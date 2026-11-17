"""Photos -> 3D model (.glb).

Stages:
  1. prepare_images          normalise uploads (HEIC, EXIF rotation) to JPEG
  2. reconstruct_point_cloud MASt3R: multi-view photos -> coloured 3D points
  3. build_mesh              Open3D: clean, surface-reconstruct, decimate
  4. export_glb              trimesh: write a game/browser-ready .glb

Run it by hand to test without the queue:

    python worker/pipeline.py photo1.jpg photo2.jpg ... -o model.glb
    python worker/pipeline.py --demo-sphere -o sphere.glb   # no GPU / MASt3R needed
"""

from __future__ import annotations

import argparse
import logging
import os
import shutil
import sys
from collections.abc import Callable, Sequence
from pathlib import Path

import numpy as np

log = logging.getLogger("pipeline")

WORKER_DIR = Path(__file__).resolve().parent
MAST3R_DIR = WORKER_DIR / "mast3r"

MODEL_NAME = "naver/MASt3R_ViTLarge_BaseDecoder_512_catmlpdpt_metric"
IMAGE_SIZE = 512  # MASt3R's native resolution
MIN_CONFIDENCE = 1.5  # drop points MASt3R is unsure about
# Triangle budget for the final model (roughly half as many vertices). Lower is
# lighter for multiplayer; override per run with e.g. SCAN_TARGET_TRIANGLES=3000.
TARGET_TRIANGLES = int(os.environ.get("SCAN_TARGET_TRIANGLES", "3000"))
# Smoothing passes before decimation. Photo scans are bumpy; smoothing flattens
# that noise so the decimator can collapse flat areas into a few big triangles.
# 0 turns it off; higher is flatter (and rounds sharp edges slightly more).
SMOOTH_ITERATIONS = int(os.environ.get("SCAN_SMOOTHING", "40"))
POISSON_DEPTH = 7  # surface detail before decimation (8 = finer, slower, heavier)
# Smoothing passes on the final low-poly mesh, to even out jagged vertices.
SMOOTH_FINAL_ITERATIONS = int(os.environ.get("SCAN_VERTEX_SMOOTHING", "10"))

# Called with a 0-100 percentage as the pipeline advances.
ProgressFn = Callable[[int], None]


def _ignore_progress(_percent: int) -> None:
    pass


# --------------------------------------------------------------------------
# 1. Input images
# --------------------------------------------------------------------------


def prepare_images(image_paths: Sequence[Path], work_dir: Path) -> list[str]:
    """Convert uploads to upright RGB JPEGs MASt3R can read (handles HEIC)."""
    from PIL import Image, ImageOps

    try:
        from pillow_heif import register_heif_opener

        register_heif_opener()
    except ImportError:
        log.warning("pillow-heif is not installed; HEIC/HEIF photos will fail")

    work_dir.mkdir(parents=True, exist_ok=True)
    prepared: list[str] = []
    for index, path in enumerate(image_paths, start=1):
        with Image.open(path) as source:
            # Phones store rotation in EXIF; bake it in so all views agree.
            upright = ImageOps.exif_transpose(source).convert("RGB")
        upright.thumbnail((1600, 1600))  # plenty for a 512px model
        out_path = work_dir / f"{index:02d}.jpg"
        upright.save(out_path, "JPEG", quality=95)
        prepared.append(str(out_path))
    return prepared


# --------------------------------------------------------------------------
# 2. MASt3R: photos -> point cloud
# --------------------------------------------------------------------------

_model = None


def _import_mast3r() -> None:
    """MASt3R is a git clone (not a pip package), so put it on sys.path."""
    if not (MAST3R_DIR / "mast3r").is_dir():
        raise RuntimeError(
            "MASt3R is not installed. From the repo root run: "
            "git clone --recursive https://github.com/naver/mast3r.git worker/mast3r"
        )
    if not (MAST3R_DIR / "dust3r" / "dust3r").is_dir():
        raise RuntimeError(
            "MASt3R's dust3r submodule is missing. Run: "
            "git -C worker/mast3r submodule update --init --recursive"
        )
    if str(MAST3R_DIR) not in sys.path:
        sys.path.insert(0, str(MAST3R_DIR))
    import mast3r.utils.path_to_dust3r  # noqa: F401  (puts dust3r on sys.path)


def get_device() -> str:
    import torch

    if torch.cuda.is_available():
        return "cuda"
    log.warning("CUDA is not available; MASt3R will run on the CPU (very slow)")
    return "cpu"


def load_model(device: str):
    """Load the MASt3R weights once and keep them for later jobs."""
    global _model
    if _model is None:
        _import_mast3r()
        from mast3r.model import AsymmetricMASt3R

        log.info(
            "Loading %s on %s (first run downloads the weights)...", MODEL_NAME, device
        )
        _model = AsymmetricMASt3R.from_pretrained(MODEL_NAME).to(device)
        _model.eval()
    return _model


def reconstruct_point_cloud(
    image_files: list[str], cache_dir: Path, device: str
) -> tuple[np.ndarray, np.ndarray]:
    """Run MASt3R on the photos. Returns (points Nx3, colours Nx3 in 0..1).

    This follows the flow of worker/mast3r/mast3r/demo.py
    (get_reconstructed_scene + _convert_scene_output_to_glb). If a MASt3R
    update changes those APIs, that file is the reference to compare against.
    """
    model = load_model(device)

    from dust3r.utils.device import to_numpy
    from dust3r.utils.image import load_images
    from mast3r.cloud_opt.sparse_ga import sparse_global_alignment
    from mast3r.image_pairs import make_pairs

    images = load_images(image_files, size=IMAGE_SIZE, verbose=False)
    # 3-10 photos: comparing every pair is affordable and gives the best result.
    pairs = make_pairs(images, scene_graph="complete", prefilter=None, symmetrize=True)

    cache_dir.mkdir(parents=True, exist_ok=True)
    scene = sparse_global_alignment(
        image_files,
        pairs,
        str(cache_dir),
        model,
        lr1=0.07,
        niter1=500,
        lr2=0.014,
        niter2=200,
        device=device,
        opt_depth=True,
        shared_intrinsics=False,
        matching_conf_thr=5.0,
    )

    pts3d, _depthmaps, confs = to_numpy(scene.get_dense_pts3d(clean_depth=True))
    colours = to_numpy(scene.imgs)

    points: list[np.ndarray] = []
    rgb: list[np.ndarray] = []
    for view_pts, view_conf, view_rgb in zip(pts3d, confs, colours, strict=True):
        pts = np.asarray(view_pts).reshape(-1, 3)
        col = np.asarray(view_rgb).reshape(-1, 3)
        keep = np.asarray(view_conf).reshape(-1) > MIN_CONFIDENCE
        if not (len(pts) == len(col) == len(keep)):
            raise RuntimeError(
                "MASt3R returned points, colours and confidences of different "
                "sizes. Compare with worker/mast3r/mast3r/demo.py."
            )
        points.append(pts[keep])
        rgb.append(col[keep])

    all_points = np.concatenate(points)
    all_colours = np.concatenate(rgb).astype(np.float64)
    if all_colours.max() > 1.0:  # tolerate 0..255 input
        all_colours /= 255.0
    if len(all_points) < 1000:
        raise RuntimeError(
            "Too few 3D points were reconstructed. Try more photos with more "
            "overlap, even lighting and a non-shiny item."
        )
    return all_points, np.clip(all_colours, 0.0, 1.0)


# --------------------------------------------------------------------------
# 3. Open3D: point cloud -> clean, light mesh
# --------------------------------------------------------------------------


def _close_bottom(pcd, plane: np.ndarray, voxel: float):
    """Add points across the item's footprint on the support surface.

    The camera never sees the underside, so without this Poisson leaves the
    bottom open (or trims it away as unsupported).
    """
    import open3d as o3d
    from scipy.spatial import Delaunay

    normal, d = plane[:3].copy(), float(plane[3])
    pts = np.asarray(pcd.points)
    height = pts @ normal + d  # signed distance from the support plane
    if np.median(height) < 0:  # make +normal point from the table up to the item
        normal, d, height = -normal, -d, -height

    low_part = height <= np.percentile(height, 25)
    base = pts[low_part]
    base_colour = np.asarray(pcd.colors)[low_part].mean(axis=0)

    # 2D coordinates on the plane, then fill the footprint's convex hull.
    u = np.cross(normal, [1.0, 0.0, 0.0] if abs(normal[0]) < 0.9 else [0.0, 1.0, 0.0])
    u /= np.linalg.norm(u)
    v = np.cross(normal, u)
    uv = np.column_stack([base @ u, base @ v])
    lo, hi = uv.min(axis=0), uv.max(axis=0)
    gu, gv = np.meshgrid(np.arange(lo[0], hi[0], voxel), np.arange(lo[1], hi[1], voxel))
    grid = np.column_stack([gu.ravel(), gv.ravel()])
    grid = grid[Delaunay(uv).find_simplex(grid) >= 0]
    if len(grid) == 0:
        return pcd

    origin = -d * normal  # a point on the plane
    level = voxel * 3  # same distance the plane was cut at
    fill = origin + grid[:, :1] * u + grid[:, 1:] * v + level * normal
    log.info("Closing the bottom with %d points", len(fill))

    bottom = o3d.geometry.PointCloud()
    bottom.points = o3d.utility.Vector3dVector(fill)
    bottom.colors = o3d.utility.Vector3dVector(np.tile(base_colour, (len(fill), 1)))
    return pcd + bottom


def _rotation_between(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """3x3 rotation taking unit vector a onto unit vector b."""
    c = float(a @ b)
    if c < -0.999999:  # opposite directions: turn 180 degrees about any perpendicular
        axis = np.cross(a, [1.0, 0.0, 0.0])
        if np.linalg.norm(axis) < 1e-6:
            axis = np.cross(a, [0.0, 1.0, 0.0])
        axis /= np.linalg.norm(axis)
        return 2.0 * np.outer(axis, axis) - np.eye(3)
    x, y, z = np.cross(a, b)
    skew = np.array([[0.0, -z, y], [z, 0.0, -x], [-y, x, 0.0]])
    return np.eye(3) + skew + skew @ skew / (1.0 + c)


def _largest_flat_face_up(vertices: np.ndarray) -> np.ndarray | None:
    """Fallback when no table was found: treat the biggest flat face as the bottom.

    Returns the unit vector pointing from that face towards the item, or None
    if the item has no clearly flat face (a sphere, say).
    """
    import open3d as o3d

    cloud = o3d.geometry.PointCloud()
    cloud.points = o3d.utility.Vector3dVector(vertices)
    size = float(np.linalg.norm(vertices.max(axis=0) - vertices.min(axis=0)))
    (a, b, c, d), inliers = cloud.segment_plane(
        distance_threshold=size / 150, ransac_n=3, num_iterations=1000
    )
    if len(inliers) < 0.15 * len(vertices):
        return None
    normal = np.array([a, b, c]) / np.linalg.norm([a, b, c])
    return normal if vertices.mean(axis=0) @ normal + d >= 0 else -normal


def _stand_on_bottom(vertices: np.ndarray, support: np.ndarray | None) -> np.ndarray:
    """Turn the item so its bottom faces down, rest it on y=0, centre it in x/z.

    glTF is Y-up. The bottom is the table the item stood on if we found one,
    otherwise the item's biggest flat face.
    """
    up = None
    if support is not None:
        normal = support[:3] / np.linalg.norm(support[:3])
        up = normal if vertices.mean(axis=0) @ normal + support[3] >= 0 else -normal
    else:
        up = _largest_flat_face_up(vertices)

    if up is not None:
        vertices = vertices @ _rotation_between(up, np.array([0.0, 1.0, 0.0])).T
        low, high = vertices.min(axis=0), vertices.max(axis=0)
        shift = np.array([(low[0] + high[0]) / 2, low[1], (low[2] + high[2]) / 2])
    else:
        shift = vertices.mean(axis=0)  # nothing flat to rest on: just centre it
    return vertices - shift


def _close_holes(
    vertices: np.ndarray,
    triangles: np.ndarray,
    colours: np.ndarray,
    max_fraction: float = 0.5,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Patch holes and drop unused vertices.

    Each hole gets a fan of triangles around a new point at its centre, coloured
    like the hole's rim. Holes bigger than max_fraction of the model's size are
    left alone, because a guess that large would be a made-up lump.
    """
    vertices = np.asarray(vertices, dtype=np.float64)
    triangles = np.asarray(triangles, dtype=np.int64)
    colours = np.asarray(colours, dtype=np.float64)
    n = len(vertices)

    # A rim edge has a triangle on one side only (its reverse is not in the mesh).
    edges = np.concatenate(
        [triangles[:, [0, 1]], triangles[:, [1, 2]], triangles[:, [2, 0]]]
    )
    forward = edges[:, 0] * n + edges[:, 1]
    backward = edges[:, 1] * n + edges[:, 0]
    rim = edges[~np.isin(backward, forward)]

    new_vertices: list[np.ndarray] = []
    new_colours: list[np.ndarray] = []
    new_triangles: list[tuple[int, int, int]] = []
    if len(rim):
        parent: dict[int, int] = {}

        def find(x: int) -> int:
            root = x
            while parent.get(root, root) != root:
                root = parent[root]
            while x != root:  # shorten the path for next time
                parent[x], x = root, parent.get(x, x)
            return root

        # Rim edges that share a vertex belong to the same hole.
        for a, b in rim:
            ra, rb = find(int(a)), find(int(b))
            if ra != rb:
                parent[ra] = rb
        holes: dict[int, list[tuple[int, int]]] = {}
        for a, b in rim:
            holes.setdefault(find(int(a)), []).append((int(a), int(b)))

        size = float(np.linalg.norm(np.ptp(vertices, axis=0)))
        next_index = n
        for hole in holes.values():
            ids = np.unique(np.array(hole).ravel())
            if np.linalg.norm(np.ptp(vertices[ids], axis=0)) > max_fraction * size:
                continue
            new_vertices.append(vertices[ids].mean(axis=0))
            new_colours.append(colours[ids].mean(axis=0))
            # Reversed edge direction keeps the new triangles facing the same way.
            new_triangles.extend((b, a, next_index) for a, b in hole)
            next_index += 1
        log.info("Patched %d hole(s) along %d rim edges", len(new_vertices), len(rim))

    if new_vertices:
        vertices = np.vstack([vertices, new_vertices])
        colours = np.vstack([colours, new_colours])
        triangles = np.vstack([triangles, np.array(new_triangles, dtype=np.int64)])

    used = np.unique(triangles)  # drops stray vertices no triangle uses
    remap = np.full(len(vertices), -1, dtype=np.int64)
    remap[used] = np.arange(len(used))
    return vertices[used], remap[triangles], colours[used]


def _smooth_vertices(
    vertices: np.ndarray,
    triangles: np.ndarray,
    iterations: int,
    lam: float = 0.5,
    mu: float = -0.53,
) -> np.ndarray:
    """Taubin smoothing on the finished mesh.

    Each pass nudges every vertex towards the average of its neighbours, then
    slightly back out so the model doesn't shrink. Evens out jagged vertices.
    """
    if iterations <= 0:
        return vertices
    from scipy import sparse

    n = len(vertices)
    edges = np.concatenate(
        [triangles[:, [0, 1]], triangles[:, [1, 2]], triangles[:, [2, 0]]]
    )
    # Each edge in both directions, so neighbours are symmetric (this also
    # covers open boundaries, where only one triangle has the edge).
    a = np.concatenate([edges[:, 0], edges[:, 1]])
    b = np.concatenate([edges[:, 1], edges[:, 0]])
    adjacency = sparse.coo_matrix((np.ones(len(a)), (a, b)), shape=(n, n)).tocsr()
    adjacency.data[:] = 1.0  # an edge shared by two triangles was counted twice
    degree = np.maximum(np.asarray(adjacency.sum(axis=1)).ravel(), 1.0)
    average = sparse.diags(1.0 / degree) @ adjacency  # mean of each vertex's neighbours

    smoothed = np.array(vertices, dtype=np.float64)
    for _ in range(iterations):
        for factor in (lam, mu):
            smoothed += factor * (average @ smoothed - smoothed)
    return smoothed


def build_mesh(
    points: np.ndarray, colours: np.ndarray, report: ProgressFn = _ignore_progress
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Returns (vertices Nx3, triangles Mx3, vertex colours Nx3 in 0..1)."""
    import open3d as o3d

    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(points.astype(np.float64))
    pcd.colors = o3d.utility.Vector3dVector(colours.astype(np.float64))

    # Pick sizes relative to the cloud, because MASt3R's scale varies per scan.
    # Percentiles ignore stray far-away points when measuring the size.
    low, high = np.percentile(points, [1, 99], axis=0)
    voxel = float(np.linalg.norm(high - low)) / 300
    if voxel <= 0:
        raise RuntimeError("The reconstructed point cloud has no extent")

    support = None  # plane (a, b, c, d) of the table, if we cut one away
    # Remove the table/floor the item sits on, if one dominates the scan.
    plane, _ = pcd.voxel_down_sample(voxel).segment_plane(
        distance_threshold=voxel * 3, ransac_n=3, num_iterations=2000
    )
    a, b, c, d = plane
    pts = np.asarray(pcd.points)
    on_plane = np.abs(pts @ np.array([a, b, c]) + d) < voxel * 3
    if on_plane.mean() > 0.4:  # only if a big flat surface is most of the cloud
        log.info("Removing support plane (%.0f%% of points)", on_plane.mean() * 100)
        support = np.array([a, b, c, d])
        pcd = pcd.select_by_index(np.where(~on_plane)[0])
        low, high = np.percentile(np.asarray(pcd.points), [1, 99], axis=0)
        voxel = float(np.linalg.norm(high - low)) / 300
        if voxel <= 0:
            raise RuntimeError("Nothing was left after removing the support surface")

    log.info("Cleaning %d points (voxel %.5f)...", len(pcd.points), voxel)
    pcd = pcd.voxel_down_sample(voxel)
    # Stray dots floating in the air.
    pcd, _ = pcd.remove_statistical_outlier(nb_neighbors=20, std_ratio=2.0)
    # Keep the largest connected blob; drops detached background fragments.
    labels = np.asarray(pcd.cluster_dbscan(eps=voxel * 4, min_points=20))
    if labels.size and labels.max() >= 0:
        largest = np.bincount(labels[labels >= 0]).argmax()
        pcd = pcd.select_by_index(np.where(labels == largest)[0])
    if len(pcd.points) < 500:
        raise RuntimeError("Not enough points left after cleaning the scan")
    if support is not None:
        pcd = _close_bottom(pcd, support, voxel)
    report(65)

    log.info("Estimating normals on %d points...", len(pcd.points))
    pcd.estimate_normals(
        search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=voxel * 3, max_nn=30)
    )
    # Point every normal away from the middle of the item. Works for compact
    # items (boxes, shoes, bottles); a deep hollow (mug interior) would need
    # orient_normals_consistent_tangent_plane(k=15) instead.
    centre = pcd.get_center()
    normals = np.asarray(pcd.normals)
    flip = ((np.asarray(pcd.points) - centre) * normals).sum(axis=1) < 0
    normals[flip] *= -1
    pcd.normals = o3d.utility.Vector3dVector(normals)
    report(72)

    log.info("Poisson surface reconstruction...")
    mesh, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
        pcd, depth=POISSON_DEPTH
    )
    # Poisson closes every gap by inference, which is what gives a fully covered
    # model. Only drop the sparsest 0.5% (stray bubbles), anything that bulges
    # outside the photographed region, and loose fragments.
    densities = np.asarray(densities)
    mesh.remove_vertices_by_mask(densities < np.quantile(densities, 0.005))
    seen = np.asarray(pcd.points)
    margin = voxel * 3
    mesh = mesh.crop(
        o3d.geometry.AxisAlignedBoundingBox(
            seen.min(axis=0) - margin, seen.max(axis=0) + margin
        )
    )
    clusters, sizes, _ = mesh.cluster_connected_triangles()
    clusters, sizes = np.asarray(clusters), np.asarray(sizes)
    if len(sizes) > 1:
        mesh.remove_triangles_by_mask(clusters != sizes.argmax())
    mesh.remove_degenerate_triangles()
    mesh.remove_unreferenced_vertices()
    log.info("Mesh is %s", "watertight" if mesh.is_watertight() else "not fully closed")
    report(80)

    if SMOOTH_ITERATIONS > 0:
        log.info("Smoothing surfaces (%d passes)...", SMOOTH_ITERATIONS)
        mesh = mesh.filter_smooth_taubin(number_of_iterations=SMOOTH_ITERATIONS)

    if len(mesh.triangles) > TARGET_TRIANGLES:
        log.info(
            "Decimating %d -> %d triangles...", len(mesh.triangles), TARGET_TRIANGLES
        )
        mesh = mesh.simplify_quadric_decimation(
            target_number_of_triangles=TARGET_TRIANGLES
        )
    if len(mesh.triangles) == 0:
        raise RuntimeError("Surface reconstruction produced an empty mesh")

    vertices = np.asarray(mesh.vertices)
    triangles = np.asarray(mesh.triangles)
    vertex_colours = (
        np.asarray(mesh.vertex_colors)
        if mesh.has_vertex_colors()
        else np.full((len(vertices), 3), 0.7)
    )
    vertices, triangles, vertex_colours = _close_holes(
        vertices, triangles, vertex_colours
    )
    vertices = _smooth_vertices(vertices, triangles, SMOOTH_FINAL_ITERATIONS)
    # Bottom down, resting on y=0, centred in x/z.
    vertices = _stand_on_bottom(np.asarray(vertices), support)
    report(85)
    return vertices, triangles, vertex_colours


# --------------------------------------------------------------------------
# 4. Export
# --------------------------------------------------------------------------


def export_glb(
    vertices: np.ndarray, triangles: np.ndarray, colours: np.ndarray, out_path: Path
) -> None:
    """Write a .glb with vertex colours (trimesh keeps colours reliably)."""
    import trimesh

    mesh = trimesh.Trimesh(
        vertices=vertices,
        faces=triangles,
        vertex_colors=(np.clip(colours, 0.0, 1.0) * 255).astype(np.uint8),
        process=False,
    )
    # Computing normals makes trimesh write them, so a low-poly model shades
    # smoothly in the game instead of looking faceted.
    _ = mesh.vertex_normals
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # Write to a temp name first so nothing ever sees a half-written model.
    tmp_path = out_path.with_name(out_path.name + ".tmp")
    mesh.export(tmp_path, file_type="glb")
    os.replace(tmp_path, out_path)


# --------------------------------------------------------------------------
# Entry points
# --------------------------------------------------------------------------


def run_pipeline(
    image_paths: Sequence[Path],
    output_glb: Path,
    report: ProgressFn = _ignore_progress,
) -> None:
    """Photos in, .glb out. Raises on failure with a message fit for users."""
    work_dir = output_glb.parent / "work"
    try:
        report(3)
        files = prepare_images(image_paths, work_dir / "images")
        report(8)
        points, colours = reconstruct_point_cloud(
            files, work_dir / "mast3r-cache", get_device()
        )
        report(60)
        vertices, triangles, vertex_colours = build_mesh(points, colours, report)
        export_glb(vertices, triangles, vertex_colours, output_glb)
        report(95)
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


def _synthetic_sphere(count: int = 60_000) -> tuple[np.ndarray, np.ndarray]:
    """A noisy coloured sphere plus stray points, to exercise build_mesh."""
    rng = np.random.default_rng(0)
    directions = rng.normal(size=(count, 3))
    directions /= np.linalg.norm(directions, axis=1, keepdims=True)
    sphere = directions * 0.15 + rng.normal(scale=0.001, size=(count, 3))
    strays = rng.uniform(-1.0, 1.0, size=(500, 3))
    points = np.concatenate([sphere, strays])
    colours = np.clip(points / 0.3 + 0.5, 0.0, 1.0)
    return points, colours


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("images", nargs="*", type=Path, help="photos of one item")
    parser.add_argument("-o", "--output", type=Path, default=Path("model.glb"))
    parser.add_argument(
        "--demo-sphere",
        action="store_true",
        help="skip MASt3R and mesh a synthetic sphere (tests Open3D + GLB export)",
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")

    if args.demo_sphere:
        points, colours = _synthetic_sphere()
        export_glb(*build_mesh(points, colours), args.output)
    elif args.images:
        run_pipeline(args.images, args.output, report=lambda p: log.info("%d%%", p))
    else:
        parser.error("give some photos, or use --demo-sphere")
    log.info("Wrote %s", args.output)


if __name__ == "__main__":
    main()

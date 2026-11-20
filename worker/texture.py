"""Bake dense surface colors onto a 1024px atlas without requiring a GPU.

Nearest-surface sampling avoids ray misses on thin/concave surfaces. It can still
transfer the wrong side's color where simplification moves surfaces together.
"""

import logging
import os
import subprocess
import time
from pathlib import Path

import numpy as np

log = logging.getLogger("pipeline")
TEXTURE_SIZE = 1024


def bake_atlas(vertices, faces, uv, dense, size=TEXTURE_SIZE):
    import open3d as o3d
    from scipy.ndimage import distance_transform_edt

    scene = o3d.t.geometry.RaycastingScene()
    scene.add_triangles(
        o3d.core.Tensor(dense["vertices"].astype(np.float32)),
        o3d.core.Tensor(dense["triangles"].astype(np.uint32)),
    )
    atlas = np.zeros((size, size, 3), dtype=np.float32)
    positions = np.empty_like(atlas)
    covered = np.zeros((size, size), dtype=bool)
    dense_faces = dense["triangles"]
    colors = dense["colours"]
    # Blender UVs start at the bottom, while PNG rows start at the top.
    pixels = uv * [size, -size] + [0, size]
    for face in faces:
        xy = pixels[face]
        low = np.maximum(np.floor(xy.min(axis=0)).astype(int), 0)
        high = np.minimum(np.ceil(xy.max(axis=0)).astype(int), size - 1)
        if np.any(high < low):
            continue
        xx, yy = np.meshgrid(
            np.arange(low[0], high[0] + 1), np.arange(low[1], high[1] + 1)
        )
        query = np.column_stack((xx.ravel() + 0.5, yy.ravel() + 0.5))
        matrix = np.column_stack((xy[1] - xy[0], xy[2] - xy[0]))
        if abs(np.linalg.det(matrix)) < 1e-10:
            continue
        weights = (query - xy[0]) @ np.linalg.inv(matrix).T
        inside = (weights >= -1e-7).all(axis=1) & (weights.sum(axis=1) <= 1 + 1e-7)
        weights = weights[inside]
        if not len(weights):
            continue
        bary = np.column_stack((1 - weights.sum(axis=1), weights))
        x, y = xx.ravel()[inside], yy.ravel()[inside]
        positions[y, x] = bary @ vertices[face]
        covered[y, x] = True
    y, x = np.nonzero(covered)
    if not len(y):
        raise ValueError("UV unwrap produced no covered texture pixels")
    for start in range(0, len(y), 65536):
        rows, cols = y[start : start + 65536], x[start : start + 65536]
        hit = scene.compute_closest_points(o3d.core.Tensor(positions[rows, cols]))
        ids = hit["primitive_ids"].numpy()
        st = hit["primitive_uvs"].numpy()
        weights = np.column_stack((1 - st.sum(axis=1), st))
        atlas[rows, cols] = (colors[dense_faces[ids]] * weights[:, :, None]).sum(axis=1)
    # Fill unused pixels with nearby island color to prevent dark mip seams.
    nearest = distance_transform_edt(
        ~covered, return_distances=False, return_indices=True
    )
    atlas[~covered] = atlas[nearest[0][~covered], nearest[1][~covered]]
    if not np.isfinite(atlas).all():
        raise ValueError("Non-finite baked texture colors")
    return np.rint(np.clip(atlas, 0, 1) * 255).astype(np.uint8), float(covered.mean())


def export_textured_glb(vertices, triangles, dense, output: Path, work: Path):
    import trimesh
    from PIL import Image

    started = time.monotonic()
    work.mkdir(parents=True, exist_ok=True)
    source, unwrapped = work / "unwrap-input.npz", work / "unwrap-output.npz"
    np.savez(source, vertices=vertices, triangles=triangles)
    subprocess.run(
        [
            os.environ.get("BLENDER_BIN", "blender"),
            "--background",
            "-noaudio",
            "--factory-startup",
            "--python-exit-code",
            "1",
            "--python",
            str(Path(__file__).with_name("unwrap_texture.py")),
            "--",
            str(source.resolve()),
            str(unwrapped.resolve()),
        ],
        check=True,
        timeout=120,
    )
    with np.load(unwrapped) as data:
        uv, indices = data["uv"], data["indices"]
    if len(indices) != triangles.size or not np.array_equal(indices, triangles.ravel()):
        raise ValueError("UV unwrap changed mesh topology")
    # Split only vertices whose UVs differ on opposite sides of a seam.
    _, first, inverse = np.unique(
        np.column_stack((indices, uv)), axis=0, return_index=True, return_inverse=True
    )
    indices, uv = indices[first], uv[first]
    corners = vertices[indices]
    faces = inverse.reshape(-1, 3)
    atlas, coverage = bake_atlas(corners, faces, uv, dense)
    material = trimesh.visual.material.PBRMaterial(
        baseColorTexture=Image.fromarray(atlas), metallicFactor=0.0, roughnessFactor=0.8
    )
    original = trimesh.Trimesh(vertices=vertices, faces=triangles, process=False)
    mesh = trimesh.Trimesh(
        vertices=corners,
        faces=faces,
        vertex_normals=original.vertex_normals[indices],
        process=False,
    )
    mesh.visual = trimesh.visual.TextureVisuals(uv=uv, material=material)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(output.name + ".tmp")
    mesh.export(temporary, file_type="glb")
    os.replace(temporary, output)
    log.info(
        "Texture bake: %dx%d, %.1f%% atlas coverage, %.2fs, %d bytes",
        TEXTURE_SIZE,
        TEXTURE_SIZE,
        coverage * 100,
        time.monotonic() - started,
        output.stat().st_size,
    )

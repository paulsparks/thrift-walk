"""Verify dense color detail and UV orientation after a real Blender/GLB round trip."""

import tempfile
from pathlib import Path

import numpy as np
import trimesh

from texture import export_textured_glb


def verify(work):
    corners = np.array(
        [[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [1.0, 1.0, 0.0], [0.0, 1.0, 0.0]]
    )
    faces = np.array([[0, 1, 2], [0, 2, 3]])
    center = [0.65, 0.35, 0.0]
    dense = dict(
        vertices=np.vstack((corners, center)),
        triangles=np.array([[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]]),
        colours=np.array([[0.0, 0.0, 1.0]] * 4 + [[1.0, 0.0, 0.0]]),
    )
    path = work / "texture.glb"
    export_textured_glb(corners, faces, dense, path, work)
    model = trimesh.load(path, force="mesh", process=False)
    assert len(model.faces) == 2 and model.visual.kind == "texture"
    image = model.visual.material.baseColorTexture
    assert image.size == (1024, 1024)
    for point, channel in [(center, 0), ([0.98, 0.02, 0.0], 2)]:
        face = next(
            f
            for f in model.faces
            if np.allclose(
                model.vertices[f].mean(axis=0), corners[faces[0]].mean(axis=0)
            )
        )
        weights = trimesh.triangles.points_to_barycentric(
            model.vertices[face][None], [point]
        )[0]
        u, v = weights @ model.visual.uv[face]
        pixel = image.getpixel((int(u * image.width), int((1 - v) * image.height)))
        assert pixel[channel] > 230, (point, pixel)
    print(
        f"Texture smoke passed: 2 triangles, 1024x1024 embedded texture, "
        f"interior red detail and blue edge verified, {path.stat().st_size} bytes"
    )


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        verify(Path(tmp))

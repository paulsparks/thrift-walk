"""Exercise Blender's GLB importer and CPU renderer while building the image."""
import tempfile
from pathlib import Path

import trimesh
from PIL import Image

from preview import generate_preview


with tempfile.TemporaryDirectory() as tmp:
    model = Path(tmp) / "model.glb"
    mesh = trimesh.creation.icosphere(subdivisions=2)
    mesh.visual.vertex_colors = [200, 80, 40, 255]
    mesh.export(model)
    with Image.open(generate_preview(model)) as image:
        assert image.size == (800, 800) and image.mode == "RGBA"
        assert image.getchannel("A").getextrema() == (0, 255), "Missing object or transparent background"
        assert image.getchannel("R").getextrema()[1] > 30, "Preview is blank or nearly black"
    print("GLB preview smoke test passed")

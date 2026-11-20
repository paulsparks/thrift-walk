"""Generate the UI preview after reconstruction and before publishing a scan."""

import os
import subprocess
from pathlib import Path

from PIL import Image


def generate_preview(model: Path) -> Path:
    destination = model.with_name("preview.png")
    subprocess.run(
        [
            os.environ.get("BLENDER_BIN", "blender"),
            "--background",
            "-noaudio",
            "--factory-startup",
            "--python-exit-code",
            "1",
            "--python",
            str(Path(__file__).with_name("render_preview.py")),
            "--",
            str(model.resolve()),
            str(destination.resolve()),
        ],
        check=True,
        timeout=180,
    )
    with Image.open(destination) as image:
        if image.size != (800, 800) or image.mode != "RGBA":
            raise ValueError("Preview must be an 800x800 RGBA PNG")
    return destination

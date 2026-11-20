"""One isolated scan per Runpod invocation; no database credentials on the GPU."""
import hashlib
import json
import os
import tempfile
from pathlib import Path
from urllib.parse import urlsplit

import requests

ORIGIN = os.environ.get("SCAN_APP_ORIGIN", "").rstrip("/")
_origin = urlsplit(ORIGIN)
if (_origin.scheme != "https" or not _origin.hostname or _origin.username is not None
        or _origin.password is not None or _origin.path or _origin.query or _origin.fragment):
    raise ValueError("SCAN_APP_ORIGIN must be an HTTPS origin without a path, credentials, query or fragment")
MAX_PHOTO_BYTES = 10 * 1024 * 1024


def checked_url(value):
    if not isinstance(value, str):
        raise ValueError("Missing transfer URL")
    url = urlsplit(value)
    if (url.scheme != "https" or url.netloc != urlsplit(ORIGIN).netloc
            or not url.path.startswith("/api/scan-transfer/") or url.fragment):
        raise ValueError("Transfer URL must belong to the configured app")
    return value


def transfer(method, url, **kwargs):
    # Never follow redirects with signed URLs, and never log their secrets.
    response = requests.request(method, checked_url(url), allow_redirects=False,
                                timeout=(15, 120), **kwargs)
    if not 200 <= response.status_code < 300:
        response.close()
        raise RuntimeError(f"File transfer returned HTTP {response.status_code}")
    return response


def handler(job):
    import runpod
    from pipeline import run_pipeline
    from preview import generate_preview

    data = job.get("input", {})
    photos = data.get("photos")
    if not isinstance(photos, list) or not 3 <= len(photos) <= 10:
        raise ValueError("A scan requires 3 to 10 photos")
    outputs = data.get("outputs", {})
    for url in [*photos, *(outputs.get(k) for k in ("model.glb", "preview.png", "result.json"))]:
        checked_url(url)
    with tempfile.TemporaryDirectory(prefix="scan-") as tmp:
        root = Path(tmp)
        paths = []
        for i, url in enumerate(photos):
            # DUSt3R filters filenames by extension before opening with Pillow.
            suffix = Path(urlsplit(url).path).suffix.lower()
            if suffix not in (".jpg", ".jpeg", ".png", ".heic", ".heif"):
                raise ValueError("Unsupported photo format")
            path = root / f"photo-{i}{suffix}"
            with transfer("GET", url, stream=True) as response, path.open("wb") as out:
                size = 0
                for chunk in response.iter_content(1024 * 1024):
                    size += len(chunk)
                    if size > MAX_PHOTO_BYTES:
                        raise ValueError("Photo exceeds 10 MiB")
                    out.write(chunk)
            paths.append(path)
        model = root / "model.glb"
        run_pipeline(paths, model, report=lambda p: runpod.serverless.progress_update(job, {"progress": p}))
        generate_preview(model)
        manifest = {}
        for name in ("model.glb", "preview.png"):
            path = root / name
            manifest[name] = hashlib.sha256(path.read_bytes()).hexdigest()
            with path.open("rb") as stream:
                transfer("PUT", outputs[name], data=stream).close()
        # Durable completion receipt survives Runpod's short result retention.
        transfer("PUT", outputs["result.json"], data=json.dumps(manifest).encode()).close()
        return {"uploaded": True}


if __name__ == "__main__":
    import runpod
    import torch
    from pipeline import load_model

    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is required; refusing slow CPU fallback")
    load_model("cuda")
    runpod.serverless.start({"handler": handler})

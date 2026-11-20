"""CPU-only dispatcher. Run exactly one alongside the app; never run worker-s with it.

Claims and journals are one transaction. A lost submit response is NOT retried:
its receipt may still arrive; otherwise the scan fails after its one-hour TTL.
"""
import hashlib
import hmac
import json
import logging
import os
import re
import time
from pathlib import Path
from urllib.parse import urlencode, quote, urlsplit, urlunsplit, parse_qsl

import psycopg
import requests

log = logging.getLogger("runpod-dispatcher")
ORIGIN = os.environ.get("SCAN_APP_ORIGIN", "").rstrip("/")
_origin = urlsplit(ORIGIN)
if (_origin.scheme != "https" or not _origin.hostname or _origin.username is not None
        or _origin.password is not None or _origin.path or _origin.query or _origin.fragment):
    raise ValueError("SCAN_APP_ORIGIN must be an HTTPS origin without a path, credentials, query or fragment")
LOCK_ID = 684391572
TTL = 3600


def postgres_url(url):
    """Remove Prisma's schema option, which psycopg/libpq does not accept."""
    parts = urlsplit(url)
    query = [(key, value) for key, value in parse_qsl(parts.query) if key != "schema"]
    return urlunsplit(parts._replace(query=urlencode(query)))


def signed_url(secret, method, job_id, filename, expires):
    if not re.fullmatch(r"[A-Za-z0-9_-]+", job_id) or not re.fullmatch(r"[A-Za-z0-9.-]+", filename):
        raise ValueError("Invalid transfer path")
    message = f"{method}\n{job_id}\n{filename}\n{expires}"
    token = hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()
    return f"{ORIGIN}/api/scan-transfer/{job_id}/{filename}?" + urlencode({"expires": expires, "token": token})


def receipt_valid(folder):
    try:
        manifest = json.loads((folder / "result.json").read_text())
        for name in ("model.glb", "preview.png"):
            if hashlib.sha256((folder / name).read_bytes()).hexdigest() != manifest[name]:
                return False
        model = (folder / "model.glb").read_bytes()
        preview = (folder / "preview.png").read_bytes()
        return model[:4] == b"glTF" and preview[:8] == b"\x89PNG\r\n\x1a\n"
    except (OSError, ValueError, KeyError, TypeError):
        return False


def finish(conn, root, job_id, photos):
    conn.execute('UPDATE scan_job SET status=\'Completed\', progress=100, "glbPath"=%s, "updatedAt"=now() WHERE id=%s AND status=\'Processing\'', (f"{job_id}/model.glb", job_id))
    for rel in photos:
        path = (root / rel).resolve()
        if path.is_relative_to(root):
            path.unlink(missing_ok=True)
    conn.execute('UPDATE scan_job SET "imagePaths"=\'{}\' WHERE id=%s AND status=\'Completed\'', (job_id,))


def fail(conn, job_id, message):
    # Preserve photos for investigation; user can delete the failed scan.
    conn.execute('UPDATE scan_job SET status=\'Failed\', error=%s, "updatedAt"=now() WHERE id=%s AND status=\'Processing\'', (message, job_id))


def tick(conn, root, endpoint, secret, session):
    base = f"https://api.runpod.ai/v2/{endpoint}"
    rows = conn.execute('''SELECT j.id, j."imagePaths", d.remote_id,
        extract(epoch from d.expires_at)::bigint FROM scan_job j
        JOIN scan_runpod_dispatch d ON d.job_id=j.id WHERE j.status='Processing' ''').fetchall()
    for job_id, photos, remote_id, expires in rows:
        if receipt_valid(root / job_id):
            finish(conn, root, job_id, photos)
            continue
        if time.time() > expires + 60:
            fail(conn, job_id, "Cloud scan expired before a complete model was received. Please try a new scan.")
            continue
        if not remote_id:
            continue  # ambiguous submission: wait for durable receipt, never resubmit
        try:
            response = session.get(f"{base}/status/{quote(remote_id, safe='')}", timeout=30)
            if response.status_code == 404:
                continue  # result retention may have elapsed; receipt/TTL handles it
            response.raise_for_status()
            result = response.json()
        except (requests.RequestException, ValueError):
            log.warning("Status temporarily unavailable for scan %s", job_id)
            continue
        status = result.get("status")
        if status in ("FAILED", "CANCELLED", "TIMED_OUT"):
            fail(conn, job_id, "Cloud reconstruction failed. Please try a new scan.")
        elif status == "COMPLETED":
            # Uploads may have finished between the first receipt check and poll.
            if receipt_valid(root / job_id):
                finish(conn, root, job_id, photos)
            else:
                fail(conn, job_id, "Cloud worker finished without valid model and preview files.")
        elif status == "IN_PROGRESS":
            output = result.get("output")
            progress = output.get("progress", 5) if isinstance(output, dict) else 5
            if isinstance(progress, int):
                conn.execute('UPDATE scan_job SET progress=GREATEST(progress,%s), "updatedAt"=now() WHERE id=%s', (min(95, max(1, progress)), job_id))
    # Resume cleanup after a crash between publishing and deleting originals.
    for job_id, photos in conn.execute('''SELECT j.id,j."imagePaths" FROM scan_job j
        JOIN scan_runpod_dispatch d ON d.job_id=j.id
        WHERE j.status='Completed' AND cardinality(j."imagePaths")>0''').fetchall():
        finish(conn, root, job_id, photos)
    active = conn.execute("SELECT count(*) FROM scan_job j JOIN scan_runpod_dispatch d ON d.job_id=j.id WHERE j.status='Processing'").fetchone()[0]
    for _ in range(max(0, 3 - active)):
        # Durable journal precedes the network request. Restart never re-submits it.
        with conn.transaction():
            row = conn.execute('''SELECT id,"imagePaths" FROM scan_job WHERE status='Pending'
                AND cardinality("imagePaths")>0 ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED''').fetchone()
            if not row:
                break
            job_id, photos = row
            expires = int(time.time()) + TTL
            conn.execute('UPDATE scan_job SET status=\'Processing\', progress=1, "updatedAt"=now() WHERE id=%s', (job_id,))
            conn.execute("INSERT INTO scan_runpod_dispatch(job_id,expires_at) VALUES (%s,to_timestamp(%s))", (job_id, expires))
        if not 3 <= len(photos) <= 10 or any(Path(p).parent.as_posix() != job_id for p in photos):
            fail(conn, job_id, "A scan requires 3 to 10 valid photos.")
            continue
        payload = {
            "input": {
                "photos": [signed_url(secret, "GET", job_id, Path(p).name, expires + 60) for p in photos],
                "outputs": {name: signed_url(secret, "PUT", job_id, name, expires + 60) for name in ("model.glb", "preview.png", "result.json")},
            },
            "policy": {"executionTimeout": 1200000, "ttl": TTL * 1000},
        }
        try:
            response = session.post(f"{base}/run", json=payload, timeout=30)
            response.raise_for_status()
            remote_id = response.json()["id"]
            if not isinstance(remote_id, str) or not remote_id:
                raise ValueError("Missing remote id")
            conn.execute("UPDATE scan_runpod_dispatch SET remote_id=%s WHERE job_id=%s", (remote_id, job_id))
            log.info("Submitted scan %s", job_id)
        except (requests.RequestException, ValueError, KeyError):
            log.warning("Submission unconfirmed for %s; waiting for receipt or expiry without retrying", job_id)


def main():
    logging.basicConfig(level=logging.INFO)
    secret = os.environ["SCAN_TRANSFER_SECRET"]
    if len(secret) < 32:
        raise ValueError("SCAN_TRANSFER_SECRET must contain at least 32 characters")
    endpoint = os.environ["RUNPOD_ENDPOINT_ID"]
    if not re.fullmatch(r"[A-Za-z0-9_-]+", endpoint):
        raise ValueError("Invalid endpoint id")
    root = Path(os.environ["SCAN_STORAGE_DIR"]).resolve()
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        database_url = "postgresql://thriftwalk:" + quote(os.environ["POSTGRES_PASSWORD"], safe="") + "@postgres:5432/thriftwalk"
    with requests.Session() as session, psycopg.connect(postgres_url(database_url), autocommit=True) as conn:
        session.headers["Authorization"] = "Bearer " + os.environ["RUNPOD_API_KEY"]
        if not conn.execute("SELECT pg_try_advisory_lock(%s)", (LOCK_ID,)).fetchone()[0]:
            raise RuntimeError("Another Runpod dispatcher is already running")
        # Losing this DB connection exits the process, releasing the singleton lock.
        while True:
            tick(conn, root, endpoint, secret, session)
            time.sleep(5)


if __name__ == "__main__":
    main()

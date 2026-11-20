"""Queue worker for 3D scans.

The web app (web/src/app/api/scan/route.ts) creates a ScanJob row, saves the
photos under SCAN_STORAGE_DIR and pushes {"jobId": ...} onto a Redis list.
This process pops job ids, runs pipeline.run_pipeline and records progress,
the finished model's path, or an error on the ScanJob row.

Once a scan finishes (or fails) its uploaded photos are deleted; only the
finished model is kept. Failed scans and abandoned uploads are cleaned up
automatically (see expire_stale).

Run it with `worker-s` (from the repo root) so secretspec injects
DATABASE_URL, REDIS_URL and SCAN_STORAGE_DIR.

It is written for a single worker process.
"""

from __future__ import annotations

import json
import logging
import os
import re
import shutil
import sys
import time
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import psycopg
import redis

from pipeline import run_pipeline
from preview import generate_preview

# Must match SCAN_QUEUE in web/src/lib/scan-config.ts
QUEUE = "scan:jobs"
POP_TIMEOUT_SECONDS = 5
JOB_ID = re.compile(r"[A-Za-z0-9_-]+")

# Failed scans are removed after this many days (0 keeps them until the user
# deletes them). Finished models are never expired automatically.
FAILED_RETENTION_DAYS = int(os.environ.get("SCAN_FAILED_RETENTION_DAYS", "7"))
# A job that never got its photos (the web server died mid-upload) is abandoned
# after this long. Left alone it would count against the user's active limit.
ABANDONED_UPLOAD_HOURS = 1
CLEANUP_INTERVAL_SECONDS = 3600

log = logging.getLogger("worker")


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        sys.exit(
            f"{name} is not set. Start the worker with `worker-s` so "
            "secretspec injects it."
        )
    return value


def postgres_url(url: str) -> str:
    """DATABASE_URL carries Prisma's `?schema=public`, which libpq rejects."""
    parts = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(parts.query) if k != "schema"]
    return urlunsplit(parts._replace(query=urlencode(query)))


# --- ScanJob table access ---------------------------------------------------
# Columns keep their camelCase names, so they need quoting. Writes bypass
# ZenStack here (plain SQL), which is why ScanJob has no client write policies.


def claim(conn: psycopg.Connection, job_id: str) -> list[str] | None:
    """Atomically move Pending -> Processing. None if it isn't ours to run."""
    row = conn.execute(
        """
        UPDATE scan_job
        SET status = 'Processing', progress = 1, error = NULL, "updatedAt" = now()
        WHERE id = %s AND status = 'Pending'
        RETURNING "imagePaths"
        """,
        (job_id,),
    ).fetchone()
    return list(row[0]) if row else None


def set_progress(conn: psycopg.Connection, job_id: str, percent: int) -> None:
    conn.execute(
        'UPDATE scan_job SET progress = %s, "updatedAt" = now() WHERE id = %s',
        (percent, job_id),
    )


def complete(conn: psycopg.Connection, job_id: str, glb_path: str) -> None:
    conn.execute(
        """
        UPDATE scan_job
        SET status = 'Completed', progress = 100, "glbPath" = %s, "updatedAt" = now()
        WHERE id = %s
        """,
        (glb_path, job_id),
    )


def fail(conn: psycopg.Connection, job_id: str, message: str) -> None:
    conn.execute(
        """
        UPDATE scan_job
        SET status = 'Failed', error = %s, "updatedAt" = now()
        WHERE id = %s
        """,
        (message[:500], job_id),
    )


def discard_photos(
    conn: psycopg.Connection,
    storage_root: Path,
    job_id: str,
    image_paths: list[str],
) -> None:
    """Delete the uploaded originals once a scan is done; only the model stays.

    Never raises for file problems: a leftover photo must not turn a finished
    scan into a failed one.
    """
    try:
        for rel in image_paths:
            path = (storage_root / rel).resolve()
            if path.is_relative_to(storage_root):
                path.unlink(missing_ok=True)
        conn.execute(
            """UPDATE scan_job SET "imagePaths" = '{}' WHERE id = %s""", (job_id,)
        )
    except OSError:
        log.warning("Could not delete the photos for %s", job_id, exc_info=True)


def remove_job_folders(storage_root: Path, job_ids: list[str]) -> None:
    for job_id in job_ids:
        if JOB_ID.fullmatch(job_id):
            shutil.rmtree(storage_root / job_id, ignore_errors=True)


def expire_stale(conn: psycopg.Connection, storage_root: Path) -> None:
    """Remove abandoned uploads and (optionally) old failed scans."""
    abandoned = conn.execute(
        """
        DELETE FROM scan_job
        WHERE status = 'Pending'
          AND cardinality("imagePaths") = 0
          AND "createdAt" < now() - make_interval(hours => %s)
        RETURNING id
        """,
        (ABANDONED_UPLOAD_HOURS,),
    ).fetchall()
    remove_job_folders(storage_root, [row[0] for row in abandoned])

    failed: list[tuple[str]] = []
    if FAILED_RETENTION_DAYS > 0:
        failed = conn.execute(
            """
            DELETE FROM scan_job
            WHERE status = 'Failed'
              AND "updatedAt" < now() - make_interval(days => %s)
            RETURNING id
            """,
            (FAILED_RETENTION_DAYS,),
        ).fetchall()
        remove_job_folders(storage_root, [row[0] for row in failed])

    if abandoned or failed:
        log.info(
            "Cleaned up %d abandoned upload(s) and %d old failed scan(s)",
            len(abandoned),
            len(failed),
        )


def recover(conn: psycopg.Connection, queue: redis.Redis) -> None:
    """On startup, re-queue work that a crash or a Redis wipe left behind.

    Harmless if a job is already queued: claim() only lets one pop run it.
    Jobs without photos yet are mid-upload, so they are left alone.
    """
    conn.execute(
        """
        UPDATE scan_job
        SET status = 'Pending', progress = 0, "updatedAt" = now()
        WHERE status = 'Processing'
        """
    )
    rows = conn.execute(
        """
        SELECT id FROM scan_job
        WHERE status = 'Pending' AND cardinality("imagePaths") > 0
        ORDER BY "createdAt"
        """
    ).fetchall()
    # LPUSH oldest-first so the oldest ends up at the BRPOP end of the list.
    for (job_id,) in rows:
        queue.lpush(QUEUE, json.dumps({"jobId": job_id}))
    if rows:
        log.info("Re-queued %d unfinished scan(s)", len(rows))


# --- Running one job --------------------------------------------------------


def process(conn: psycopg.Connection, storage_root: Path, job_id: str) -> None:
    image_paths = claim(conn, job_id)
    if image_paths is None:
        log.info("Skipping %s (not pending)", job_id)
        return
    if not image_paths:
        fail(conn, job_id, "No photos were attached to this scan.")
        return

    log.info("Processing %s (%d photos)", job_id, len(image_paths))
    started = time.monotonic()
    try:
        photos = [(storage_root / rel).resolve() for rel in image_paths]
        if not all(p.is_relative_to(storage_root) for p in photos):
            raise ValueError("A photo path points outside the storage folder")

        run_pipeline(
            photos,
            storage_root / job_id / "model.glb",
            report=lambda percent: set_progress(conn, job_id, percent),
        )
        generate_preview(storage_root / job_id / "model.glb")
        complete(conn, job_id, f"{job_id}/model.glb")
        discard_photos(conn, storage_root, job_id, image_paths)
        log.info("Finished %s in %.0fs", job_id, time.monotonic() - started)
    except psycopg.OperationalError:
        raise  # database went away: let the outer loop reconnect and recover
    except Exception as exc:  # noqa: BLE001 - any failure should fail the job, not the worker
        log.exception("Scan %s failed", job_id)
        fail(conn, job_id, f"{type(exc).__name__}: {exc}")
        discard_photos(conn, storage_root, job_id, image_paths)


def parse_job_id(payload: str) -> str | None:
    try:
        job_id = json.loads(payload)["jobId"]
    except (ValueError, KeyError, TypeError):
        return None
    return job_id if isinstance(job_id, str) and JOB_ID.fullmatch(job_id) else None


def main() -> None:
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s"
    )
    storage_root = Path(require_env("SCAN_STORAGE_DIR")).resolve()
    database_url = postgres_url(require_env("DATABASE_URL"))
    queue = redis.Redis.from_url(
        require_env("REDIS_URL"),
        decode_responses=True,
        # BRPOP needs time to return an empty result before the socket expires.
        socket_timeout=POP_TIMEOUT_SECONDS + 5,
        socket_connect_timeout=5,
    )

    log.info("Worker started; storage at %s", storage_root)
    try:
        while True:
            try:
                with psycopg.connect(database_url, autocommit=True) as conn:
                    recover(conn, queue)
                    log.info("Waiting for scans on %s...", QUEUE)
                    last_cleanup = float("-inf")
                    while True:
                        if time.monotonic() - last_cleanup > CLEANUP_INTERVAL_SECONDS:
                            expire_stale(conn, storage_root)
                            last_cleanup = time.monotonic()
                        item = queue.brpop([QUEUE], timeout=POP_TIMEOUT_SECONDS)
                        if item is None:
                            continue
                        job_id = parse_job_id(item[1])
                        if job_id is None:
                            log.warning("Ignoring malformed queue item: %r", item[1])
                            continue
                        process(conn, storage_root, job_id)
            except (
                psycopg.OperationalError,
                redis.ConnectionError,
                redis.TimeoutError,
            ) as exc:
                log.warning("Lost a connection (%s); retrying in 3s", exc)
                time.sleep(3)
    except KeyboardInterrupt:
        log.info("Stopping")


if __name__ == "__main__":
    main()

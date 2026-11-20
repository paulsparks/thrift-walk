# Runpod scans

This integration runs one 3–10-photo MASt3R reconstruction per GPU worker.
The CPU dispatcher stays on the app server, polls PostgreSQL, and submits up to
three scans. Runpod runs 0–3 workers. Only signed photo/output URLs leave the
app server; database credentials and the transfer signing secret stay there.

## Build and publish

The existing queue endpoint is `thrift-walk-scans` (`rzkm43jcdkixzj`). Its v3 worker uses the 1024×1024 UV texture bake. [endpoint.json](endpoint.json) records the pinned image and scaling configuration. Normal Ubuntu updates reuse this endpoint and image.

For a **worker code change**, build from the checkout root using a fresh version tag, run the image build's CPU texture and preview smoke tests, then publish the tested image. For example, for the release following v3:

```sh
image=ghcr.io/paulsparks/thrift-walk-worker:runpod-v4
docker build --platform linux/amd64 -f worker/Dockerfile.runpod -t "$image" .
docker push "$image"
```

Use the digest printed by the successful push to update only the image on the existing endpoint. Preserve the private registry credential, worker environment, GPU selection, North American data centers, and 0–3 worker limits. Read back the endpoint image and record the same digest in `endpoint.json`. Keep the previous digest for rollback. The app host does not pull or build this GPU image.

The Dockerfile pins MASt3R source and model revisions and includes weights at `/opt/model`, Blender, Open3D, CUDA/PyTorch and compiled RoPE kernels. The endpoint has 20 GB container disk for runtime files and needs no persistent GPU volume.

## App-server configuration

Use the existing deployment directory layout in the [Ubuntu deployment guide](../README.md).
Set these in its private `.env.production` (do not commit or paste credentials):

- `RUNPOD_API_KEY`: key permitted to invoke the selected endpoint.
- `RUNPOD_ENDPOINT_ID`: the existing endpoint ID.
- `SCAN_APP_ORIGIN`: required public HTTPS app origin, with no default.
  Set the same environment variable on the
  Runpod endpoint's GPU workers. Use an origin only (no path,
  credentials, query or fragment); a trailing slash is accepted. For example:
  `SCAN_APP_ORIGIN=https://app.example.com`.
- `SCAN_TRANSFER_SECRET`: dedicated random secret, at least 32 characters.
  Generate it locally with `openssl rand -hex 32`.
- `SCANS_DIR`: optional path; defaults to `./storage/scans` beside the main Compose file.

The four runtime variables above are also declared in both `secretspec.toml`
profiles for commands launched through SecretSpec. They are optional in those
profiles because local scans do not need Runpod; the Runpod Compose overlay and
processes require them. Declarations do not populate `.env.production` or the
Runpod endpoint automatically. `SCANS_DIR` is a Compose-only host path setting;
the application uses `SCAN_STORAGE_DIR` inside the container instead.

Prepare the scan directory owned by UID/GID 1000:1000, mode 750. It is shared
between web and dispatcher and must be backed up. Existing scans must be copied
here before switching backends. Stop the old local `worker-s`; it must not run
alongside the Runpod dispatcher because its recovery logic assumes sole ownership.
The database migration adds a private `scan_runpod_dispatch` journal table.

Select the base and overlay files with `COMPOSE_FILE` in `.env.production` as shown in the Ubuntu guide. Use that same env file on every Compose invocation:

```sh
docker compose --env-file .env.production config -q
docker compose --env-file .env.production config --services
docker compose --env-file .env.production up -d --build --wait
```

The dispatcher acquires a PostgreSQL
advisory lock so a second dispatcher cannot submit duplicate jobs. It exits on
DB connection loss; Compose restarts it and it resumes polling journaled jobs.
The web and dispatcher must use exactly the same transfer secret.

The worker is restricted to `${SCAN_APP_ORIGIN}/api/scan-transfer/`.
Both Python processes read the variable at startup; restart them after changing
it. Compose reads it from `.env.production`; direct Python execution needs it
exported in the shell (Python does not load `.env` files automatically).
Transfer URLs expire after the one-hour queue/execution TTL plus a minute. Do
not log query strings for this route in a proxy or observability service.
The normal job execution limit is 20 minutes, including downloads and previews.
The signed upload route streams bounded files to a temporary name, then renames
atomically. The worker uploads a checksum receipt last; the dispatcher verifies
both artifacts before publishing the scan. This receipt survives Runpod's result
retention window. Original photos are removed only after success. Failed scans
retain photos until the user deletes the scan.

If the submit response is lost, the dispatcher waits for the receipt or TTL and
never auto-resubmits an uncertain request. The UI may remain Processing until
expiry in that case. After expiry users can submit a new scan. Pending scans
remain in the DB when three are already outstanding. Uploaded files with no
image paths from an interrupted browser upload still require ordinary stale
upload maintenance; the dispatcher does not delete abandoned user records.

## Verification

```sh
.devenv/state/venv/bin/python -m unittest discover -s worker -p 'test_runpod*.py'
cd web
pnpm exec tsx --test scripts/scan-transfer.test.ts
pnpm run typecheck
```

After the app and endpoint are deployed, submit one real 3–10-photo scan through
the app. Confirm Completed, download the GLB, view its preview, and verify that
originals are removed. Submit two scans to verify isolation. Observe worker count
returning to zero after the five-second idle window, and never exceeding three.
GPU memory sizing (24 GB VRAM) remains provisional until that live test passes.
An image build and mocked adapter tests do not establish reconstruction quality.

# Deploy Thrift Walk on Ubuntu

## Choose the deployment directory

Use an x86-64 Ubuntu server with Docker Engine, Buildx, the Compose plugin, Git LFS, and OpenSSL. Follow [Docker’s Ubuntu installation instructions](https://docs.docker.com/engine/install/ubuntu/). No GPU, Nix, Godot, or Node installation is required on the app host. The initial build downloads Godot export templates, JavaScript packages, and fonts. Budget at least 15 GB free for builds, plus space for PostgreSQL, uploads, and backups. Run builds before stopping a working release.

Keep using the directory, Compose project name, bind paths, and Caddy volumes that already own your data. Two layouts are supported:

| Layout | Working directory for Compose | Source checkout | Setting in private `.env.production` |
| --- | --- | --- | --- |
| Default server layout | Parent containing `docker-compose.yaml`, `.env.production`, and `thrift-walk/` | `./thrift-walk` | Compose defaults to this checkout |
| In-checkout opt-in | Repository root | `.` | Run `deploy/configure.sh --in-checkout` to use this layout |

All paths below are relative to the **Compose working directory**. For upgrades, skip initial configuration and follow **Update an existing server** below. The Ubuntu build needs the release's committed source and LFS objects. Local staged or untracked changes are absent from a server-side Git checkout.

## Fresh install

Point the domain's A record to the server. Publish an AAAA record only if IPv6 reaches the server. Allow TCP 80/443 to Caddy through both firewalls; UDP 443 enables HTTP/3. Keep the database, web, and game ports private. If another proxy already owns ports 80/443, retain your existing ingress configuration.

Install the host tools with `sudo apt install git git-lfs openssl` and confirm `docker compose version` and `docker buildx version` succeed. For a checkout at `/opt/thriftwalk/thrift-walk`, run:

```sh
cd /opt/thriftwalk
git -C thrift-walk lfs install --local
git -C thrift-walk lfs pull
./thrift-walk/deploy/configure.sh market.example.com you@example.com
sudo chown 1000:1000 storage/images storage/scans
sudo chmod 750 storage/images storage/scans
```

The script resolves the deployment directory from the checkout location, regardless of your shell’s working directory. It puts `docker-compose.yaml`, `.env.production`, `config/`, `database/`, and `storage/` together in `/opt/thriftwalk`. It copies the Compose and Caddy templates only when missing. With an existing top-level `.env.production`, run `./thrift-walk/deploy/configure.sh` without arguments to prepare missing directories using the existing configuration. Keep any existing `storage/models/`; the scan overlay defaults to the separate `storage/scans/` directory.

On first install the script creates a mode-600 `.env.production`, three independent credentials, `config/Caddyfile`, and host storage directories. It refuses to overwrite the env file. Protect and back up that file. Caddy uses the copied configuration in `config/`. PostgreSQL 18 stores its cluster under the `./database` bind mount at `/var/lib/postgresql`. The setup script creates the mount parent with mode 0711 so the container’s postgres user can traverse it. The image manages the private cluster directory beneath it. If a previous setup created the mount parent with mode 0700 and startup logs show a permission error at /var/lib/postgresql, run `sudo chmod a+x ./database` from the Compose directory (substitute your actual DATABASE_DIR if customized), then `docker compose --env-file .env.production up -d --wait`. Apply the change only to the mount parent. The web and dispatcher containers use UID:GID 1000:1000.

### Enable cloud scanning

The base stack provides the website and multiplayer game. **Enable the Runpod overlay for scan uploads and access to stored scan files.** The overlay starts one CPU dispatcher and mounts the same scan directory into web and dispatcher. It needs no Redis or GPU on Ubuntu. The base stack alone returns HTTP 503 for a new scan upload.

Add the following to the private `.env.production` using an editor. Supply real values for the key, transfer secret, and public origin:

```dotenv
# /opt/thriftwalk/.env.production
COMPOSE_FILE=docker-compose.yaml:thrift-walk/deploy/runpod/compose.yaml
RUNPOD_ENDPOINT_ID=rzkm43jcdkixzj
RUNPOD_API_KEY=<key with access to invoke and poll this endpoint>
SCAN_APP_ORIGIN=https://market.example.com
SCAN_TRANSFER_SECRET=<output of openssl rand -hex 32>
```

For the in-checkout layout, use `COMPOSE_FILE=docker-compose.yaml:deploy/runpod/compose.yaml`. Keeping the file list in the env file applies the same services to startup, updates, backups, and maintenance. Match `SCAN_APP_ORIGIN` to the **production HTTPS origin** on both the dispatcher and the existing Runpod endpoint. A previous local tunnel URL must be updated on the endpoint at cutover. That endpoint serves one origin at a time. Runpod must be able to reach the signed transfer URLs through your ingress without an interactive login. See the [worker deployment guide](runpod/README.md) for GPU image updates. A website deployment does not require publishing a GPU image.

Optional env settings include `DATABASE_DIR`, `IMAGES_DIR`, and `SCANS_DIR` for existing absolute bind paths. Create those exact directories first. For password recovery configure `RESET_EMAIL_WEBHOOK_URL` and `RESET_EMAIL_WEBHOOK_SECRET` for a service that delivers the email. Google sign-in uses `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the callback `https://market.example.com/api/auth/callback/google`.

### Start and check

Define this shell function again when opening a new SSH session. Run it from the Compose working directory:

```sh
dc() { docker compose --env-file .env.production "$@"; }
dc config -q
dc config --services
dc build
dc up -d --wait --wait-timeout 300
dc ps -a
dc logs --tail=60 migrate web game caddy
```

The Runpod configuration must list `scan-dispatcher` in `dc config --services`. Avoid publishing full rendered Compose config or signed URLs in logs. The `migrate` container must exit 0 before web starts. The internal web probe uses the shared game credential. Caddy deliberately returns 404 for public `/api/health`. Game waits for web, then Caddy waits for both. Check `dc ps scan-dispatcher` and `dc logs --tail=40 scan-dispatcher` if using the overlay.

### First administrator and acceptance checks

Sign up at `/sign-up`. New users reach the approval prompt. The migration grants approval to existing Admin accounts so they can issue invitations. For a database without an admin, register the intended operator's account first, verify its identity, then open:

```sh
dc exec postgres psql -U thriftwalk -d thriftwalk
```

At the psql prompt, enter the exact email when asked, verify the returned ID, and use that ID in the second prompt:

```sql
\prompt 'Operator email: ' email
SELECT id, email, role, approved FROM "user" WHERE email = :'email';
\prompt 'Verified operator ID: ' uid
UPDATE "user" SET role = 'Admin', approved = true
WHERE id = :'uid' AND email = :'email' RETURNING id, email, role, approved;
\q
```

Verify exactly one updated account. Open **Profile → Approval Codes** and generate a code. In another browser session, sign up, redeem that code, and open the originally requested page. The code disappears from the admin list on refresh. Unused codes can be copied or deleted and have no expiration date. A signed-out request to `/api/market/session` should return 401; an unapproved session returns 403. Confirm an approved account can open `/play`, join the game, and load listing media. Both browser and dedicated exports come from the same Godot build. On a clean import the Tiny Store FBX references five missing PavingStones127/Concrete025 texture files and Godot skips them. The existing Next.js build also reports a ZenStack dynamic-require warning. Both exports and the standalone web image built with these warnings during the deployment rehearsal.

For cloud scans, upload 3–10 photos as an approved user. Check that the job completes and its GLB and preview remain available after web/dispatcher recreation. A real submission invokes the paid endpoint. A healthy web container alone does not verify public TLS, callback reachability, or GPU reconstruction.

## Update an existing server

1. Record the running source revision and image IDs (`dc images`), the Compose files, bind paths, and project name. Preserve any locally customized Caddyfile or Compose settings. For older in-checkout deployments add `THRIFT_SOURCE_DIR=.` to the existing env file. Keep existing credentials, especially the database password. Changing its env value alone does not change the PostgreSQL role password.
2. Drain pending and processing scans before maintenance. Pause new uploads and check the queue in PostgreSQL with `SELECT status, count(*) FROM scan_job GROUP BY status;`. When moving from a local worker or another host, copy the entire previous scan root to the configured scan bind path, preserving per-job directories. Stop the old worker before starting the dispatcher. If old data lives in named volumes, restore it into the target bind paths first.
3. Take a consistent backup as described below. Fetch the desired release in the source checkout and run `git lfs pull`. In a separate deployment directory, merge the release’s `thrift-walk/docker-compose.yaml` into the active parent `docker-compose.yaml`. Compare the checkout’s `deploy/Caddyfile` with your active `config/Caddyfile`. In particular, the web health probe must send its service credential. Add the overlay/env settings above when enabling Runpod. Create the scan directory and set ownership and permissions as in the fresh install.
4. Run `dc config -q`, check `dc config --services`, then `dc build`. A failed build leaves the running containers in place. For cutover, stop the app services as in the backup procedure, take a final consistent backup if writes resumed, then run `dc up -d --wait --wait-timeout 300` and repeat the acceptance checks. PostgreSQL migrations run automatically. Existing non-admin users need approval after this upgrade.
5. If startup fails, inspect `dc ps -a` and `dc logs --tail=100 migrate web game caddy` plus dispatcher logs. Preserve failed migration details. For rollback use the matching previous source/configuration and images. If the old app is incompatible with a migrated schema, restore the pre-upgrade database and files to fresh paths before restarting it. Retain the original paths through verification.

Ordinary `dc down` and recreation preserve host data and named volumes. `down -v` removes Caddy’s certificate/config volumes. Keep PostgreSQL on major version 18 until a planned major upgrade. Run `dc run --rm cleanup` periodically to remove old unattached marketplace images and expired rate-limit buckets. Keep one game server and one dispatcher per database.

## Backup and restore

Run these commands in Bash from the configured deployment directory. The web container reads the actual image and scan mounts, including custom host paths. Quiesce writes and drain cloud jobs first. Pause scheduled cleanup during backup. The following backup leaves app services stopped so you can perform maintenance or restart them after verifying the archive:

```sh
set -e
umask 077
backup="backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup"
dc stop caddy game
if dc config --services | grep -qx scan-dispatcher; then dc stop scan-dispatcher; fi
dc stop web
dc exec -T postgres pg_dump -U thriftwalk -d thriftwalk -Fc > "$backup/database.dump"
dc run --rm --no-deps -T --entrypoint tar web -C /data/media -czf - . > "$backup/images.tgz"
if dc config --services | grep -qx scan-dispatcher; then
  dc run --rm --no-deps -T --entrypoint tar web -C /data/scans -czf - . > "$backup/scans.tgz"
fi
cp .env.production docker-compose.yaml config/Caddyfile "$backup/"
dc exec -T postgres pg_restore --list < "$backup/database.dump" > /dev/null
gzip -t "$backup"/*.tgz
# After a backup-only maintenance window:
dc up -d --wait --wait-timeout 300
```

Copy the private backup off-server. Also preserve any custom overlays, the exact source revision, and Caddy named volumes if you want to retain issued certificates. Protect the dump as credential-bearing data. If scan storage exists on a previous host or outside the configured mounts, archive it separately before switching.

Restore into a **fresh deployment directory and empty database/media/scan paths**, using the original release, Compose project settings and saved environment. Check custom bind paths in the restored env before starting anything. Restore the saved Caddyfile to `config/Caddyfile`. Prepare bind directory permissions as above. With `backup` pointing to the chosen archive:

```sh
dc config -q
dc build
dc up -d --wait postgres
dc exec -T postgres pg_restore --exit-on-error --no-owner -U thriftwalk -d thriftwalk < "$backup/database.dump"
dc run --rm --no-deps -T --entrypoint tar web -C /data/media -xzf - < "$backup/images.tgz"
if dc config --services | grep -qx scan-dispatcher; then
  dc run --rm --no-deps -T --entrypoint tar web -C /data/scans -xzf - < "$backup/scans.tgz"
fi
dc up -d --wait --wait-timeout 300
dc ps -a
```

Recheck login, approval, listings, game admission, and a stored scan preview. If startup fails after restoring, inspect the one-shot migration logs before opening traffic. A fresh PostgreSQL 18 cluster must mount the parent `/var/lib/postgresql`. Migrations on startup bring the restored schema to the selected release.

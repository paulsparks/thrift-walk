# Deploy Thrift Walk on Ubuntu

This deployment builds and runs the complete application from this checkout. You
need Docker Engine with the **Compose plugin** (`docker compose`), Git LFS, a
public domain, and an **x86-64/amd64 Ubuntu server**. No Nix, local Node.js, Godot,
or SecretSpec installation is needed. Allow 15 GB of free disk space and
at least 4 GB of RAM for the initial build; a small VPS may need swap. Builds
need outbound access to package registries, Godot releases, and Google Fonts.
The first build downloads roughly 1.2 GB of Godot export templates in addition
to container images and JavaScript dependencies; later builds reuse Docker's cache.

## 1. Prepare the server

Install Docker Engine and its Compose/Buildx plugins using
[Docker's Ubuntu instructions](https://docs.docker.com/engine/install/ubuntu/).
Then install the small host-side prerequisites:

```sh
sudo apt update
sudo apt install git git-lfs openssl
sudo systemctl enable --now docker
```

Use `sudo docker` in the commands below if your account cannot access Docker.
Do not install the obsolete Python `docker-compose` package.

Clone this repository and check out the revision you want to deploy. All of the
new deployment/application files must be committed or copied to that checkout.
From the repository root:

```sh
git lfs install
git lfs pull
```

The image build rejects unresolved LFS pointers instead of exporting a game
with missing models/textures. Do not copy your local `.godot`, `node_modules`,
`.next`, development `.env`, or old game exports; Docker rebuilds them.

The existing Tiny Store FBX references five absent `PavingStones127`/`Concrete025`
texture files. Godot reports these during a clean import and skips those textures;
they are not a Docker download failure.

Set your domain's DNS **A** record to the server's public IPv4 address. Only add
an **AAAA** record if IPv6 actually reaches this server. Allow inbound **TCP 80
and 443** in the hosting-provider firewall and the server firewall. UDP 443 is
optional for HTTP/3. Nothing else needs a public port. Caddy must own those ports;
stop/reconfigure an existing nginx/Apache/Caddy instance if necessary.

## 2. Configure and start

Replace the example domain and email:

```sh
./deploy/configure.sh market.example.com you@example.com
sudo chown 1000:1000 storage/images
sudo chmod 750 storage/images
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps -a
docker compose --env-file .env.production logs -f --tail=100 migrate web game caddy
```

The configuration script creates **`.env.production`**, mode `600`, with three
independent random secrets. It refuses to overwrite an existing file. Keep this
file private and back it up. It is ignored by Git and excluded from Docker's
build context. No production secrets are embedded in the images/browser export.
The runtime entrypoint URL-encodes the database password automatically.

The configuration script also prepares this layout beside the Compose file:

```text
config/
  Caddyfile
database/
docker-compose.yaml
storage/
  images/
  models/
```

`./database` is bind-mounted at `/var/lib/postgresql` (PostgreSQL 18 keeps
its cluster beneath that directory). `./storage/images` is bind-mounted at
`/data/media` in both the web and cleanup containers. Both run as UID/GID
`1000:1000`, so the image directory needs the ownership shown above. PostgreSQL's
entrypoint manages its own data-directory permissions. Missing bind directories
cause startup to fail instead of silently creating root-owned upload directories.
`storage/models` is reserved; current game models are built into the game exports.
Caddy reads `config/Caddyfile`; its certificates still use named volumes.

If you already generated `.env.production`, prepare the directories separately:

```sh
mkdir -p config database storage/images storage/models
# Copy the template only if you do not already have a Caddyfile.
test -e config/Caddyfile || cp deploy/Caddyfile config/Caddyfile
sudo chown 1000:1000 storage/images
sudo chmod 750 storage/images
```

These paths are relative to the Compose file. Building from source still requires
the repository's Dockerfile, `game`, `web`, and `deploy` files alongside this layout.
Existing data in the previous named volumes is **not automatically moved**:
back it up using the old configuration and restore it into the new bind mounts
before switching a populated deployment. Keep the old volumes until verified.

On first startup, `migrate` applies all committed migrations with
`zen migrate deploy`. Next.js starts only after that succeeds; Godot and Caddy
wait for application health. `migrate` showing **Exited (0)** is expected. No
seed/demo accounts are created. Register your own account at:

- `https://market.example.com/sign-up`
- `https://market.example.com/play`

Caddy obtains and renews its TLS certificate automatically. The first certificate
may take a short time to issue. If it fails, check DNS, TCP 80/443 reachability,
and `docker compose --env-file .env.production logs caddy`.

### Optional account integrations

Edit `.env.production` to configure `RESET_EMAIL_WEBHOOK_URL` and
`RESET_EMAIL_WEBHOOK_SECRET` for password recovery. The endpoint receives
`{ to, name, resetUrl }` with a bearer credential and must actually send email.
Until configured, password-recovery email delivery is unavailable.

Google login is optional: set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and
register `https://market.example.com/api/auth/callback/google` with Google.
Apply environment changes with `docker compose --env-file .env.production up -d`.

## What runs

| Service | Purpose | Persistence / exposure |
| --- | --- | --- |
| `postgres` | PostgreSQL 18 | `./database` bind mount; no host port |
| `migrate` | One-shot production migrations | Must succeed before web starts |
| `web` | Next.js standalone server | `./storage/images` bind mount; private port 3000 |
| `game` | Headless Godot dedicated server | Private WebSocket port 8080 |
| `caddy` | HTTPS and WebSocket reverse proxy | Public 80/443; certificate/config volumes |
| `cleanup` | Optional one-shot media maintenance | Only started explicitly |

Caddy serves normal requests through Next.js and forwards `/game-socket` to
Godot. Both exports are built by the same pinned Godot 4.7.2 stage, so deployed
browser/server protocols match. Game assets use `Cache-Control: no-cache` to
revalidate after deployments. Existing open browser tabs still need a refresh
when game code changes.

The dedicated server calls `http://thrift-web:3000` over the private Compose
network. This alias also meets Godot's minimum HTTP hostname length.
`THRIFT_ALLOW_INTERNAL_HTTP=true` permits this **only for dedicated-server API
requests**. Browser/native client transport restrictions remain unchanged;
public connections use HTTPS/WSS. The database has its own internal network.
Caddy does not expose `/api/health`, which checks database/migration readiness.

Next.js and Godot run as unprivileged users. The PostgreSQL password is runtime
configuration; the shared game secret is supplied only to Next.js and the
headless server. Do not scale `game` beyond one instance: admission/presence and
the demo world currently assume a single authoritative game server.

## Updates and operations

From the same directory, using the same `.env.production` and Compose project:

```sh
# Back up first, especially when the update includes database migrations.
git pull --ff-only
git lfs pull
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps -a
```

This rebuilds the matching exports, reruns pending migrations, and replaces
changed containers. Plan a short interruption and refresh browser game tabs.
Do not update only the game container or only its browser export.

Useful commands:

```sh
# Stop while retaining all data.
docker compose --env-file .env.production down

# Start again (or after a reboot; services also have restart policies).
docker compose --env-file .env.production up -d

# Remove unattached images older than 24 hours and expired rate-limit buckets.
docker compose --env-file .env.production run --rm cleanup
```

Run cleanup daily, for example from your server's scheduler, with the repository
as the working directory. The cleanup command is safe alongside normal uploads.

**`down -v` deletes Caddy's certificate/config volumes.** It does not remove
`database` or `storage/images`; those are host directories. Ordinary `down`,
container recreation, and image rebuilds retain both bind-mounted data and named volumes. PostgreSQL is pinned to major version 18;
changing major versions requires a planned database upgrade/restore, not just
changing the image tag. Do not rotate `POSTGRES_PASSWORD` in the env file alone
for an existing database: update the database role password too.

## Backup and restore

Back up the database, uploaded media and `.env.production` together. A database
backup by itself does not contain uploaded image bytes. These commands briefly
stop application writes so the database and image archive are consistent:

```sh
mkdir -p backups
chmod 700 backups
umask 077
docker compose --env-file .env.production stop caddy game web
docker compose --env-file .env.production exec -T postgres \
  pg_dump -U thriftwalk -d thriftwalk -Fc > backups/database.dump
docker compose --env-file .env.production run --rm --no-deps -T \
  --entrypoint tar cleanup -C /data/media -czf - . > backups/media.tar.gz
cp .env.production backups/environment
docker compose --env-file .env.production start web game caddy
```

Copy backups off the server. Use dated directories/files for repeated backups.
Caddy's certificate volume may also be backed up; otherwise Caddy can obtain
new certificates after restore, subject to certificate-authority rate limits.

To restore into a **fresh stack**, restore the protected environment file first,
then build the images and start only PostgreSQL:

```sh
cp backups/environment .env.production
chmod 600 .env.production
mkdir -p config database storage/images storage/models
test -e config/Caddyfile || cp deploy/Caddyfile config/Caddyfile
sudo chown 1000:1000 storage/images
sudo chmod 750 storage/images
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d --wait postgres
docker compose --env-file .env.production exec -T postgres \
  pg_restore -U thriftwalk -d thriftwalk --no-owner < backups/database.dump
docker compose --env-file .env.production run --rm --no-deps -T \
  --entrypoint tar cleanup -C /data/media -xzf - < backups/media.tar.gz
docker compose --env-file .env.production up -d
```

The normal startup migration job applies any newer migrations after restore.
These restore commands assume an empty target database/image directories.

## Local container smoke test

Production configuration defaults to public HTTPS. For an isolated loopback
smoke test, use a separate env file with disposable secrets and these overrides:

```dotenv
PUBLIC_ORIGIN=http://localhost:19080
CADDY_SITE_ADDRESS=http://localhost
ACME_EMAIL=test@example.com
BIND_IP=127.0.0.1
HTTP_PORT=19080
HTTPS_PORT=19443
DATABASE_DIR=/tmp/thrift-deploy-test/database
IMAGES_DIR=/tmp/thrift-deploy-test/images
POSTGRES_PASSWORD=disposable-test-password
BETTER_AUTH_SECRET=disposable-test-auth-secret-at-least-32-characters
GAME_SERVER_SECRET=disposable-test-game-secret-at-least-32-characters
```

Start it with `docker compose --env-file /path/to/test.env -p thrift-deploy-test
up -d --build`. Visit `http://localhost:19080`. Use a separate project name to
isolate Caddy volumes from production. Bind mounts are **not isolated by project
name**: use the separate absolute paths above, create them before starting, and
set the test images directory to UID/GID `1000:1000`. Prepare `config/Caddyfile`
as shown above. Public deployments must use HTTPS.

References: [Next.js Docker deployment](https://docs.docker.com/guides/nextjs/),
[Caddy WebSocket proxying](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy),
[PostgreSQL 18 volume layout](https://docs.docker.com/guides/postgresql/immediate-setup-and-data-persistence/).

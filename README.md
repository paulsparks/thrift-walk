# Thrift Walk

## Ubuntu deployment with Docker Compose

Follow the [Ubuntu deployment guide](deploy/README.md) for first install, upgrades,
first-admin setup, backups, and restore. It covers both an in-checkout install
and a server with the Compose file one directory above the checkout. For 3D
scans, enable the [Runpod overlay](deploy/runpod/README.md) before starting
the app. The Ubuntu server runs the CPU dispatcher; reconstruction runs on the
existing GPU endpoint. Keep PostgreSQL, image storage, scan storage, and the
private deployment environment together in backups.

## Getting Started with Development

### Prerequisites

The following environment configuration is necessary:

- Linux or [WSL 2](https://learn.microsoft.com/en-us/windows/wsl/about)
- [Nix Package Manager](https://nixos.org/download/)
- [Devenv](https://devenv.sh/getting-started/)

Install the recommended VSCode workspace extensions (under `./.vscode/extensions.json`).
These are necessary for formatting, linting, Typescript integration, Godot integration, etc.

### Environment Activation

See [Prerequisites](#prerequisites) for the necessary system dependencies.

Once you are in an environment with Nix and devenv installed, you can run `devenv shell` to activate the environment. Devenv will do this automatically if you [enable auto activation](https://devenv.sh/auto-activation/).

### Project-Specific Setup

#### Web

The project needs some background services (like Postgres) to operate fully.
These can be started by running `devenv up -d` to start the _services_ in a
detached state. These can be stopped by running `devenv processes down`.

Configure `secretspec` by running `secretspec config init` and select `env`, then `development` as the profile using the interactive prompt. Then run the following `secretspec config provider add env "env://"` and `secretspec config provider add dotenv "dotenv://"`.

Once you have the necessary background services running and secretspec configured, the application can be started in development mode by applying database migrations with `pnpm-s migrate` and then running `pnpm-s dev`. Note that the `pnpm-s` command is the same as the normal `pnpm` command, but with secrets injected into its environment via `secretspec`. Only commands that need secrets should be run with `secretspec run -- <cmd>` and/or `pnpm-s`.

The development profile uses `http://localhost:9000` as the public origin. With
Next.js running on port 3000, start the temporary proxy from the repository root:

```sh
secretspec run -- node scripts/dev-proxy.mjs
```

Open [http://localhost:9000](http://localhost:9000). The same proxy forwards
`/game-socket` to the dedicated Godot server on port 8080. See the storefront
guide below for server setup and browser export instructions.

After signing in, users enter a six-digit approval code to unlock their account.
Approved admins can generate, copy, and delete unused codes in **Profile → Approval Codes**. Codes stay valid until
redeemed, and each code approves one account. The approval migration enables
existing admins. On a fresh database, sign up first, then have the database
operator set that specific account’s role to Admin and its approved flag to true.

#### Worker (3D scanning)

Uploaded item photos are turned into `.glb` models by a Python worker in
`worker/` (MASt3R for reconstruction, Open3D for cleanup and meshing). The web
app queues local development jobs in Redis. The Runpod deployment uses PostgreSQL instead. A CUDA GPU is strongly
recommended; MASt3R on CPU takes minutes per scan. On WSL 2 the GPU comes from
the Windows NVIDIA driver, so no Linux driver install is needed.

One-time setup, from the repo root inside `devenv shell`:

```bash
# MASt3R (and its DUSt3R submodule), pinned as a git submodule.
git submodule update --init --recursive
# If your checkout has no worker/mast3r gitlink, install the worker image's pinned revision:
if [ ! -f worker/mast3r/requirements.txt ]; then
  git clone https://github.com/naver/mast3r.git worker/mast3r
  git -C worker/mast3r checkout f5209afc300cec36239a7ac992263f36847bbba0
  git -C worker/mast3r submodule update --init --recursive
fi

# PyTorch first. Pick the build that matches your CUDA version from
# https://pytorch.org/get-started/locally/ (cu128 shown here).
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128

pip install -r worker/mast3r/requirements.txt
pip install -r worker/mast3r/dust3r/requirements.txt
pip install -r worker/requirements.txt
```

Then, with `devenv up -d` running, start the worker with `worker-s`. Scan photos
and finished models are stored in `SCAN_STORAGE_DIR` (see `secretspec.toml`); it
defaults to a folder under `/tmp`, which may be cleared on restart, so point it
somewhere permanent to keep your scans. The MASt3R model weights download from
Hugging Face on first use.

Model size and smoothness can be tuned with environment variables when starting
the worker, for example `SCAN_TARGET_TRIANGLES=2000 worker-s`:

- `SCAN_TARGET_TRIANGLES`: triangle budget (default 3000)
- `SCAN_SMOOTHING`: surface smoothing before simplification (default 40, 0 = off)
- `SCAN_VERTEX_SMOOTHING`: final smoothing of the low-poly mesh (default 10, 0 = off)

Note that MASt3R's code and weights are released for non-commercial use.

Python code in `worker/` is formatted and linted with [ruff](https://docs.astral.sh/ruff/)
(configured in `worker/ruff.toml`; MASt3R is excluded). It's included in the
devenv shell, and the recommended VS Code extension formats on save. To run it
by hand:

```bash
ruff format worker
ruff check --fix worker
```

#### Store items from scans

In **My Stores → Add item** (or **Edit**), choose **3D scan model** and select
one of your completed scans. Image items still use a picture frame; scan items
use the model itself, including during placement, with the same item inspection
and listing controls. Models rest on the lobby table; image frames go on the
display wall. While placing a model, scroll the mouse wheel to rotate it in
15° steps, then click to place. Models retain their proportions. Changing media type returns
an already-placed item to inventory so it can be placed on the correct surface. A scan attached to an item cannot be deleted until
the item is changed or removed.

Apply the database migration from `web/` with `pnpm-s exec zen migrate deploy`
and rebuild the browser/dedicated game exports when updating an existing setup.
The web server and worker must share `SCAN_STORAGE_DIR`: listed models are
served from there; unattached scans remain private.

The worker UV-unwraps the simplified mesh with Blender and bakes the dense surface
colors into a 1024×1024 base-color texture embedded in the GLB.
The worker uses Blender (included in `devenv`, or set `BLENDER_BIN`) to render
an 800×800 transparent PNG after reconstruction, before marking the scan complete.
Each scan stores `<id>/model.glb` and `<id>/preview.png`. The PNG is used in the
store, scan picker, profile, and game inventory/details. To backfill an existing
model without rerunning reconstruction, run from `worker/`:
`python -c 'from pathlib import Path; from preview import generate_preview; generate_preview(Path("/path/to/scan/model.glb"))'`.

Regression checks: the `test:market` script requires `DATABASE_URL` to point
to a disposable PostgreSQL service on port 55432. The model/interaction smoke test runs without a backend:
`godot --headless --path game res://tests/scan_model_smoke.tscn`.

#### Game

Development for the Game will take place in **Godot 4.7**.

Make sure to use Visual Studio Code as your editor:

- Editor > Editor Settings > Text Editor > External
- Exec Path: (Your VSCode executable path)
- Exec Flags: {project} --goto {file}:{line}:{col}
- Use External Editor: On

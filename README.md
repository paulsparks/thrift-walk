# Thrift Walk

## Ubuntu deployment with Docker Compose

See [the deployment guide](deploy/README.md) for Docker installation, DNS, backups,
and updates. On an x86-64 server with Docker Compose installed:

```sh
git lfs install
git lfs pull
./deploy/configure.sh market.example.com you@example.com
sudo chown 1000:1000 storage/images
sudo chmod 750 storage/images
docker compose --env-file .env.production up -d --build
```

Point the domain at your server and open TCP ports 80/443 (UDP 443 is optional).
The stack builds matching browser/dedicated game exports, applies migrations,
and starts PostgreSQL, Next.js, Godot, and Caddy with automatic HTTPS.
Database data lives in `./database`, images in `./storage/images`, and certificates
persist in Caddy named volumes.

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

#### Worker (3D scanning)

Uploaded item photos are turned into `.glb` models by a Python worker in
`worker/` (MASt3R for reconstruction, Open3D for cleanup and meshing). The web
app queues jobs in Redis, and the worker picks them up. A CUDA GPU is strongly
recommended; MASt3R on CPU takes minutes per scan.

One-time setup, from the repo root inside `devenv shell`:

```bash
# MASt3R (and its DUSt3R submodule). This folder is gitignored.
git clone --recursive https://github.com/naver/mast3r.git worker/mast3r

# PyTorch first. Pick the build that matches your CUDA version from
# https://pytorch.org/get-started/locally/ (cu128 shown here).
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128

pip install -r web/worker/mast3r/requirements.txt
pip install -r web/worker/mast3r/dust3r/requirements.txt
pip install -r worker/requirements.txt
```

Then, with `devenv up -d` running, start the worker with `worker-s`. Scan photos
and finished models are stored in `SCAN_STORAGE_DIR` (see `secretspec.toml`).
The MASt3R model weights download from Hugging Face on first use.

Note that MASt3R's code and weights are released for non-commercial use.

#### Game

Development for the Game will take place in **Godot 4.7**.

Make sure to use Visual Studio Code as your editor:

- Editor > Editor Settings > Text Editor > External
- Exec Path: (Your VSCode executable path)
- Exec Flags: {project} --goto {file}:{line}:{col}
- Use External Editor: On

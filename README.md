# Thrift Walk

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

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

#### Worker (3D scanning)

Uploaded item photos are turned into `.glb` models by a Python worker in
`worker/` (MASt3R for reconstruction, Open3D for cleanup and meshing). The web
app queues jobs in Redis, and the worker picks them up. A CUDA GPU is strongly
recommended; MASt3R on CPU takes minutes per scan. On WSL 2 the GPU comes from
the Windows NVIDIA driver, so no Linux driver install is needed.

One-time setup, from the repo root inside `devenv shell`:

```bash
# MASt3R (and its DUSt3R submodule), pinned as a git submodule.
git submodule update --init --recursive

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

#### Game

Development for the Game will take place in **Godot 4.7**.

Make sure to use Visual Studio Code as your editor:

- Editor > Editor Settings > Text Editor > External
- Exec Path: (Your VSCode executable path)
- Exec Flags: {project} --goto {file}:{line}:{col}
- Use External Editor: On

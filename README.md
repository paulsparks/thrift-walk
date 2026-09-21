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

#### Game

Development for the Game will take place in **Godot 4.7**.

Make sure to use Visual Studio Code as your editor:

- Editor > Editor Settings > Text Editor > External
- Exec Path: (Your VSCode executable path)
- Exec Flags: {project} --goto {file}:{line}:{col}
- Use External Editor: On

{
  pkgs,
  lib,
  config,
  ...
}:

{
  dotenv.disableHint = true;

  packages = with pkgs; [
    git
    # Used by the Godot Tools VS Code extension to run an LSP in WSL.
    # Keep this as Godot 4 so its version matches game/project.godot.
    godot_4
    gdtoolkit_4
    blender
    secretspec
    prisma-engines_6
    biome
    lefthook
    ruff

    # Native libraries that pip-installed PyTorch / Open3D wheels expect.
    # Without these, importing them on Nix/WSL fails with
    # "libstdc++.so.6 / libGL.so.1: cannot open shared object file".
    stdenv.cc.cc.lib
    zlib
    libGL
    glib
    libX11
    systemd
    libusb1
    libidn2
    tbb
  ];

  env = {
    # WSL2 exposes the Windows NVIDIA driver (libcuda.so) in /usr/lib/wsl/lib;
    # PyTorch needs it to use the GPU.
    LD_LIBRARY_PATH =
      (lib.makeLibraryPath [
        pkgs.stdenv.cc.cc.lib
        pkgs.zlib
        pkgs.libGL
        pkgs.glib
        pkgs.libX11
        pkgs.systemd
        pkgs.libusb1
        pkgs.libidn2
        pkgs.tbb
      ]);

    PRISMA_SCHEMA_ENGINE_BINARY = "${pkgs.prisma-engines_6}/bin/schema-engine";

    PRISMA_QUERY_ENGINE_BINARY = "${pkgs.prisma-engines_6}/bin/query-engine";

    PRISMA_FMT_BINARY = "${pkgs.prisma-engines_6}/bin/prisma-fmt";

    BIOME_BINARY = "${pkgs.biome}/bin/biome";
  };

  languages.javascript = {
    enable = true;
    pnpm = {
      enable = true;
      install.enable = true;
    };
  };

  languages.typescript = {
    enable = true;
    lsp.enable = true;
  };

  services.postgres = {
    enable = true;
    initialDatabases = [
      {
        name = "postgres";
        user = "postgres";
        pass = "db-pass";
      }
    ];
    initialScript = ''
      -- Give postgres access to create databases (useful for Prisma Shadow DB stuff)
      ALTER USER "postgres" CREATEDB;
      GRANT CREATE ON SCHEMA public TO "postgres";
    '';
    listen_addresses = "0.0.0.0";
    port = 5432;
  };

  # Job queue between the Next.js app and the 3D scan worker (worker/).
  services.redis = {
    enable = true;
    bind = "127.0.0.1";
    port = 6379;
  };

  # Python environment for the 3D scan worker. Pinned to 3.12 because
  # PyTorch / Open3D wheels lag behind the newest Python release.
  # Install the packages yourself once (see the Worker section of the README).
  languages.python = {
    enable = true;
    package = pkgs.python312;
    venv.enable = true;
  };

  scripts.motd = {
    exec = ''
      echo "--- Dev Environment ---"
      echo "Helper Scripts:                         "
      ${pkgs.gnused}/bin/sed -e 's| |••|g' -e 's|=| |' <<EOF | ${pkgs.util-linuxMinimal}/bin/column -t | ${pkgs.gnused}/bin/sed -e 's|^| - |' -e 's|••| |g'
      ${lib.generators.toKeyValue { } (lib.mapAttrs (name: value: value.description) config.scripts)}
      EOF
      echo "                                        "
      echo "To get started, run 'devenv up -d' to   "
      echo "start the provided services. Then, run  "
      echo "'pnpm-s run dev' to start the server    "
      echo "and 'worker-s' for the 3D scan worker.  "
      echo "-----------------------"
    '';
    description = "Writes the start message with useful instructions";
  };

  scripts.pnpm-s = {
    exec = "secretspec run -- pnpm $@";
    description = "Runs pnpm with secrets injected (via secretspec)";
  };

  scripts.worker-s = {
    exec = "secretspec run -- python run_worker.py $@";
    description = "Runs the 3D scan worker with secrets injected (run from the repo root)";
  };

  enterShell = ''
     # WSL exposes the Windows GPU driver here; real Linux doesn't have this folder.
    if [ -d /usr/lib/wsl/lib ]; then
      export LD_LIBRARY_PATH="''${LD_LIBRARY_PATH:+$LD_LIBRARY_PATH:}/usr/lib/wsl/lib"
    fi
    lefthook install
    motd
  '';
}

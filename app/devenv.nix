{ pkgs, lib, ... }:

# NOTE: Android studio does not work in this dev environment yet.

{
  scripts = {
    studio.exec = "(android-studio &> /dev/null &)";
    create-emulator.exec = ''
      avdmanager create avd --force --name $1 --package 'system-images;android-36;google_apis_playstore;x86_64'
    '';
  };

  packages = with pkgs; [
    git
    glib
  ];

  languages.java = {
    enable = true;
    jdk.package = pkgs.openjdk17;
  };

  android = {
    enable = true;
    android-studio.enable = true;
    platforms.version = [ "36" ];
    sources.enable = true;
    emulator.enable = true;
    reactNative.enable = true;
  };

  enterShell = ''
    if command -v emulator >/dev/null 2>&1; then
      EMU_BIN="$(readlink -f "$(command -v emulator)")"
      export LD_LIBRARY_PATH="$(dirname "$EMU_BIN")/lib64''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
    fi
  '';

  env.LD_LIBRARY_PATH = lib.makeLibraryPath (
    with pkgs;
    [
      glib
      nss
      nspr
      dbus
      atk
      at-spi2-atk
      at-spi2-core
      cups
      gtk3
      pango
      cairo
      gdk-pixbuf
      alsa-lib
      mesa
      libgbm
      libdrm
      expat
      libxkbcommon
      systemd
      xorg.libX11
      xorg.libXcomposite
      xorg.libXdamage
      xorg.libXext
      xorg.libXfixes
      xorg.libXrandr
      xorg.libxcb
    ]
  );
}

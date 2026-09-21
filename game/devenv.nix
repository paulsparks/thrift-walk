{ pkgs, ... }:

{
  packages = with pkgs; [
    git
    gdtoolkit_4
  ];
}

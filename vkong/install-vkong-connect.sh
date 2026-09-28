#!/bin/sh
# Install vkong-connect into the Unsloth Studio environment created by
# `./install.sh --local`, so Studio shows the "Train on VKong" button.
# Usage: ./vkong/install-vkong-connect.sh            (installs vkong-connect@main)
#        VKONG_CONNECT_REF=<branch|tag|commit> ./vkong/install-vkong-connect.sh
set -eu

STUDIO_HOME="${UNSLOTH_STUDIO_HOME:-${STUDIO_HOME:-$HOME/.unsloth/studio}}"
REF="${VKONG_CONNECT_REF:-main}"
PACKAGE="vkong-connect @ git+https://github.com/tlitech-hq/vkong-connect.git@${REF}"

PYTHON=""
for candidate in "$STUDIO_HOME/unsloth_studio/bin/python" "$STUDIO_HOME/unsloth_studio/Scripts/python.exe"; do
    if [ -x "$candidate" ]; then PYTHON="$candidate"; break; fi
done
if [ -z "$PYTHON" ]; then
    echo "Unsloth Studio environment not found under $STUDIO_HOME." >&2
    echo "Run ./install.sh --local from this checkout first." >&2
    exit 1
fi

UV=""
for candidate in "$(command -v uv 2>/dev/null || true)" "$STUDIO_HOME/bin/uv" "$HOME/.local/bin/uv"; do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then UV="$candidate"; break; fi
done

echo "Installing $PACKAGE into $PYTHON"
if [ -n "$UV" ]; then
    "$UV" pip install --python "$PYTHON" --reinstall-package vkong-connect "$PACKAGE"
else
    "$PYTHON" -m pip --version >/dev/null 2>&1 || "$PYTHON" -m ensurepip --upgrade
    "$PYTHON" -m pip install --force-reinstall --no-deps "$PACKAGE"
fi

if ! command -v vkong >/dev/null 2>&1; then
    echo
    echo "Next: install the VKong CLI from https://vkong.tli-tech.com/download and run: vkong login"
fi
echo "Done. Restart Unsloth Studio (unsloth studio) to see the Train on VKong button."

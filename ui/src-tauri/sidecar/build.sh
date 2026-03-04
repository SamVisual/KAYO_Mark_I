#!/bin/bash
# Build the KAYO memory sidecar as a standalone binary using PyInstaller.
# Output goes to src-tauri/binaries/ where Tauri expects sidecar binaries.
#
# Usage: cd src-tauri/sidecar && bash build.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BINARIES_DIR="$(dirname "$SCRIPT_DIR")/binaries"

echo "=== KAYO Memory Sidecar Build ==="
echo "Script dir:   $SCRIPT_DIR"
echo "Binaries dir: $BINARIES_DIR"

# Detect platform triple for Tauri sidecar naming
detect_triple() {
    local arch os
    arch="$(uname -m)"
    case "$arch" in
        x86_64)  arch="x86_64" ;;
        aarch64) arch="aarch64" ;;
        arm64)   arch="aarch64" ;;
        *)       echo "Unsupported arch: $arch"; exit 1 ;;
    esac

    case "$(uname -s)" in
        Linux*)  os="unknown-linux-gnu" ;;
        Darwin*) os="apple-darwin" ;;
        MINGW*|MSYS*|CYGWIN*) os="pc-windows-msvc" ;;
        *)       echo "Unsupported OS: $(uname -s)"; exit 1 ;;
    esac

    echo "${arch}-${os}"
}

TRIPLE="$(detect_triple)"
echo "Platform:     $TRIPLE"

# Install dependencies
echo ""
echo "--- Installing Python dependencies ---"
pip install -r "$SCRIPT_DIR/requirements.txt" --quiet
pip install pyinstaller --quiet

# Build with PyInstaller
echo ""
echo "--- Building with PyInstaller ---"
cd "$SCRIPT_DIR"
pyinstaller \
    --onefile \
    --name "memory_server" \
    --distpath "$BINARIES_DIR" \
    --workpath "/tmp/kayo_build_work" \
    --specpath "/tmp/kayo_build_spec" \
    --clean \
    --noconfirm \
    memory_server.py

# Rename to include platform triple (Tauri expects: name-triple[.exe])
EXT=""
if [[ "$TRIPLE" == *"windows"* ]]; then
    EXT=".exe"
fi

SOURCE="$BINARIES_DIR/memory_server${EXT}"
TARGET="$BINARIES_DIR/memory_server-${TRIPLE}${EXT}"

if [ -f "$SOURCE" ]; then
    mv "$SOURCE" "$TARGET"
    chmod +x "$TARGET"
    echo ""
    echo "=== Build complete ==="
    echo "Output: $TARGET"
    echo "Size:   $(du -h "$TARGET" | cut -f1)"
else
    echo "ERROR: Build output not found at $SOURCE"
    exit 1
fi

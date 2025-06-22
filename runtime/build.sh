#!/bin/bash

# Build script for Eghact runtime
# Requires: rustup, wasm-pack

set -e

echo "Building Eghact runtime..."

# Install wasm-pack if not present
if ! command -v wasm-pack &> /dev/null; then
    echo "Installing wasm-pack..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# Build the WASM module
wasm-pack build --target web --out-dir pkg --release

# Check size
WASM_SIZE=$(stat -f%z pkg/eghact_runtime_bg.wasm 2>/dev/null || stat -c%s pkg/eghact_runtime_bg.wasm)
WASM_SIZE_KB=$((WASM_SIZE / 1024))

echo "Build complete!"
echo "WASM size: ${WASM_SIZE_KB}KB (target: <10KB)"

if [ $WASM_SIZE_KB -gt 10 ]; then
    echo "WARNING: WASM size exceeds 10KB target!"
    exit 1
fi
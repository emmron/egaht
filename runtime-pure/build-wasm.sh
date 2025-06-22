#!/bin/bash

# Build script for Eghact WASM runtime

echo "Building Eghact WASM runtime..."

# Navigate to wasm source
cd wasm-src

# Install wasm-pack if not present
if ! command -v wasm-pack &> /dev/null; then
    echo "Installing wasm-pack..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# Build WASM module
echo "Compiling Rust to WebAssembly..."
wasm-pack build --target web --out-dir ../wasm --no-typescript

# Optimize WASM with wasm-opt if available
if command -v wasm-opt &> /dev/null; then
    echo "Optimizing WASM module..."
    wasm-opt -Oz -o ../wasm/eghact_runtime_bg.wasm ../wasm/eghact_runtime_bg.wasm
fi

# Clean up unnecessary files
cd ../wasm
rm -f package.json README.md .gitignore

echo "WASM build complete!"
echo "Output: wasm/eghact_runtime_bg.wasm"
echo "Size: $(wc -c < eghact_runtime_bg.wasm) bytes"
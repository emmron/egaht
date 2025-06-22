#!/bin/bash
# Build script for Eghact native CLI

set -e

echo "Building Eghact CLI..."

# Build for current platform
cargo build --release

# Strip binary for smaller size
strip target/release/eghact

echo "Build complete!"
echo "Binary location: target/release/eghact"
echo ""
echo "To install globally:"
echo "  sudo cp target/release/eghact /usr/local/bin/"
echo ""
echo "Or add to PATH:"
echo "  export PATH=\"\$PATH:$(pwd)/target/release\""
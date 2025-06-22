#!/bin/bash
# Build script for EPkg - Eghact Package Manager

set -e

echo "Building EPkg..."

# Build release binary
cargo build --release

# Strip binary for smaller size
strip target/release/epkg

# Get version
VERSION=$(grep version Cargo.toml | head -1 | cut -d'"' -f2)

echo "EPkg v$VERSION built successfully!"
echo ""
echo "Binary location: target/release/epkg"
echo "Size: $(du -h target/release/epkg | cut -f1)"
echo ""
echo "To install globally:"
echo "  sudo cp target/release/epkg /usr/local/bin/"
echo ""
echo "To build for all platforms:"
echo "  cargo install cross"
echo "  cross build --release --target x86_64-unknown-linux-gnu"
echo "  cross build --release --target x86_64-apple-darwin"
echo "  cross build --release --target x86_64-pc-windows-gnu"
#!/bin/bash
# Build script for Eghact Native Mobile Runtime

set -e

echo "Building Eghact Native Mobile Runtime..."

# Create build directory
mkdir -p build

# Detect platform
if [[ "$OSTYPE" == "darwin"* ]]; then
    PLATFORM="iOS"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if [ -n "$ANDROID_HOME" ]; then
        PLATFORM="Android"
    else
        PLATFORM="Default"
    fi
else
    PLATFORM="Default"
fi

echo "Detected platform: $PLATFORM"

# Build based on platform
case $PLATFORM in
    iOS)
        echo "Building for iOS..."
        cd build
        cmake .. -DIOS=ON -DBUILD_EXAMPLES=ON \
            -DCMAKE_OSX_DEPLOYMENT_TARGET=11.0 \
            -G Xcode
        xcodebuild -project EghactMobileRuntime.xcodeproj \
            -scheme eghact_mobile \
            -configuration Release \
            -sdk iphoneos
        ;;
        
    Android)
        echo "Building for Android..."
        cd build
        cmake .. -DANDROID=ON -DBUILD_EXAMPLES=ON \
            -DCMAKE_TOOLCHAIN_FILE=$ANDROID_HOME/ndk-bundle/build/cmake/android.toolchain.cmake \
            -DANDROID_ABI=arm64-v8a \
            -DANDROID_PLATFORM=android-21
        make -j$(nproc)
        ;;
        
    Default)
        echo "Building default (testing) version..."
        cd build
        cmake .. -DBUILD_EXAMPLES=ON -DBUILD_TESTS=ON
        make -j$(nproc)
        
        echo "Running example..."
        ./examples/counter_app
        ;;
esac

echo "Build complete!"
#!/bin/bash

# Build WebAssembly module for ultimate decoupling
echo "🔨 Building Eghact Component Generator WebAssembly module..."

# Install emscripten if not available
if ! command -v emcc &> /dev/null; then
    echo "⚠️  Emscripten not found. Please install it first:"
    echo "git clone https://github.com/emscripten-core/emsdk.git"
    echo "cd emsdk && ./emsdk install latest && ./emsdk activate latest"
    exit 1
fi

# Compile to WebAssembly
emcc component-generator.c \
    -o component-generator.js \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS='["_generate_component_wasm", "_free_string", "_malloc", "_free"]' \
    -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "UTF8ToString", "stringToUTF8", "lengthBytesUTF8"]' \
    -s MODULARIZE=1 \
    -s EXPORT_NAME="EghactGeneratorWASM" \
    -s ALLOW_MEMORY_GROWTH=1 \
    -O3

# Also build standalone native binary
echo "🔨 Building native binary..."
gcc component-generator.c -o component-generator-native -O3

echo "✅ Build complete!"
echo "   - WebAssembly: component-generator.js + component-generator.wasm"
echo "   - Native binary: component-generator-native"

# Create usage example
cat > usage-example.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Eghact WASM Component Generator</title>
</head>
<body>
    <h1>Eghact Component Generator (WebAssembly)</h1>
    <input type="text" id="prompt" placeholder="Enter component description" style="width: 400px;">
    <button onclick="generateComponent()">Generate</button>
    <pre id="output"></pre>
    
    <script src="component-generator.js"></script>
    <script>
        let generator;
        
        EghactGeneratorWASM().then(module => {
            generator = module;
            console.log('WASM module loaded!');
        });
        
        function generateComponent() {
            if (!generator) {
                alert('WASM module not loaded yet');
                return;
            }
            
            const prompt = document.getElementById('prompt').value;
            const generate = generator.cwrap('generate_component_wasm', 'number', ['string']);
            const freeString = generator.cwrap('free_string', null, ['number']);
            
            const ptr = generate(prompt);
            const component = generator.UTF8ToString(ptr);
            freeString(ptr);
            
            document.getElementById('output').textContent = component;
        }
    </script>
</body>
</html>
EOF

echo "📄 Created usage-example.html - open in browser to test!"
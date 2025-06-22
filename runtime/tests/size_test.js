const fs = require('fs');
const path = require('path');

// Check WASM file size
const wasmPath = path.join(__dirname, '../pkg/eghact_runtime_bg.wasm');

if (!fs.existsSync(wasmPath)) {
    console.error('WASM file not found. Run build.sh first.');
    process.exit(1);
}

const stats = fs.statSync(wasmPath);
const sizeInKB = stats.size / 1024;

console.log(`WASM Runtime Size: ${sizeInKB.toFixed(2)}KB`);

if (sizeInKB > 10) {
    console.error(`❌ FAIL: Runtime size (${sizeInKB.toFixed(2)}KB) exceeds 10KB limit`);
    process.exit(1);
} else {
    console.log('✅ PASS: Runtime size is under 10KB');
}

// Check JS wrapper size
const jsPath = path.join(__dirname, '../pkg/eghact_runtime.js');
if (fs.existsSync(jsPath)) {
    const jsStats = fs.statSync(jsPath);
    const jsSizeInKB = jsStats.size / 1024;
    console.log(`JS Wrapper Size: ${jsSizeInKB.toFixed(2)}KB`);
    
    const totalSize = sizeInKB + jsSizeInKB;
    console.log(`Total Bundle Size: ${totalSize.toFixed(2)}KB`);
}
#!/usr/bin/env node

// Build script for Eghact Performance Monitor
// Compiles .egh files to JavaScript

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Simple Eghact to JS transformer
function transformEghactToJS(eghCode) {
  // This is a simplified transform - in production, use the full Eghact compiler
  let jsCode = eghCode;
  
  // Transform component syntax
  jsCode = jsCode.replace(/component\s+(\w+)\s*{/g, 'class $1 extends Eghact.Component {');
  
  // Transform JSX-like syntax to h() calls
  jsCode = jsCode.replace(/<(\w+)([^>]*)>/g, (match, tag, attrs) => {
    const attrObj = attrs.trim() ? `{${attrs}}` : '{}';
    return `h('${tag}', ${attrObj}, [`;
  });
  jsCode = jsCode.replace(/<\/\w+>/g, '])');
  
  // Transform @click to '@click'
  jsCode = jsCode.replace(/@(\w+)=/g, "'@$1':");
  
  // Add export statements
  jsCode = jsCode.replace(/export default (\w+);?$/m, 'export { $1 as default };');
  
  return jsCode;
}

// Build files
const files = [
  'eghact-perf-monitor.egh',
  'perf-runtime-hook.egh',
  'devtools-panel.egh'
];

const distDir = join(__dirname, 'dist');
mkdirSync(distDir, { recursive: true });

console.log('Building Eghact Performance Monitor...\n');

files.forEach(file => {
  try {
    const inputPath = join(__dirname, file);
    const outputPath = join(distDir, file.replace('.egh', '.js'));
    
    const eghCode = readFileSync(inputPath, 'utf8');
    const jsCode = transformEghactToJS(eghCode);
    
    writeFileSync(outputPath, jsCode);
    console.log(`✓ Built ${file} -> ${outputPath}`);
  } catch (err) {
    console.error(`✗ Error building ${file}:`, err.message);
  }
});

// Copy CSS
try {
  const cssPath = join(__dirname, 'devtools-panel.css');
  const cssDest = join(distDir, 'devtools-panel.css');
  const css = readFileSync(cssPath, 'utf8');
  writeFileSync(cssDest, css);
  console.log(`✓ Copied devtools-panel.css`);
} catch (err) {
  console.error(`✗ Error copying CSS:`, err.message);
}

console.log('\nBuild complete!');
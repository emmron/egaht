/**
 * Build script for Eghact Pure Runtime
 * Bundles the runtime without any Node/React dependencies
 */

import { build } from 'esbuild';
import { promises as fs } from 'fs';
import path from 'path';

async function buildRuntime() {
  console.log('Building Eghact Pure Runtime...');
  
  // Ensure dist directory exists
  await fs.mkdir('dist', { recursive: true });
  
  // Build main runtime bundle
  await build({
    entryPoints: ['src/index.js'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2020'],
    outfile: 'dist/eghact-runtime.js',
    minify: true,
    sourcemap: true,
    external: [],  // No external dependencies!
    define: {
      'process.env.NODE_ENV': '"production"'
    }
  });
  
  // Build development version
  await build({
    entryPoints: ['src/index.js'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2020'],
    outfile: 'dist/eghact-runtime.dev.js',
    minify: false,
    sourcemap: 'inline',
    external: [],
    define: {
      'process.env.NODE_ENV': '"development"'
    }
  });
  
  // Build IIFE version for script tags
  await build({
    entryPoints: ['src/index.js'],
    bundle: true,
    format: 'iife',
    globalName: 'Eghact',
    platform: 'browser',
    target: ['es2020'],
    outfile: 'dist/eghact-runtime.iife.js',
    minify: true,
    external: []
  });
  
  // Create package exports
  const packageExports = {
    "name": "@eghact/runtime",
    "version": "1.0.0",
    "description": "Pure Eghact runtime - zero dependencies",
    "type": "module",
    "main": "./eghact-runtime.js",
    "module": "./eghact-runtime.js",
    "browser": "./eghact-runtime.js",
    "exports": {
      ".": {
        "import": "./eghact-runtime.js",
        "require": "./eghact-runtime.iife.js",
        "default": "./eghact-runtime.js"
      },
      "./dev": "./eghact-runtime.dev.js"
    },
    "files": ["*"],
    "sideEffects": false
  };
  
  await fs.writeFile(
    'dist/package.json',
    JSON.stringify(packageExports, null, 2)
  );
  
  const stats = await fs.stat('dist/eghact-runtime.js');
  console.log(`✓ Build complete! Size: ${(stats.size / 1024).toFixed(2)}KB`);
}

// Run build
buildRuntime().catch(console.error);
#!/usr/bin/env node

import { EghactBuildSystem } from './build-system/src/index.js';
import chalk from 'chalk';
import path from 'path';

const root = process.cwd();
const outputDir = process.env.OUTPUT_DIR || 'dist';

async function runBuild() {
  console.log(chalk.blue('🔨 Starting Eghact production build...'));
  
  try {
    const buildSystem = new EghactBuildSystem({
      root,
      outDir: outputDir,
      minify: true,
      sourcemap: false,
      target: 'es2020',
      format: 'esm',
      splitting: true,
      metafile: true,
      bundle: true,
      treeshake: true,
      enableXSS: true,
      enableCSRF: true,
      strictMode: true
    });
    
    const result = await buildSystem.build();
    
    console.log(chalk.green('✅ Build completed successfully!'));
    console.log(chalk.gray(`Output directory: ${outputDir}`));
    
    // Display bundle size information
    if (result.bundleSizes) {
      const totalSize = Object.values(result.bundleSizes).reduce((sum, size) => sum + (size || 0), 0);
      const totalKB = (totalSize / 1024).toFixed(1);
      
      console.log(chalk.white(`📦 Total bundle size: ${totalKB}KB`));
      
      if (totalSize < 10240) {
        console.log(chalk.green('🎯 Under 10KB goal achieved!'));
      } else {
        console.log(chalk.yellow(`⚠️  Bundle size exceeds 10KB goal (${totalKB}KB)`));
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error(chalk.red('❌ Build failed:'), error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

runBuild();
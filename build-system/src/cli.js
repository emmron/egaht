#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import { EghactBuildSystem } from './index.js';
import path from 'path';
import fs from 'fs-extra';

const version = '0.1.0';

program
  .name('eghact-build')
  .description('Eghact production build system')
  .version(version);

program
  .command('build')
  .description('Build the project for production')
  .option('-r, --root <path>', 'Root directory of the project', process.cwd())
  .option('-o, --outDir <path>', 'Output directory', 'dist')
  .option('--sourcemap', 'Generate source maps', false)
  .option('--no-minify', 'Disable minification')
  .option('--no-splitting', 'Disable code splitting')
  .option('--target <target>', 'Target environment', 'es2020')
  .option('--analyze', 'Analyze bundle and generate report', false)
  .option('--watch', 'Watch for changes and rebuild', false)
  .action(async (options) => {
    console.log(chalk.blue('🔨 Eghact Build System v' + version));
    console.log('');
    
    try {
      const buildSystem = new EghactBuildSystem({
        root: path.resolve(options.root),
        outDir: options.outDir,
        sourcemap: options.sourcemap,
        minify: options.minify,
        splitting: options.splitting,
        target: options.target
      });
      
      if (options.watch) {
        await buildInWatchMode(buildSystem);
      } else {
        const result = await buildSystem.build();
        
        if (options.analyze) {
          await generateAnalysisReport(result, options.root);
        }
        
        process.exit(0);
      }
    } catch (error) {
      console.error(chalk.red('❌ Build failed:'), error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('Analyze bundle size and performance')
  .option('-r, --root <path>', 'Root directory of the project', process.cwd())
  .option('-d, --dist <path>', 'Distribution directory', 'dist')
  .action(async (options) => {
    try {
      const distPath = path.join(options.root, options.dist);
      
      if (!await fs.pathExists(distPath)) {
        console.error(chalk.red('❌ Distribution directory not found. Run build first.'));
        process.exit(1);
      }
      
      await analyzeBuild(distPath);
    } catch (error) {
      console.error(chalk.red('❌ Analysis failed:'), error.message);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize Eghact project structure')
  .option('-r, --root <path>', 'Root directory of the project', process.cwd())
  .action(async (options) => {
    try {
      await initializeProject(options.root);
      console.log(chalk.green('✅ Eghact project initialized successfully!'));
    } catch (error) {
      console.error(chalk.red('❌ Initialization failed:'), error.message);
      process.exit(1);
    }
  });

async function buildInWatchMode(buildSystem) {
  console.log(chalk.yellow('👀 Watch mode enabled - building on changes...'));
  
  // Initial build
  await buildSystem.build();
  
  // Set up file watcher
  const chokidar = await import('chokidar');
  const watcher = chokidar.watch([
    'src/**/*.egh',
    'src/**/*.css',
    'src/**/*.js',
    'public/**/*'
  ], {
    ignored: ['node_modules', 'dist', '.git'],
    persistent: true,
    ignoreInitial: true
  });
  
  let isBuilding = false;
  let shouldRebuild = false;
  
  watcher.on('change', async (path) => {
    console.log(chalk.yellow(`📝 File changed: ${path}`));
    
    if (isBuilding) {
      shouldRebuild = true;
      return;
    }
    
    isBuilding = true;
    
    try {
      await buildSystem.build();
      console.log(chalk.green('✅ Rebuild completed'));
    } catch (error) {
      console.error(chalk.red('❌ Rebuild failed:'), error.message);
    }
    
    isBuilding = false;
    
    if (shouldRebuild) {
      shouldRebuild = false;
      // Trigger another build if changes occurred during build
      setTimeout(() => watcher.emit('change', 'delayed-rebuild'), 100);
    }
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n👋 Shutting down watch mode...'));
    watcher.close();
    process.exit(0);
  });
}

async function generateAnalysisReport(buildResult, rootPath) {
  console.log('');
  console.log(chalk.blue('📊 Bundle Analysis Report:'));
  console.log('');
  
  const reportPath = path.join(rootPath, 'dist', 'build-report.json');
  
  if (await fs.pathExists(reportPath)) {
    const report = await fs.readJson(reportPath);
    
    // Display bundle sizes
    console.log(chalk.white('Bundle Sizes:'));
    
    if (report.bundleSizes) {
      for (const [name, size] of Object.entries(report.bundleSizes)) {
        const sizeKB = (size / 1024).toFixed(1);
        const color = size < 10000 ? chalk.green : size < 50000 ? chalk.yellow : chalk.red;
        console.log(`  ${name}: ${color(sizeKB + 'KB')}`);
      }
    }
    
    console.log('');
    
    // Display Lighthouse scores
    if (report.lighthouse) {
      console.log(chalk.white('Lighthouse Scores:'));
      for (const [metric, score] of Object.entries(report.lighthouse)) {
        const color = score >= 90 ? chalk.green : score >= 70 ? chalk.yellow : chalk.red;
        console.log(`  ${metric}: ${color(score + '/100')}`);
      }
    }
    
    console.log('');
    
    // Check goals
    const totalSizeKB = report.bundleSizes?.total ? (report.bundleSizes.total / 1024) : 0;
    console.log(chalk.white('Goal Achievement:'));
    console.log(`  <10KB bundle: ${totalSizeKB < 10 ? chalk.green('✅ PASS') : chalk.red('❌ FAIL')} (${totalSizeKB.toFixed(1)}KB)`);
    
    if (report.lighthouse?.performance) {
      console.log(`  100/100 Lighthouse: ${report.lighthouse.performance === 100 ? chalk.green('✅ PASS') : chalk.red('❌ FAIL')} (${report.lighthouse.performance}/100)`);
    }
  } else {
    console.log(chalk.yellow('⚠️  Build report not found'));
  }
}

async function analyzeBuild(distPath) {
  console.log(chalk.blue('🔍 Analyzing existing build...'));
  
  // Analyze file sizes
  const files = await fs.readdir(distPath);
  const fileSizes = {};
  
  for (const file of files) {
    const filePath = path.join(distPath, file);
    const stat = await fs.stat(filePath);
    
    if (stat.isFile()) {
      fileSizes[file] = stat.size;
    }
  }
  
  // Display results
  console.log('');
  console.log(chalk.white('File Sizes:'));
  
  for (const [file, size] of Object.entries(fileSizes)) {
    const sizeKB = (size / 1024).toFixed(1);
    const color = size < 10000 ? chalk.green : size < 50000 ? chalk.yellow : chalk.red;
    console.log(`  ${file}: ${color(sizeKB + 'KB')}`);
  }
  
  const totalSize = Object.values(fileSizes).reduce((sum, size) => sum + size, 0);
  const totalSizeKB = (totalSize / 1024).toFixed(1);
  
  console.log('');
  console.log(`Total size: ${totalSizeKB}KB`);
  console.log(`Under 10KB goal: ${totalSize < 10240 ? chalk.green('✅ YES') : chalk.red('❌ NO')}`);
}

async function initializeProject(rootPath) {
  console.log(chalk.blue('🚀 Initializing Eghact project...'));
  
  // Create directory structure
  const dirs = [
    'src/routes',
    'src/components',
    'src/styles',
    'public',
    'docs'
  ];
  
  for (const dir of dirs) {
    await fs.ensureDir(path.join(rootPath, dir));
  }
  
  // Create initial files
  const files = {
    'src/routes/index.egh': `<template>
  <div class="home">
    <h1>Welcome to Eghact!</h1>
    <p>Count: {count}</p>
    <button @click={increment}>Increment</button>
  </div>
</template>

<script>
  let count = 0;
  
  function increment() {
    count++;
  }
</script>

<style>
  .home {
    text-align: center;
    padding: 2rem;
  }
  
  button {
    background: #007acc;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }
  
  button:hover {
    background: #005a99;
  }
</style>`,
    
    'eghact.config.js': `export default {
  build: {
    outDir: 'dist',
    target: 'es2020',
    minify: true,
    sourcemap: false
  },
  
  dev: {
    port: 3000,
    host: 'localhost',
    open: true
  }
};`,
    
    'package.json': JSON.stringify({
      name: 'my-eghact-app',
      version: '1.0.0',
      type: 'module',
      scripts: {
        dev: 'eghact-dev',
        build: 'eghact-build build',
        preview: 'eghact-build build && serve dist'
      },
      dependencies: {
        '@eghact/runtime': '^0.1.0'
      },
      devDependencies: {
        '@eghact/dev-server': '^0.1.0',
        '@eghact/build-system': '^0.1.0'
      }
    }, null, 2),
    
    'README.md': `# My Eghact App

A fast, lightweight web application built with the Eghact framework.

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
\`\`\`

## Features

- ⚡ Ultra-fast compilation (<50ms)
- 📦 Tiny bundle size (<10KB)
- 🔥 Hot Module Replacement
- 🎯 Zero configuration
- 🚀 100/100 Lighthouse scores

## Learn More

- [Eghact Documentation](https://eghact.dev/docs)
- [Examples](https://eghact.dev/examples)
- [GitHub](https://github.com/eghact/eghact)
`
  };
  
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(rootPath, filePath);
    
    // Only create if doesn't exist
    if (!await fs.pathExists(fullPath)) {
      await fs.writeFile(fullPath, content);
      console.log(chalk.gray(`  Created ${filePath}`));
    }
  }
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error(chalk.red('💥 Uncaught Exception:'), error.message);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('💥 Unhandled Rejection at:'), promise, 'reason:', reason);
  process.exit(1);
});

// Parse command line arguments
program.parse();
/**
 * Optimized Build System with Parallel Processing - PO002
 * Integrates ParallelBuildSystem for <100ms incremental builds
 */

import { EghactBuildSystem } from './index.js';
import { ParallelBuildSystem } from './ParallelBuildSystem.js';
import { performance } from 'perf_hooks';
import chalk from 'chalk';
import path from 'path';

export class OptimizedBuildSystem extends EghactBuildSystem {
  constructor(options = {}) {
    super(options);
    
    // Initialize parallel build system
    this.parallelBuilder = new ParallelBuildSystem({
      workers: options.workers || 4,
      cacheDir: path.join(this.options.root, '.eghact-cache'),
      enableCache: options.enableCache !== false,
      watchMode: options.watch || false,
      ...options
    });
    
    // Performance tracking
    this.performanceMetrics = {
      builds: [],
      averageBuildTime: 0,
      incrementalBuilds: 0,
      fullBuilds: 0
    };
  }

  /**
   * Initialize the build system
   */
  async initialize() {
    await this.parallelBuilder.initialize();
  }

  /**
   * Optimized build method with parallelization
   */
  async build(changedFiles = []) {
    const isIncremental = changedFiles.length > 0;
    const startTime = performance.now();
    
    console.log(chalk.blue(
      isIncremental 
        ? `⚡ Starting incremental build (${changedFiles.length} files changed)`
        : '🔨 Starting full production build...'
    ));
    
    try {
      if (isIncremental) {
        // Use parallel build system for incremental builds
        const result = await this.parallelBuilder.build(changedFiles);
        
        // Update performance metrics
        this.updatePerformanceMetrics(result.time, true);
        
        return result;
      } else {
        // Full build with optimizations
        await this.performFullBuild();
      }
      
      const buildTime = performance.now() - startTime;
      
      console.log(chalk.green(`✅ Build completed in ${buildTime.toFixed(2)}ms`));
      
      // Show performance summary
      this.showPerformanceSummary();
      
      return {
        success: true,
        time: buildTime,
        incremental: isIncremental
      };
      
    } catch (error) {
      console.error(chalk.red('❌ Build failed:'), error.message);
      throw error;
    }
  }

  /**
   * Perform full build with parallel optimizations
   */
  async performFullBuild() {
    const tasks = [];
    
    // 1. Clean output directory
    tasks.push(this.cleanOutDir());
    
    // 2. Discover routes (can run in parallel with cleaning)
    tasks.push(this.discoverRoutes());
    
    // Wait for initial tasks
    const [, routes] = await Promise.all(tasks);
    
    // 3. Build tasks that can run in parallel
    const parallelTasks = [
      this.buildRuntime(),
      this.buildRoutes(routes),
      this.optimizeCSS(),
      this.optimizeAssets()
    ];
    
    // Execute in parallel
    await Promise.all(parallelTasks);
    
    // 4. Sequential tasks that depend on previous results
    await this.generateServiceWorker();
    await this.generateCSP();
    await this.integrateSecurityFeatures();
    
    // 5. Analysis can run async
    this.analyzeBundleAndOptimizations().catch(err => 
      console.warn('Bundle analysis failed:', err.message)
    );
    
    await this.generateBuildReport();
  }

  /**
   * Override buildRoutes to use parallel compilation
   */
  async buildRoutes(routes) {
    console.log(chalk.gray('📦 Building routes in parallel...'));
    
    const routeModules = Object.keys(routes).map(route => routes[route].file);
    
    // Use parallel builder for route compilation
    const results = await this.parallelBuilder.build(routeModules);
    
    // Update build manifest
    results.forEach(result => {
      const route = Object.keys(routes).find(r => routes[r].file === result.module);
      if (route) {
        this.buildManifest.routes[route] = {
          ...routes[route],
          hash: result.hash,
          size: result.size
        };
      }
    });
    
    console.log(chalk.gray(`✓ Built ${results.length} routes`));
  }

  /**
   * Override buildRuntime for parallel WASM compilation
   */
  async buildRuntime() {
    console.log(chalk.gray('🚀 Building WASM runtime...'));
    
    const tasks = [];
    
    // Build WASM runtime in parallel with JS runtime
    if (this.options.wasmRuntime) {
      tasks.push(this.buildWASMRuntime());
    }
    
    // Build JS runtime
    tasks.push(this.buildJSRuntime());
    
    await Promise.all(tasks);
    
    console.log(chalk.gray('✓ Runtime built'));
  }

  /**
   * Build WASM runtime asynchronously
   */
  async buildWASMRuntime() {
    // In real implementation, would compile Rust/C to WASM
    // For now, simulate async build
    return new Promise(resolve => {
      setTimeout(() => {
        this.buildManifest.runtime = {
          wasm: {
            size: 245760, // 240KB
            hash: 'abc123'
          }
        };
        resolve();
      }, 50);
    });
  }

  /**
   * Build JS runtime
   */
  async buildJSRuntime() {
    // Use esbuild for fast JS compilation
    const { build } = await import('esbuild');
    
    const result = await build({
      entryPoints: ['src/runtime/index.js'],
      bundle: true,
      format: 'esm',
      target: this.options.target,
      minify: this.options.minify,
      splitting: false,
      outfile: path.join(this.options.outDir, 'runtime.js'),
      metafile: true
    });
    
    if (result.metafile) {
      const output = Object.values(result.metafile.outputs)[0];
      this.buildManifest.runtime = {
        ...this.buildManifest.runtime,
        js: {
          size: output.bytes,
          hash: 'def456'
        }
      };
    }
  }

  /**
   * Optimize CSS with parallel processing
   */
  async optimizeCSS() {
    console.log(chalk.gray('🎨 Optimizing CSS in parallel...'));
    
    const cssFiles = await this.glob('**/*.css');
    
    // Process CSS files in parallel
    const tasks = cssFiles.map(file => 
      this.parallelBuilder.processTask({
        id: `css-${file}`,
        module: file,
        type: 'css'
      })
    );
    
    await Promise.all(tasks);
    
    console.log(chalk.gray(`✓ Optimized ${cssFiles.length} CSS files`));
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(buildTime, isIncremental) {
    this.performanceMetrics.builds.push({
      time: buildTime,
      incremental: isIncremental,
      timestamp: Date.now()
    });
    
    if (isIncremental) {
      this.performanceMetrics.incrementalBuilds++;
    } else {
      this.performanceMetrics.fullBuilds++;
    }
    
    // Calculate average
    const times = this.performanceMetrics.builds.map(b => b.time);
    this.performanceMetrics.averageBuildTime = 
      times.reduce((a, b) => a + b, 0) / times.length;
  }

  /**
   * Show performance summary
   */
  showPerformanceSummary() {
    const metrics = this.performanceMetrics;
    
    console.log(chalk.cyan('\n📊 Build Performance Summary:'));
    console.log(`   Total builds: ${metrics.builds.length}`);
    console.log(`   Incremental: ${metrics.incrementalBuilds}`);
    console.log(`   Full builds: ${metrics.fullBuilds}`);
    console.log(`   Average time: ${metrics.averageBuildTime.toFixed(2)}ms`);
    
    // Show last 5 builds
    if (metrics.builds.length > 0) {
      console.log(chalk.gray('\n   Recent builds:'));
      metrics.builds.slice(-5).forEach((build, i) => {
        const type = build.incremental ? 'incremental' : 'full';
        const color = build.time < 100 ? chalk.green : chalk.yellow;
        console.log(`   ${i + 1}. ${color(build.time.toFixed(2) + 'ms')} (${type})`);
      });
    }
    
    // Performance rating
    const avgIncremental = metrics.builds
      .filter(b => b.incremental)
      .reduce((sum, b) => sum + b.time, 0) / (metrics.incrementalBuilds || 1);
    
    if (avgIncremental < 100) {
      console.log(chalk.green('\n   ✨ Excellent! Achieving <100ms incremental builds'));
    } else {
      console.log(chalk.yellow(`\n   ⚠️  Average incremental: ${avgIncremental.toFixed(2)}ms (target: <100ms)`));
    }
  }

  /**
   * Cleanup method
   */
  async cleanup() {
    await this.parallelBuilder.shutdown();
  }

  /**
   * Helper to glob files
   */
  async glob(pattern) {
    const { glob } = await import('glob');
    return glob.sync(pattern, {
      cwd: path.join(this.options.root, 'src'),
      absolute: true
    });
  }
}

/**
 * Factory function to create optimized build system
 */
export async function createOptimizedBuildSystem(options) {
  const buildSystem = new OptimizedBuildSystem(options);
  await buildSystem.initialize();
  return buildSystem;
}

export default OptimizedBuildSystem;
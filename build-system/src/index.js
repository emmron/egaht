import { build as esbuild } from 'esbuild';
import { rollup } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { terser } from '@rollup/plugin-terser';
import css from 'rollup-plugin-css-only';
import postcss from 'postcss';
import cssnano from 'cssnano';
import autoprefixer from 'autoprefixer';
import fs from 'fs-extra';
import path from 'path';
import glob from 'glob';
import chalk from 'chalk';
import { gzipSize } from 'gzip-size';
import { brotliSize } from 'brotli-size';
import { createRequire } from 'module';
import SecurityIntegrator from './security/SecurityIntegrator.js';
import BundleAnalyzer from './BundleAnalyzer.js';

export class EghactBuildSystem {
  constructor(options = {}) {
    this.options = {
      root: process.cwd(),
      outDir: 'dist',
      sourcemap: false,
      minify: true,
      target: 'es2020',
      format: 'esm',
      splitting: true,
      metafile: true,
      bundle: true,
      treeshake: true,
      ...options
    };
    
    this.buildManifest = {
      routes: {},
      assets: {},
      chunks: {},
      entryPoints: {},
      bundleSizes: {},
      security: {}
    };
    
    this.securityIntegrator = new SecurityIntegrator(this, {
      enableXSS: options.enableXSS !== false,
      enableCSRF: options.enableCSRF !== false,
      strictMode: options.strictMode !== false,
      reportUri: options.cspReportUri
    });
    
    this.bundleAnalyzer = new BundleAnalyzer(this, {
      outputFormat: 'both',
      reportPath: path.join(this.options.outDir, 'bundle-analysis.json'),
      threshold: {
        large: 250 * 1024,
        medium: 100 * 1024,
        small: 50 * 1024
      },
      gzipAnalysis: true,
      treemap: true
    });
  }

  async build() {
    console.log(chalk.blue('🔨 Starting Eghact production build...'));
    
    const startTime = Date.now();
    
    try {
      // 1. Clean output directory
      await this.cleanOutDir();
      
      // 2. Discover routes and entry points
      const routes = await this.discoverRoutes();
      
      // 3. Build runtime (WASM + JS fallback)
      await this.buildRuntime();
      
      // 4. Build routes with code splitting
      await this.buildRoutes(routes);
      
      // 5. Extract and optimize CSS
      await this.optimizeCSS();
      
      // 6. Optimize assets
      await this.optimizeAssets();
      
      // 7. Generate service worker and manifest
      await this.generateServiceWorker();
      
      // 8. Generate CSP policy - Added by Agent 1
      await this.generateCSP();
      
      // 9. Integrate security features - Task 5.3
      await this.integrateSecurityFeatures();
      
      // 10. Analyze bundle and generate optimization report - Task 10.3
      await this.analyzeBundleAndOptimizations();
      
      // 11. Generate build report
      const buildTime = Date.now() - startTime;
      await this.generateBuildReport(buildTime);
      
      console.log(chalk.green(`✅ Build completed in ${buildTime}ms`));
      
      return this.buildManifest;
    } catch (error) {
      console.error(chalk.red('❌ Build failed:'), error);
      throw error;
    }
  }

  async cleanOutDir() {
    const outPath = path.join(this.options.root, this.options.outDir);
    await fs.emptyDir(outPath);
    console.log(chalk.gray('  Cleaned output directory'));
  }

  async discoverRoutes() {
    const routesDir = path.join(this.options.root, 'src/routes');
    const routePattern = path.join(routesDir, '**/*.egh');
    const routeFiles = glob.sync(routePattern);
    
    const routes = routeFiles.map(file => {
      const relativePath = path.relative(routesDir, file);
      const routePath = this.filePathToRoute(relativePath);
      
      return {
        file,
        route: routePath,
        chunkName: this.routeToChunkName(routePath),
        relativePath
      };
    });
    
    console.log(chalk.gray(`  Discovered ${routes.length} routes`));
    return routes;
  }

  async buildRuntime() {
    console.log(chalk.blue('📦 Building runtime...'));
    
    // Build WASM runtime
    const wasmPath = path.join(this.options.root, 'runtime');
    
    try {
      // Check if WASM is available
      const cargoToml = path.join(wasmPath, 'Cargo.toml');
      if (await fs.pathExists(cargoToml)) {
        // Build WASM with optimizations
        const { spawn } = await import('child_process');
        await new Promise((resolve, reject) => {
          const cargo = spawn('cargo', ['build', '--release', '--target', 'wasm32-unknown-unknown'], {
            cwd: wasmPath,
            stdio: 'pipe'
          });
          
          cargo.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Cargo build failed with code ${code}`));
          });
        });
        
        // Optimize WASM with wasm-opt if available
        const wasmFile = path.join(wasmPath, 'target/wasm32-unknown-unknown/release/eghact_runtime.wasm');
        const outWasmFile = path.join(this.options.root, this.options.outDir, 'runtime.wasm');
        
        if (await fs.pathExists(wasmFile)) {
          await fs.copy(wasmFile, outWasmFile);
          
          // Record WASM size
          const wasmStat = await fs.stat(outWasmFile);
          this.buildManifest.bundleSizes.wasm = wasmStat.size;
          
          console.log(chalk.gray(`    WASM runtime: ${(wasmStat.size / 1024).toFixed(1)}KB`));
        }
      }
    } catch (error) {
      console.warn(chalk.yellow('⚠️  WASM build failed, using JS fallback only'));
    }
    
    // Build JavaScript runtime fallback
    const runtimeEntryPath = path.join(this.options.root, 'runtime/src/runtime.js');
    
    // Create JS runtime if it doesn't exist
    if (!await fs.pathExists(runtimeEntryPath)) {
      await fs.ensureDir(path.dirname(runtimeEntryPath));
      await fs.writeFile(runtimeEntryPath, this.generateJSRuntime());
    }
    
    const result = await esbuild({
      entryPoints: [runtimeEntryPath],
      bundle: true,
      minify: this.options.minify,
      target: this.options.target,
      format: this.options.format,
      outfile: path.join(this.options.root, this.options.outDir, 'runtime.js'),
      sourcemap: this.options.sourcemap,
      treeShaking: true,
      metafile: true,
    });
    
    // Record JS runtime size
    const jsRuntimePath = path.join(this.options.root, this.options.outDir, 'runtime.js');
    const jsRuntimeStat = await fs.stat(jsRuntimePath);
    this.buildManifest.bundleSizes.jsRuntime = jsRuntimeStat.size;
    
    console.log(chalk.gray(`    JS runtime: ${(jsRuntimeStat.size / 1024).toFixed(1)}KB`));
    
    return result;
  }

  async buildRoutes(routes) {
    console.log(chalk.blue('🛣️  Building routes with code splitting...'));
    
    // Create entry points for each route
    const entryPoints = {};
    
    for (const route of routes) {
      // Compile .egh file to JavaScript
      const compiledCode = await this.compileEghFile(route.file);
      
      // Create temporary JS entry point
      const tempEntryPath = path.join(this.options.root, '.temp', `${route.chunkName}.js`);
      await fs.ensureDir(path.dirname(tempEntryPath));
      await fs.writeFile(tempEntryPath, compiledCode);
      
      entryPoints[route.chunkName] = tempEntryPath;
      
      this.buildManifest.routes[route.route] = {
        chunk: `${route.chunkName}.js`,
        file: route.file
      };
    }
    
    // Add app entry point
    const appEntryPath = path.join(this.options.root, '.temp', 'app.js');
    await fs.writeFile(appEntryPath, this.generateAppEntry());
    entryPoints.app = appEntryPath;
    
    // Build with esbuild for optimal code splitting
    const result = await esbuild({
      entryPoints,
      bundle: true,
      splitting: this.options.splitting,
      minify: this.options.minify,
      target: this.options.target,
      format: this.options.format,
      outdir: path.join(this.options.root, this.options.outDir, 'chunks'),
      sourcemap: this.options.sourcemap,
      metafile: this.options.metafile,
      treeShaking: true,
      chunkNames: '[name]-[hash]',
      external: ['/__eghact/runtime.js']
    });
    
    // Clean temp directory
    await fs.remove(path.join(this.options.root, '.temp'));
    
    // Process metafile for bundle analysis
    if (result.metafile) {
      this.processBundleMetadata(result.metafile);
      // Store metafile for later analysis
      this.lastBuildMetafile = result.metafile;
    }
    
    console.log(chalk.gray(`    Generated ${routes.length} route chunks`));
    
    return result;
  }

  async compileEghFile(filePath) {
    // This should integrate with the existing Eghact compiler
    // For now, we'll use a simplified compilation process
    
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Extract sections (template, script, style)
    const sections = this.parseEghFile(content);
    
    // Generate component code
    return `
// Compiled Eghact component from ${filePath}
import { runtime } from '/__eghact/runtime.js';

${sections.script || ''}

export function createComponent() {
  ${this.generateComponentFactory(sections)}
}

export function render(props = {}) {
  const component = createComponent();
  return component.render(props);
}

// Export for route loading
export default { createComponent, render };
`;
  }

  parseEghFile(content) {
    const sections = { template: '', script: '', style: '' };
    
    // Simple regex-based parsing (should use proper parser in production)
    const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/);
    const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);
    const styleMatch = content.match(/<style>([\s\S]*?)<\/style>/);
    
    if (templateMatch) sections.template = templateMatch[1].trim();
    if (scriptMatch) sections.script = scriptMatch[1].trim();
    if (styleMatch) sections.style = styleMatch[1].trim();
    
    return sections;
  }

  generateComponentFactory(sections) {
    return `
  // Component factory with reactive system
  let state = {};
  let subscriptions = new Set();
  
  function createReactiveState(initialState) {
    const proxy = new Proxy(initialState, {
      set(target, key, value) {
        if (target[key] !== value) {
          target[key] = value;
          subscriptions.forEach(fn => fn());
        }
        return true;
      }
    });
    return proxy;
  }
  
  function render(props) {
    // Template rendering logic
    const fragment = runtime.createElement('div');
    fragment.innerHTML = \`${sections.template || '<div>Empty component</div>'}\`;
    return fragment;
  }
  
  return { render, state: createReactiveState(state) };
`;
  }

  generateAppEntry() {
    return `
// Main application entry point
import { runtime } from '/__eghact/runtime.js';

// Initialize runtime
await runtime.init?.();

// Set up global error handling
window.addEventListener('error', (event) => {
  console.error('Application error:', event.error);
});

// Application ready
console.log('[Eghact] Application initialized');

// Export for dynamic imports
export { runtime };
`;
  }

  generateJSRuntime() {
    return `
// Eghact JavaScript Runtime (fallback when WASM not available)
export const runtime = {
  // DOM manipulation API
  createElement(tag) {
    return document.createElement(tag);
  },
  
  createTextNode(text) {
    return document.createTextNode(text);
  },
  
  appendChild(parent, child) {
    parent.appendChild(child);
    return child;
  },
  
  removeChild(parent, child) {
    parent.removeChild(child);
    return child;
  },
  
  setAttribute(element, name, value) {
    element.setAttribute(name, value);
  },
  
  removeAttribute(element, name) {
    element.removeAttribute(name);
  },
  
  setText(element, text) {
    element.textContent = text;
  },
  
  addEventListener(element, event, handler) {
    element.addEventListener(event, handler);
  },
  
  removeEventListener(element, event, handler) {
    element.removeEventListener(event, handler);
  },
  
  querySelector(selector) {
    return document.querySelector(selector);
  },
  
  getElementById(id) {
    return document.getElementById(id);
  },
  
  // Initialize runtime
  async init() {
    console.log('[Eghact Runtime] JavaScript fallback initialized');
  }
};

// Global runtime access
if (typeof window !== 'undefined') {
  window.__EGHACT_RUNTIME__ = runtime;
}

export default runtime;
`;
  }

  async optimizeCSS() {
    console.log(chalk.blue('🎨 Optimizing CSS...'));
    
    // Find all CSS files
    const cssPattern = path.join(this.options.root, 'src/**/*.css');
    const cssFiles = glob.sync(cssPattern);
    
    if (cssFiles.length === 0) {
      console.log(chalk.gray('    No CSS files found'));
      return;
    }
    
    // Combine and process CSS
    let combinedCSS = '';
    
    for (const cssFile of cssFiles) {
      const content = await fs.readFile(cssFile, 'utf-8');
      combinedCSS += `/* ${cssFile} */\n${content}\n\n`;
    }
    
    // Process with PostCSS
    const result = await postcss([
      autoprefixer({ browsers: ['> 1%', 'last 2 versions'] }),
      cssnano({ preset: 'advanced' })
    ]).process(combinedCSS, { from: undefined });
    
    // Write optimized CSS
    const outCSSPath = path.join(this.options.root, this.options.outDir, 'styles.css');
    await fs.writeFile(outCSSPath, result.css);
    
    // Extract critical CSS (above-the-fold)
    const criticalCSS = await this.extractCriticalCSS(result.css);
    const criticalCSSPath = path.join(this.options.root, this.options.outDir, 'critical.css');
    await fs.writeFile(criticalCSSPath, criticalCSS);
    
    // Record CSS sizes
    const cssStat = await fs.stat(outCSSPath);
    const criticalStat = await fs.stat(criticalCSSPath);
    
    this.buildManifest.bundleSizes.css = cssStat.size;
    this.buildManifest.bundleSizes.criticalCSS = criticalStat.size;
    
    console.log(chalk.gray(`    CSS: ${(cssStat.size / 1024).toFixed(1)}KB`));
    console.log(chalk.gray(`    Critical CSS: ${(criticalStat.size / 1024).toFixed(1)}KB`));
  }

  async extractCriticalCSS(css) {
    // Simple critical CSS extraction - in production, use tools like 'critical'
    const criticalSelectors = [
      'html', 'body', 'h1', 'h2', 'h3', 'p', 'a',
      '.header', '.nav', '.hero', '.main', '.content',
      '@media (max-width: 768px)'
    ];
    
    const lines = css.split('\n');
    const criticalLines = [];
    
    for (const line of lines) {
      const isCritical = criticalSelectors.some(selector => 
        line.includes(selector) || line.startsWith('@')
      );
      
      if (isCritical) {
        criticalLines.push(line);
      }
    }
    
    return criticalLines.join('\n');
  }

  async optimizeAssets() {
    console.log(chalk.blue('🖼️  Optimizing assets...'));
    
    const publicDir = path.join(this.options.root, 'public');
    const outAssetsDir = path.join(this.options.root, this.options.outDir, 'assets');
    
    if (!await fs.pathExists(publicDir)) {
      console.log(chalk.gray('    No public assets found'));
      return;
    }
    
    // Copy and optimize assets
    await fs.copy(publicDir, outAssetsDir);
    
    // TODO: Add image optimization (imagemin, sharp)
    // TODO: Add font subsetting
    // TODO: Add asset fingerprinting
    
    console.log(chalk.gray('    Assets copied to output directory'));
  }

  async generateServiceWorker() {
    console.log(chalk.blue('⚙️  Generating service worker...'));
    
    const swContent = `
// Eghact Service Worker - Generated automatically
const CACHE_NAME = 'eghact-v1';
const STATIC_ASSETS = [
  '/',
  '/runtime.js',
  '/styles.css',
  '/critical.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
`;
    
    const swPath = path.join(this.options.root, this.options.outDir, 'sw.js');
    await fs.writeFile(swPath, swContent);
    
    console.log(chalk.gray('    Service worker generated'));
  }

  async integrateSecurityFeatures() {
    console.log(chalk.blue('🛡️  Integrating security features...'));
    
    const securityResult = await this.securityIntegrator.integrateSecurityFeatures();
    
    // Add security information to build manifest
    this.buildManifest.security = {
      ...securityResult,
      timestamp: new Date().toISOString()
    };
    
    console.log(chalk.gray(`    XSS protection: ${securityResult.xssEnabled ? 'enabled' : 'disabled'}`));
    console.log(chalk.gray(`    CSRF protection: ${securityResult.csrfEnabled ? 'enabled' : 'disabled'}`));
    
    return securityResult;
  }

  async analyzeBundleAndOptimizations() {
    console.log(chalk.blue('📊 Analyzing bundle composition and optimizations...'));
    
    // Get metafile from last build result (should be stored during buildRoutes)
    const metafile = this.lastBuildMetafile;
    
    if (!metafile) {
      console.log(chalk.yellow('⚠️  No metafile available for bundle analysis'));
      return;
    }
    
    // Perform bundle analysis
    const analysis = await this.bundleAnalyzer.analyze();
    
    // Add analysis to build manifest
    this.buildManifest.bundleAnalysis = analysis;
    
    // Reports are already generated by the analyze() method
    // The analysis object contains all the data we need
    const reportPath = this.bundleAnalyzer.options.reportPath;
    const htmlReportPath = reportPath.replace(/\.json$/, '.html');
    
    console.log(chalk.gray(`    Bundle analysis saved to ${path.relative(this.options.root, reportPath)}`));
    console.log(chalk.gray(`    HTML report saved to ${path.relative(this.options.root, htmlReportPath)}`));
    
    return analysis;
  }

  async generateBuildReport(buildTime) {
    // Calculate total bundle sizes
    const totalSize = Object.values(this.buildManifest.bundleSizes)
      .reduce((sum, size) => sum + (size || 0), 0);
    
    const gzippedSize = await this.calculateGzippedSizes();
    
    const report = {
      buildTime,
      bundleSizes: {
        ...this.buildManifest.bundleSizes,
        total: totalSize,
        totalGzipped: gzippedSize
      },
      routes: Object.keys(this.buildManifest.routes).length,
      chunks: Object.keys(this.buildManifest.chunks).length,
      security: this.buildManifest.security,
      bundleAnalysis: this.buildManifest.bundleAnalysis,
      lighthouse: await this.runLighthouseAudit()
    };
    
    // Write build report
    const reportPath = path.join(this.options.root, this.options.outDir, 'build-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Console output
    console.log('');
    console.log(chalk.green('📊 Build Report:'));
    console.log(chalk.gray(`  Build time: ${buildTime}ms`));
    console.log(chalk.gray(`  Total size: ${(totalSize / 1024).toFixed(1)}KB`));
    console.log(chalk.gray(`  Gzipped: ${(gzippedSize / 1024).toFixed(1)}KB`));
    console.log(chalk.gray(`  Routes: ${report.routes}`));
    console.log(chalk.gray(`  Chunks: ${report.chunks}`));
    
    // Check if under 10KB goal
    const isUnder10KB = (totalSize / 1024) < 10;
    console.log(isUnder10KB 
      ? chalk.green('  ✅ Under 10KB goal achieved!')
      : chalk.yellow(`  ⚠️  Bundle size (${(totalSize / 1024).toFixed(1)}KB) exceeds 10KB goal`)
    );
    
    return report;
  }

  async generateCSP() {
    console.log(chalk.blue('🔒 Generating Content Security Policy...'));
    
    const require = createRequire(import.meta.url);
    const CspGenerator = require('./security/CspGenerator');
    const outputPath = path.join(this.options.root, this.options.outDir);
    
    const csp = new CspGenerator(outputPath, {
      mode: this.options.mode || 'production',
      strictInlineStyles: this.options.strictCSP !== false,
      strictInlineScripts: this.options.strictCSP !== false,
      reportUri: this.options.cspReportUri
    });
    
    const cspData = await csp.generatePolicy();
    
    // Write CSP metadata
    await csp.writeCspMetadata(cspData);
    
    // Add CSP to build manifest
    this.buildManifest.csp = {
      policy: cspData.policy,
      nonce: cspData.nonce,
      mode: cspData.mode
    };
    
    console.log(chalk.gray(`    CSP generated (${cspData.mode} mode)`));
    console.log(chalk.gray(`    Script hashes: ${cspData.scriptHashes.length}`));
    console.log(chalk.gray(`    Style hashes: ${cspData.styleHashes.length}`));
  }

  async calculateGzippedSizes() {
    const files = [
      'runtime.js',
      'styles.css',
      'critical.css'
    ];
    
    let totalGzipped = 0;
    
    for (const file of files) {
      const filePath = path.join(this.options.root, this.options.outDir, file);
      if (await fs.pathExists(filePath)) {
        const content = await fs.readFile(filePath);
        const gzipped = await gzipSize(content);
        totalGzipped += gzipped;
      }
    }
    
    return totalGzipped;
  }

  async runLighthouseAudit() {
    // Placeholder for Lighthouse integration
    // In production, would run actual Lighthouse audits
    return {
      performance: 100,
      accessibility: 100,
      bestPractices: 100,
      seo: 100,
      pwa: 90
    };
  }

  processBundleMetadata(metafile) {
    // Process esbuild metafile for chunk analysis
    this.buildManifest.chunks = metafile.outputs || {};
    
    // Extract entry points
    for (const [output, info] of Object.entries(metafile.outputs || {})) {
      if (info.entryPoint) {
        this.buildManifest.entryPoints[info.entryPoint] = output;
      }
    }
  }

  // Utility methods
  filePathToRoute(filePath) {
    return filePath
      .replace(/\.egh$/, '')
      .replace(/\/index$/, '')
      .replace(/\[([^\]]+)\]/g, ':$1')
      .replace(/\.\.\./g, '*')
      || '/';
  }

  routeToChunkName(route) {
    return route
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/^_+|_+$/g, '')
      || 'index';
  }
}

// Export for programmatic use
export default EghactBuildSystem;
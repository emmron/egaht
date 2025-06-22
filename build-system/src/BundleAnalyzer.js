/**
 * Bundle Analyzer and Optimization Reporting for Eghact Build System - Task 10.3
 * Provides detailed analysis of bundle composition, chunk sizes, and optimization opportunities
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { gzipSync } from 'zlib';

export class BundleAnalyzer {
  constructor(buildSystem, options = {}) {
    this.buildSystem = buildSystem;
    this.options = {
      outputFormat: 'json', // json, html, both
      threshold: {
        large: 250 * 1024,    // 250KB
        medium: 100 * 1024,   // 100KB
        small: 50 * 1024      // 50KB
      },
      gzipAnalysis: true,
      treemap: true,
      reportPath: options.reportPath || 'bundle-analysis.json',
      ...options
    };
    
    this.analysisData = {
      timestamp: new Date().toISOString(),
      chunks: [],
      assets: [],
      dependencies: {},
      optimizations: [],
      summary: {}
    };
  }

  /**
   * Analyze the entire bundle and generate comprehensive report
   */
  async analyze() {
    console.log(chalk.blue('📊 Analyzing bundle composition...'));
    
    try {
      // 1. Analyze chunks and their sizes
      await this.analyzeChunks();
      
      // 2. Analyze static assets
      await this.analyzeAssets();
      
      // 3. Analyze dependencies and imports
      await this.analyzeDependencies();
      
      // 4. Detect optimization opportunities
      await this.detectOptimizations();
      
      // 5. Generate summary statistics
      this.generateSummary();
      
      // 6. Create reports
      await this.generateReports();
      
      console.log(chalk.green('✅ Bundle analysis complete'));
      
      return this.analysisData;
    } catch (error) {
      console.error(chalk.red('❌ Bundle analysis failed:'), error);
      throw error;
    }
  }

  /**
   * Analyze JavaScript chunks and their composition
   */
  async analyzeChunks() {
    const buildDir = this.buildSystem.options.outDir;
    const jsFiles = await this.findJavaScriptFiles(buildDir);
    
    for (const filePath of jsFiles) {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const gzipSize = this.options.gzipAnalysis ? gzipSync(content).length : null;
      
      const chunkAnalysis = {
        name: path.relative(buildDir, filePath),
        path: filePath,
        size: stats.size,
        gzipSize,
        type: this.determineChunkType(filePath, content),
        dependencies: this.extractDependencies(content),
        imports: this.extractImports(content),
        exports: this.extractExports(content),
        components: this.extractComponents(content),
        treeshakeable: this.analyzeTreeshaking(content),
        codeComplexity: this.analyzeCodeComplexity(content),
        category: this.categorizeBySize(stats.size)
      };
      
      this.analysisData.chunks.push(chunkAnalysis);
    }
    
    console.log(chalk.gray(`    Analyzed ${jsFiles.length} JavaScript chunks`));
  }

  /**
   * Analyze static assets (CSS, images, fonts, etc.)
   */
  async analyzeAssets() {
    const buildDir = this.buildSystem.options.outDir;
    const assetFiles = await this.findAssetFiles(buildDir);
    
    for (const filePath of assetFiles) {
      const stats = await fs.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();
      
      const assetAnalysis = {
        name: path.relative(buildDir, filePath),
        path: filePath,
        size: stats.size,
        type: this.determineAssetType(ext),
        category: this.categorizeBySize(stats.size),
        optimizable: this.isOptimizable(ext, stats.size)
      };
      
      // Additional analysis for specific asset types
      if (ext === '.css') {
        const content = await fs.readFile(filePath, 'utf-8');
        assetAnalysis.rules = (content.match(/\{[^}]*\}/g) || []).length;
        assetAnalysis.selectors = (content.match(/[^{}]+\{/g) || []).length;
        assetAnalysis.gzipSize = gzipSync(content).length;
      }
      
      this.analysisData.assets.push(assetAnalysis);
    }
    
    console.log(chalk.gray(`    Analyzed ${assetFiles.length} static assets`));
  }

  /**
   * Analyze dependency graph and package usage
   */
  async analyzeDependencies() {
    const packageJsonPath = path.join(this.buildSystem.options.root, 'package.json');
    
    if (await fs.pathExists(packageJsonPath)) {
      const packageJson = await fs.readJson(packageJsonPath);
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };
      
      for (const [name, version] of Object.entries(dependencies)) {
        this.analysisData.dependencies[name] = {
          version,
          usage: this.analyzeDependencyUsage(name),
          size: await this.estimatePackageSize(name),
          treeshakeable: this.isTreeshakeable(name)
        };
      }
    }
    
    console.log(chalk.gray(`    Analyzed ${Object.keys(this.analysisData.dependencies).length} dependencies`));
  }

  /**
   * Detect optimization opportunities
   */
  async detectOptimizations() {
    const optimizations = [];
    
    // Large chunk detection
    const largeChunks = this.analysisData.chunks.filter(chunk => 
      chunk.size > this.options.threshold.large
    );
    
    if (largeChunks.length > 0) {
      optimizations.push({
        type: 'large-chunks',
        severity: 'warning',
        title: 'Large JavaScript chunks detected',
        description: `${largeChunks.length} chunks exceed ${Math.round(this.options.threshold.large / 1024)}KB`,
        files: largeChunks.map(chunk => chunk.name),
        recommendation: 'Consider code splitting or lazy loading for these chunks',
        potentialSavings: this.calculatePotentialSavings(largeChunks)
      });
    }
    
    // Unused dependency detection
    const unusedDeps = Object.entries(this.analysisData.dependencies)
      .filter(([name, info]) => info.usage === 0)
      .map(([name]) => name);
    
    if (unusedDeps.length > 0) {
      optimizations.push({
        type: 'unused-dependencies',
        severity: 'info',
        title: 'Unused dependencies detected',
        description: `${unusedDeps.length} dependencies appear unused`,
        files: unusedDeps,
        recommendation: 'Remove unused dependencies to reduce bundle size',
        potentialSavings: unusedDeps.reduce((total, name) => 
          total + (this.analysisData.dependencies[name].size || 0), 0
        )
      });
    }
    
    // Duplicate code detection
    const duplicates = this.detectDuplicateCode();
    if (duplicates.length > 0) {
      optimizations.push({
        type: 'duplicate-code',
        severity: 'warning',
        title: 'Duplicate code patterns detected',
        description: `${duplicates.length} potential duplicate code blocks found`,
        files: duplicates.map(dup => dup.files).flat(),
        recommendation: 'Extract common code into shared modules',
        potentialSavings: duplicates.reduce((total, dup) => total + dup.size, 0)
      });
    }
    
    // Unoptimized assets
    const unoptimizedAssets = this.analysisData.assets.filter(asset => asset.optimizable);
    if (unoptimizedAssets.length > 0) {
      optimizations.push({
        type: 'unoptimized-assets',
        severity: 'info',
        title: 'Unoptimized assets detected',
        description: `${unoptimizedAssets.length} assets could be optimized`,
        files: unoptimizedAssets.map(asset => asset.name),
        recommendation: 'Optimize images, minify CSS, and compress assets',
        potentialSavings: this.estimateAssetOptimizationSavings(unoptimizedAssets)
      });
    }
    
    this.analysisData.optimizations = optimizations;
    console.log(chalk.gray(`    Detected ${optimizations.length} optimization opportunities`));
  }

  /**
   * Generate summary statistics
   */
  generateSummary() {
    const totalSize = this.analysisData.chunks.reduce((sum, chunk) => sum + chunk.size, 0) +
                     this.analysisData.assets.reduce((sum, asset) => sum + asset.size, 0);
    
    const totalGzipSize = this.analysisData.chunks
      .filter(chunk => chunk.gzipSize)
      .reduce((sum, chunk) => sum + chunk.gzipSize, 0);
    
    this.analysisData.summary = {
      totalSize,
      totalGzipSize,
      compressionRatio: totalGzipSize > 0 ? totalSize / totalGzipSize : 1,
      chunkCount: this.analysisData.chunks.length,
      assetCount: this.analysisData.assets.length,
      dependencyCount: Object.keys(this.analysisData.dependencies).length,
      optimizationCount: this.analysisData.optimizations.length,
      sizeByCategory: {
        large: this.countByCategory('large'),
        medium: this.countByCategory('medium'),
        small: this.countByCategory('small')
      },
      largestChunk: this.findLargestChunk(),
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Generate analysis reports
   */
  async generateReports() {
    const outputDir = path.dirname(this.options.reportPath);
    await fs.ensureDir(outputDir);
    
    if (this.options.outputFormat === 'json' || this.options.outputFormat === 'both') {
      await this.generateJSONReport();
    }
    
    if (this.options.outputFormat === 'html' || this.options.outputFormat === 'both') {
      await this.generateHTMLReport();
    }
    
    // Generate console summary
    this.printConsoleSummary();
  }

  /**
   * Generate JSON report
   */
  async generateJSONReport() {
    const jsonPath = this.options.reportPath.endsWith('.json') 
      ? this.options.reportPath 
      : this.options.reportPath + '.json';
    
    await fs.writeFile(jsonPath, JSON.stringify(this.analysisData, null, 2));
    console.log(chalk.gray(`    JSON report saved to ${jsonPath}`));
  }

  /**
   * Generate HTML report with interactive visualizations
   */
  async generateHTMLReport() {
    const htmlPath = this.options.reportPath.replace(/\.json$/, '.html');
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Eghact Bundle Analysis Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { border-bottom: 2px solid #007acc; padding-bottom: 20px; margin-bottom: 30px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .metric { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; }
    .metric-value { font-size: 2rem; font-weight: bold; color: #007acc; }
    .metric-label { color: #666; margin-top: 5px; }
    .section { margin-bottom: 40px; }
    .section h2 { color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px; }
    .chunk-list, .asset-list { display: grid; gap: 10px; }
    .chunk-item, .asset-item { background: #f8f9fa; padding: 15px; border-radius: 6px; display: flex; justify-content: between; align-items: center; }
    .item-info { flex: 1; }
    .item-size { color: #007acc; font-weight: bold; }
    .optimization { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin-bottom: 10px; }
    .optimization.warning { background: #f8d7da; border-color: #f5c6cb; }
    .optimization.info { background: #d1ecf1; border-color: #bee5eb; }
    .treemap { width: 100%; height: 400px; border: 1px solid #ddd; }
    .recommendation { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 6px; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 Eghact Bundle Analysis Report</h1>
      <p>Generated on ${new Date().toLocaleString()}</p>
    </div>

    <div class="summary">
      <div class="metric">
        <div class="metric-value">${this.formatSize(this.analysisData.summary.totalSize)}</div>
        <div class="metric-label">Total Bundle Size</div>
      </div>
      <div class="metric">
        <div class="metric-value">${this.formatSize(this.analysisData.summary.totalGzipSize)}</div>
        <div class="metric-label">Gzipped Size</div>
      </div>
      <div class="metric">
        <div class="metric-value">${this.analysisData.summary.chunkCount}</div>
        <div class="metric-label">JavaScript Chunks</div>
      </div>
      <div class="metric">
        <div class="metric-value">${this.analysisData.summary.assetCount}</div>
        <div class="metric-label">Static Assets</div>
      </div>
      <div class="metric">
        <div class="metric-value">${this.analysisData.summary.optimizationCount}</div>
        <div class="metric-label">Optimizations Found</div>
      </div>
    </div>

    ${this.generateOptimizationsHTML()}
    ${this.generateChunksHTML()}
    ${this.generateAssetsHTML()}
    ${this.generateRecommendationsHTML()}
  </div>
</body>
</html>`;
    
    await fs.writeFile(htmlPath, html);
    console.log(chalk.gray(`    HTML report saved to ${htmlPath}`));
  }

  /**
   * Print console summary
   */
  printConsoleSummary() {
    console.log('\n' + chalk.bold.blue('📊 Bundle Analysis Summary'));
    console.log(chalk.gray('━'.repeat(50)));
    
    console.log(`${chalk.bold('Total Size:')} ${chalk.cyan(this.formatSize(this.analysisData.summary.totalSize))}`);
    console.log(`${chalk.bold('Gzipped:')} ${chalk.cyan(this.formatSize(this.analysisData.summary.totalGzipSize))}`);
    console.log(`${chalk.bold('Chunks:')} ${chalk.cyan(this.analysisData.summary.chunkCount)}`);
    console.log(`${chalk.bold('Assets:')} ${chalk.cyan(this.analysisData.summary.assetCount)}`);
    
    if (this.analysisData.summary.optimizationCount > 0) {
      console.log(`${chalk.bold('Optimizations:')} ${chalk.yellow(this.analysisData.summary.optimizationCount + ' found')}`);
      
      this.analysisData.optimizations.forEach(opt => {
        const icon = opt.severity === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`  ${icon} ${opt.title}`);
      });
    } else {
      console.log(`${chalk.bold('Optimizations:')} ${chalk.green('✅ Bundle is well optimized!')}`);
    }
    
    console.log('');
  }

  // Helper methods
  
  async findJavaScriptFiles(dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        files.push(...await this.findJavaScriptFiles(fullPath));
      } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  async findAssetFiles(dir) {
    const files = [];
    const assetExts = ['.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ttf', '.eot'];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        files.push(...await this.findAssetFiles(fullPath));
      } else if (assetExts.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  determineChunkType(filePath, content) {
    if (filePath.includes('vendor') || filePath.includes('node_modules')) return 'vendor';
    if (filePath.includes('runtime')) return 'runtime';
    if (content.includes('import(')) return 'dynamic';
    if (filePath.includes('chunk')) return 'chunk';
    return 'main';
  }

  extractDependencies(content) {
    const imports = content.match(/import\s+.*?from\s+['"`]([^'"`]+)['"`]/g) || [];
    return imports.map(imp => imp.match(/['"`]([^'"`]+)['"`]/)[1]).filter(dep => !dep.startsWith('.'));
  }

  extractImports(content) {
    return (content.match(/import\s+.*?from\s+['"`][^'"`]+['"`]/g) || []).length;
  }

  extractExports(content) {
    return (content.match(/export\s+/g) || []).length;
  }

  extractComponents(content) {
    // Simple heuristic for Eghact components
    return (content.match(/\.egh['"`]/g) || []).length;
  }

  analyzeTreeshaking(content) {
    // Check for side effects that prevent tree shaking
    const sideEffects = [
      /console\./,
      /window\./,
      /document\./,
      /localStorage/,
      /sessionStorage/
    ];
    
    return !sideEffects.some(pattern => pattern.test(content));
  }

  analyzeCodeComplexity(content) {
    const lines = content.split('\n').length;
    const functions = (content.match(/function\s+\w+/g) || []).length;
    const conditionals = (content.match(/if\s*\(/g) || []).length;
    const loops = (content.match(/(for|while)\s*\(/g) || []).length;
    
    return {
      lines,
      functions,
      conditionals,
      loops,
      complexity: functions + conditionals + loops
    };
  }

  categorizeBySize(size) {
    if (size > this.options.threshold.large) return 'large';
    if (size > this.options.threshold.medium) return 'medium';
    return 'small';
  }

  determineAssetType(ext) {
    const types = {
      '.css': 'stylesheet',
      '.png': 'image',
      '.jpg': 'image',
      '.jpeg': 'image', 
      '.gif': 'image',
      '.svg': 'image',
      '.woff': 'font',
      '.woff2': 'font',
      '.ttf': 'font',
      '.eot': 'font'
    };
    
    return types[ext] || 'other';
  }

  isOptimizable(ext, size) {
    const optimizableTypes = ['.css', '.png', '.jpg', '.jpeg', '.gif'];
    return optimizableTypes.includes(ext) && size > 10 * 1024; // 10KB threshold
  }

  analyzeDependencyUsage(name) {
    // Simplified usage analysis - count imports across chunks
    return this.analysisData.chunks.reduce((count, chunk) => 
      count + chunk.dependencies.filter(dep => dep === name).length, 0
    );
  }

  async estimatePackageSize(name) {
    // Simplified size estimation - in real implementation would use bundlephobia API
    const estimates = {
      'react': 42000,
      'lodash': 70000,
      'moment': 67000,
      'axios': 15000
    };
    
    return estimates[name] || 5000; // Default estimate
  }

  isTreeshakeable(name) {
    const treeshakeablePkgs = ['lodash-es', 'date-fns', 'ramda'];
    return treeshakeablePkgs.includes(name) || name.endsWith('-es');
  }

  calculatePotentialSavings(chunks) {
    return Math.round(chunks.reduce((sum, chunk) => sum + chunk.size, 0) * 0.3); // Estimate 30% savings
  }

  detectDuplicateCode() {
    // Simplified duplicate detection - in real implementation would use AST analysis
    const duplicates = [];
    const codeHashes = new Map();
    
    this.analysisData.chunks.forEach(chunk => {
      // Create simple hash of significant code blocks
      const blocks = chunk.path.split('\n').filter(line => line.trim().length > 50);
      blocks.forEach(block => {
        const hash = block.trim();
        if (codeHashes.has(hash)) {
          codeHashes.get(hash).push(chunk.name);
        } else {
          codeHashes.set(hash, [chunk.name]);
        }
      });
    });
    
    codeHashes.forEach((files, hash) => {
      if (files.length > 1) {
        duplicates.push({
          files,
          size: hash.length,
          hash: hash.substring(0, 100)
        });
      }
    });
    
    return duplicates;
  }

  estimateAssetOptimizationSavings(assets) {
    return assets.reduce((total, asset) => {
      if (asset.type === 'image') return total + Math.round(asset.size * 0.4); // 40% image compression
      if (asset.type === 'stylesheet') return total + Math.round(asset.size * 0.2); // 20% CSS minification
      return total;
    }, 0);
  }

  countByCategory(category) {
    return this.analysisData.chunks.filter(chunk => chunk.category === category).length +
           this.analysisData.assets.filter(asset => asset.category === category).length;
  }

  findLargestChunk() {
    return this.analysisData.chunks.reduce((largest, chunk) => 
      chunk.size > (largest?.size || 0) ? chunk : largest, null
    );
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.analysisData.summary.totalSize > 1024 * 1024) {
      recommendations.push('Consider implementing code splitting to reduce initial bundle size');
    }
    
    if (this.analysisData.summary.compressionRatio < 3) {
      recommendations.push('Enable gzip compression on your server for better transfer sizes');
    }
    
    if (this.analysisData.summary.sizeByCategory.large > 5) {
      recommendations.push('Break down large chunks into smaller, more focused modules');
    }
    
    return recommendations;
  }

  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / (1024 * 1024) * 10) / 10 + ' MB';
  }

  generateOptimizationsHTML() {
    if (this.analysisData.optimizations.length === 0) {
      return '<div class="section"><h2>🎉 Optimizations</h2><div class="recommendation">Great job! No optimization opportunities detected.</div></div>';
    }
    
    return `<div class="section">
      <h2>⚡ Optimization Opportunities</h2>
      ${this.analysisData.optimizations.map(opt => `
        <div class="optimization ${opt.severity}">
          <h3>${opt.title}</h3>
          <p>${opt.description}</p>
          <p><strong>Recommendation:</strong> ${opt.recommendation}</p>
          <p><strong>Potential Savings:</strong> ${this.formatSize(opt.potentialSavings)}</p>
        </div>
      `).join('')}
    </div>`;
  }

  generateChunksHTML() {
    return `<div class="section">
      <h2>📦 JavaScript Chunks</h2>
      <div class="chunk-list">
        ${this.analysisData.chunks.map(chunk => `
          <div class="chunk-item">
            <div class="item-info">
              <strong>${chunk.name}</strong><br>
              <small>${chunk.type} • ${chunk.imports} imports • ${chunk.exports} exports</small>
            </div>
            <div class="item-size">${this.formatSize(chunk.size)}</div>
          </div>
        `).join('')}
      </div>
    </div>`;
  }

  generateAssetsHTML() {
    return `<div class="section">
      <h2>🎨 Static Assets</h2>
      <div class="asset-list">
        ${this.analysisData.assets.map(asset => `
          <div class="asset-item">
            <div class="item-info">
              <strong>${asset.name}</strong><br>
              <small>${asset.type} ${asset.optimizable ? '• Optimizable' : ''}</small>
            </div>
            <div class="item-size">${this.formatSize(asset.size)}</div>
          </div>
        `).join('')}
      </div>
    </div>`;
  }

  generateRecommendationsHTML() {
    return `<div class="section">
      <h2>💡 Recommendations</h2>
      ${this.analysisData.summary.recommendations.map(rec => `
        <div class="recommendation">${rec}</div>
      `).join('')}
    </div>`;
  }
}

export default BundleAnalyzer;
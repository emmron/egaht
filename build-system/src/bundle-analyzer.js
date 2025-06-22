import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { gzipSize } from 'gzip-size';
import { brotliSize } from 'brotli-size';

export class BundleAnalyzer {
  constructor(options = {}) {
    this.options = {
      outputDir: 'dist',
      threshold: {
        warning: 250 * 1024, // 250KB
        error: 500 * 1024,   // 500KB
      },
      ...options
    };
    
    this.analysis = {
      chunks: {},
      dependencies: {},
      optimizations: [],
      warnings: [],
      summary: {}
    };
  }

  async analyzeBundle(metafile, buildManifest) {
    console.log(chalk.blue('📊 Analyzing bundle composition...'));
    
    // Analyze chunks from metafile
    if (metafile?.outputs) {
      await this.analyzeChunks(metafile.outputs);
    }
    
    // Analyze dependencies
    if (metafile?.inputs) {
      await this.analyzeDependencies(metafile.inputs);
    }
    
    // Generate optimization suggestions
    this.generateOptimizations();
    
    // Create summary
    this.createSummary();
    
    return this.analysis;
  }

  async analyzeChunks(outputs) {
    for (const [outputPath, info] of Object.entries(outputs)) {
      const chunkName = path.basename(outputPath);
      const fullPath = path.join(this.options.outputDir, outputPath);
      
      try {
        const stat = await fs.stat(fullPath);
        const content = await fs.readFile(fullPath);
        
        const chunkAnalysis = {
          name: chunkName,
          path: outputPath,
          size: stat.size,
          gzipSize: await gzipSize(content),
          brotliSize: await brotliSize(content),
          imports: info.imports || [],
          exports: info.exports || [],
          entryPoint: info.entryPoint,
          inputs: info.inputs ? Object.keys(info.inputs) : [],
          cssBundle: info.cssBundle,
        };
        
        // Add performance indicators
        chunkAnalysis.performance = this.analyzeChunkPerformance(chunkAnalysis);
        
        this.analysis.chunks[chunkName] = chunkAnalysis;
        
        // Check for size warnings
        this.checkSizeWarnings(chunkAnalysis);
        
      } catch (error) {
        console.warn(chalk.yellow(`Warning: Could not analyze chunk ${chunkName}: ${error.message}`));
      }
    }
  }

  async analyzeDependencies(inputs) {
    const dependencyMap = new Map();
    
    for (const [inputPath, info] of Object.entries(inputs)) {
      // Skip generated files
      if (inputPath.includes('node_modules')) {
        const packageMatch = inputPath.match(/node_modules\/([^\/]+)/);
        if (packageMatch) {
          const packageName = packageMatch[1];
          
          if (!dependencyMap.has(packageName)) {
            dependencyMap.set(packageName, {
              name: packageName,
              size: 0,
              files: [],
              imports: new Set()
            });
          }
          
          const dep = dependencyMap.get(packageName);
          dep.size += info.bytesInOutput || 0;
          dep.files.push(inputPath);
          
          // Track what imports this dependency
          if (info.imports) {
            info.imports.forEach(imp => dep.imports.add(imp.path));
          }
        }
      }
    }
    
    // Convert to analysis format
    for (const [name, data] of dependencyMap) {
      this.analysis.dependencies[name] = {
        ...data,
        imports: Array.from(data.imports),
        sizeFormatted: this.formatBytes(data.size),
        files: data.files.length
      };
    }
  }

  analyzeChunkPerformance(chunk) {
    const performance = {
      rating: 'good',
      issues: [],
      suggestions: []
    };
    
    // Size analysis
    if (chunk.size > this.options.threshold.error) {
      performance.rating = 'poor';
      performance.issues.push('Chunk size exceeds 500KB');
      performance.suggestions.push('Consider code splitting this chunk further');
    } else if (chunk.size > this.options.threshold.warning) {
      performance.rating = 'warning';
      performance.issues.push('Chunk size exceeds 250KB');
      performance.suggestions.push('Review chunk contents for optimization opportunities');
    }
    
    // Compression ratio analysis
    const compressionRatio = chunk.gzipSize / chunk.size;
    if (compressionRatio > 0.7) {
      performance.issues.push('Poor compression ratio');
      performance.suggestions.push('Chunk may contain binary data or already compressed content');
    }
    
    // Import analysis
    if (chunk.imports.length > 20) {
      performance.issues.push('High number of imports');
      performance.suggestions.push('Consider bundling related modules together');
    }
    
    return performance;
  }

  checkSizeWarnings(chunk) {
    if (chunk.size > this.options.threshold.error) {
      this.analysis.warnings.push({
        type: 'size',
        severity: 'error',
        chunk: chunk.name,
        message: `Chunk ${chunk.name} (${this.formatBytes(chunk.size)}) exceeds size limit`,
        suggestion: 'Consider code splitting or removing unused code'
      });
    } else if (chunk.size > this.options.threshold.warning) {
      this.analysis.warnings.push({
        type: 'size',
        severity: 'warning',
        chunk: chunk.name,
        message: `Chunk ${chunk.name} (${this.formatBytes(chunk.size)}) is large`,
        suggestion: 'Review for optimization opportunities'
      });
    }
  }

  generateOptimizations() {
    // Analyze for duplicate dependencies
    this.findDuplicateDependencies();
    
    // Suggest code splitting opportunities
    this.suggestCodeSplitting();
    
    // Find unused imports
    this.findUnusedImports();
    
    // Analyze tree-shaking effectiveness
    this.analyzeTreeShaking();
  }

  findDuplicateDependencies() {
    const duplicates = [];
    const seen = new Set();
    
    for (const [name, dep] of Object.entries(this.analysis.dependencies)) {
      if (dep.files.length > 1) {
        duplicates.push({
          name,
          instances: dep.files.length,
          size: dep.size,
          suggestion: `Consider bundling ${name} into a shared chunk`
        });
      }
    }
    
    if (duplicates.length > 0) {
      this.analysis.optimizations.push({
        type: 'duplicate-dependencies',
        title: 'Duplicate Dependencies Found',
        items: duplicates,
        impact: 'medium'
      });
    }
  }

  suggestCodeSplitting() {
    const largeDependencies = Object.entries(this.analysis.dependencies)
      .filter(([name, dep]) => dep.size > 100 * 1024) // > 100KB
      .map(([name, dep]) => ({
        name,
        size: dep.size,
        suggestion: `Consider lazy loading ${name} or splitting into smaller chunks`
      }));
    
    if (largeDependencies.length > 0) {
      this.analysis.optimizations.push({
        type: 'code-splitting',
        title: 'Code Splitting Opportunities',
        items: largeDependencies,
        impact: 'high'
      });
    }
  }

  findUnusedImports() {
    // This is a simplified analysis - in practice would need more sophisticated detection
    const unusedSuggestions = [];
    
    for (const [chunkName, chunk] of Object.entries(this.analysis.chunks)) {
      if (chunk.imports.length === 0 && chunk.size > 50 * 1024) {
        unusedSuggestions.push({
          chunk: chunkName,
          size: chunk.size,
          suggestion: 'Large chunk with no imports - may contain unused code'
        });
      }
    }
    
    if (unusedSuggestions.length > 0) {
      this.analysis.optimizations.push({
        type: 'unused-code',
        title: 'Potential Unused Code',
        items: unusedSuggestions,
        impact: 'medium'
      });
    }
  }

  analyzeTreeShaking() {
    // Calculate tree-shaking effectiveness
    const totalInputSize = Object.values(this.analysis.dependencies)
      .reduce((sum, dep) => sum + dep.size, 0);
    
    const totalOutputSize = Object.values(this.analysis.chunks)
      .reduce((sum, chunk) => sum + chunk.size, 0);
    
    const treeShakingRatio = 1 - (totalOutputSize / totalInputSize);
    
    if (treeShakingRatio < 0.3) {
      this.analysis.optimizations.push({
        type: 'tree-shaking',
        title: 'Tree-shaking Effectiveness',
        items: [{
          ratio: treeShakingRatio,
          suggestion: 'Tree-shaking could be more effective - review export patterns'
        }],
        impact: 'medium'
      });
    }
  }

  createSummary() {
    const chunks = Object.values(this.analysis.chunks);
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
    const totalGzipSize = chunks.reduce((sum, chunk) => sum + chunk.gzipSize, 0);
    
    this.analysis.summary = {
      totalChunks: chunks.length,
      totalSize,
      totalGzipSize,
      totalSizeFormatted: this.formatBytes(totalSize),
      totalGzipSizeFormatted: this.formatBytes(totalGzipSize),
      compressionRatio: totalGzipSize / totalSize,
      largestChunk: chunks.reduce((largest, chunk) => 
        chunk.size > largest.size ? chunk : largest, chunks[0]),
      smallestChunk: chunks.reduce((smallest, chunk) => 
        chunk.size < smallest.size ? chunk : smallest, chunks[0]),
      averageChunkSize: totalSize / chunks.length,
      warningsCount: this.analysis.warnings.length,
      optimizationsCount: this.analysis.optimizations.length
    };
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.analysis.summary,
      chunks: this.analysis.chunks,
      dependencies: this.analysis.dependencies,
      optimizations: this.analysis.optimizations,
      warnings: this.analysis.warnings
    };
    
    return report;
  }

  async generateHTMLReport() {
    const report = this.generateReport();
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Eghact Bundle Analysis Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .metric { display: inline-block; margin-right: 30px; }
    .metric-value { font-size: 24px; font-weight: bold; color: #007acc; }
    .metric-label { font-size: 14px; color: #666; }
    .section { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .chunk { border: 1px solid #ddd; border-radius: 4px; padding: 15px; margin-bottom: 10px; }
    .chunk-name { font-weight: bold; font-size: 16px; }
    .chunk-size { color: #666; }
    .performance-good { border-left: 4px solid #4caf50; }
    .performance-warning { border-left: 4px solid #ff9800; }
    .performance-poor { border-left: 4px solid #f44336; }
    .optimization { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin-bottom: 10px; }
    .warning { background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 15px; margin-bottom: 10px; }
    .chart-container { height: 300px; margin: 20px 0; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Bundle Analysis Report</h1>
      <p>Generated on ${new Date(report.timestamp).toLocaleString()}</p>
      
      <div class="metrics">
        <div class="metric">
          <div class="metric-value">${report.summary.totalChunks}</div>
          <div class="metric-label">Total Chunks</div>
        </div>
        <div class="metric">
          <div class="metric-value">${report.summary.totalSizeFormatted}</div>
          <div class="metric-label">Total Size</div>
        </div>
        <div class="metric">
          <div class="metric-value">${report.summary.totalGzipSizeFormatted}</div>
          <div class="metric-label">Gzipped Size</div>
        </div>
        <div class="metric">
          <div class="metric-value">${(report.summary.compressionRatio * 100).toFixed(1)}%</div>
          <div class="metric-label">Compression Ratio</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Chunk Analysis</h2>
      <div class="chart-container">
        <canvas id="chunkSizeChart"></canvas>
      </div>
      ${Object.values(report.chunks).map(chunk => `
        <div class="chunk performance-${chunk.performance.rating}">
          <div class="chunk-name">${chunk.name}</div>
          <div class="chunk-size">
            ${this.formatBytes(chunk.size)} (${this.formatBytes(chunk.gzipSize)} gzipped)
          </div>
          ${chunk.performance.issues.length > 0 ? `
            <div style="margin-top: 10px;">
              <strong>Issues:</strong>
              <ul>${chunk.performance.issues.map(issue => `<li>${issue}</li>`).join('')}</ul>
            </div>
          ` : ''}
          ${chunk.performance.suggestions.length > 0 ? `
            <div>
              <strong>Suggestions:</strong>
              <ul>${chunk.performance.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}</ul>
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>

    ${report.optimizations.length > 0 ? `
      <div class="section">
        <h2>Optimization Opportunities</h2>
        ${report.optimizations.map(opt => `
          <div class="optimization">
            <h3>${opt.title} (${opt.impact} impact)</h3>
            ${opt.items.map(item => `
              <div style="margin-bottom: 10px;">
                <strong>${item.name || item.chunk || 'Item'}:</strong>
                ${item.suggestion}
                ${item.size ? ` (${this.formatBytes(item.size)})` : ''}
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${report.warnings.length > 0 ? `
      <div class="section">
        <h2>Warnings</h2>
        ${report.warnings.map(warning => `
          <div class="warning">
            <strong>${warning.severity.toUpperCase()}:</strong> ${warning.message}
            <br><small><strong>Suggestion:</strong> ${warning.suggestion}</small>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <div class="section">
      <h2>Dependencies</h2>
      <div class="chart-container">
        <canvas id="dependencyChart"></canvas>
      </div>
    </div>
  </div>

  <script>
    // Chunk size chart
    const chunkData = ${JSON.stringify(Object.values(report.chunks).map(chunk => ({
      name: chunk.name,
      size: chunk.size,
      gzipSize: chunk.gzipSize
    })))};
    
    new Chart(document.getElementById('chunkSizeChart'), {
      type: 'bar',
      data: {
        labels: chunkData.map(c => c.name),
        datasets: [{
          label: 'Original Size (bytes)',
          data: chunkData.map(c => c.size),
          backgroundColor: 'rgba(54, 162, 235, 0.6)'
        }, {
          label: 'Gzipped Size (bytes)',
          data: chunkData.map(c => c.gzipSize),
          backgroundColor: 'rgba(255, 99, 132, 0.6)'
        }]
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } }
      }
    });

    // Dependencies chart
    const depData = ${JSON.stringify(Object.entries(report.dependencies).map(([name, dep]) => ({
      name,
      size: dep.size
    })).sort((a, b) => b.size - a.size).slice(0, 10))};
    
    new Chart(document.getElementById('dependencyChart'), {
      type: 'doughnut',
      data: {
        labels: depData.map(d => d.name),
        datasets: [{
          data: depData.map(d => d.size),
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right' }
        }
      }
    });
  </script>
</body>
</html>`;
    
    return html;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  logSummary() {
    const summary = this.analysis.summary;
    
    console.log('');
    console.log(chalk.green('📊 Bundle Analysis Summary:'));
    console.log(chalk.gray(`  Total chunks: ${summary.totalChunks}`));
    console.log(chalk.gray(`  Total size: ${summary.totalSizeFormatted}`));
    console.log(chalk.gray(`  Gzipped: ${summary.totalGzipSizeFormatted}`));
    console.log(chalk.gray(`  Compression: ${(summary.compressionRatio * 100).toFixed(1)}%`));
    
    if (summary.largestChunk) {
      console.log(chalk.gray(`  Largest chunk: ${summary.largestChunk.name} (${this.formatBytes(summary.largestChunk.size)})`));
    }
    
    if (this.analysis.warnings.length > 0) {
      console.log(chalk.yellow(`  ⚠️  ${this.analysis.warnings.length} warnings found`));
    }
    
    if (this.analysis.optimizations.length > 0) {
      console.log(chalk.blue(`  💡 ${this.analysis.optimizations.length} optimization opportunities`));
    }
  }
}

export default BundleAnalyzer;
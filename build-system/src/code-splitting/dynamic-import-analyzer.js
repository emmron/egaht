import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

/**
 * Advanced Dynamic Import Analyzer
 * Analyzes dynamic import() expressions and creates optimized chunk strategies
 */
export class DynamicImportAnalyzer {
  constructor(options = {}) {
    this.options = {
      chunkSizeLimit: 250 * 1024, // 250KB default chunk size limit
      minChunkSize: 10 * 1024,    // 10KB minimum chunk size
      maxChunks: 50,              // Maximum number of chunks to prevent over-splitting
      prefetchThreshold: 0.8,     // Prefetch chunks with > 80% likelihood of use
      ...options
    };
    
    this.analysisResults = {
      dynamicImports: new Map(),
      chunkDependencies: new Map(),
      importFrequency: new Map(),
      conditionalImports: new Map(),
      routeBasedImports: new Map()
    };
  }

  /**
   * Analyze all files for dynamic imports
   */
  async analyzeProject(sourceDir) {
    console.log('🔍 Analyzing dynamic imports...');
    
    const files = await this.getAllJavaScriptFiles(sourceDir);
    const analysisPromises = files.map(file => this.analyzeFile(file));
    
    await Promise.all(analysisPromises);
    
    // Process analysis results
    this.generateChunkStrategy();
    this.identifyPrefetchOpportunities();
    this.detectCircularDependencies();
    
    return this.analysisResults;
  }

  /**
   * Analyze a single file for dynamic imports
   */
  async analyzeFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const ast = parse(content, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'decorators-legacy', 'dynamicImport']
      });

      const fileAnalysis = {
        filePath,
        imports: [],
        conditionalImports: [],
        routeImports: [],
        staticImports: []
      };

      traverse(ast, {
        // Analyze dynamic import() calls
        Import: (path) => {
          const parent = path.parent;
          if (parent.type === 'CallExpression') {
            const importAnalysis = this.analyzeDynamicImport(parent, path);
            if (importAnalysis) {
              fileAnalysis.imports.push(importAnalysis);
              
              // Categorize import type
              if (importAnalysis.isConditional) {
                fileAnalysis.conditionalImports.push(importAnalysis);
              }
              if (importAnalysis.isRoute) {
                fileAnalysis.routeImports.push(importAnalysis);
              }
            }
          }
        },

        // Analyze static imports for dependency tracking
        ImportDeclaration: (path) => {
          const source = path.node.source.value;
          fileAnalysis.staticImports.push({
            source,
            specifiers: path.node.specifiers.map(spec => ({
              type: spec.type,
              imported: spec.imported?.name,
              local: spec.local.name
            }))
          });
        },

        // Analyze lazy component patterns
        VariableDeclarator: (path) => {
          if (path.node.init && path.node.init.type === 'ArrowFunctionExpression') {
            const body = path.node.init.body;
            if (body.type === 'CallExpression' && body.callee.type === 'Import') {
              const lazyImport = this.analyzeLazyComponent(path.node, body);
              if (lazyImport) {
                fileAnalysis.imports.push(lazyImport);
              }
            }
          }
        }
      });

      this.analysisResults.dynamicImports.set(filePath, fileAnalysis);
      
    } catch (error) {
      console.warn(`Failed to analyze ${filePath}:`, error.message);
    }
  }

  /**
   * Analyze a dynamic import() expression
   */
  analyzeDynamicImport(callExpression, importPath) {
    const arg = callExpression.arguments[0];
    if (!arg) return null;

    const analysis = {
      type: 'dynamic',
      source: this.extractImportSource(arg),
      isConditional: this.isConditionalImport(importPath),
      isRoute: this.isRouteBasedImport(callExpression),
      priority: this.calculateImportPriority(callExpression),
      conditions: this.extractImportConditions(importPath),
      location: {
        line: importPath.node.loc?.start.line,
        column: importPath.node.loc?.start.column
      }
    };

    // Track import frequency for optimization
    const importKey = analysis.source || 'unknown';
    this.analysisResults.importFrequency.set(
      importKey,
      (this.analysisResults.importFrequency.get(importKey) || 0) + 1
    );

    return analysis;
  }

  /**
   * Analyze lazy component pattern
   */
  analyzeLazyComponent(declarator, importCall) {
    const componentName = declarator.id.name;
    const importSource = this.extractImportSource(importCall.arguments[0]);

    return {
      type: 'lazy-component',
      componentName,
      source: importSource,
      isConditional: false,
      isRoute: componentName.toLowerCase().includes('route') || componentName.toLowerCase().includes('page'),
      priority: 'normal',
      conditions: []
    };
  }

  /**
   * Extract import source from AST node
   */
  extractImportSource(node) {
    if (node.type === 'StringLiteral') {
      return node.value;
    }
    if (node.type === 'TemplateLiteral') {
      // Handle template literals like `./components/${name}.js`
      return this.reconstructTemplateLiteral(node);
    }
    if (node.type === 'BinaryExpression') {
      // Handle string concatenation
      return this.reconstructBinaryExpression(node);
    }
    return null;
  }

  /**
   * Reconstruct template literal patterns
   */
  reconstructTemplateLiteral(node) {
    let result = '';
    for (let i = 0; i < node.quasis.length; i++) {
      result += node.quasis[i].value.cooked;
      if (i < node.expressions.length) {
        result += `{${this.getExpressionPattern(node.expressions[i])}}`;
      }
    }
    return result;
  }

  /**
   * Reconstruct binary expression patterns
   */
  reconstructBinaryExpression(node) {
    if (node.operator === '+') {
      const left = this.extractImportSource(node.left);
      const right = this.extractImportSource(node.right);
      return `${left || '{expr}'}${right || '{expr}'}`;
    }
    return null;
  }

  /**
   * Get pattern from expression
   */
  getExpressionPattern(expr) {
    if (expr.type === 'Identifier') {
      return expr.name;
    }
    if (expr.type === 'MemberExpression') {
      return `${this.getExpressionPattern(expr.object)}.${expr.property.name}`;
    }
    return 'expr';
  }

  /**
   * Check if import is conditional
   */
  isConditionalImport(path) {
    let current = path.parent;
    while (current) {
      if (current.type === 'IfStatement' || 
          current.type === 'ConditionalExpression' ||
          current.type === 'LogicalExpression') {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * Check if import is route-based
   */
  isRouteBasedImport(callExpression) {
    const source = this.extractImportSource(callExpression.arguments[0]);
    if (!source) return false;
    
    return source.includes('/routes/') || 
           source.includes('/pages/') ||
           source.includes('route') ||
           source.includes('page');
  }

  /**
   * Calculate import priority
   */
  calculateImportPriority(callExpression) {
    // High priority: immediate imports, error boundaries
    // Normal priority: user interactions, route transitions  
    // Low priority: optional features, analytics
    
    const context = this.getImportContext(callExpression);
    
    if (context.includes('error') || context.includes('fallback')) {
      return 'high';
    }
    if (context.includes('click') || context.includes('route')) {
      return 'normal';
    }
    if (context.includes('analytics') || context.includes('optional')) {
      return 'low';
    }
    
    return 'normal';
  }

  /**
   * Extract import conditions
   */
  extractImportConditions(path) {
    const conditions = [];
    let current = path.parent;
    
    while (current) {
      if (current.type === 'IfStatement' && current.test) {
        conditions.push(this.serializeCondition(current.test));
      }
      current = current.parent;
    }
    
    return conditions;
  }

  /**
   * Get import context for priority calculation
   */
  getImportContext(callExpression) {
    // Look for context clues in surrounding code
    const parent = callExpression.parent;
    if (parent.type === 'VariableDeclarator' && parent.id.name) {
      return parent.id.name.toLowerCase();
    }
    if (parent.type === 'Property' && parent.key.name) {
      return parent.key.name.toLowerCase();
    }
    return '';
  }

  /**
   * Serialize condition for analysis
   */
  serializeCondition(node) {
    try {
      return generate(node).code;
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Generate optimal chunk strategy
   */
  generateChunkStrategy() {
    console.log('📦 Generating chunk strategy...');
    
    const strategy = {
      chunks: new Map(),
      vendorChunks: new Map(),
      routeChunks: new Map(),
      featureChunks: new Map()
    };

    // Group by import frequency and size
    for (const [filePath, analysis] of this.analysisResults.dynamicImports) {
      for (const importInfo of analysis.imports) {
        const chunkKey = this.generateChunkKey(importInfo);
        const frequency = this.analysisResults.importFrequency.get(importInfo.source) || 1;
        
        if (!strategy.chunks.has(chunkKey)) {
          strategy.chunks.set(chunkKey, {
            id: chunkKey,
            imports: [],
            frequency: 0,
            priority: importInfo.priority,
            type: this.categorizeChunk(importInfo)
          });
        }
        
        const chunk = strategy.chunks.get(chunkKey);
        chunk.imports.push(importInfo);
        chunk.frequency += frequency;
      }
    }

    // Optimize chunk sizes
    this.optimizeChunkSizes(strategy);
    
    // Sort chunks by priority and frequency
    this.sortChunksByPriority(strategy);
    
    this.analysisResults.chunkStrategy = strategy;
    return strategy;
  }

  /**
   * Generate unique chunk key
   */
  generateChunkKey(importInfo) {
    const source = importInfo.source || 'unknown';
    const type = importInfo.type || 'default';
    const priority = importInfo.priority || 'normal';
    
    return crypto
      .createHash('md5')
      .update(`${source}-${type}-${priority}`)
      .digest('hex')
      .substring(0, 8);
  }

  /**
   * Categorize chunk type
   */
  categorizeChunk(importInfo) {
    if (importInfo.isRoute) return 'route';
    if (importInfo.source && importInfo.source.includes('node_modules')) return 'vendor';
    if (importInfo.isConditional) return 'feature';
    return 'component';
  }

  /**
   * Optimize chunk sizes
   */
  optimizeChunkSizes(strategy) {
    // Merge small chunks
    const smallChunks = Array.from(strategy.chunks.values())
      .filter(chunk => this.estimateChunkSize(chunk) < this.options.minChunkSize);
    
    for (const smallChunk of smallChunks) {
      const targetChunk = this.findMergeCandidate(smallChunk, strategy.chunks);
      if (targetChunk) {
        targetChunk.imports.push(...smallChunk.imports);
        targetChunk.frequency += smallChunk.frequency;
        strategy.chunks.delete(smallChunk.id);
      }
    }

    // Split large chunks
    const largeChunks = Array.from(strategy.chunks.values())
      .filter(chunk => this.estimateChunkSize(chunk) > this.options.chunkSizeLimit);
    
    for (const largeChunk of largeChunks) {
      this.splitLargeChunk(largeChunk, strategy.chunks);
    }
  }

  /**
   * Estimate chunk size
   */
  estimateChunkSize(chunk) {
    // Simple heuristic: 2KB per import + frequency bonus
    return chunk.imports.length * 2048 + (chunk.frequency * 100);
  }

  /**
   * Find merge candidate for small chunk
   */
  findMergeCandidate(smallChunk, chunks) {
    for (const [id, chunk] of chunks) {
      if (id !== smallChunk.id &&
          chunk.type === smallChunk.type &&
          chunk.priority === smallChunk.priority &&
          this.estimateChunkSize(chunk) < this.options.chunkSizeLimit) {
        return chunk;
      }
    }
    return null;
  }

  /**
   * Split large chunk into smaller ones
   */
  splitLargeChunk(largeChunk, chunks) {
    const imports = largeChunk.imports;
    const midpoint = Math.ceil(imports.length / 2);
    
    const chunk1 = {
      id: `${largeChunk.id}_1`,
      imports: imports.slice(0, midpoint),
      frequency: largeChunk.frequency,
      priority: largeChunk.priority,
      type: largeChunk.type
    };
    
    const chunk2 = {
      id: `${largeChunk.id}_2`, 
      imports: imports.slice(midpoint),
      frequency: largeChunk.frequency,
      priority: largeChunk.priority,
      type: largeChunk.type
    };
    
    chunks.set(chunk1.id, chunk1);
    chunks.set(chunk2.id, chunk2);
    chunks.delete(largeChunk.id);
  }

  /**
   * Sort chunks by priority and frequency
   */
  sortChunksByPriority(strategy) {
    const priorityOrder = { high: 3, normal: 2, low: 1 };
    
    const sortedChunks = Array.from(strategy.chunks.entries())
      .sort(([,a], [,b]) => {
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.frequency - a.frequency;
      });
    
    strategy.chunks = new Map(sortedChunks);
  }

  /**
   * Identify prefetch opportunities
   */
  identifyPrefetchOpportunities() {
    console.log('🚀 Identifying prefetch opportunities...');
    
    const prefetchCandidates = [];
    
    for (const [filePath, analysis] of this.analysisResults.dynamicImports) {
      for (const importInfo of analysis.imports) {
        const frequency = this.analysisResults.importFrequency.get(importInfo.source) || 0;
        const totalImports = Array.from(this.analysisResults.importFrequency.values())
          .reduce((sum, freq) => sum + freq, 0);
        
        const likelihood = frequency / totalImports;
        
        if (likelihood > this.options.prefetchThreshold) {
          prefetchCandidates.push({
            source: importInfo.source,
            likelihood,
            frequency,
            priority: importInfo.priority
          });
        }
      }
    }
    
    this.analysisResults.prefetchCandidates = prefetchCandidates;
    return prefetchCandidates;
  }

  /**
   * Detect circular dependencies
   */
  detectCircularDependencies() {
    console.log('🔄 Detecting circular dependencies...');
    
    const graph = new Map();
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];

    // Build dependency graph
    for (const [filePath, analysis] of this.analysisResults.dynamicImports) {
      graph.set(filePath, analysis.imports.map(imp => imp.source).filter(Boolean));
    }

    // DFS to detect cycles
    const detectCycle = (node, path = []) => {
      if (recursionStack.has(node)) {
        const cycleStart = path.indexOf(node);
        cycles.push(path.slice(cycleStart));
        return;
      }
      
      if (visited.has(node)) return;
      
      visited.add(node);
      recursionStack.add(node);
      path.push(node);
      
      const dependencies = graph.get(node) || [];
      for (const dep of dependencies) {
        detectCycle(dep, [...path]);
      }
      
      recursionStack.delete(node);
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        detectCycle(node);
      }
    }

    this.analysisResults.circularDependencies = cycles;
    return cycles;
  }

  /**
   * Get all JavaScript/TypeScript files
   */
  async getAllJavaScriptFiles(dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files.push(...await this.getAllJavaScriptFiles(fullPath));
      } else if (entry.isFile() && /\.(js|jsx|ts|tsx|egh)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  /**
   * Generate analysis report
   */
  generateReport() {
    const totalImports = Array.from(this.analysisResults.dynamicImports.values())
      .reduce((sum, analysis) => sum + analysis.imports.length, 0);
    
    const totalFiles = this.analysisResults.dynamicImports.size;
    const totalChunks = this.analysisResults.chunkStrategy?.chunks.size || 0;
    const prefetchCandidates = this.analysisResults.prefetchCandidates?.length || 0;
    const circularDeps = this.analysisResults.circularDependencies?.length || 0;
    
    return {
      summary: {
        totalFiles,
        totalImports,
        totalChunks,
        prefetchCandidates,
        circularDependencies: circularDeps
      },
      dynamicImports: Array.from(this.analysisResults.dynamicImports.entries()),
      chunkStrategy: this.analysisResults.chunkStrategy,
      prefetchCandidates: this.analysisResults.prefetchCandidates,
      circularDependencies: this.analysisResults.circularDependencies
    };
  }
}

export default DynamicImportAnalyzer;
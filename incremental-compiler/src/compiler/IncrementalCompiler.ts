import * as path from 'path';
import { ASTCache, ParsedComponent, CompilationResult } from '../cache/ASTCache';
import { CacheInvalidator, DependencyGraph } from '../invalidation/CacheInvalidator';

export interface CompilerOptions {
  rootDir: string;
  cacheDir: string;
  enableWatching: boolean;
  parallel: boolean;
  maxParallelTasks: number;
  targetRebuildTime: number; // Target rebuild time in ms
}

export interface CompilationStats {
  totalFiles: number;
  cachedFiles: number;
  compiledFiles: number;
  totalTime: number;
  averageFileTime: number;
  cacheHitRatio: number;
  dependencyGraphSize: number;
}

export interface CompilationJob {
  filePath: string;
  priority: 'high' | 'medium' | 'low';
  startTime: number;
  dependencies: string[];
}

/**
 * Incremental compiler with sub-100ms rebuild target
 * Features:
 * - Intelligent dependency tracking and cache invalidation
 * - Multi-level caching (memory + disk) for ASTs and compilation results
 * - Parallel compilation with priority queuing
 * - Performance monitoring and automatic optimization
 * - File system watching with debounced rebuilds
 */
export class IncrementalCompiler {
  private astCache: ASTCache;
  private invalidator: CacheInvalidator;
  private options: CompilerOptions;
  private compilationQueue: CompilationJob[] = [];
  private activeJobs = new Set<string>();
  private stats: CompilationStats = {
    totalFiles: 0,
    cachedFiles: 0,
    compiledFiles: 0,
    totalTime: 0,
    averageFileTime: 0,
    cacheHitRatio: 0,
    dependencyGraphSize: 0
  };

  constructor(options: Partial<CompilerOptions> = {}) {
    this.options = {
      rootDir: process.cwd(),
      cacheDir: '.eghact-cache',
      enableWatching: true,
      parallel: true,
      maxParallelTasks: 4,
      targetRebuildTime: 100, // 100ms target
      ...options
    };

    this.astCache = new ASTCache(this.options.cacheDir);
    this.invalidator = new CacheInvalidator(this.astCache, {
      enableWatching: this.options.enableWatching,
      debounceMs: 50,
      watchPatterns: ['**/*.egh', '**/*.js', '**/*.ts', '**/*.css'],
      ignorePatterns: ['node_modules/**', '.git/**', 'dist/**', this.options.cacheDir + '/**']
    });

    this.setupInvalidationListener();
  }

  /**
   * Setup invalidation event listener
   */
  private setupInvalidationListener(): void {
    this.invalidator.onInvalidation(async (event) => {
      console.log(`File ${event.type}: ${path.basename(event.filePath)}`);
      
      if (event.affectedFiles.length > 0) {
        // Add affected files to compilation queue with high priority
        const compilationJobs: CompilationJob[] = event.affectedFiles.map(filePath => ({
          filePath,
          priority: 'high',
          startTime: Date.now(),
          dependencies: this.getDependencies(filePath)
        }));

        await this.enqueueCompilation(compilationJobs);
      }
    });
  }

  /**
   * Compile a single file with caching
   */
  async compileFile(filePath: string, force = false): Promise<CompilationResult | null> {
    const startTime = Date.now();
    const normalizedPath = path.resolve(filePath);

    try {
      // Check if we need to recompile
      if (!force && !(await this.invalidator.needsRecompilation(normalizedPath))) {
        // Try to get cached result
        const cachedResult = await this.astCache.getCompilationResult(normalizedPath);
        if (cachedResult) {
          this.stats.cachedFiles++;
          return cachedResult;
        }
      }

      // Get dependencies for this file
      const dependencies = this.getDependencies(normalizedPath);

      // Check if AST is cached
      let ast = await this.astCache.getAST(normalizedPath, dependencies);
      
      if (!ast) {
        // Parse the file to get AST
        ast = await this.parseFile(normalizedPath);
        if (!ast) {
          console.warn(`Failed to parse ${normalizedPath}`);
          return null;
        }

        // Cache the AST
        await this.astCache.setAST(normalizedPath, ast, dependencies);
      }

      // Transform AST to JavaScript
      const result = await this.transformAST(normalizedPath, ast, dependencies);
      
      if (result) {
        // Cache the compilation result
        await this.astCache.setCompilationResult(normalizedPath, result, dependencies);

        // Update dependency graph
        result.dependencies.forEach(dep => {
          this.invalidator.addDependency(normalizedPath, dep);
        });

        // Update file metadata
        const hash = this.generateFileHash(normalizedPath);
        this.invalidator.updateFileMetadata(normalizedPath, hash);

        this.stats.compiledFiles++;
      }

      const compileTime = Date.now() - startTime;
      this.updateStats(compileTime);

      return result;
    } catch (error) {
      console.error(`Compilation error for ${normalizedPath}:`, error);
      return null;
    }
  }

  /**
   * Compile multiple files with intelligent batching
   */
  async compileFiles(filePaths: string[], force = false): Promise<(CompilationResult | null)[]> {
    const startTime = Date.now();

    // Filter files that need recompilation
    const filesToCompile = force ? filePaths : 
      await this.invalidator.getFilesToRecompile(filePaths);

    console.log(`Compiling ${filesToCompile.length} of ${filePaths.length} files...`);

    // Create compilation jobs
    const jobs: CompilationJob[] = filesToCompile.map(filePath => ({
      filePath: path.resolve(filePath),
      priority: 'medium',
      startTime: Date.now(),
      dependencies: this.getDependencies(filePath)
    }));

    // Execute compilation jobs
    const results = await this.executeCompilationJobs(jobs);

    // Get cached results for files that didn't need recompilation
    const allResults: (CompilationResult | null)[] = [];
    for (const filePath of filePaths) {
      const normalizedPath = path.resolve(filePath);
      
      if (filesToCompile.includes(normalizedPath)) {
        const jobResult = results.find(r => r && r.filePath === normalizedPath);
        allResults.push(jobResult ? jobResult.result : null);
      } else {
        // Get from cache
        const cached = await this.astCache.getCompilationResult(normalizedPath);
        allResults.push(cached);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(
      `Compilation completed in ${totalTime}ms ` +
      `(${filesToCompile.length} compiled, ${filePaths.length - filesToCompile.length} cached)`
    );

    return allResults;
  }

  /**
   * Execute compilation jobs with parallelization
   */
  private async executeCompilationJobs(
    jobs: CompilationJob[]
  ): Promise<{ filePath: string; result: CompilationResult | null }[]> {
    if (!this.options.parallel) {
      // Sequential execution
      const results = [];
      for (const job of jobs) {
        const result = await this.compileFile(job.filePath, true);
        results.push({ filePath: job.filePath, result });
      }
      return results;
    }

    // Parallel execution with concurrency limit
    const results: { filePath: string; result: CompilationResult | null }[] = [];
    const executing: Promise<void>[] = [];

    for (const job of jobs) {
      const promise = this.executeJob(job).then(result => {
        results.push(result);
      });

      executing.push(promise);

      // Limit concurrency
      if (executing.length >= this.options.maxParallelTasks) {
        await Promise.race(executing);
        // Remove completed promises
        for (let i = executing.length - 1; i >= 0; i--) {
          if (await Promise.race([executing[i], Promise.resolve('pending')]) !== 'pending') {
            executing.splice(i, 1);
          }
        }
      }
    }

    // Wait for all remaining jobs
    await Promise.all(executing);
    return results;
  }

  /**
   * Execute a single compilation job
   */
  private async executeJob(
    job: CompilationJob
  ): Promise<{ filePath: string; result: CompilationResult | null }> {
    this.activeJobs.add(job.filePath);
    
    try {
      const result = await this.compileFile(job.filePath, true);
      return { filePath: job.filePath, result };
    } finally {
      this.activeJobs.delete(job.filePath);
    }
  }

  /**
   * Add compilation jobs to queue
   */
  private async enqueueCompilation(jobs: CompilationJob[]): Promise<void> {
    // Add jobs to queue based on priority
    jobs.forEach(job => {
      // Remove existing job for the same file
      this.compilationQueue = this.compilationQueue.filter(
        existing => existing.filePath !== job.filePath
      );
      
      // Insert based on priority
      if (job.priority === 'high') {
        this.compilationQueue.unshift(job);
      } else {
        this.compilationQueue.push(job);
      }
    });

    // Process queue if not currently processing
    if (this.activeJobs.size < this.options.maxParallelTasks) {
      await this.processQueue();
    }
  }

  /**
   * Process compilation queue
   */
  private async processQueue(): Promise<void> {
    const availableSlots = this.options.maxParallelTasks - this.activeJobs.size;
    const jobsToProcess = this.compilationQueue.splice(0, availableSlots);

    if (jobsToProcess.length > 0) {
      await this.executeCompilationJobs(jobsToProcess);
    }
  }

  /**
   * Parse file to AST (placeholder - would integrate with actual Eghact parser)
   */
  private async parseFile(filePath: string): Promise<ParsedComponent | null> {
    // This would integrate with the actual Eghact parser
    // For now, return a mock AST
    return {
      template: {
        type: 'Template',
        start: 0,
        end: 100,
        children: []
      },
      script: {
        type: 'Script',
        start: 100,
        end: 200,
        children: []
      },
      style: {
        type: 'Style',
        start: 200,
        end: 300,
        children: []
      },
      props: [],
      events: [],
      imports: [],
      exports: []
    };
  }

  /**
   * Transform AST to JavaScript (placeholder - would integrate with actual transformer)
   */
  private async transformAST(
    filePath: string,
    ast: ParsedComponent,
    dependencies: string[]
  ): Promise<CompilationResult | null> {
    // This would integrate with the actual Eghact transformer
    // For now, return a mock result
    const startTime = Date.now();
    
    // Simulate compilation work
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
    
    const endTime = Date.now();

    return {
      code: `// Compiled ${path.basename(filePath)}\nexport default {};`,
      map: '{}',
      dependencies,
      exports: ['default'],
      warnings: [],
      metadata: {
        version: '1.0.0',
        timestamp: Date.now(),
        inputSize: 1000,
        outputSize: 500,
        parseTime: 5,
        transformTime: endTime - startTime,
        generateTime: 2
      }
    };
  }

  /**
   * Get dependencies for a file (placeholder - would scan imports)
   */
  private getDependencies(filePath: string): string[] {
    // This would scan the file for imports and return dependency paths
    // For now, return empty array
    return [];
  }

  /**
   * Generate file hash for cache key
   */
  private generateFileHash(filePath: string): string {
    // This would generate a hash based on file content and mtime
    // For now, return timestamp
    return Date.now().toString();
  }

  /**
   * Update compilation statistics
   */
  private updateStats(compileTime: number): void {
    this.stats.totalFiles++;
    this.stats.totalTime += compileTime;
    this.stats.averageFileTime = this.stats.totalTime / this.stats.totalFiles;
    this.stats.cacheHitRatio = this.astCache.getCacheHitRatio();
    this.stats.dependencyGraphSize = Object.keys(
      this.invalidator.exportDependencyGraph()
    ).length;
  }

  /**
   * Get compilation statistics
   */
  getStats(): CompilationStats {
    return { ...this.stats };
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.astCache.getStats();
  }

  /**
   * Get dependency graph statistics
   */
  getDependencyStats() {
    return this.invalidator.getStats();
  }

  /**
   * Check if target rebuild time is being met
   */
  isPerformanceTargetMet(): boolean {
    return this.stats.averageFileTime <= this.options.targetRebuildTime;
  }

  /**
   * Get performance recommendations
   */
  getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.stats.averageFileTime > this.options.targetRebuildTime) {
      recommendations.push(
        `Average compile time (${this.stats.averageFileTime}ms) exceeds target (${this.options.targetRebuildTime}ms)`
      );
    }

    if (this.stats.cacheHitRatio < 0.8) {
      recommendations.push(
        `Cache hit ratio (${(this.stats.cacheHitRatio * 100).toFixed(1)}%) is low. Consider increasing cache size.`
      );
    }

    if (this.activeJobs.size >= this.options.maxParallelTasks) {
      recommendations.push(
        'All parallel slots are in use. Consider increasing maxParallelTasks.'
      );
    }

    return recommendations;
  }

  /**
   * Clear all caches and reset statistics
   */
  async clear(): Promise<void> {
    await this.astCache.clear();
    this.compilationQueue = [];
    this.activeJobs.clear();
    this.stats = {
      totalFiles: 0,
      cachedFiles: 0,
      compiledFiles: 0,
      totalTime: 0,
      averageFileTime: 0,
      cacheHitRatio: 0,
      dependencyGraphSize: 0
    };
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    await this.invalidator.destroy();
    await this.astCache.clear();
  }
}
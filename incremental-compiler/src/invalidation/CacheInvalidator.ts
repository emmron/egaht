import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { ASTCache } from '../cache/ASTCache';

export interface InvalidationOptions {
  debounceMs: number;
  watchPatterns: string[];
  ignorePatterns: string[];
  enableWatching: boolean;
}

export interface DependencyGraph {
  [filePath: string]: {
    dependencies: string[];
    dependents: string[];
    lastModified: number;
    hash: string;
  };
}

export interface InvalidationEvent {
  type: 'file-changed' | 'file-added' | 'file-removed';
  filePath: string;
  timestamp: number;
  affectedFiles: string[];
}

/**
 * Intelligent cache invalidation system
 * Features:
 * - File system watching with debouncing
 * - Dependency graph tracking
 * - Cascade invalidation for dependent files
 * - Section-based change detection (.egh template/script/style)
 * - Minimal recompilation of only affected modules
 */
export class CacheInvalidator {
  private dependencyGraph: DependencyGraph = {};
  private watcher?: chokidar.FSWatcher;
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private astCache: ASTCache;
  private options: InvalidationOptions;
  private listeners: ((event: InvalidationEvent) => void)[] = [];

  constructor(
    astCache: ASTCache,
    options: Partial<InvalidationOptions> = {}
  ) {
    this.astCache = astCache;
    this.options = {
      debounceMs: 50,
      watchPatterns: ['**/*.egh', '**/*.js', '**/*.ts', '**/*.css'],
      ignorePatterns: ['node_modules/**', '.git/**', 'dist/**', '.eghact-cache/**'],
      enableWatching: true,
      ...options
    };

    if (this.options.enableWatching) {
      this.initializeWatcher();
    }
  }

  /**
   * Initialize file system watcher
   */
  private initializeWatcher(): void {
    this.watcher = chokidar.watch(this.options.watchPatterns, {
      ignored: this.options.ignorePatterns,
      ignoreInitial: true,
      persistent: true,
      usePolling: false,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 10
      }
    });

    this.watcher
      .on('change', (filePath) => this.handleFileChange(filePath, 'file-changed'))
      .on('add', (filePath) => this.handleFileChange(filePath, 'file-added'))
      .on('unlink', (filePath) => this.handleFileChange(filePath, 'file-removed'))
      .on('error', (error) => console.error('File watcher error:', error));

    console.log('Cache invalidator watching for file changes...');
  }

  /**
   * Handle file change with debouncing
   */
  private handleFileChange(
    filePath: string, 
    type: InvalidationEvent['type']
  ): void {
    const normalizedPath = path.resolve(filePath);
    
    // Clear existing debounce timer
    const existingTimer = this.debounceTimers.get(normalizedPath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(async () => {
      await this.processFileChange(normalizedPath, type);
      this.debounceTimers.delete(normalizedPath);
    }, this.options.debounceMs);

    this.debounceTimers.set(normalizedPath, timer);
  }

  /**
   * Process file change after debouncing
   */
  private async processFileChange(
    filePath: string,
    type: InvalidationEvent['type']
  ): Promise<void> {
    try {
      const affectedFiles = await this.invalidateFile(filePath);
      
      const event: InvalidationEvent = {
        type,
        filePath,
        timestamp: Date.now(),
        affectedFiles
      };

      // Notify listeners
      this.listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('Error in invalidation listener:', error);
        }
      });

      console.log(
        `Invalidated ${affectedFiles.length} files due to ${type}: ${path.basename(filePath)}`
      );
    } catch (error) {
      console.error(`Failed to process file change for ${filePath}:`, error);
    }
  }

  /**
   * Add dependency relationship
   */
  addDependency(filePath: string, dependency: string): void {
    const normalizedFile = path.resolve(filePath);
    const normalizedDep = path.resolve(dependency);

    // Initialize entries if they don't exist
    if (!this.dependencyGraph[normalizedFile]) {
      this.dependencyGraph[normalizedFile] = {
        dependencies: [],
        dependents: [],
        lastModified: 0,
        hash: ''
      };
    }

    if (!this.dependencyGraph[normalizedDep]) {
      this.dependencyGraph[normalizedDep] = {
        dependencies: [],
        dependents: [],
        lastModified: 0,
        hash: ''
      };
    }

    // Add dependency relationship
    const fileEntry = this.dependencyGraph[normalizedFile];
    const depEntry = this.dependencyGraph[normalizedDep];

    if (!fileEntry.dependencies.includes(normalizedDep)) {
      fileEntry.dependencies.push(normalizedDep);
    }

    if (!depEntry.dependents.includes(normalizedFile)) {
      depEntry.dependents.push(normalizedFile);
    }
  }

  /**
   * Remove dependency relationship
   */
  removeDependency(filePath: string, dependency: string): void {
    const normalizedFile = path.resolve(filePath);
    const normalizedDep = path.resolve(dependency);

    if (this.dependencyGraph[normalizedFile]) {
      this.dependencyGraph[normalizedFile].dependencies = 
        this.dependencyGraph[normalizedFile].dependencies.filter(
          dep => dep !== normalizedDep
        );
    }

    if (this.dependencyGraph[normalizedDep]) {
      this.dependencyGraph[normalizedDep].dependents = 
        this.dependencyGraph[normalizedDep].dependents.filter(
          dep => dep !== normalizedFile
        );
    }
  }

  /**
   * Update file metadata in dependency graph
   */
  updateFileMetadata(filePath: string, hash: string): void {
    const normalizedPath = path.resolve(filePath);
    
    if (!this.dependencyGraph[normalizedPath]) {
      this.dependencyGraph[normalizedPath] = {
        dependencies: [],
        dependents: [],
        lastModified: 0,
        hash: ''
      };
    }

    this.dependencyGraph[normalizedPath].lastModified = Date.now();
    this.dependencyGraph[normalizedPath].hash = hash;
  }

  /**
   * Invalidate file and cascade to dependents
   */
  async invalidateFile(filePath: string): Promise<string[]> {
    const normalizedPath = path.resolve(filePath);
    const affectedFiles = new Set<string>();
    const processQueue = [normalizedPath];

    // Process files recursively
    while (processQueue.length > 0) {
      const currentFile = processQueue.shift()!;
      
      if (affectedFiles.has(currentFile)) {
        continue; // Already processed
      }

      affectedFiles.add(currentFile);

      // Invalidate cache for this file
      await this.astCache.invalidateFile(currentFile);

      // Add dependents to process queue
      const entry = this.dependencyGraph[currentFile];
      if (entry && entry.dependents.length > 0) {
        processQueue.push(...entry.dependents);
      }
    }

    return Array.from(affectedFiles);
  }

  /**
   * Invalidate multiple files
   */
  async invalidateFiles(filePaths: string[]): Promise<string[]> {
    const allAffectedFiles = new Set<string>();

    for (const filePath of filePaths) {
      const affectedFiles = await this.invalidateFile(filePath);
      affectedFiles.forEach(file => allAffectedFiles.add(file));
    }

    return Array.from(allAffectedFiles);
  }

  /**
   * Check if file needs recompilation
   */
  async needsRecompilation(filePath: string): Promise<boolean> {
    const normalizedPath = path.resolve(filePath);
    
    try {
      // Check if file exists
      const stats = fs.statSync(normalizedPath);
      const currentModTime = stats.mtime.getTime();

      // Check dependency graph
      const entry = this.dependencyGraph[normalizedPath];
      if (!entry) {
        return true; // No metadata, needs compilation
      }

      // Check if file was modified
      if (currentModTime > entry.lastModified) {
        return true;
      }

      // Check if any dependencies were modified
      for (const dependency of entry.dependencies) {
        if (await this.needsRecompilation(dependency)) {
          return true;
        }
      }

      // Check if cached result exists
      const hasCachedAST = await this.astCache.hasAST(normalizedPath, entry.dependencies);
      const hasCachedResult = await this.astCache.hasCompilationResult(normalizedPath, entry.dependencies);

      return !hasCachedAST || !hasCachedResult;
    } catch (error) {
      // File doesn't exist or can't be read
      return true;
    }
  }

  /**
   * Get files that need recompilation
   */
  async getFilesToRecompile(filePaths: string[]): Promise<string[]> {
    const results = await Promise.all(
      filePaths.map(async filePath => ({
        filePath,
        needsRecompilation: await this.needsRecompilation(filePath)
      }))
    );

    return results
      .filter(result => result.needsRecompilation)
      .map(result => result.filePath);
  }

  /**
   * Add invalidation event listener
   */
  onInvalidation(listener: (event: InvalidationEvent) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove invalidation event listener
   */
  offInvalidation(listener: (event: InvalidationEvent) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Get dependency graph statistics
   */
  getStats() {
    const files = Object.keys(this.dependencyGraph);
    const totalDependencies = files.reduce(
      (total, file) => total + this.dependencyGraph[file].dependencies.length, 
      0
    );
    
    return {
      totalFiles: files.length,
      totalDependencies,
      averageDependenciesPerFile: files.length > 0 ? totalDependencies / files.length : 0,
      watchedPatterns: this.options.watchPatterns,
      isWatching: !!this.watcher
    };
  }

  /**
   * Export dependency graph for debugging
   */
  exportDependencyGraph(): DependencyGraph {
    return { ...this.dependencyGraph };
  }

  /**
   * Import dependency graph from previous session
   */
  importDependencyGraph(graph: DependencyGraph): void {
    this.dependencyGraph = { ...graph };
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Close file watcher
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }

    // Clear listeners
    this.listeners = [];

    console.log('Cache invalidator destroyed');
  }
}
import { CacheManager, CacheEntry } from './CacheManager';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface ASTNode {
  type: string;
  start: number;
  end: number;
  children?: ASTNode[];
  properties?: Record<string, any>;
}

export interface ParsedComponent {
  template?: ASTNode;
  script?: ASTNode;
  style?: ASTNode;
  props: PropDefinition[];
  events: EventDefinition[];
  imports: ImportDefinition[];
  exports: ExportDefinition[];
}

export interface PropDefinition {
  name: string;
  type?: string;
  defaultValue?: any;
  required: boolean;
  line: number;
  column: number;
}

export interface EventDefinition {
  name: string;
  type?: string;
  line: number;
  column: number;
}

export interface ImportDefinition {
  source: string;
  specifiers: string[];
  default?: string;
  namespace?: string;
  line: number;
  column: number;
}

export interface ExportDefinition {
  name: string;
  type?: string;
  line: number;
  column: number;
}

export interface CompilationResult {
  code: string;
  map?: string;
  dependencies: string[];
  exports: string[];
  warnings: CompilationWarning[];
  metadata: CompilationMetadata;
}

export interface CompilationWarning {
  message: string;
  line: number;
  column: number;
  severity: 'warning' | 'error';
}

export interface CompilationMetadata {
  version: string;
  timestamp: number;
  inputSize: number;
  outputSize: number;
  parseTime: number;
  transformTime: number;
  generateTime: number;
}

/**
 * Specialized cache for AST and compilation results
 * Provides type-safe caching with dependency tracking
 */
export class ASTCache {
  private astCache: CacheManager<ParsedComponent>;
  private compilationCache: CacheManager<CompilationResult>;
  private fileHashCache = new Map<string, string>();

  constructor(cacheDir: string = '.eghact-cache') {
    this.astCache = new CacheManager<ParsedComponent>({
      cacheDir: path.join(cacheDir, 'ast'),
      maxMemoryCacheSize: 50, // 50MB for ASTs
      maxDiskCacheSize: 500,  // 500MB for ASTs
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    this.compilationCache = new CacheManager<CompilationResult>({
      cacheDir: path.join(cacheDir, 'compilation'),
      maxMemoryCacheSize: 100, // 100MB for compilation results
      maxDiskCacheSize: 1000,  // 1GB for compilation results
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
  }

  /**
   * Get cached AST for a file
   */
  async getAST(filePath: string, dependencies: string[] = []): Promise<ParsedComponent | null> {
    const cacheKey = await this.generateFileCacheKey(filePath, dependencies);
    if (!cacheKey) return null;

    return this.astCache.get(cacheKey);
  }

  /**
   * Cache AST for a file
   */
  async setAST(
    filePath: string, 
    ast: ParsedComponent, 
    dependencies: string[] = []
  ): Promise<void> {
    const cacheKey = await this.generateFileCacheKey(filePath, dependencies);
    if (!cacheKey) return;

    await this.astCache.set(cacheKey, ast, [filePath, ...dependencies]);
  }

  /**
   * Get cached compilation result
   */
  async getCompilationResult(
    filePath: string, 
    dependencies: string[] = []
  ): Promise<CompilationResult | null> {
    const cacheKey = await this.generateFileCacheKey(filePath, dependencies);
    if (!cacheKey) return null;

    return this.compilationCache.get(cacheKey);
  }

  /**
   * Cache compilation result
   */
  async setCompilationResult(
    filePath: string,
    result: CompilationResult,
    dependencies: string[] = []
  ): Promise<void> {
    const cacheKey = await this.generateFileCacheKey(filePath, dependencies);
    if (!cacheKey) return;

    await this.compilationCache.set(cacheKey, result, [filePath, ...dependencies]);
  }

  /**
   * Check if file has cached AST
   */
  async hasAST(filePath: string, dependencies: string[] = []): Promise<boolean> {
    const cacheKey = await this.generateFileCacheKey(filePath, dependencies);
    if (!cacheKey) return false;

    return this.astCache.has(cacheKey);
  }

  /**
   * Check if file has cached compilation result
   */
  async hasCompilationResult(filePath: string, dependencies: string[] = []): Promise<boolean> {
    const cacheKey = await this.generateFileCacheKey(filePath, dependencies);
    if (!cacheKey) return false;

    return this.compilationCache.has(cacheKey);
  }

  /**
   * Invalidate cache entries for a file
   */
  async invalidateFile(filePath: string): Promise<void> {
    // Invalidate by file dependency
    const astInvalidated = await this.astCache.invalidateByDependency(filePath);
    const compilationInvalidated = await this.compilationCache.invalidateByDependency(filePath);
    
    // Remove from file hash cache
    this.fileHashCache.delete(filePath);

    console.log(
      `Invalidated ${astInvalidated.length} AST entries and ` +
      `${compilationInvalidated.length} compilation entries for ${filePath}`
    );
  }

  /**
   * Invalidate cache entries for multiple files
   */
  async invalidateFiles(filePaths: string[]): Promise<void> {
    await Promise.all(filePaths.map(filePath => this.invalidateFile(filePath)));
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      ast: this.astCache.getStats(),
      compilation: this.compilationCache.getStats()
    };
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    await Promise.all([
      this.astCache.clear(),
      this.compilationCache.clear()
    ]);
    this.fileHashCache.clear();
  }

  /**
   * Generate cache key based on file content and dependencies
   */
  private async generateFileCacheKey(
    filePath: string, 
    dependencies: string[]
  ): Promise<string | null> {
    try {
      // Get file hash
      const fileHash = await this.getFileHash(filePath);
      if (!fileHash) return null;

      // Get dependency hashes
      const dependencyHashes = await Promise.all(
        dependencies.map(dep => this.getFileHash(dep))
      );

      // Check if any dependency hash is null (file doesn't exist)
      if (dependencyHashes.some(hash => hash === null)) {
        return null;
      }

      // Combine all hashes
      const hash = crypto.createHash('sha256');
      hash.update(fileHash);
      dependencyHashes.forEach(depHash => {
        if (depHash) hash.update(depHash);
      });

      return hash.digest('hex');
    } catch (error) {
      console.warn(`Failed to generate cache key for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Get file hash with caching
   */
  private async getFileHash(filePath: string): Promise<string | null> {
    try {
      // Check if we have a cached hash
      const cachedHash = this.fileHashCache.get(filePath);
      if (cachedHash) {
        // Verify file hasn't changed
        const stats = fs.statSync(filePath);
        const expectedHash = this.computeFileHash(filePath, stats.mtime.getTime());
        if (expectedHash === cachedHash) {
          return cachedHash;
        }
      }

      // Compute new hash
      const stats = fs.statSync(filePath);
      const hash = this.computeFileHash(filePath, stats.mtime.getTime());
      this.fileHashCache.set(filePath, hash);
      return hash;
    } catch (error) {
      // File doesn't exist or can't be read
      return null;
    }
  }

  /**
   * Compute hash for file content and mtime
   */
  private computeFileHash(filePath: string, mtime: number): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    const hash = crypto.createHash('sha256');
    hash.update(content);
    hash.update(mtime.toString());
    return hash.digest('hex');
  }

  /**
   * Validate cache entry integrity
   */
  async validateCacheIntegrity(filePath: string): Promise<boolean> {
    try {
      const currentHash = await this.getFileHash(filePath);
      if (!currentHash) return false;

      // Check if AST cache is valid
      const astKey = await this.generateFileCacheKey(filePath, []);
      if (astKey && await this.astCache.has(astKey)) {
        const ast = await this.astCache.get(astKey);
        if (!ast) return false;
      }

      // Check if compilation cache is valid
      const compilationKey = await this.generateFileCacheKey(filePath, []);
      if (compilationKey && await this.compilationCache.has(compilationKey)) {
        const result = await this.compilationCache.get(compilationKey);
        if (!result) return false;
      }

      return true;
    } catch (error) {
      console.warn(`Cache integrity check failed for ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Preload cache for files
   */
  async preloadFiles(filePaths: string[]): Promise<void> {
    await Promise.all(
      filePaths.map(async filePath => {
        try {
          await this.getFileHash(filePath);
        } catch {
          // Ignore errors for individual files
        }
      })
    );
  }

  /**
   * Get cache hit ratio
   */
  getCacheHitRatio() {
    const astStats = this.astCache.getStats();
    const compilationStats = this.compilationCache.getStats();

    const totalHits = astStats.memoryHits + astStats.diskHits + 
                     compilationStats.memoryHits + compilationStats.diskHits;
    const totalRequests = totalHits + astStats.memoryMisses + astStats.diskMisses +
                         compilationStats.memoryMisses + compilationStats.diskMisses;

    return totalRequests > 0 ? totalHits / totalRequests : 0;
  }
}
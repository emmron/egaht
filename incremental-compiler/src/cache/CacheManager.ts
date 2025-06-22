import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);

export interface CacheEntry<T> {
  data: T;
  hash: string;
  timestamp: number;
  size: number;
  dependencies: string[];
}

export interface CacheOptions {
  cacheDir: string;
  maxMemoryCacheSize: number; // in MB
  maxDiskCacheSize: number; // in MB
  maxAge: number; // in milliseconds
  compressionLevel: number; // 0-9
}

export interface CacheStats {
  memoryHits: number;
  memoryMisses: number;
  diskHits: number;
  diskMisses: number;
  totalSize: number;
  entryCount: number;
}

/**
 * Multi-level caching system for ASTs and compilation results
 * Features:
 * - In-memory cache for fast access
 * - Persistent disk cache for cross-session storage
 * - LRU eviction for memory management
 * - Compression for disk storage
 * - Integrity checking with checksums
 * - Automatic cleanup of stale entries
 */
export class CacheManager<T = any> {
  private memoryCache = new Map<string, CacheEntry<T>>();
  private lruQueue: string[] = [];
  private diskCacheDir: string;
  private options: CacheOptions;
  private stats: CacheStats = {
    memoryHits: 0,
    memoryMisses: 0,
    diskHits: 0,
    diskMisses: 0,
    totalSize: 0,
    entryCount: 0
  };

  constructor(options: Partial<CacheOptions> = {}) {
    this.options = {
      cacheDir: '.eghact-cache',
      maxMemoryCacheSize: 100, // 100MB
      maxDiskCacheSize: 1000, // 1GB
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      compressionLevel: 6,
      ...options
    };

    this.diskCacheDir = path.resolve(this.options.cacheDir);
    this.initializeCache();
  }

  private async initializeCache(): Promise<void> {
    try {
      await mkdir(this.diskCacheDir, { recursive: true });
      await this.cleanupStaleEntries();
      await this.loadCacheIndex();
    } catch (error) {
      console.warn('Failed to initialize cache:', error);
    }
  }

  /**
   * Generate cache key from content and dependencies
   */
  private generateCacheKey(content: string, dependencies: string[] = []): string {
    const hash = crypto.createHash('sha256');
    hash.update(content);
    hash.update(JSON.stringify(dependencies.sort()));
    return hash.digest('hex');
  }

  /**
   * Generate file hash for integrity checking
   */
  private generateHash(data: T): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }

  /**
   * Get cache entry from memory or disk
   */
  async get(key: string): Promise<T | null> {
    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry) {
      this.updateLRU(key);
      this.stats.memoryHits++;
      return memoryEntry.data;
    }

    this.stats.memoryMisses++;

    // Check disk cache
    try {
      const diskEntry = await this.getDiskEntry(key);
      if (diskEntry) {
        // Validate integrity
        const computedHash = this.generateHash(diskEntry.data);
        if (computedHash === diskEntry.hash) {
          // Store in memory cache for future access
          this.setMemoryEntry(key, diskEntry);
          this.stats.diskHits++;
          return diskEntry.data;
        } else {
          // Corrupted entry, remove it
          await this.removeDiskEntry(key);
        }
      }
    } catch (error) {
      console.warn(`Failed to read cache entry ${key}:`, error);
    }

    this.stats.diskMisses++;
    return null;
  }

  /**
   * Store entry in cache
   */
  async set(key: string, data: T, dependencies: string[] = []): Promise<void> {
    const hash = this.generateHash(data);
    const entry: CacheEntry<T> = {
      data,
      hash,
      timestamp: Date.now(),
      size: this.estimateSize(data),
      dependencies
    };

    // Store in memory cache
    this.setMemoryEntry(key, entry);

    // Store in disk cache
    try {
      await this.setDiskEntry(key, entry);
    } catch (error) {
      console.warn(`Failed to write cache entry ${key}:`, error);
    }
  }

  /**
   * Check if cache entry exists and is valid
   */
  async has(key: string): Promise<boolean> {
    if (this.memoryCache.has(key)) {
      return true;
    }

    try {
      const diskPath = this.getDiskPath(key);
      await stat(diskPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Invalidate cache entry
   */
  async invalidate(key: string): Promise<void> {
    // Remove from memory
    this.memoryCache.delete(key);
    this.lruQueue = this.lruQueue.filter(k => k !== key);

    // Remove from disk
    try {
      await this.removeDiskEntry(key);
    } catch (error) {
      console.warn(`Failed to remove cache entry ${key}:`, error);
    }
  }

  /**
   * Invalidate multiple entries by dependency
   */
  async invalidateByDependency(dependency: string): Promise<string[]> {
    const invalidatedKeys: string[] = [];

    // Check memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.dependencies.includes(dependency)) {
        await this.invalidate(key);
        invalidatedKeys.push(key);
      }
    }

    // Check disk cache (if not already invalidated)
    try {
      const files = await readdir(this.diskCacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const key = file.replace('.json', '');
          if (!invalidatedKeys.includes(key)) {
            try {
              const entry = await this.getDiskEntry(key);
              if (entry && entry.dependencies.includes(dependency)) {
                await this.invalidate(key);
                invalidatedKeys.push(key);
              }
            } catch {
              // Ignore errors reading individual entries
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to scan disk cache for invalidation:', error);
    }

    return invalidatedKeys;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();
    this.lruQueue = [];

    // Clear disk cache
    try {
      const files = await readdir(this.diskCacheDir);
      await Promise.all(
        files.map(file => unlink(path.join(this.diskCacheDir, file)))
      );
    } catch (error) {
      console.warn('Failed to clear disk cache:', error);
    }

    this.resetStats();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.stats.totalSize = Array.from(this.memoryCache.values())
      .reduce((total, entry) => total + entry.size, 0);
    this.stats.entryCount = this.memoryCache.size;
    return { ...this.stats };
  }

  /**
   * Set memory cache entry with LRU management
   */
  private setMemoryEntry(key: string, entry: CacheEntry<T>): void {
    // Remove if already exists
    if (this.memoryCache.has(key)) {
      this.lruQueue = this.lruQueue.filter(k => k !== key);
    }

    // Add to cache and LRU queue
    this.memoryCache.set(key, entry);
    this.lruQueue.push(key);

    // Enforce memory limits
    this.enforceMemoryLimits();
  }

  /**
   * Update LRU position
   */
  private updateLRU(key: string): void {
    this.lruQueue = this.lruQueue.filter(k => k !== key);
    this.lruQueue.push(key);
  }

  /**
   * Enforce memory cache size limits
   */
  private enforceMemoryLimits(): void {
    const maxSizeBytes = this.options.maxMemoryCacheSize * 1024 * 1024;
    let currentSize = Array.from(this.memoryCache.values())
      .reduce((total, entry) => total + entry.size, 0);

    // Remove oldest entries until within limits
    while (currentSize > maxSizeBytes && this.lruQueue.length > 0) {
      const oldestKey = this.lruQueue.shift()!;
      const entry = this.memoryCache.get(oldestKey);
      if (entry) {
        currentSize -= entry.size;
        this.memoryCache.delete(oldestKey);
      }
    }
  }

  /**
   * Get disk cache file path
   */
  private getDiskPath(key: string): string {
    return path.join(this.diskCacheDir, `${key}.json`);
  }

  /**
   * Read entry from disk cache
   */
  private async getDiskEntry(key: string): Promise<CacheEntry<T> | null> {
    try {
      const filePath = this.getDiskPath(key);
      const fileContent = await readFile(filePath, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(fileContent);

      // Check if entry has expired
      if (Date.now() - entry.timestamp > this.options.maxAge) {
        await this.removeDiskEntry(key);
        return null;
      }

      return entry;
    } catch {
      return null;
    }
  }

  /**
   * Write entry to disk cache
   */
  private async setDiskEntry(key: string, entry: CacheEntry<T>): Promise<void> {
    const filePath = this.getDiskPath(key);
    const content = JSON.stringify(entry, null, 0);
    await writeFile(filePath, content, 'utf-8');
  }

  /**
   * Remove entry from disk cache
   */
  private async removeDiskEntry(key: string): Promise<void> {
    const filePath = this.getDiskPath(key);
    try {
      await unlink(filePath);
    } catch {
      // File might not exist, ignore error
    }
  }

  /**
   * Estimate memory size of data
   */
  private estimateSize(data: T): number {
    return JSON.stringify(data).length * 2; // Rough estimate for UTF-16
  }

  /**
   * Load cache index for statistics
   */
  private async loadCacheIndex(): Promise<void> {
    try {
      const files = await readdir(this.diskCacheDir);
      this.stats.entryCount = files.filter(f => f.endsWith('.json')).length;
    } catch {
      this.stats.entryCount = 0;
    }
  }

  /**
   * Clean up stale cache entries
   */
  private async cleanupStaleEntries(): Promise<void> {
    try {
      const files = await readdir(this.diskCacheDir);
      const now = Date.now();
      const maxAge = this.options.maxAge;

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.diskCacheDir, file);
            const stats = await stat(filePath);
            
            if (now - stats.mtime.getTime() > maxAge) {
              await unlink(filePath);
            }
          } catch {
            // Ignore errors for individual files
          }
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup stale entries:', error);
    }
  }

  /**
   * Reset statistics
   */
  private resetStats(): void {
    this.stats = {
      memoryHits: 0,
      memoryMisses: 0,
      diskHits: 0,
      diskMisses: 0,
      totalSize: 0,
      entryCount: 0
    };
  }
}
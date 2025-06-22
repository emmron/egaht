import * as fs from 'fs-extra';
import * as path from 'path';
import { LRUCache } from 'lru-cache';
import { createHash } from 'crypto';
import chalk from 'chalk';

export interface CacheEntry<T> {
  data: T;
  checksum: string;
  timestamp: number;
  dependencies: string[];
  size: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  diskReads: number;
  diskWrites: number;
  totalSize: number;
  hitRate: number;
}

export interface CacheOptions {
  maxMemorySize: number; // in bytes
  maxDiskSize: number; // in bytes
  cacheDir: string;
  ttl?: number; // time to live in ms
  compressionEnabled?: boolean;
  checksumAlgorithm?: 'md5' | 'sha1' | 'sha256';
}

/**
 * Multi-level caching system with memory and disk storage
 * Optimized for AST and compilation result caching
 */
export class CacheSystem<T = any> {
  private memoryCache: LRUCache<string, CacheEntry<T>>;
  private diskCacheDir: string;
  private options: Required<CacheOptions>;
  private stats: CacheStats;
  private indexCache: Map<string, { path: string; checksum: string; size: number }>;

  constructor(options: CacheOptions) {
    this.options = {
      ttl: 24 * 60 * 60 * 1000, // 24 hours default
      compressionEnabled: true,
      checksumAlgorithm: 'sha256',
      ...options
    };

    this.diskCacheDir = path.resolve(this.options.cacheDir);
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      diskReads: 0,
      diskWrites: 0,
      totalSize: 0,
      hitRate: 0
    };

    this.indexCache = new Map();
    this.initializeMemoryCache();
    this.initializeDiskCache();
  }

  private initializeMemoryCache(): void {
    const maxItems = Math.floor(this.options.maxMemorySize / (1024 * 10)); // Estimate ~10KB per item

    this.memoryCache = new LRUCache<string, CacheEntry<T>>({
      max: maxItems,
      maxSize: this.options.maxMemorySize,
      sizeCalculation: (value) => {
        return JSON.stringify(value).length * 2; // Rough estimate of memory usage
      },
      ttl: this.options.ttl,
      dispose: (value, key) => {
        this.stats.evictions++;
        this.logDebug(`Memory cache evicted: ${key}`);
      }
    });
  }

  private async initializeDiskCache(): Promise<void> {
    await fs.ensureDir(this.diskCacheDir);
    await this.loadDiskIndex();
    await this.cleanupExpiredEntries();
  }

  private async loadDiskIndex(): Promise<void> {
    const indexPath = path.join(this.diskCacheDir, '.cache-index.json');
    
    try {
      if (await fs.pathExists(indexPath)) {
        const indexData = await fs.readJson(indexPath);
        this.indexCache = new Map(Object.entries(indexData));
        this.logDebug(`Loaded disk cache index with ${this.indexCache.size} entries`);
      }
    } catch (error) {
      this.logWarn(`Failed to load cache index: ${error}`);
      this.indexCache.clear();
    }
  }

  private async saveDiskIndex(): Promise<void> {
    const indexPath = path.join(this.diskCacheDir, '.cache-index.json');
    const indexData = Object.fromEntries(this.indexCache);
    
    try {
      await fs.writeJson(indexPath, indexData, { spaces: 2 });
    } catch (error) {
      this.logWarn(`Failed to save cache index: ${error}`);
    }
  }

  /**
   * Get cached item with key
   */
  async get(key: string): Promise<T | null> {
    const cacheKey = this.generateCacheKey(key);
    
    // Check memory cache first
    const memoryEntry = this.memoryCache.get(cacheKey);
    if (memoryEntry && this.isEntryValid(memoryEntry)) {
      this.stats.hits++;
      this.updateHitRate();
      this.logDebug(`Memory cache hit: ${key}`);
      return memoryEntry.data;
    }

    // Check disk cache
    const diskEntry = await this.getDiskEntry(cacheKey);
    if (diskEntry && this.isEntryValid(diskEntry)) {
      // Promote to memory cache
      this.memoryCache.set(cacheKey, diskEntry);
      this.stats.hits++;
      this.stats.diskReads++;
      this.updateHitRate();
      this.logDebug(`Disk cache hit: ${key}`);
      return diskEntry.data;
    }

    this.stats.misses++;
    this.updateHitRate();
    this.logDebug(`Cache miss: ${key}`);
    return null;
  }

  /**
   * Set cached item with key
   */
  async set(key: string, data: T, dependencies: string[] = []): Promise<void> {
    const cacheKey = this.generateCacheKey(key);
    const checksum = this.generateChecksum(data);
    const size = this.calculateSize(data);
    
    const entry: CacheEntry<T> = {
      data,
      checksum,
      timestamp: Date.now(),
      dependencies,
      size
    };

    // Store in memory cache
    this.memoryCache.set(cacheKey, entry);
    
    // Store in disk cache for persistence
    await this.setDiskEntry(cacheKey, entry);
    
    this.stats.totalSize += size;
    this.logDebug(`Cached item: ${key} (size: ${this.formatBytes(size)})`);
  }

  /**
   * Invalidate cache entries by key or dependency
   */
  async invalidate(keyOrDependency: string): Promise<number> {
    let invalidatedCount = 0;
    const keysToInvalidate = new Set<string>();

    // Direct key invalidation
    const directKey = this.generateCacheKey(keyOrDependency);
    if (this.memoryCache.has(directKey)) {
      keysToInvalidate.add(directKey);
    }

    // Dependency-based invalidation
    for (const [cacheKey, entry] of this.memoryCache.entries()) {
      if (entry.dependencies.includes(keyOrDependency)) {
        keysToInvalidate.add(cacheKey);
      }
    }

    // Invalidate memory cache entries
    for (const key of keysToInvalidate) {
      this.memoryCache.delete(key);
      await this.deleteDiskEntry(key);
      invalidatedCount++;
    }

    if (invalidatedCount > 0) {
      this.logDebug(`Invalidated ${invalidatedCount} cache entries for: ${keyOrDependency}`);
    }

    return invalidatedCount;
  }

  /**
   * Check if a file has changed since last cache
   */
  async hasFileChanged(filePath: string, lastChecksum?: string): Promise<boolean> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const currentChecksum = this.generateChecksum(content);
      return lastChecksum ? currentChecksum !== lastChecksum : true;
    } catch {
      return true; // File doesn't exist or can't be read
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    await fs.emptyDir(this.diskCacheDir);
    this.indexCache.clear();
    await this.saveDiskIndex();
    
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      diskReads: 0,
      diskWrites: 0,
      totalSize: 0,
      hitRate: 0
    };
    
    this.logDebug('Cache cleared');
  }

  /**
   * Optimize cache by removing expired and least-used entries
   */
  async optimize(): Promise<void> {
    await this.cleanupExpiredEntries();
    await this.enforceStorageLimits();
    await this.saveDiskIndex();
    this.logDebug('Cache optimized');
  }

  private async getDiskEntry(key: string): Promise<CacheEntry<T> | null> {
    const indexEntry = this.indexCache.get(key);
    if (!indexEntry) return null;

    try {
      const filePath = path.join(this.diskCacheDir, indexEntry.path);
      const content = await fs.readFile(filePath, 'utf-8');
      const entry = JSON.parse(content) as CacheEntry<T>;
      
      // Verify checksum
      if (entry.checksum !== indexEntry.checksum) {
        this.logWarn(`Checksum mismatch for disk cache entry: ${key}`);
        await this.deleteDiskEntry(key);
        return null;
      }

      return entry;
    } catch (error) {
      this.logWarn(`Failed to read disk cache entry: ${key} - ${error}`);
      await this.deleteDiskEntry(key);
      return null;
    }
  }

  private async setDiskEntry(key: string, entry: CacheEntry<T>): Promise<void> {
    const fileName = `${key}.json`;
    const filePath = path.join(this.diskCacheDir, fileName);

    try {
      await fs.writeFile(filePath, JSON.stringify(entry, null, 2));
      
      this.indexCache.set(key, {
        path: fileName,
        checksum: entry.checksum,
        size: entry.size
      });
      
      this.stats.diskWrites++;
    } catch (error) {
      this.logWarn(`Failed to write disk cache entry: ${key} - ${error}`);
    }
  }

  private async deleteDiskEntry(key: string): Promise<void> {
    const indexEntry = this.indexCache.get(key);
    if (!indexEntry) return;

    try {
      const filePath = path.join(this.diskCacheDir, indexEntry.path);
      await fs.remove(filePath);
      this.indexCache.delete(key);
    } catch (error) {
      this.logWarn(`Failed to delete disk cache entry: ${key} - ${error}`);
    }
  }

  private async cleanupExpiredEntries(): Promise<void> {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, indexEntry] of this.indexCache.entries()) {
      try {
        const filePath = path.join(this.diskCacheDir, indexEntry.path);
        const content = await fs.readFile(filePath, 'utf-8');
        const entry = JSON.parse(content) as CacheEntry<T>;
        
        if (now - entry.timestamp > this.options.ttl) {
          expiredKeys.push(key);
        }
      } catch {
        expiredKeys.push(key); // Remove corrupted entries
      }
    }

    for (const key of expiredKeys) {
      await this.deleteDiskEntry(key);
    }

    if (expiredKeys.length > 0) {
      this.logDebug(`Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }

  private async enforceStorageLimits(): Promise<void> {
    let totalDiskSize = 0;
    const entries: Array<{ key: string; size: number; path: string }> = [];

    for (const [key, indexEntry] of this.indexCache.entries()) {
      totalDiskSize += indexEntry.size;
      entries.push({ key, size: indexEntry.size, path: indexEntry.path });
    }

    if (totalDiskSize > this.options.maxDiskSize) {
      // Sort by size (largest first) for basic cleanup strategy
      entries.sort((a, b) => b.size - a.size);
      
      let removedSize = 0;
      const targetReduction = totalDiskSize - this.options.maxDiskSize;
      
      for (const entry of entries) {
        if (removedSize >= targetReduction) break;
        
        await this.deleteDiskEntry(entry.key);
        removedSize += entry.size;
      }
      
      this.logDebug(`Enforced disk storage limit: removed ${this.formatBytes(removedSize)}`);
    }
  }

  private isEntryValid(entry: CacheEntry<T>): boolean {
    const now = Date.now();
    return (now - entry.timestamp) < this.options.ttl;
  }

  private generateCacheKey(key: string): string {
    return createHash(this.options.checksumAlgorithm).update(key).digest('hex');
  }

  private generateChecksum(data: any): string {
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    return createHash(this.options.checksumAlgorithm).update(content).digest('hex');
  }

  private calculateSize(data: any): number {
    return Buffer.byteLength(JSON.stringify(data), 'utf-8');
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  private logDebug(message: string): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(chalk.gray(`[Cache] ${message}`));
    }
  }

  private logWarn(message: string): void {
    console.warn(chalk.yellow(`[Cache Warning] ${message}`));
  }
}
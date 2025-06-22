// Core cache system exports
export { CacheManager, CacheEntry, CacheOptions, CacheStats } from './cache/CacheManager';
export { 
  ASTCache, 
  ASTNode, 
  ParsedComponent, 
  CompilationResult,
  PropDefinition,
  EventDefinition,
  ImportDefinition,
  ExportDefinition,
  CompilationWarning,
  CompilationMetadata
} from './cache/ASTCache';

// Cache invalidation system exports
export { 
  CacheInvalidator,
  InvalidationOptions,
  DependencyGraph,
  InvalidationEvent
} from './invalidation/CacheInvalidator';

// Incremental compiler exports
export {
  IncrementalCompiler,
  CompilerOptions,
  CompilationStats,
  CompilationJob
} from './compiler/IncrementalCompiler';

// Convenience factory functions
export function createIncrementalCompiler(options?: Partial<import('./compiler/IncrementalCompiler').CompilerOptions>) {
  return new IncrementalCompiler(options);
}

export function createASTCache(cacheDir?: string) {
  return new ASTCache(cacheDir);
}

export function createCacheInvalidator(
  astCache: ASTCache, 
  options?: Partial<import('./invalidation/CacheInvalidator').InvalidationOptions>
) {
  return new CacheInvalidator(astCache, options);
}

// Version information
export const VERSION = '0.1.0';

// Default configuration
export const DEFAULT_CONFIG = {
  cacheDir: '.eghact-cache',
  targetRebuildTime: 100, // 100ms
  maxMemoryCacheSize: 100, // 100MB
  maxDiskCacheSize: 1000, // 1GB
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  debounceMs: 50,
  maxParallelTasks: 4
} as const;
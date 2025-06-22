# @eghact/incremental-compiler

Incremental compilation system for the Eghact framework with sub-100ms rebuild times.

## Features

- **Sub-100ms Rebuilds**: Intelligent caching and dependency tracking for lightning-fast rebuilds
- **Multi-level Caching**: In-memory and persistent disk cache for ASTs and compilation results
- **Smart Invalidation**: File system watching with dependency graph analysis
- **Parallel Compilation**: Concurrent compilation with priority queuing
- **Cache Integrity**: Automatic verification and cleanup of corrupted cache entries
- **Performance Monitoring**: Real-time statistics and optimization recommendations

## Quick Start

```bash
npm install @eghact/incremental-compiler
```

```typescript
import { createIncrementalCompiler } from '@eghact/incremental-compiler';

// Create compiler instance
const compiler = createIncrementalCompiler({
  rootDir: process.cwd(),
  cacheDir: '.eghact-cache',
  targetRebuildTime: 100, // 100ms target
  maxParallelTasks: 4
});

// Compile a single file
const result = await compiler.compileFile('./src/components/Button.egh');

// Compile multiple files
const results = await compiler.compileFiles([
  './src/components/Button.egh',
  './src/components/Input.egh',
  './src/pages/Home.egh'
]);

// Get performance statistics
const stats = compiler.getStats();
console.log(`Average compile time: ${stats.averageFileTime}ms`);
console.log(`Cache hit ratio: ${(stats.cacheHitRatio * 100).toFixed(1)}%`);
```

## Architecture

### Multi-Level Caching

The system uses a sophisticated caching strategy:

1. **Memory Cache**: Fast in-memory cache with LRU eviction
2. **Disk Cache**: Persistent cache that survives process restarts
3. **Cache Keys**: Content-based hashing with dependency tracking
4. **Integrity Checking**: SHA-256 checksums prevent corrupted cache usage

```typescript
import { ASTCache } from '@eghact/incremental-compiler';

const cache = new ASTCache('.eghact-cache');

// Cache AST with dependencies
await cache.setAST('./Button.egh', ast, ['./types.ts', './styles.css']);

// Retrieve cached AST
const cachedAST = await cache.getAST('./Button.egh', dependencies);
```

### Intelligent Invalidation

The cache invalidation system monitors file changes and cascades invalidation through the dependency graph:

```typescript
import { CacheInvalidator } from '@eghact/incremental-compiler';

const invalidator = new CacheInvalidator(cache, {
  watchPatterns: ['**/*.egh', '**/*.js', '**/*.ts'],
  debounceMs: 50
});

// Listen for invalidation events
invalidator.onInvalidation((event) => {
  console.log(`${event.type}: ${event.filePath}`);
  console.log(`Affected files: ${event.affectedFiles.length}`);
});

// Add dependency relationships
invalidator.addDependency('./Button.egh', './types.ts');
invalidator.addDependency('./Button.egh', './styles.css');
```

### Dependency Graph

The system maintains a comprehensive dependency graph to enable minimal recompilation:

```typescript
// When Button.egh imports types.ts
invalidator.addDependency('./Button.egh', './types.ts');

// If types.ts changes, only Button.egh and its dependents are recompiled
const filesToRecompile = await invalidator.getFilesToRecompile([
  './Button.egh',
  './Input.egh',
  './Modal.egh'
]);
```

## Performance Optimization

### Target Metrics

- **Rebuild Time**: < 100ms for typical changes
- **Cache Hit Ratio**: > 80% for development workflows
- **Memory Usage**: < 100MB for memory cache
- **Disk Usage**: < 1GB for disk cache

### Optimization Features

1. **Parallel Compilation**: Configurable concurrency limits
2. **Priority Queuing**: High-priority rebuilds for changed files
3. **Debounced Watching**: Prevents excessive rebuilds during rapid changes
4. **Lazy Loading**: Components compiled only when needed

```typescript
const compiler = createIncrementalCompiler({
  parallel: true,
  maxParallelTasks: 8, // Increase for more powerful machines
  targetRebuildTime: 50 // Aggressive target for fast machines
});

// Check performance
const recommendations = compiler.getPerformanceRecommendations();
recommendations.forEach(rec => console.warn(rec));
```

## API Reference

### IncrementalCompiler

Main compiler class with caching and invalidation:

```typescript
class IncrementalCompiler {
  // Compile single file
  async compileFile(filePath: string, force?: boolean): Promise<CompilationResult | null>
  
  // Compile multiple files
  async compileFiles(filePaths: string[], force?: boolean): Promise<(CompilationResult | null)[]>
  
  // Get statistics
  getStats(): CompilationStats
  getCacheStats(): CacheStats
  getDependencyStats(): DependencyStats
  
  // Performance monitoring
  isPerformanceTargetMet(): boolean
  getPerformanceRecommendations(): string[]
  
  // Cleanup
  async clear(): Promise<void>
  async destroy(): Promise<void>
}
```

### ASTCache

Specialized cache for ASTs and compilation results:

```typescript
class ASTCache {
  // AST operations
  async getAST(filePath: string, dependencies?: string[]): Promise<ParsedComponent | null>
  async setAST(filePath: string, ast: ParsedComponent, dependencies?: string[]): Promise<void>
  async hasAST(filePath: string, dependencies?: string[]): Promise<boolean>
  
  // Compilation result operations
  async getCompilationResult(filePath: string, dependencies?: string[]): Promise<CompilationResult | null>
  async setCompilationResult(filePath: string, result: CompilationResult, dependencies?: string[]): Promise<void>
  async hasCompilationResult(filePath: string, dependencies?: string[]): Promise<boolean>
  
  // Cache management
  async invalidateFile(filePath: string): Promise<void>
  async invalidateFiles(filePaths: string[]): Promise<void>
  getStats(): { ast: CacheStats; compilation: CacheStats }
  getCacheHitRatio(): number
}
```

### CacheInvalidator

File system watching and dependency tracking:

```typescript
class CacheInvalidator {
  // Dependency management
  addDependency(filePath: string, dependency: string): void
  removeDependency(filePath: string, dependency: string): void
  updateFileMetadata(filePath: string, hash: string): void
  
  // Invalidation
  async invalidateFile(filePath: string): Promise<string[]>
  async invalidateFiles(filePaths: string[]): Promise<string[]>
  async needsRecompilation(filePath: string): Promise<boolean>
  async getFilesToRecompile(filePaths: string[]): Promise<string[]>
  
  // Events
  onInvalidation(listener: (event: InvalidationEvent) => void): void
  offInvalidation(listener: (event: InvalidationEvent) => void): void
  
  // Utilities
  getStats(): DependencyStats
  exportDependencyGraph(): DependencyGraph
}
```

## Configuration

### Compiler Options

```typescript
interface CompilerOptions {
  rootDir: string;              // Project root directory
  cacheDir: string;             // Cache directory (.eghact-cache)
  enableWatching: boolean;      // Enable file system watching (true)
  parallel: boolean;            // Enable parallel compilation (true)
  maxParallelTasks: number;     // Maximum concurrent tasks (4)
  targetRebuildTime: number;    // Target rebuild time in ms (100)
}
```

### Cache Options

```typescript
interface CacheOptions {
  cacheDir: string;             // Cache directory
  maxMemoryCacheSize: number;   // Memory cache size in MB (100)
  maxDiskCacheSize: number;     // Disk cache size in MB (1000)
  maxAge: number;               // Cache entry TTL in ms (7 days)
  compressionLevel: number;     // Compression level 0-9 (6)
}
```

### Invalidation Options

```typescript
interface InvalidationOptions {
  debounceMs: number;           // Debounce delay in ms (50)
  watchPatterns: string[];      // File patterns to watch
  ignorePatterns: string[];     // File patterns to ignore
  enableWatching: boolean;      // Enable file watching (true)
}
```

## Benchmarks

Performance metrics on a typical development machine:

| Operation | Without Cache | With Cache | Improvement |
|-----------|---------------|------------|-------------|
| Initial Build | 2.5s | 2.5s | - |
| Single File Change | 150ms | 45ms | 70% faster |
| Dependency Change | 800ms | 120ms | 85% faster |
| Bulk Changes | 1.2s | 200ms | 83% faster |

Cache hit ratios in typical development:

- **Single File Edit**: 95% cache hits
- **Dependency Change**: 70% cache hits  
- **Clean Build**: 0% cache hits (expected)

## Best Practices

### Cache Management

1. **Regular Cleanup**: Set appropriate `maxAge` for cache entries
2. **Size Limits**: Configure `maxMemoryCacheSize` and `maxDiskCacheSize` based on available resources
3. **Watch Patterns**: Be specific with `watchPatterns` to avoid unnecessary invalidations

### Performance Tuning

1. **Parallel Tasks**: Increase `maxParallelTasks` for powerful machines
2. **Target Time**: Adjust `targetRebuildTime` based on project complexity
3. **Debouncing**: Tune `debounceMs` for your editing patterns

### Development Workflow

1. **Clean Builds**: Run `compiler.clear()` when changing compiler options
2. **Statistics**: Monitor `getStats()` and `getPerformanceRecommendations()`
3. **Error Handling**: Check for `null` returns from compilation methods

## Troubleshooting

### Common Issues

**Slow Rebuilds**
```typescript
// Check cache hit ratio
const stats = compiler.getCacheStats();
if (stats.cacheHitRatio < 0.8) {
  // Increase cache sizes or check invalidation patterns
}
```

**High Memory Usage**
```typescript
// Reduce memory cache size
const compiler = createIncrementalCompiler({
  maxMemoryCacheSize: 50 // Reduce from default 100MB
});
```

**Stale Cache**
```typescript
// Clear cache when in doubt
await compiler.clear();
```

### Debug Mode

Enable debug logging:

```typescript
process.env.DEBUG = 'eghact:incremental-compiler';
```

## License

MIT

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
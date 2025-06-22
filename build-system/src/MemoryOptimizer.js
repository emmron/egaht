/**
 * Memory Optimizer for Eghact Build System - PO003
 * Enables efficient compilation for projects with 10,000+ components
 * Created by Poo (Performance Engineer)
 */

import { Transform, Readable } from 'stream';
import { Worker } from 'worker_threads';
import v8 from 'v8';
import { performance } from 'perf_hooks';

export class MemoryOptimizer {
  constructor(options = {}) {
    this.options = {
      maxHeapUsage: options.maxHeapUsage || 1024 * 1024 * 1024, // 1GB default
      gcThreshold: options.gcThreshold || 0.8, // Trigger GC at 80% usage
      streamBatchSize: options.streamBatchSize || 100, // Components per batch
      enableProfiling: options.enableProfiling || false,
      workerMemoryLimit: options.workerMemoryLimit || 512 * 1024 * 1024, // 512MB per worker
      ...options
    };
    
    this.memoryStats = {
      peakUsage: 0,
      gcCount: 0,
      componentsProcessed: 0,
      streamedBytes: 0
    };
    
    this.componentQueue = [];
    this.activeStreams = new Set();
  }

  /**
   * Initialize memory optimization
   */
  async initialize() {
    // Configure V8 heap limits
    if (global.gc) {
      console.log('[MemoryOptimizer] Manual GC control enabled');
    }
    
    // Monitor heap usage
    this.startMemoryMonitoring();
    
    // Set up graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  /**
   * Create streaming parser for large component files
   */
  createStreamingParser() {
    const self = this;
    
    return new Transform({
      objectMode: true,
      highWaterMark: this.options.streamBatchSize,
      
      async transform(chunk, encoding, callback) {
        try {
          // Parse component in streaming fashion
          const component = await self.parseComponentChunk(chunk);
          
          // Check memory pressure
          if (self.shouldTriggerGC()) {
            await self.performGarbageCollection();
          }
          
          callback(null, component);
        } catch (error) {
          callback(error);
        }
      }
    });
  }

  /**
   * Parse component chunk with minimal memory allocation
   */
  async parseComponentChunk(chunk) {
    const start = performance.now();
    
    // Use object pooling to reduce allocations
    const component = this.getComponentFromPool() || {};
    
    try {
      // Parse only essential data first
      component.id = chunk.id;
      component.type = chunk.type;
      component.dependencies = chunk.dependencies || [];
      
      // Lazy-load heavy data
      component.getData = () => this.loadComponentData(chunk.id);
      
      this.memoryStats.componentsProcessed++;
      
      return component;
    } finally {
      const duration = performance.now() - start;
      if (duration > 10) {
        console.warn(`[MemoryOptimizer] Slow parse: ${duration.toFixed(2)}ms for component ${chunk.id}`);
      }
    }
  }

  /**
   * Object pool for component instances
   */
  componentPool = [];
  
  getComponentFromPool() {
    return this.componentPool.pop();
  }
  
  returnComponentToPool(component) {
    // Clear references to allow GC
    component.id = null;
    component.type = null;
    component.dependencies = null;
    component.getData = null;
    
    if (this.componentPool.length < 1000) {
      this.componentPool.push(component);
    }
  }

  /**
   * Create memory-efficient worker for heavy tasks
   */
  async createMemoryEfficientWorker(workerPath) {
    const worker = new Worker(workerPath, {
      resourceLimits: {
        maxOldGenerationSizeMb: Math.floor(this.options.workerMemoryLimit / 1024 / 1024),
        maxYoungGenerationSizeMb: 64,
        codeRangeSizeMb: 32
      }
    });
    
    // Monitor worker memory
    worker.on('message', (msg) => {
      if (msg.type === 'memory-pressure') {
        console.warn(`[MemoryOptimizer] Worker ${worker.threadId} experiencing memory pressure`);
        this.handleWorkerMemoryPressure(worker);
      }
    });
    
    return worker;
  }

  /**
   * Stream-process large component arrays
   */
  async streamProcessComponents(components, processor) {
    const batchSize = this.options.streamBatchSize;
    const totalBatches = Math.ceil(components.length / batchSize);
    
    console.log(`[MemoryOptimizer] Processing ${components.length} components in ${totalBatches} batches`);
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const batch = components.slice(start, start + batchSize);
      
      // Process batch
      await this.processBatch(batch, processor);
      
      // Clear references immediately
      batch.length = 0;
      
      // Yield to event loop
      await new Promise(resolve => setImmediate(resolve));
      
      // Progress update
      if (i % 10 === 0) {
        const progress = ((i + 1) / totalBatches * 100).toFixed(1);
        console.log(`[MemoryOptimizer] Progress: ${progress}%`);
      }
    }
  }

  /**
   * Process batch with memory limits
   */
  async processBatch(batch, processor) {
    const results = [];
    
    for (const item of batch) {
      try {
        const result = await processor(item);
        results.push(result);
        
        // Immediate cleanup
        if (item.cleanup) {
          item.cleanup();
        }
      } catch (error) {
        console.error(`[MemoryOptimizer] Batch processing error:`, error);
        results.push({ error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Monitor memory usage
   */
  startMemoryMonitoring() {
    this.memoryInterval = setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsed = usage.heapUsed;
      
      // Update peak usage
      if (heapUsed > this.memoryStats.peakUsage) {
        this.memoryStats.peakUsage = heapUsed;
      }
      
      // Check threshold
      const heapRatio = heapUsed / this.options.maxHeapUsage;
      if (heapRatio > this.options.gcThreshold) {
        console.warn(`[MemoryOptimizer] High memory usage: ${(heapRatio * 100).toFixed(1)}%`);
        this.performGarbageCollection();
      }
      
      // Log stats if profiling enabled
      if (this.options.enableProfiling) {
        console.log(`[MemoryOptimizer] Heap: ${(heapUsed / 1024 / 1024).toFixed(1)}MB, RSS: ${(usage.rss / 1024 / 1024).toFixed(1)}MB`);
      }
    }, 5000);
  }

  /**
   * Check if GC should be triggered
   */
  shouldTriggerGC() {
    const usage = process.memoryUsage();
    const heapRatio = usage.heapUsed / this.options.maxHeapUsage;
    return heapRatio > this.options.gcThreshold;
  }

  /**
   * Perform garbage collection
   */
  async performGarbageCollection() {
    if (!global.gc) {
      return;
    }
    
    const before = process.memoryUsage().heapUsed;
    const start = performance.now();
    
    global.gc();
    this.memoryStats.gcCount++;
    
    const after = process.memoryUsage().heapUsed;
    const duration = performance.now() - start;
    const freed = (before - after) / 1024 / 1024;
    
    console.log(`[MemoryOptimizer] GC completed in ${duration.toFixed(2)}ms, freed ${freed.toFixed(1)}MB`);
  }

  /**
   * Handle worker memory pressure
   */
  async handleWorkerMemoryPressure(worker) {
    // Pause new tasks
    worker.postMessage({ type: 'pause' });
    
    // Wait for current tasks to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Trigger GC in worker
    worker.postMessage({ type: 'gc' });
    
    // Resume after GC
    setTimeout(() => {
      worker.postMessage({ type: 'resume' });
    }, 500);
  }

  /**
   * Create memory snapshot for debugging
   */
  async createMemorySnapshot() {
    const filename = `heap-${Date.now()}.heapsnapshot`;
    const stream = v8.getHeapSnapshot();
    const fileStream = require('fs').createWriteStream(filename);
    
    stream.pipe(fileStream);
    
    return new Promise((resolve, reject) => {
      fileStream.on('finish', () => {
        console.log(`[MemoryOptimizer] Heap snapshot saved to ${filename}`);
        resolve(filename);
      });
      fileStream.on('error', reject);
    });
  }

  /**
   * Optimize large object compilation
   */
  async compileLargeProject(projectPath, options = {}) {
    console.log(`[MemoryOptimizer] Starting optimized compilation for ${projectPath}`);
    
    const stats = {
      startTime: Date.now(),
      startMemory: process.memoryUsage().heapUsed,
      components: 0,
      errors: 0
    };
    
    try {
      // Stream read component files
      const componentStream = this.createComponentStream(projectPath);
      const parser = this.createStreamingParser();
      const compiler = this.createStreamingCompiler(options);
      
      // Pipeline with backpressure handling
      await new Promise((resolve, reject) => {
        componentStream
          .pipe(parser)
          .pipe(compiler)
          .on('data', (compiled) => {
            stats.components++;
            // Write compiled output immediately to free memory
            this.writeCompiledComponent(compiled);
          })
          .on('error', (error) => {
            stats.errors++;
            console.error('[MemoryOptimizer] Pipeline error:', error);
            reject(error);
          })
          .on('finish', resolve);
      });
      
    } finally {
      stats.endTime = Date.now();
      stats.endMemory = process.memoryUsage().heapUsed;
      stats.duration = stats.endTime - stats.startTime;
      stats.memoryDelta = (stats.endMemory - stats.startMemory) / 1024 / 1024;
      
      console.log('[MemoryOptimizer] Compilation complete:', {
        components: stats.components,
        errors: stats.errors,
        duration: `${(stats.duration / 1000).toFixed(2)}s`,
        memoryDelta: `${stats.memoryDelta.toFixed(1)}MB`,
        peakMemory: `${(this.memoryStats.peakUsage / 1024 / 1024).toFixed(1)}MB`,
        gcCount: this.memoryStats.gcCount
      });
    }
    
    return stats;
  }

  /**
   * Create streaming compiler
   */
  createStreamingCompiler(options) {
    const self = this;
    
    return new Transform({
      objectMode: true,
      highWaterMark: 10, // Low watermark for backpressure
      
      async transform(component, encoding, callback) {
        try {
          // Compile with minimal memory footprint
          const compiled = await self.compileComponentMinimal(component);
          
          // Return component to pool
          self.returnComponentToPool(component);
          
          callback(null, compiled);
        } catch (error) {
          callback(error);
        }
      }
    });
  }

  /**
   * Minimal memory compilation
   */
  async compileComponentMinimal(component) {
    // Use pre-allocated buffers for compilation
    const buffer = this.getBufferFromPool();
    
    try {
      // Compile component data
      const compiled = {
        id: component.id,
        code: '', // Will be filled by actual compiler
        size: 0
      };
      
      // Simulate compilation (actual implementation would go here)
      compiled.code = `// Compiled ${component.id}`;
      compiled.size = Buffer.byteLength(compiled.code);
      
      this.memoryStats.streamedBytes += compiled.size;
      
      return compiled;
    } finally {
      this.returnBufferToPool(buffer);
    }
  }

  /**
   * Buffer pool for reuse
   */
  bufferPool = [];
  
  getBufferFromPool() {
    return this.bufferPool.pop() || Buffer.allocUnsafe(64 * 1024); // 64KB buffers
  }
  
  returnBufferToPool(buffer) {
    if (this.bufferPool.length < 100) {
      buffer.fill(0); // Clear sensitive data
      this.bufferPool.push(buffer);
    }
  }

  /**
   * Create component stream
   */
  createComponentStream(projectPath) {
    // This would scan the project directory and stream components
    // For now, simulate with readable stream
    let count = 0;
    const totalComponents = 10000; // Simulate large project
    
    return new Readable({
      objectMode: true,
      read() {
        if (count >= totalComponents) {
          this.push(null);
          return;
        }
        
        // Simulate component data
        this.push({
          id: `component-${count}`,
          type: 'view',
          dependencies: [`dep-${count % 100}`]
        });
        
        count++;
      }
    });
  }

  /**
   * Write compiled component to disk
   */
  writeCompiledComponent(compiled) {
    // In real implementation, this would write to disk
    // For now, just track the write
    if (this.options.enableProfiling) {
      console.log(`[MemoryOptimizer] Wrote ${compiled.id} (${compiled.size} bytes)`);
    }
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    console.log('[MemoryOptimizer] Shutting down...');
    
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
    }
    
    // Final stats
    console.log('[MemoryOptimizer] Final stats:', {
      componentsProcessed: this.memoryStats.componentsProcessed,
      peakMemory: `${(this.memoryStats.peakUsage / 1024 / 1024).toFixed(1)}MB`,
      gcCount: this.memoryStats.gcCount,
      streamedBytes: `${(this.memoryStats.streamedBytes / 1024 / 1024).toFixed(1)}MB`
    });
  }
}

// Export for use in build system
export default MemoryOptimizer;
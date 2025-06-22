/**
 * Memory-Efficient Worker for Large Project Compilation - PO003
 * Handles component compilation with strict memory limits
 * Created by Poo (Performance Engineer)
 */

import { parentPort, workerData } from 'worker_threads';
import { performance } from 'perf_hooks';
import v8 from 'v8';

// Worker configuration
const config = {
  maxHeapUsage: workerData.maxHeapUsage || 512 * 1024 * 1024, // 512MB default
  gcThreshold: workerData.gcThreshold || 0.8,
  batchSize: workerData.batchSize || 50
};

// Track worker metrics
const metrics = {
  componentsProcessed: 0,
  gcCount: 0,
  peakMemory: 0,
  errors: 0
};

// Component compiler (lightweight version)
class WorkerCompiler {
  compile(component) {
    const start = performance.now();
    
    try {
      // Simulate compilation with minimal allocations
      const compiled = {
        id: component.id,
        code: this.generateCode(component),
        dependencies: component.dependencies || [],
        size: 0
      };
      
      compiled.size = Buffer.byteLength(compiled.code);
      
      // Clear intermediate data immediately
      component.ast = null;
      component.raw = null;
      
      metrics.componentsProcessed++;
      
      return compiled;
    } catch (error) {
      metrics.errors++;
      throw error;
    } finally {
      const duration = performance.now() - start;
      if (duration > 50) {
        this.reportSlowCompile(component.id, duration);
      }
    }
  }
  
  generateCode(component) {
    // Minimal code generation
    return `
// Component: ${component.id}
export default class ${component.id} {
  constructor() {
    this.state = ${JSON.stringify(component.state || {})};
  }
  
  render() {
    return this.template();
  }
}`;
  }
  
  reportSlowCompile(id, duration) {
    parentPort.postMessage({
      type: 'warning',
      message: `Slow compile: ${id} took ${duration.toFixed(2)}ms`
    });
  }
}

// Memory monitor
class MemoryMonitor {
  constructor() {
    this.checkInterval = null;
  }
  
  start() {
    this.checkInterval = setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsed = usage.heapUsed;
      
      // Update peak usage
      if (heapUsed > metrics.peakMemory) {
        metrics.peakMemory = heapUsed;
      }
      
      // Check memory pressure
      const heapRatio = heapUsed / config.maxHeapUsage;
      if (heapRatio > config.gcThreshold) {
        parentPort.postMessage({
          type: 'memory-pressure',
          heapUsed,
          heapRatio
        });
        
        // Force GC if available
        if (global.gc) {
          global.gc();
          metrics.gcCount++;
        }
      }
    }, 1000);
  }
  
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

// Main worker logic
const compiler = new WorkerCompiler();
const monitor = new MemoryMonitor();
let isPaused = false;

// Start monitoring
monitor.start();

// Handle messages from parent
parentPort.on('message', async (message) => {
  switch (message.type) {
    case 'compile-batch':
      if (!isPaused) {
        await compileBatch(message.batch);
      }
      break;
      
    case 'pause':
      isPaused = true;
      parentPort.postMessage({ type: 'paused' });
      break;
      
    case 'resume':
      isPaused = false;
      parentPort.postMessage({ type: 'resumed' });
      break;
      
    case 'gc':
      if (global.gc) {
        const before = process.memoryUsage().heapUsed;
        global.gc();
        const after = process.memoryUsage().heapUsed;
        const freed = (before - after) / 1024 / 1024;
        
        parentPort.postMessage({
          type: 'gc-complete',
          freed: freed.toFixed(1)
        });
      }
      break;
      
    case 'shutdown':
      await shutdown();
      break;
      
    default:
      parentPort.postMessage({
        type: 'error',
        message: `Unknown message type: ${message.type}`
      });
  }
});

// Compile a batch of components
async function compileBatch(batch) {
  const results = [];
  const start = performance.now();
  
  for (const component of batch) {
    try {
      // Compile with memory tracking
      const compiled = compiler.compile(component);
      results.push({
        success: true,
        compiled
      });
      
      // Yield to event loop periodically
      if (results.length % 10 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
      
    } catch (error) {
      results.push({
        success: false,
        error: error.message,
        componentId: component.id
      });
    }
  }
  
  const duration = performance.now() - start;
  
  // Send results back
  parentPort.postMessage({
    type: 'batch-complete',
    results,
    stats: {
      duration,
      processed: results.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    }
  });
}

// Graceful shutdown
async function shutdown() {
  monitor.stop();
  
  // Send final metrics
  parentPort.postMessage({
    type: 'worker-stats',
    metrics: {
      ...metrics,
      peakMemoryMB: (metrics.peakMemory / 1024 / 1024).toFixed(1),
      avgComponentTime: metrics.componentsProcessed > 0 
        ? (performance.now() / metrics.componentsProcessed).toFixed(2)
        : 0
    }
  });
  
  // Exit cleanly
  process.exit(0);
}

// Handle errors
process.on('uncaughtException', (error) => {
  parentPort.postMessage({
    type: 'error',
    message: `Worker error: ${error.message}`,
    stack: error.stack
  });
});

process.on('unhandledRejection', (reason) => {
  parentPort.postMessage({
    type: 'error',
    message: `Worker unhandled rejection: ${reason}`
  });
});

// Ready signal
parentPort.postMessage({
  type: 'ready',
  workerId: workerData.workerId,
  pid: process.pid
});
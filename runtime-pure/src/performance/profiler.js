/**
 * Eghact Performance Profiler
 * Real-time performance monitoring for component render times, memory usage, and bundle impact
 */

import { wasmBenchmark } from '../wasm-interop.js';

// Performance data store
class PerformanceStore {
  constructor() {
    this.renderMetrics = new Map();
    this.memorySnapshots = [];
    this.bundleImpact = new Map();
    this.activeTimers = new Map();
    this.subscribers = new Set();
  }

  startComponentRender(componentName, props) {
    const id = `${componentName}-${Date.now()}-${Math.random()}`;
    const startData = {
      componentName,
      props: JSON.stringify(props),
      startTime: performance.now(),
      startMemory: performance.memory ? performance.memory.usedJSHeapSize : 0,
      renderCount: (this.renderMetrics.get(componentName)?.renderCount || 0) + 1
    };
    
    this.activeTimers.set(id, startData);
    
    // Use WASM timer if available
    if (wasmBenchmark?.startTimer) {
      startData.wasmTimerId = wasmBenchmark.startTimer(componentName);
    }
    
    return id;
  }

  endComponentRender(id) {
    const startData = this.activeTimers.get(id);
    if (!startData) return null;

    const endTime = performance.now();
    const duration = endTime - startData.startTime;
    const endMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
    const memoryDelta = endMemory - startData.startMemory;

    // End WASM timer if available
    let wasmDuration = null;
    if (startData.wasmTimerId && wasmBenchmark?.endTimer) {
      wasmDuration = wasmBenchmark.endTimer(startData.wasmTimerId);
    }

    const metric = {
      componentName: startData.componentName,
      props: startData.props,
      duration,
      wasmDuration,
      memoryDelta,
      timestamp: Date.now(),
      renderCount: startData.renderCount
    };

    // Update component metrics
    const componentMetrics = this.renderMetrics.get(startData.componentName) || {
      totalRenders: 0,
      totalTime: 0,
      avgTime: 0,
      minTime: Infinity,
      maxTime: 0,
      memoryImpact: 0,
      renderHistory: []
    };

    componentMetrics.totalRenders++;
    componentMetrics.totalTime += duration;
    componentMetrics.avgTime = componentMetrics.totalTime / componentMetrics.totalRenders;
    componentMetrics.minTime = Math.min(componentMetrics.minTime, duration);
    componentMetrics.maxTime = Math.max(componentMetrics.maxTime, duration);
    componentMetrics.memoryImpact += memoryDelta;
    componentMetrics.renderHistory.push(metric);

    // Keep only last 100 renders for history
    if (componentMetrics.renderHistory.length > 100) {
      componentMetrics.renderHistory.shift();
    }

    this.renderMetrics.set(startData.componentName, componentMetrics);
    this.activeTimers.delete(id);

    // Notify subscribers
    this.notifySubscribers({
      type: 'render',
      componentName: startData.componentName,
      metric
    });

    return metric;
  }

  captureMemorySnapshot(label = '') {
    if (!performance.memory) return null;

    const snapshot = {
      label,
      timestamp: Date.now(),
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
    };

    this.memorySnapshots.push(snapshot);

    // Keep only last 1000 snapshots
    if (this.memorySnapshots.length > 1000) {
      this.memorySnapshots.shift();
    }

    this.notifySubscribers({
      type: 'memory',
      snapshot
    });

    return snapshot;
  }

  analyzeBundleImpact(componentName, bundleInfo) {
    this.bundleImpact.set(componentName, {
      size: bundleInfo.size,
      gzipSize: bundleInfo.gzipSize,
      dependencies: bundleInfo.dependencies || [],
      treeShaking: bundleInfo.treeShaking || false,
      timestamp: Date.now()
    });

    this.notifySubscribers({
      type: 'bundle',
      componentName,
      bundleInfo
    });
  }

  getMetrics() {
    return {
      renderMetrics: Object.fromEntries(this.renderMetrics),
      memorySnapshots: this.memorySnapshots,
      bundleImpact: Object.fromEntries(this.bundleImpact),
      wasmStats: wasmBenchmark?.getStats ? wasmBenchmark.getStats() : null
    };
  }

  getComponentMetrics(componentName) {
    return this.renderMetrics.get(componentName);
  }

  clearMetrics() {
    this.renderMetrics.clear();
    this.memorySnapshots = [];
    this.bundleImpact.clear();
    this.activeTimers.clear();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers(event) {
    this.subscribers.forEach(callback => callback(event));
  }
}

// Global performance store instance
export const performanceStore = new PerformanceStore();

// Performance monitoring HOC
export function withPerformanceMonitoring(Component) {
  const ComponentName = Component.name || 'UnknownComponent';
  
  return class PerformanceWrappedComponent extends Component {
    constructor(props) {
      super(props);
      this._perfTimerId = null;
    }
    
    _mount(container) {
      // Start performance timing
      this._perfTimerId = performanceStore.startComponentRender(ComponentName, this.props);
      
      try {
        super._mount(container);
      } finally {
        // End performance timing
        if (this._perfTimerId) {
          performanceStore.endComponentRender(this._perfTimerId);
        }
      }
    }
    
    render() {
      // Time each render
      const timerId = performanceStore.startComponentRender(ComponentName, this.props);
      
      try {
        return super.render();
      } finally {
        performanceStore.endComponentRender(timerId);
      }
    }
  };
}

// Performance monitoring hooks
export function usePerformance() {
  return {
    startTimer: (label) => performanceStore.startComponentRender(label, {}),
    endTimer: (id) => performanceStore.endComponentRender(id),
    captureMemory: (label) => performanceStore.captureMemorySnapshot(label),
    getMetrics: () => performanceStore.getMetrics()
  };
}

// Auto-capture memory snapshots periodically
let memoryMonitorInterval = null;

export function startMemoryMonitoring(intervalMs = 1000) {
  if (memoryMonitorInterval) return;
  
  memoryMonitorInterval = setInterval(() => {
    performanceStore.captureMemorySnapshot('auto');
  }, intervalMs);
}

export function stopMemoryMonitoring() {
  if (memoryMonitorInterval) {
    clearInterval(memoryMonitorInterval);
    memoryMonitorInterval = null;
  }
}

// Export main API
export default {
  performanceStore,
  withPerformanceMonitoring,
  usePerformance,
  startMemoryMonitoring,
  stopMemoryMonitoring
};
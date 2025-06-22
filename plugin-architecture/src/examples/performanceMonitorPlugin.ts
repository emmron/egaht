import { createPlugin, metadata } from '../utils/createPlugin';
import { RuntimeHookContext } from '../types';

/**
 * Example Plugin: Performance Monitor
 * 
 * Tracks and logs runtime performance metrics for Eghact components
 * 
 * Features:
 * - Component render time tracking
 * - Memory usage monitoring
 * - Performance bottleneck detection
 * - Real-time performance dashboard
 * 
 * This demonstrates:
 * - Runtime hook integration
 * - Performance measurement
 * - DevTools integration
 * - Real-time monitoring
 */

interface PerformanceMetrics {
  componentId: string;
  name: string;
  mountTime: number;
  renderTime: number;
  updateCount: number;
  totalRenderTime: number;
  averageRenderTime: number;
  memoryUsage?: number;
  lastUpdate: number;
}

interface PerformanceOptions {
  enableLogging?: boolean;
  enableDevTools?: boolean;
  slowRenderThreshold?: number; // ms
  memoryMonitoring?: boolean;
  reportInterval?: number; // ms
}

let performanceRegistry = new Map<string, PerformanceMetrics>();
let renderStartTimes = new Map<string, number>();

export const performanceMonitorPlugin = createPlugin({
  metadata: metadata()
    .name('@eghact/plugin-performance-monitor')
    .version('1.0.0')
    .description('Real-time performance monitoring for Eghact components')
    .author('Agent 3 v2.0')
    .keywords(['eghact-plugin', 'performance', 'monitoring', 'devtools'])
    .engines({ eghact: '^1.0.0' })
    .build(),

  runtime: {
    /**
     * Track component mount performance
     */
    async beforeMount(context: RuntimeHookContext): Promise<void> {
      const componentId = getComponentId(context.component);
      const startTime = performance.now();
      
      renderStartTimes.set(componentId, startTime);
      
      const options = getPluginOptions(context);
      
      if (options.enableLogging) {
        console.log(`🚀 [Performance] Mounting component: ${context.component.constructor.name}`);
      }
    },

    /**
     * Record mount completion and initialize metrics
     */
    async mounted(context: RuntimeHookContext): Promise<void> {
      const componentId = getComponentId(context.component);
      const startTime = renderStartTimes.get(componentId);
      
      if (startTime) {
        const mountTime = performance.now() - startTime;
        renderStartTimes.delete(componentId);
        
        const metrics: PerformanceMetrics = {
          componentId,
          name: context.component.constructor.name,
          mountTime,
          renderTime: mountTime,
          updateCount: 0,
          totalRenderTime: mountTime,
          averageRenderTime: mountTime,
          lastUpdate: Date.now()
        };

        // Add memory usage if enabled
        const options = getPluginOptions(context);
        if (options.memoryMonitoring && 'memory' in performance) {
          metrics.memoryUsage = (performance as any).memory.usedJSHeapSize;
        }

        performanceRegistry.set(componentId, metrics);
        
        // Check for slow mount
        if (mountTime > (options.slowRenderThreshold || 16)) {
          console.warn(`⚠️ [Performance] Slow component mount detected: ${metrics.name} (${mountTime.toFixed(2)}ms)`);
        }

        if (options.enableLogging) {
          console.log(`✅ [Performance] Component mounted: ${metrics.name} (${mountTime.toFixed(2)}ms)`);
        }

        // Notify DevTools if available
        notifyDevTools('component-mounted', metrics);
      }
    },

    /**
     * Track update performance
     */
    async beforeUpdate(context: RuntimeHookContext): Promise<void> {
      const componentId = getComponentId(context.component);
      const startTime = performance.now();
      
      renderStartTimes.set(componentId, startTime);
    },

    /**
     * Record update completion and update metrics
     */
    async updated(context: RuntimeHookContext): Promise<void> {
      const componentId = getComponentId(context.component);
      const startTime = renderStartTimes.get(componentId);
      
      if (startTime) {
        const updateTime = performance.now() - startTime;
        renderStartTimes.delete(componentId);
        
        const metrics = performanceRegistry.get(componentId);
        if (metrics) {
          metrics.updateCount++;
          metrics.totalRenderTime += updateTime;
          metrics.averageRenderTime = metrics.totalRenderTime / (metrics.updateCount + 1);
          metrics.lastUpdate = Date.now();

          // Update memory usage if enabled
          const options = getPluginOptions(context);
          if (options.memoryMonitoring && 'memory' in performance) {
            metrics.memoryUsage = (performance as any).memory.usedJSHeapSize;
          }

          // Check for slow update
          if (updateTime > (options.slowRenderThreshold || 16)) {
            console.warn(`⚠️ [Performance] Slow component update detected: ${metrics.name} (${updateTime.toFixed(2)}ms)`);
          }

          if (options.enableLogging) {
            console.log(`🔄 [Performance] Component updated: ${metrics.name} (${updateTime.toFixed(2)}ms, avg: ${metrics.averageRenderTime.toFixed(2)}ms)`);
          }

          // Notify DevTools
          notifyDevTools('component-updated', metrics);
        }
      }
    },

    /**
     * Clean up metrics when component unmounts
     */
    async beforeUnmount(context: RuntimeHookContext): Promise<void> {
      const componentId = getComponentId(context.component);
      const metrics = performanceRegistry.get(componentId);
      
      if (metrics) {
        const options = getPluginOptions(context);
        
        if (options.enableLogging) {
          console.log(`🗑️ [Performance] Component unmounting: ${metrics.name} (${metrics.updateCount} updates, avg: ${metrics.averageRenderTime.toFixed(2)}ms)`);
        }

        // Notify DevTools
        notifyDevTools('component-unmounted', metrics);
        
        // Remove from registry
        performanceRegistry.delete(componentId);
      }
    },

    /**
     * Handle performance measurements from framework
     */
    onPerformanceMeasure(name: string, duration: number, context: RuntimeHookContext): void {
      const options = getPluginOptions(context);
      
      if (options.enableLogging) {
        console.log(`📊 [Performance] ${name}: ${duration.toFixed(2)}ms`);
      }

      // Send to DevTools
      notifyDevTools('performance-measure', {
        name,
        duration,
        timestamp: Date.now(),
        component: context.component.constructor.name
      });
    }
  },

  async init(pluginManager) {
    console.log('📊 Performance Monitor Plugin initialized');
    
    // Set up periodic reporting if enabled
    const options = getGlobalOptions();
    if (options.reportInterval && options.reportInterval > 0) {
      setInterval(() => {
        generatePerformanceReport();
      }, options.reportInterval);
    }

    // Expose global performance API
    if (typeof window !== 'undefined') {
      window.__eghact_performance = {
        getMetrics: () => Array.from(performanceRegistry.values()),
        getMetric: (componentId: string) => performanceRegistry.get(componentId),
        clearMetrics: () => performanceRegistry.clear(),
        generateReport: generatePerformanceReport
      };
    }
  },

  async destroy() {
    // Clean up
    performanceRegistry.clear();
    renderStartTimes.clear();
    
    if (typeof window !== 'undefined') {
      delete window.__eghact_performance;
    }
    
    console.log('📊 Performance Monitor Plugin destroyed');
  }
});

/**
 * Generate a comprehensive performance report
 */
function generatePerformanceReport(): void {
  const metrics = Array.from(performanceRegistry.values());
  
  if (metrics.length === 0) {
    console.log('📊 [Performance Report] No components tracked');
    return;
  }

  const totalComponents = metrics.length;
  const totalRenders = metrics.reduce((sum, m) => sum + m.updateCount + 1, 0);
  const averageRenderTime = metrics.reduce((sum, m) => sum + m.averageRenderTime, 0) / totalComponents;
  const slowComponents = metrics.filter(m => m.averageRenderTime > 16);
  
  console.group('📊 [Performance Report]');
  console.log(`Total Components: ${totalComponents}`);
  console.log(`Total Renders: ${totalRenders}`);
  console.log(`Average Render Time: ${averageRenderTime.toFixed(2)}ms`);
  console.log(`Slow Components (>16ms): ${slowComponents.length}`);
  
  if (slowComponents.length > 0) {
    console.group('🐌 Slow Components:');
    slowComponents
      .sort((a, b) => b.averageRenderTime - a.averageRenderTime)
      .forEach(component => {
        console.log(`${component.name}: ${component.averageRenderTime.toFixed(2)}ms (${component.updateCount} updates)`);
      });
    console.groupEnd();
  }

  // Memory usage summary if available
  const memoryMetrics = metrics.filter(m => m.memoryUsage);
  if (memoryMetrics.length > 0) {
    const totalMemory = memoryMetrics.reduce((sum, m) => sum + (m.memoryUsage || 0), 0);
    console.log(`Total Memory Usage: ${(totalMemory / 1024 / 1024).toFixed(2)}MB`);
  }
  
  console.groupEnd();

  // Send to DevTools
  notifyDevTools('performance-report', {
    totalComponents,
    totalRenders,
    averageRenderTime,
    slowComponents: slowComponents.length,
    timestamp: Date.now()
  });
}

/**
 * Get unique component ID
 */
function getComponentId(component: any): string {
  if (component._eghactId) {
    return component._eghactId;
  }
  
  // Generate unique ID
  const id = `component_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  component._eghactId = id;
  return id;
}

/**
 * Get plugin options from component or global config
 */
function getPluginOptions(context: RuntimeHookContext): PerformanceOptions {
  return {
    enableLogging: true,
    enableDevTools: true,
    slowRenderThreshold: 16,
    memoryMonitoring: false,
    reportInterval: 0,
    ...(context.component._performanceOptions || {})
  };
}

/**
 * Get global plugin options
 */
function getGlobalOptions(): PerformanceOptions {
  if (typeof window !== 'undefined' && window.__eghact_performance_options) {
    return window.__eghact_performance_options;
  }
  
  return {
    enableLogging: true,
    enableDevTools: true,
    slowRenderThreshold: 16,
    memoryMonitoring: false,
    reportInterval: 30000 // 30 seconds
  };
}

/**
 * Notify DevTools of performance events
 */
function notifyDevTools(type: string, data: any): void {
  if (typeof window !== 'undefined' && window.__EGHACT_DEVTOOLS__) {
    window.__EGHACT_DEVTOOLS__.notifyPerformance?.(type, data);
  }
}

// Type declarations for global objects
declare global {
  interface Window {
    __eghact_performance?: {
      getMetrics: () => PerformanceMetrics[];
      getMetric: (componentId: string) => PerformanceMetrics | undefined;
      clearMetrics: () => void;
      generateReport: () => void;
    };
    __eghact_performance_options?: PerformanceOptions;
    __EGHACT_DEVTOOLS__?: {
      notifyPerformance?: (type: string, data: any) => void;
    };
  }
}
/**
 * Eghact Plugin Architecture
 * Secure, performant plugin system for the Eghact framework
 * 
 * @author Agent 3 v2.0
 * @description Main entry point for plugin system with examples and utilities
 */

export { PluginManager } from './PluginManager';
export * from './types';

// Re-export utilities for plugin development
export { createPlugin } from './utils/createPlugin';
export { defineCompilerPlugin } from './utils/defineCompilerPlugin';
export { defineRuntimePlugin } from './utils/defineRuntimePlugin';

// Export example plugins for reference
export { customDirectivePlugin } from './examples/customDirectivePlugin';
export { cssInJsPlugin } from './examples/cssInJsPlugin';
export { performanceMonitorPlugin } from './examples/performanceMonitorPlugin';

/**
 * Create a new plugin manager instance with configuration
 */
export function createPluginManager(config?: any) {
  return new PluginManager(config);
}

/**
 * Plugin system version for compatibility checking
 */
export const PLUGIN_API_VERSION = '1.0.0';

/**
 * Default plugin configuration
 */
export const DEFAULT_PLUGIN_CONFIG = {
  pluginDirectory: './plugins',
  enableSandbox: true,
  maxConcurrentPlugins: 10,
  cacheTimeout: 300000, // 5 minutes
  security: {
    allowedModules: ['path', 'fs', 'crypto', 'util'],
    allowedGlobals: ['console', 'Buffer', 'process'],
    timeoutMs: 5000,
    memoryLimitMB: 128
  }
};

/**
 * Plugin development utilities and helpers
 */
export const pluginUtils = {
  /**
   * Validate plugin metadata format
   */
  validateMetadata: (metadata: any): boolean => {
    return !!(
      metadata.name &&
      metadata.version &&
      typeof metadata.name === 'string' &&
      typeof metadata.version === 'string'
    );
  },

  /**
   * Check if plugin API version is compatible
   */
  isCompatibleVersion: (pluginVersion: string): boolean => {
    // Simple major version compatibility check
    const [majorPlugin] = pluginVersion.split('.');
    const [majorApi] = PLUGIN_API_VERSION.split('.');
    return majorPlugin === majorApi;
  },

  /**
   * Create a performance timing wrapper for plugin hooks
   */
  withPerformanceTracking: (name: string, fn: Function) => {
    return async (...args: any[]) => {
      const start = performance.now();
      try {
        const result = await fn(...args);
        console.log(`[Performance] ${name}: ${(performance.now() - start).toFixed(2)}ms`);
        return result;
      } catch (error) {
        console.error(`[Performance] ${name} failed after ${(performance.now() - start).toFixed(2)}ms:`, error);
        throw error;
      }
    };
  }
};
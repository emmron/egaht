import fs from 'fs/promises';
import path from 'path';
import { VM } from 'vm2';
import chalk from 'chalk';
import glob from 'glob';
import semver from 'semver';

import {
  PluginInstance,
  PluginDefinition,
  PluginManagerConfig,
  PluginRegistryEntry,
  PluginLoadResult,
  PluginValidationResult,
  PluginSecurityContext,
  PluginExecutionContext,
  CompilerHookContext,
  RuntimeHookContext,
  TransformResult
} from './types';

/**
 * Secure plugin manager for Eghact framework
 * Provides sandboxed execution, performance monitoring, and lifecycle management
 */
export class PluginManager {
  private plugins = new Map<string, PluginRegistryEntry>();
  private hooks = new Map<string, PluginInstance[]>();
  private config: PluginManagerConfig;
  private logger: Console;

  constructor(config: Partial<PluginManagerConfig> = {}) {
    this.config = {
      pluginDirectory: './plugins',
      enableSandbox: true,
      maxConcurrentPlugins: 10,
      cacheTimeout: 300000, // 5 minutes
      security: {
        allowedModules: ['path', 'fs', 'crypto'],
        allowedGlobals: ['console', 'Buffer', 'process'],
        timeoutMs: 5000,
        memoryLimitMB: 128
      },
      ...config
    };

    this.logger = console;
  }

  /**
   * Initialize plugin manager and discover plugins
   */
  async init(): Promise<void> {
    this.logger.info(chalk.blue('🔌 Initializing Eghact Plugin Manager'));
    
    try {
      await this.discoverPlugins();
      await this.loadConfiguredPlugins();
      this.logger.info(chalk.green(`✅ Plugin Manager initialized with ${this.plugins.size} plugins`));
    } catch (error) {
      this.logger.error(chalk.red('❌ Failed to initialize Plugin Manager:'), error);
      throw error;
    }
  }

  /**
   * Discover plugins in the plugin directory
   */
  private async discoverPlugins(): Promise<void> {
    try {
      const pluginFiles = await glob(`${this.config.pluginDirectory}/**/package.json`);
      
      for (const packageFile of pluginFiles) {
        try {
          const packageData = JSON.parse(await fs.readFile(packageFile, 'utf-8'));
          
          if (this.isEghactPlugin(packageData)) {
            const pluginPath = path.dirname(packageFile);
            const entry: PluginRegistryEntry = {
              name: packageData.name,
              version: packageData.version,
              path: pluginPath,
              metadata: this.extractMetadata(packageData),
              config: { enabled: false },
              performance: {
                averageExecutionTime: 0,
                totalCalls: 0,
                errors: 0
              }
            };
            
            this.plugins.set(packageData.name, entry);
            this.logger.info(chalk.cyan(`📦 Discovered plugin: ${packageData.name}@${packageData.version}`));
          }
        } catch (error) {
          this.logger.warn(chalk.yellow(`⚠️  Failed to parse plugin package: ${packageFile}`));
        }
      }
    } catch (error) {
      this.logger.error(chalk.red('❌ Plugin discovery failed:'), error);
    }
  }

  /**
   * Check if package is an Eghact plugin
   */
  private isEghactPlugin(packageData: any): boolean {
    return (
      packageData.keywords?.includes('eghact-plugin') ||
      packageData.name?.startsWith('@eghact/plugin-') ||
      packageData.eghact?.plugin === true
    );
  }

  /**
   * Extract plugin metadata from package.json
   */
  private extractMetadata(packageData: any): any {
    return {
      name: packageData.name,
      version: packageData.version,
      description: packageData.description,
      author: packageData.author,
      homepage: packageData.homepage,
      keywords: packageData.keywords,
      engines: packageData.engines,
      dependencies: packageData.dependencies,
      peerDependencies: packageData.peerDependencies
    };
  }

  /**
   * Load configured plugins
   */
  private async loadConfiguredPlugins(): Promise<void> {
    const configFile = path.join(process.cwd(), 'eghact.plugins.json');
    
    try {
      const configData = JSON.parse(await fs.readFile(configFile, 'utf-8'));
      
      for (const [pluginName, pluginConfig] of Object.entries(configData.plugins || {})) {
        if ((pluginConfig as any).enabled !== false) {
          await this.loadPlugin(pluginName, pluginConfig as any);
        }
      }
    } catch (error) {
      this.logger.info(chalk.gray('ℹ️  No plugin configuration found, using defaults'));
    }
  }

  /**
   * Load and validate a specific plugin
   */
  async loadPlugin(name: string, config: any = {}): Promise<PluginLoadResult> {
    const startTime = performance.now();
    
    try {
      const entry = this.plugins.get(name);
      if (!entry) {
        return { success: false, error: `Plugin '${name}' not found` };
      }

      // Validate plugin compatibility
      const validation = await this.validatePlugin(entry);
      if (!validation.valid) {
        return { 
          success: false, 
          error: `Plugin validation failed: ${validation.errors.join(', ')}`,
          warnings: validation.warnings
        };
      }

      // Load plugin instance
      const instance = await this.createPluginInstance(entry, config);
      if (!instance) {
        return { success: false, error: 'Failed to create plugin instance' };
      }

      // Update registry
      entry.config = { enabled: true, ...config };
      entry.instance = instance;
      entry.loadTime = performance.now() - startTime;

      // Register plugin hooks
      this.registerHooks(instance);

      // Initialize plugin
      if (instance.init) {
        await instance.init(this);
      }

      this.logger.info(chalk.green(`✅ Loaded plugin: ${name} (${entry.loadTime.toFixed(2)}ms)`));
      
      return { 
        success: true, 
        plugin: instance,
        warnings: validation.warnings
      };

    } catch (error) {
      this.logger.error(chalk.red(`❌ Failed to load plugin '${name}':`), error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate plugin compatibility and security
   */
  private async validatePlugin(entry: PluginRegistryEntry): Promise<PluginValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check Eghact version compatibility
    const requiredEghact = entry.metadata.engines?.eghact;
    if (requiredEghact && !semver.satisfies('1.0.0', requiredEghact)) {
      errors.push(`Incompatible Eghact version. Required: ${requiredEghact}, Current: 1.0.0`);
    }

    // Check Node.js version compatibility
    const requiredNode = entry.metadata.engines?.node;
    if (requiredNode && !semver.satisfies(process.version, requiredNode)) {
      warnings.push(`Node.js version mismatch. Required: ${requiredNode}, Current: ${process.version}`);
    }

    // Validate plugin entry point exists
    const mainFile = path.join(entry.path, 'index.js');
    try {
      await fs.access(mainFile);
    } catch {
      errors.push('Plugin entry point (index.js) not found');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Create secure plugin instance with sandboxing
   */
  private async createPluginInstance(entry: PluginRegistryEntry, config: any): Promise<PluginInstance | null> {
    const pluginPath = path.join(entry.path, 'index.js');
    
    try {
      if (this.config.enableSandbox) {
        return await this.createSandboxedInstance(pluginPath, entry, config);
      } else {
        // Direct require (less secure but faster)
        const pluginModule = require(pluginPath);
        const pluginFactory: PluginDefinition = pluginModule.default || pluginModule;
        return pluginFactory(config);
      }
    } catch (error) {
      this.logger.error(chalk.red(`Failed to create plugin instance for '${entry.name}':`), error);
      return null;
    }
  }

  /**
   * Create plugin instance in secure sandbox
   */
  private async createSandboxedInstance(
    pluginPath: string, 
    entry: PluginRegistryEntry, 
    config: any
  ): Promise<PluginInstance | null> {
    const vm = new VM({
      timeout: this.config.security.timeoutMs,
      allowAsync: true,
      sandbox: {
        require: this.createSecureRequire(),
        console: this.createPluginLogger(entry.name),
        Buffer,
        process: {
          env: process.env,
          version: process.version
        }
      }
    });

    try {
      const pluginCode = await fs.readFile(pluginPath, 'utf-8');
      const result = vm.run(`
        ${pluginCode}
        module.exports
      `);

      const pluginFactory: PluginDefinition = result.default || result;
      return pluginFactory(config);
    } catch (error) {
      this.logger.error(chalk.red(`Sandbox execution failed for '${entry.name}':`), error);
      return null;
    }
  }

  /**
   * Create secure require function for sandbox
   */
  private createSecureRequire() {
    return (moduleName: string) => {
      if (this.config.security.allowedModules.includes(moduleName)) {
        return require(moduleName);
      }
      throw new Error(`Module '${moduleName}' is not allowed in plugin sandbox`);
    };
  }

  /**
   * Create plugin-specific logger
   */
  private createPluginLogger(pluginName: string) {
    const prefix = chalk.magenta(`[${pluginName}]`);
    return {
      info: (message: string) => this.logger.info(`${prefix} ${message}`),
      warn: (message: string) => this.logger.warn(`${prefix} ${chalk.yellow(message)}`),
      error: (message: string) => this.logger.error(`${prefix} ${chalk.red(message)}`)
    };
  }

  /**
   * Register plugin hooks for execution
   */
  private registerHooks(plugin: PluginInstance): void {
    // Register compiler hooks
    if (plugin.compiler) {
      for (const [hookName, hookFn] of Object.entries(plugin.compiler)) {
        if (typeof hookFn === 'function') {
          if (!this.hooks.has(`compiler:${hookName}`)) {
            this.hooks.set(`compiler:${hookName}`, []);
          }
          this.hooks.get(`compiler:${hookName}`)!.push(plugin);
        }
      }
    }

    // Register runtime hooks
    if (plugin.runtime) {
      for (const [hookName, hookFn] of Object.entries(plugin.runtime)) {
        if (typeof hookFn === 'function') {
          if (!this.hooks.has(`runtime:${hookName}`)) {
            this.hooks.set(`runtime:${hookName}`, []);
          }
          this.hooks.get(`runtime:${hookName}`)!.push(plugin);
        }
      }
    }
  }

  /**
   * Execute compiler hooks
   */
  async executeCompilerHook(hookName: string, context: CompilerHookContext): Promise<TransformResult> {
    const plugins = this.hooks.get(`compiler:${hookName}`) || [];
    let result: TransformResult = { code: context.source };

    for (const plugin of plugins) {
      const hookFn = plugin.compiler?.[hookName];
      if (hookFn) {
        try {
          const startTime = performance.now();
          const pluginResult = await hookFn(context);
          
          if (pluginResult) {
            result = { ...result, ...pluginResult };
            context.source = pluginResult.code || context.source;
          }

          this.updatePluginPerformance(plugin.metadata.name, performance.now() - startTime);
        } catch (error) {
          this.logger.error(chalk.red(`Plugin '${plugin.metadata.name}' failed in ${hookName}:`), error);
          this.incrementPluginErrors(plugin.metadata.name);
        }
      }
    }

    return result;
  }

  /**
   * Execute runtime hooks
   */
  async executeRuntimeHook(hookName: string, context: RuntimeHookContext): Promise<void> {
    const plugins = this.hooks.get(`runtime:${hookName}`) || [];

    for (const plugin of plugins) {
      const hookFn = plugin.runtime?.[hookName];
      if (hookFn) {
        try {
          const startTime = performance.now();
          await hookFn(context);
          this.updatePluginPerformance(plugin.metadata.name, performance.now() - startTime);
        } catch (error) {
          this.logger.error(chalk.red(`Plugin '${plugin.metadata.name}' failed in ${hookName}:`), error);
          this.incrementPluginErrors(plugin.metadata.name);
        }
      }
    }
  }

  /**
   * Update plugin performance metrics
   */
  private updatePluginPerformance(pluginName: string, duration: number): void {
    const entry = this.plugins.get(pluginName);
    if (entry) {
      const perf = entry.performance;
      perf.totalCalls++;
      perf.averageExecutionTime = (perf.averageExecutionTime * (perf.totalCalls - 1) + duration) / perf.totalCalls;
      entry.lastUsed = Date.now();
    }
  }

  /**
   * Increment plugin error count
   */
  private incrementPluginErrors(pluginName: string): void {
    const entry = this.plugins.get(pluginName);
    if (entry) {
      entry.performance.errors++;
    }
  }

  /**
   * Unload plugin and cleanup resources
   */
  async unloadPlugin(name: string): Promise<boolean> {
    try {
      const entry = this.plugins.get(name);
      if (!entry || !entry.instance) {
        return false;
      }

      // Call plugin destroy lifecycle
      if (entry.instance.destroy) {
        await entry.instance.destroy();
      }

      // Remove from hooks
      for (const [hookName, plugins] of this.hooks.entries()) {
        const index = plugins.findIndex(p => p.metadata.name === name);
        if (index !== -1) {
          plugins.splice(index, 1);
        }
      }

      // Clear instance
      entry.instance = undefined;
      entry.config.enabled = false;

      this.logger.info(chalk.gray(`🔌 Unloaded plugin: ${name}`));
      return true;
    } catch (error) {
      this.logger.error(chalk.red(`Failed to unload plugin '${name}':`), error);
      return false;
    }
  }

  /**
   * Get plugin performance statistics
   */
  getPluginStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [name, entry] of this.plugins.entries()) {
      stats[name] = {
        enabled: entry.config.enabled,
        loadTime: entry.loadTime,
        lastUsed: entry.lastUsed,
        performance: entry.performance
      };
    }

    return stats;
  }

  /**
   * List all available plugins
   */
  listPlugins(): PluginRegistryEntry[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Cleanup and destroy plugin manager
   */
  async destroy(): Promise<void> {
    this.logger.info(chalk.blue('🔌 Shutting down Plugin Manager'));
    
    for (const [name] of this.plugins) {
      await this.unloadPlugin(name);
    }

    this.plugins.clear();
    this.hooks.clear();
    
    this.logger.info(chalk.green('✅ Plugin Manager shutdown complete'));
  }
}
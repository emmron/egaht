import { 
  PluginDefinition, 
  PluginInstance, 
  PluginMetadata, 
  CompilerHooks, 
  RuntimeHooks 
} from '../types';

/**
 * Utility function to create a well-formed Eghact plugin
 * Provides TypeScript support and validation for plugin development
 */
export interface CreatePluginOptions {
  metadata: PluginMetadata;
  compiler?: CompilerHooks;
  runtime?: RuntimeHooks;
  init?: (pluginManager: any) => void | Promise<void>;
  destroy?: () => void | Promise<void>;
}

/**
 * Create a new Eghact plugin with proper structure and validation
 */
export function createPlugin(options: CreatePluginOptions): PluginDefinition {
  return function pluginFactory(config: Record<string, any> = {}): PluginInstance {
    // Validate metadata
    if (!options.metadata.name || !options.metadata.version) {
      throw new Error('Plugin metadata must include name and version');
    }

    // Validate hooks
    if (options.compiler) {
      validateCompilerHooks(options.compiler);
    }

    if (options.runtime) {
      validateRuntimeHooks(options.runtime);
    }

    return {
      metadata: options.metadata,
      config: { enabled: true, ...config },
      compiler: options.compiler,
      runtime: options.runtime,
      init: options.init,
      destroy: options.destroy
    };
  };
}

/**
 * Validate compiler hook structure
 */
function validateCompilerHooks(hooks: CompilerHooks): void {
  const validHooks = [
    'buildStart', 'buildEnd', 'resolveId', 'load', 'transform',
    'parseComponent', 'transformTemplate', 'transformScript', 'transformStyle',
    'generateBundle', 'writeBundle'
  ];

  for (const [hookName, hookFn] of Object.entries(hooks)) {
    if (!validHooks.includes(hookName)) {
      throw new Error(`Invalid compiler hook: ${hookName}`);
    }

    if (typeof hookFn !== 'function') {
      throw new Error(`Compiler hook '${hookName}' must be a function`);
    }
  }
}

/**
 * Validate runtime hook structure
 */
function validateRuntimeHooks(hooks: RuntimeHooks): void {
  const validHooks = [
    'beforeMount', 'mounted', 'beforeUpdate', 'updated', 'beforeUnmount', 'unmounted',
    'onStateChange', 'onSignalUpdate', 'onError', 'onWarning', 'onPerformanceMeasure'
  ];

  for (const [hookName, hookFn] of Object.entries(hooks)) {
    if (!validHooks.includes(hookName)) {
      throw new Error(`Invalid runtime hook: ${hookName}`);
    }

    if (typeof hookFn !== 'function') {
      throw new Error(`Runtime hook '${hookName}' must be a function`);
    }
  }
}

/**
 * Plugin metadata builder with validation
 */
export class PluginMetadataBuilder {
  private metadata: Partial<PluginMetadata> = {};

  name(name: string): this {
    if (!name || typeof name !== 'string') {
      throw new Error('Plugin name must be a non-empty string');
    }
    this.metadata.name = name;
    return this;
  }

  version(version: string): this {
    if (!version || typeof version !== 'string') {
      throw new Error('Plugin version must be a non-empty string');
    }
    // Basic semver validation
    if (!/^\d+\.\d+\.\d+/.test(version)) {
      throw new Error('Plugin version must follow semver format (e.g., 1.0.0)');
    }
    this.metadata.version = version;
    return this;
  }

  description(description: string): this {
    this.metadata.description = description;
    return this;
  }

  author(author: string): this {
    this.metadata.author = author;
    return this;
  }

  homepage(homepage: string): this {
    this.metadata.homepage = homepage;
    return this;
  }

  keywords(keywords: string[]): this {
    this.metadata.keywords = keywords;
    return this;
  }

  engines(engines: { eghact?: string; node?: string }): this {
    this.metadata.engines = engines;
    return this;
  }

  dependencies(dependencies: Record<string, string>): this {
    this.metadata.dependencies = dependencies;
    return this;
  }

  peerDependencies(peerDependencies: Record<string, string>): this {
    this.metadata.peerDependencies = peerDependencies;
    return this;
  }

  build(): PluginMetadata {
    if (!this.metadata.name || !this.metadata.version) {
      throw new Error('Plugin metadata must include name and version');
    }

    return this.metadata as PluginMetadata;
  }
}

/**
 * Create plugin metadata with fluent builder pattern
 */
export function metadata(): PluginMetadataBuilder {
  return new PluginMetadataBuilder();
}
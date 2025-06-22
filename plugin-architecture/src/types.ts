/**
 * Core plugin architecture types for Eghact framework
 * Provides secure, performant plugin system with compilation and runtime hooks
 */

export interface PluginMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  keywords?: string[];
  engines?: {
    eghact?: string;
    node?: string;
  };
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export interface PluginConfig {
  enabled?: boolean;
  options?: Record<string, any>;
  priority?: number; // Lower numbers = higher priority
}

export interface CompilerHookContext {
  filename: string;
  source: string;
  ast: any; // AST representation
  isProduction: boolean;
  target: 'browser' | 'server';
  options: Record<string, any>;
}

export interface RuntimeHookContext {
  component: any;
  props: Record<string, any>;
  state: Record<string, any>;
  element: HTMLElement | null;
  isHydrating: boolean;
}

export interface TransformResult {
  code?: string;
  ast?: any;
  map?: string;
  dependencies?: string[];
  metadata?: Record<string, any>;
}

export interface CompilerHooks {
  // Build process hooks
  buildStart?: (config: any) => void | Promise<void>;
  buildEnd?: (bundle: any) => void | Promise<void>;
  
  // File processing hooks
  resolveId?: (id: string, importer?: string) => string | null | Promise<string | null>;
  load?: (id: string) => string | null | Promise<string | null>;
  transform?: (context: CompilerHookContext) => TransformResult | Promise<TransformResult>;
  
  // Component lifecycle hooks
  parseComponent?: (source: string, filename: string) => any | Promise<any>;
  transformTemplate?: (template: string, context: CompilerHookContext) => string | Promise<string>;
  transformScript?: (script: string, context: CompilerHookContext) => TransformResult | Promise<TransformResult>;
  transformStyle?: (style: string, context: CompilerHookContext) => string | Promise<string>;
  
  // Output generation hooks
  generateBundle?: (bundle: any, isWrite: boolean) => void | Promise<void>;
  writeBundle?: (bundle: any) => void | Promise<void>;
}

export interface RuntimeHooks {
  // Component lifecycle
  beforeMount?: (context: RuntimeHookContext) => void | Promise<void>;
  mounted?: (context: RuntimeHookContext) => void | Promise<void>;
  beforeUpdate?: (context: RuntimeHookContext, prevProps: any, prevState: any) => void | Promise<void>;
  updated?: (context: RuntimeHookContext, prevProps: any, prevState: any) => void | Promise<void>;
  beforeUnmount?: (context: RuntimeHookContext) => void | Promise<void>;
  unmounted?: (context: RuntimeHookContext) => void | Promise<void>;
  
  // State management
  onStateChange?: (newState: any, oldState: any, component: any) => void;
  onSignalUpdate?: (signal: any, newValue: any, oldValue: any) => void;
  
  // Error handling
  onError?: (error: Error, context: RuntimeHookContext) => void;
  onWarning?: (warning: string, context: RuntimeHookContext) => void;
  
  // Performance monitoring
  onPerformanceMeasure?: (name: string, duration: number, context: RuntimeHookContext) => void;
}

export interface PluginInstance {
  metadata: PluginMetadata;
  config: PluginConfig;
  compiler?: CompilerHooks;
  runtime?: RuntimeHooks;
  
  // Plugin lifecycle
  init?: (pluginManager: any) => void | Promise<void>;
  destroy?: () => void | Promise<void>;
}

export interface PluginDefinition {
  (options?: Record<string, any>): PluginInstance;
  pluginName?: string;
  pluginVersion?: string;
}

export interface PluginLoadResult {
  success: boolean;
  plugin?: PluginInstance;
  error?: string;
  warnings?: string[];
}

export interface PluginValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PluginSecurityContext {
  allowedModules: string[];
  allowedGlobals: string[];
  timeoutMs: number;
  memoryLimitMB: number;
}

export interface PluginExecutionContext {
  sandbox: any; // VM2 sandbox
  security: PluginSecurityContext;
  logger: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
}

export interface PluginRegistryEntry {
  name: string;
  version: string;
  path: string;
  metadata: PluginMetadata;
  config: PluginConfig;
  instance?: PluginInstance;
  loadTime?: number;
  lastUsed?: number;
  performance: {
    averageExecutionTime: number;
    totalCalls: number;
    errors: number;
  };
}

export interface PluginManagerConfig {
  pluginDirectory: string;
  enableSandbox: boolean;
  security: PluginSecurityContext;
  maxConcurrentPlugins: number;
  cacheTimeout: number;
}
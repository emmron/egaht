# Eghact Plugin Architecture

A secure, performant plugin system for the Eghact framework that enables developers to extend both compiler and runtime functionality.

## 🚀 Features

- **Secure Sandboxing**: VM2-based isolation for plugin execution
- **Performance Monitoring**: Built-in metrics and bottleneck detection
- **Lifecycle Management**: Comprehensive plugin initialization and cleanup
- **Hook System**: Compiler and runtime hooks for maximum extensibility
- **Type Safety**: Full TypeScript support with validation
- **Developer Experience**: Rich debugging and error reporting

## 📦 Installation

```bash
npm install @eghact/plugin-architecture
```

## 🎯 Quick Start

### Creating Your First Plugin

```typescript
import { createPlugin, metadata } from '@eghact/plugin-architecture';

const myPlugin = createPlugin({
  metadata: metadata()
    .name('my-awesome-plugin')
    .version('1.0.0')
    .description('Does awesome things')
    .build(),

  compiler: {
    async transform(context) {
      // Transform code during compilation
      return {
        code: context.source.replace(/console\.log/g, 'console.info')
      };
    }
  },

  runtime: {
    async mounted(context) {
      // Run when components mount
      console.log(`Component ${context.component.constructor.name} mounted!`);
    }
  }
});

export default myPlugin;
```

### Using the Plugin Manager

```typescript
import { createPluginManager } from '@eghact/plugin-architecture';

const manager = createPluginManager({
  pluginDirectory: './plugins',
  enableSandbox: true,
  security: {
    allowedModules: ['path', 'fs'],
    timeoutMs: 5000
  }
});

await manager.init();
await manager.loadPlugin('my-awesome-plugin');
```

## 🔌 Plugin Types

### Compiler Plugins

Extend the build process and code transformation:

```typescript
compiler: {
  // Build lifecycle
  buildStart: async (config) => { /* ... */ },
  buildEnd: async (bundle) => { /* ... */ },
  
  // File processing
  resolveId: (id, importer) => { /* ... */ },
  load: (id) => { /* ... */ },
  transform: (context) => { /* ... */ },
  
  // Component processing
  parseComponent: (source, filename) => { /* ... */ },
  transformTemplate: (template, context) => { /* ... */ },
  transformScript: (script, context) => { /* ... */ },
  transformStyle: (style, context) => { /* ... */ },
  
  // Bundle generation
  generateBundle: (bundle, isWrite) => { /* ... */ },
  writeBundle: (bundle) => { /* ... */ }
}
```

### Runtime Plugins

Hook into component lifecycle and state management:

```typescript
runtime: {
  // Component lifecycle
  beforeMount: (context) => { /* ... */ },
  mounted: (context) => { /* ... */ },
  beforeUpdate: (context, prevProps, prevState) => { /* ... */ },
  updated: (context, prevProps, prevState) => { /* ... */ },
  beforeUnmount: (context) => { /* ... */ },
  unmounted: (context) => { /* ... */ },
  
  // State management
  onStateChange: (newState, oldState, component) => { /* ... */ },
  onSignalUpdate: (signal, newValue, oldValue) => { /* ... */ },
  
  // Error handling
  onError: (error, context) => { /* ... */ },
  onWarning: (warning, context) => { /* ... */ },
  
  // Performance monitoring
  onPerformanceMeasure: (name, duration, context) => { /* ... */ }
}
```

## 📚 Example Plugins

### 1. Custom Directive Plugin

Adds `@tooltip` directive support:

```typescript
// Usage in templates
<button @tooltip="Click me!">Submit</button>
```

```typescript
import { customDirectivePlugin } from '@eghact/plugin-architecture';

// Transforms @tooltip into HTML attributes and runtime code
await manager.loadPlugin('custom-directive', {
  position: 'top',
  theme: 'dark',
  delay: 100
});
```

### 2. Performance Monitor Plugin

Real-time component performance tracking:

```typescript
import { performanceMonitorPlugin } from '@eghact/plugin-architecture';

await manager.loadPlugin('performance-monitor', {
  enableLogging: true,
  slowRenderThreshold: 16, // ms
  reportInterval: 30000 // 30 seconds
});

// Access metrics
window.__eghact_performance.getMetrics();
window.__eghact_performance.generateReport();
```

## 🔒 Security Model

### Sandboxing

Plugins run in secure VM2 sandboxes with restricted access:

```typescript
security: {
  allowedModules: ['path', 'fs', 'crypto'],
  allowedGlobals: ['console', 'Buffer'],
  timeoutMs: 5000,
  memoryLimitMB: 128
}
```

### Validation

All plugins undergo comprehensive validation:

- Metadata format checking
- Version compatibility verification
- Security constraint enforcement
- Performance impact assessment

## 📊 Performance Monitoring

Built-in performance tracking for all plugins:

```typescript
// Get plugin performance statistics
const stats = manager.getPluginStats();

console.log(stats['my-plugin']);
// {
//   enabled: true,
//   loadTime: 25.4,
//   performance: {
//     averageExecutionTime: 1.2,
//     totalCalls: 150,
//     errors: 0
//   }
// }
```

## 🛠️ Configuration

### Plugin Configuration File

Create `eghact.plugins.json` in your project root:

```json
{
  "plugins": {
    "@eghact/plugin-custom-directive": {
      "enabled": true,
      "options": {
        "position": "top",
        "theme": "dark"
      }
    },
    "@eghact/plugin-performance-monitor": {
      "enabled": true,
      "options": {
        "enableLogging": false,
        "reportInterval": 60000
      }
    }
  }
}
```

### Manager Configuration

```typescript
const manager = createPluginManager({
  pluginDirectory: './plugins',
  enableSandbox: true,
  maxConcurrentPlugins: 10,
  cacheTimeout: 300000,
  security: {
    allowedModules: ['path', 'fs', 'crypto'],
    allowedGlobals: ['console', 'Buffer', 'process'],
    timeoutMs: 5000,
    memoryLimitMB: 128
  }
});
```

## 🎨 Plugin Development

### Using the Plugin Builder

```typescript
import { metadata, createPlugin } from '@eghact/plugin-architecture';

const plugin = createPlugin({
  metadata: metadata()
    .name('@my-org/awesome-plugin')
    .version('1.2.3')
    .description('Does amazing things')
    .author('Your Name')
    .keywords(['eghact-plugin', 'transformation'])
    .engines({ eghact: '^1.0.0', node: '>=16' })
    .dependencies({ 'some-lib': '^2.0.0' })
    .build(),

  // Plugin implementation...
});
```

### TypeScript Support

Full type safety and IntelliSense support:

```typescript
import { 
  PluginDefinition, 
  CompilerHookContext, 
  RuntimeHookContext,
  TransformResult 
} from '@eghact/plugin-architecture';

const plugin: PluginDefinition = createPlugin({
  // Fully typed plugin implementation
});
```

## 🧪 Testing Plugins

### Unit Testing

```typescript
import { createPluginManager } from '@eghact/plugin-architecture';

describe('My Plugin', () => {
  let manager: PluginManager;

  beforeEach(async () => {
    manager = createPluginManager({ enableSandbox: false });
    await manager.init();
  });

  it('should transform code correctly', async () => {
    const result = await manager.loadPlugin('my-plugin');
    expect(result.success).toBe(true);
    
    // Test compiler hooks
    const transformed = await manager.executeCompilerHook('transform', {
      filename: 'test.egh',
      source: 'console.log("test")',
      // ... other context
    });
    
    expect(transformed.code).toContain('console.info');
  });
});
```

## 📖 API Reference

### PluginManager

- `init()`: Initialize and discover plugins
- `loadPlugin(name, config)`: Load and configure a plugin
- `unloadPlugin(name)`: Unload a plugin
- `executeCompilerHook(hookName, context)`: Execute compiler hooks
- `executeRuntimeHook(hookName, context)`: Execute runtime hooks
- `getPluginStats()`: Get performance statistics
- `listPlugins()`: List all available plugins
- `destroy()`: Cleanup and shutdown

### Hook Contexts

#### CompilerHookContext
```typescript
{
  filename: string;
  source: string;
  ast: any;
  isProduction: boolean;
  target: 'browser' | 'server';
  options: Record<string, any>;
}
```

#### RuntimeHookContext
```typescript
{
  component: any;
  props: Record<string, any>;
  state: Record<string, any>;
  element: HTMLElement | null;
  isHydrating: boolean;
}
```

## 🔧 Advanced Usage

### Plugin Discovery

Plugins are automatically discovered by:

1. `keywords` containing `"eghact-plugin"`
2. Package name starting with `"@eghact/plugin-"`
3. `package.json` field: `"eghact": { "plugin": true }`

### Dependency Resolution

Plugins can depend on other plugins:

```json
{
  "peerDependencies": {
    "@eghact/plugin-base": "^1.0.0"
  },
  "eghact": {
    "plugin": true,
    "requires": ["@eghact/plugin-base"]
  }
}
```

### Hot Reloading

Development mode supports plugin hot reloading:

```typescript
// Watch for plugin changes
manager.enableHotReload('./plugins');

// Automatically reload when files change
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Add tests for your changes
4. Ensure security compliance
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

---

**Built by Agent 3 v2.0** - Delivering enterprise-grade plugin architecture! 🚀
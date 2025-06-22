# Eghact Plugin API Specification v1.0
## For CLI Integration by Bobby

### Quick Start for CLI Integration

```typescript
// Bobby, here's what you need for BOB003
import { PluginManager } from '@eghact/plugin-core';

// Initialize plugin system in CLI
const pluginManager = new PluginManager({
  cliMode: true,
  searchPaths: [
    './node_modules',
    '~/.eghact/plugins',
    './plugins'
  ]
});

// Register CLI command extension point
pluginManager.registerExtensionPoint('cli:command', {
  validate: (command) => command.name && command.handler,
  priority: 'sequential'
});
```

### Core Plugin API for CLI

```typescript
// Plugin interface for CLI extensions
interface CLIPlugin {
  name: string;
  version: string;
  
  // CLI-specific hooks
  registerCommands?(api: CLIPluginAPI): void;
  enhanceREPL?(repl: REPLContext): void;
  beforeCommand?(cmd: string, args: string[]): void;
  afterCommand?(cmd: string, result: any): void;
}

// API exposed to plugins
interface CLIPluginAPI {
  // Register new CLI command
  registerCommand(command: {
    name: string;
    description: string;
    options?: CommandOption[];
    handler: (args: any) => Promise<void>;
  }): void;
  
  // Add command alias
  addAlias(alias: string, command: string): void;
  
  // Register autocomplete provider
  registerAutocomplete(provider: AutocompleteProvider): void;
  
  // Access to CLI internals
  getConfig(): CLIConfig;
  getLogger(): Logger;
  prompt(question: string): Promise<string>;
}
```

### Plugin Discovery & Loading

```typescript
// For BOB003 implementation
class CLIPluginLoader {
  async loadPlugins(): Promise<CLIPlugin[]> {
    // 1. Scan for plugins in package.json
    const packagePlugins = await this.scanPackageJson();
    
    // 2. Scan global plugins
    const globalPlugins = await this.scanGlobalPlugins();
    
    // 3. Scan local project plugins
    const localPlugins = await this.scanLocalPlugins();
    
    // 4. Deduplicate and resolve conflicts
    return this.resolvePlugins([
      ...packagePlugins,
      ...globalPlugins,
      ...localPlugins
    ]);
  }
  
  // Plugin validation
  validatePlugin(plugin: any): boolean {
    return plugin.name && 
           plugin.version && 
           typeof plugin.registerCommands === 'function';
  }
}
```

### Command Registration Flow

```typescript
// How plugins extend CLI commands
export function createPlugin(): CLIPlugin {
  return {
    name: 'eghact-deploy-plugin',
    version: '1.0.0',
    
    registerCommands(api: CLIPluginAPI) {
      // Add new command
      api.registerCommand({
        name: 'deploy',
        description: 'Deploy Eghact app to cloud',
        options: [
          { name: '--provider', type: 'string', default: 'vercel' },
          { name: '--env', type: 'string', default: 'production' }
        ],
        handler: async (args) => {
          // Plugin implementation
          console.log(`Deploying to ${args.provider}...`);
        }
      });
      
      // Add alias
      api.addAlias('d', 'deploy');
      
      // Add autocomplete
      api.registerAutocomplete({
        command: 'deploy',
        provider: async (partial) => {
          return ['vercel', 'netlify', 'aws', 'gcp']
            .filter(p => p.startsWith(partial));
        }
      });
    }
  };
}
```

### Integration with Bobby's CLI Architecture

```typescript
// In your CLI main file
import { CLI } from './cli';
import { CLIPluginLoader } from './plugin-loader';

async function initializeCLI() {
  const cli = new CLI();
  const loader = new CLIPluginLoader();
  
  // Load all plugins
  const plugins = await loader.loadPlugins();
  
  // Initialize each plugin
  for (const plugin of plugins) {
    if (plugin.registerCommands) {
      plugin.registerCommands(cli.pluginAPI);
    }
  }
  
  // Start CLI with plugin commands
  await cli.start();
}
```

### Plugin Manifest for CLI Plugins

```json
{
  "name": "eghact-awesome-cli-plugin",
  "version": "1.0.0",
  "eghact": {
    "type": "cli-extension",
    "commands": [
      {
        "name": "awesome",
        "description": "Do awesome things"
      }
    ],
    "requiredVersion": "^3.0.0"
  },
  "main": "./dist/index.js",
  "peerDependencies": {
    "@eghact/cli": "^3.0.0"
  }
}
```

### Performance Considerations for CLI

```typescript
// Lazy loading for optimal <3ms overhead
class LazyPluginLoader {
  private pluginCache = new Map<string, CLIPlugin>();
  
  async loadPlugin(name: string): Promise<CLIPlugin> {
    // Only load when command is actually used
    if (!this.pluginCache.has(name)) {
      const plugin = await import(name);
      this.pluginCache.set(name, plugin.default);
    }
    return this.pluginCache.get(name)!;
  }
}
```

### Security Model for CLI Plugins

```typescript
// Plugins run in restricted context
interface CLIPluginSandbox {
  // No filesystem access by default
  fs?: RestrictedFS;
  
  // Limited network access
  fetch?: RestrictedFetch;
  
  // No process spawning
  exec?: never;
  
  // Explicit capability requests
  requestCapability(cap: string): Promise<boolean>;
}
```

### Example: Complete CLI Plugin

```typescript
// Example plugin that Bobby can use for testing
import { CLIPlugin, CLIPluginAPI } from '@eghact/plugin-api';

export default {
  name: 'eghact-git-plugin',
  version: '1.0.0',
  
  async registerCommands(api: CLIPluginAPI) {
    api.registerCommand({
      name: 'git-stats',
      description: 'Show git statistics for Eghact project',
      handler: async () => {
        const stats = await getGitStats();
        console.log('Components:', stats.components);
        console.log('Commits:', stats.commits);
      }
    });
    
    api.registerCommand({
      name: 'git-hooks',
      description: 'Install Eghact git hooks',
      handler: async () => {
        await installGitHooks();
        console.log('Git hooks installed!');
      }
    });
  },
  
  enhanceREPL(repl) {
    // Add REPL commands
    repl.defineCommand('stats', {
      help: 'Show project statistics',
      action() {
        this.clearBufferedCommand();
        console.log('Project stats...');
        this.displayPrompt();
      }
    });
  }
} as CLIPlugin;
```

### Bobby's Implementation Checklist

1. **Create plugin loader** using the CLIPluginLoader pattern
2. **Implement plugin API** with registerCommand, addAlias, etc.
3. **Add plugin discovery** scanning package.json and plugin directories
4. **Integrate with existing CLI** command parser
5. **Add lazy loading** for <3ms performance target
6. **Test with example plugin** provided above

### Performance Optimization Tips

- Use dynamic imports for lazy loading
- Cache plugin metadata, load code only on command execution
- Implement command trie for O(1) lookup
- Precompile plugin manifests during build

---
*Bobby, this spec should unblock BOB003. The API is designed to integrate seamlessly with your existing CLI architecture while maintaining <3ms overhead through lazy loading.*

*- Lexypoo, Chief Architect*
import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';
import chalk from 'chalk';

export interface CLIPlugin {
  name: string;
  version: string;
  registerCommands?(api: CLIPluginAPI): void;
  enhanceREPL?(repl: any): void;
  beforeCommand?(cmd: string, args: string[]): void;
  afterCommand?(cmd: string, result: any): void;
}

export interface CommandOption {
  name: string;
  type?: 'string' | 'boolean' | 'number';
  default?: any;
  description?: string;
}

export interface CLICommand {
  name: string;
  description: string;
  options?: CommandOption[];
  handler: (args: any) => Promise<void>;
}

export interface AutocompleteProvider {
  command: string;
  provider: (partial: string) => Promise<string[]>;
}

export interface CLIPluginAPI {
  registerCommand(command: CLICommand): void;
  addAlias(alias: string, command: string): void;
  registerAutocomplete(provider: AutocompleteProvider): void;
  getConfig(): any;
  getLogger(): any;
  prompt(question: string): Promise<string>;
}

interface PluginMetadata {
  name: string;
  path: string;
  manifest: any;
  loadTime?: number;
}

export class CLIPluginLoader {
  private pluginCache = new Map<string, CLIPlugin>();
  private pluginMetadata = new Map<string, PluginMetadata>();
  private searchPaths: string[];
  private lazyLoadMap = new Map<string, string>();

  constructor(searchPaths?: string[]) {
    this.searchPaths = searchPaths || [
      path.join(process.cwd(), 'node_modules'),
      path.join(process.env.HOME || '.', '.eghact', 'plugins'),
      path.join(process.cwd(), 'plugins')
    ];
  }

  async loadPlugins(lazy: boolean = true): Promise<CLIPlugin[]> {
    const startTime = Date.now();
    
    // Phase 1: Discover plugins (metadata only)
    const packagePlugins = await this.scanPackageJson();
    const globalPlugins = await this.scanGlobalPlugins();
    const localPlugins = await this.scanLocalPlugins();

    // Merge and deduplicate
    const allPluginMeta = this.resolvePlugins([
      ...packagePlugins,
      ...globalPlugins,
      ...localPlugins
    ]);

    // Phase 2: Load plugins (lazy or eager)
    const plugins: CLIPlugin[] = [];
    
    for (const meta of allPluginMeta) {
      if (lazy) {
        // Store path for lazy loading
        this.lazyLoadMap.set(meta.name, meta.path);
        this.pluginMetadata.set(meta.name, meta);
      } else {
        // Load immediately
        const plugin = await this.loadPlugin(meta.path);
        if (plugin && this.validatePlugin(plugin)) {
          plugins.push(plugin);
          this.pluginCache.set(plugin.name, plugin);
        }
      }
    }

    const loadTime = Date.now() - startTime;
    if (process.env.DEBUG) {
      console.log(chalk.gray(`Plugin discovery took ${loadTime}ms`));
    }

    return plugins;
  }

  async loadPluginByName(name: string): Promise<CLIPlugin | null> {
    // Check cache first
    if (this.pluginCache.has(name)) {
      return this.pluginCache.get(name)!;
    }

    // Check lazy load map
    const pluginPath = this.lazyLoadMap.get(name);
    if (!pluginPath) {
      return null;
    }

    // Load plugin
    const plugin = await this.loadPlugin(pluginPath);
    if (plugin && this.validatePlugin(plugin)) {
      this.pluginCache.set(name, plugin);
      return plugin;
    }

    return null;
  }

  async loadPluginForCommand(command: string): Promise<CLIPlugin | null> {
    // Check if any plugin metadata indicates it provides this command
    for (const [name, meta] of this.pluginMetadata) {
      if (meta.manifest?.eghact?.commands?.some((cmd: any) => cmd.name === command)) {
        return await this.loadPluginByName(name);
      }
    }
    return null;
  }

  private async scanPackageJson(): Promise<PluginMetadata[]> {
    const plugins: PluginMetadata[] = [];
    
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        // Check dependencies for Eghact plugins
        const deps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies
        };

        for (const [name, version] of Object.entries(deps)) {
          if (name.startsWith('@eghact/plugin-') || name.includes('eghact-plugin-')) {
            const pluginPath = path.join(process.cwd(), 'node_modules', name);
            if (fs.existsSync(pluginPath)) {
              const manifest = await this.loadPluginManifest(pluginPath);
              if (manifest) {
                plugins.push({
                  name,
                  path: pluginPath,
                  manifest
                });
              }
            }
          }
        }
      }
    } catch (error) {
      // Ignore errors in scanning
    }

    return plugins;
  }

  private async scanGlobalPlugins(): Promise<PluginMetadata[]> {
    const plugins: PluginMetadata[] = [];
    const globalPath = path.join(process.env.HOME || '.', '.eghact', 'plugins');

    if (fs.existsSync(globalPath)) {
      try {
        const pluginDirs = await fs.promises.readdir(globalPath);
        
        for (const dir of pluginDirs) {
          const pluginPath = path.join(globalPath, dir);
          const manifest = await this.loadPluginManifest(pluginPath);
          
          if (manifest) {
            plugins.push({
              name: manifest.name || dir,
              path: pluginPath,
              manifest
            });
          }
        }
      } catch (error) {
        // Ignore errors
      }
    }

    return plugins;
  }

  private async scanLocalPlugins(): Promise<PluginMetadata[]> {
    const plugins: PluginMetadata[] = [];
    const localPath = path.join(process.cwd(), 'plugins');

    if (fs.existsSync(localPath)) {
      try {
        const pluginFiles = await glob('*/package.json', { cwd: localPath });
        
        for (const file of pluginFiles) {
          const pluginPath = path.join(localPath, path.dirname(file));
          const manifest = await this.loadPluginManifest(pluginPath);
          
          if (manifest) {
            plugins.push({
              name: manifest.name || path.basename(pluginPath),
              path: pluginPath,
              manifest
            });
          }
        }
      } catch (error) {
        // Ignore errors
      }
    }

    return plugins;
  }

  private async loadPluginManifest(pluginPath: string): Promise<any | null> {
    try {
      const manifestPath = path.join(pluginPath, 'package.json');
      if (fs.existsSync(manifestPath)) {
        return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      }
    } catch (error) {
      // Ignore manifest errors
    }
    return null;
  }

  private async loadPlugin(pluginPath: string): Promise<CLIPlugin | null> {
    try {
      const mainFile = await this.findMainFile(pluginPath);
      if (!mainFile) {
        return null;
      }

      // Dynamic import for lazy loading
      const module = await import(mainFile);
      return module.default || module;
    } catch (error) {
      if (process.env.DEBUG) {
        console.error(chalk.red(`Failed to load plugin from ${pluginPath}:`), error);
      }
      return null;
    }
  }

  private async findMainFile(pluginPath: string): Promise<string | null> {
    // Check package.json for main entry
    const manifest = await this.loadPluginManifest(pluginPath);
    if (manifest?.main) {
      const mainPath = path.join(pluginPath, manifest.main);
      if (fs.existsSync(mainPath)) {
        return mainPath;
      }
    }

    // Check common entry points
    const commonEntries = ['index.js', 'dist/index.js', 'lib/index.js'];
    for (const entry of commonEntries) {
      const entryPath = path.join(pluginPath, entry);
      if (fs.existsSync(entryPath)) {
        return entryPath;
      }
    }

    return null;
  }

  private resolvePlugins(plugins: PluginMetadata[]): PluginMetadata[] {
    // Deduplicate by name, prefer local > global > package
    const pluginMap = new Map<string, PluginMetadata>();

    for (const plugin of plugins) {
      const existing = pluginMap.get(plugin.name);
      if (!existing || this.shouldReplace(existing, plugin)) {
        pluginMap.set(plugin.name, plugin);
      }
    }

    return Array.from(pluginMap.values());
  }

  private shouldReplace(existing: PluginMetadata, candidate: PluginMetadata): boolean {
    // Priority: local > global > package
    const getPriority = (p: PluginMetadata) => {
      if (p.path.includes('/plugins/')) return 3;
      if (p.path.includes('/.eghact/')) return 2;
      return 1;
    };

    return getPriority(candidate) > getPriority(existing);
  }

  validatePlugin(plugin: any): boolean {
    return !!(
      plugin &&
      typeof plugin === 'object' &&
      plugin.name &&
      plugin.version &&
      (typeof plugin.registerCommands === 'function' ||
       typeof plugin.enhanceREPL === 'function')
    );
  }

  getLoadedPlugins(): CLIPlugin[] {
    return Array.from(this.pluginCache.values());
  }

  getPluginMetadata(): PluginMetadata[] {
    return Array.from(this.pluginMetadata.values());
  }

  clearCache(): void {
    this.pluginCache.clear();
    this.pluginMetadata.clear();
    this.lazyLoadMap.clear();
  }
}
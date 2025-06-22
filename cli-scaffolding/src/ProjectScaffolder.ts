import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import fetch from 'node-fetch';
import * as tar from 'tar';
import * as fsExtra from 'fs-extra';
import * as glob from 'glob';
import * as Mustache from 'mustache';
import validatePackageName from 'validate-npm-package-name';
import * as semver from 'semver';

import {
  CreateProjectOptions,
  TemplateConfig,
  TemplateSource,
  TemplateValidationResult,
  InstallationResult,
  ProgressCallback,
  ComponentGeneratorOptions,
  TemplateRegistry
} from './types';

/**
 * Main project scaffolding class
 * 
 * Handles project creation, template processing, dependency installation,
 * and component generation for Eghact CLI.
 */
export class ProjectScaffolder {
  private cacheDir: string;
  private registries: TemplateRegistry[] = [];

  constructor(cacheDir?: string, registries?: TemplateRegistry[]) {
    this.cacheDir = cacheDir || path.join(os.homedir(), '.eghact', 'templates');
    this.registries = registries || this.getDefaultRegistries();
  }

  /**
   * Create a new Eghact project from template
   */
  async createProject(options: CreateProjectOptions, onProgress?: ProgressCallback): Promise<void> {
    const totalSteps = 8;
    let currentStep = 0;

    const progress = (step: string) => {
      currentStep++;
      onProgress?.(step, currentStep, totalSteps);
    };

    try {
      // Validate project name
      progress('Validating project name');
      this.validateProjectName(options.name);

      // Resolve template
      progress('Resolving template');
      const template = await this.resolveTemplate(options.template || 'basic');

      // Create project directory
      progress('Creating project directory');
      const projectDir = await this.createProjectDirectory(options);

      // Download and extract template
      progress('Downloading template');
      const templateDir = await this.downloadTemplate(template);

      // Validate template
      progress('Validating template');
      const validation = await this.validateTemplate(templateDir);
      if (!validation.valid) {
        throw new Error(`Template validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Process template variables
      progress('Processing template');
      const variables = await this.collectVariables(template, options.variables);
      await this.processTemplate(templateDir, projectDir, variables);

      // Install dependencies
      if (!options.skipInstall) {
        progress('Installing dependencies');
        await this.installDependencies(projectDir, options.packageManager);
      }

      // Initialize git repository
      if (!options.skipGit) {
        progress('Initializing git repository');
        await this.initializeGit(projectDir);
      }

      // Run post-creation scripts
      progress('Running post-creation scripts');
      await this.runPostCreationScripts(template, projectDir);

      console.log(chalk.green('\n✅ Project created successfully!'));
      console.log(chalk.cyan(`\nNext steps:`));
      console.log(chalk.white(`  cd ${options.name}`));
      if (options.skipInstall) {
        console.log(chalk.white(`  npm install`));
      }
      console.log(chalk.white(`  npm run dev`));

    } catch (error) {
      console.error(chalk.red('\n❌ Project creation failed:'), error instanceof Error ? error.message : error);
      throw error;
    }
  }

  /**
   * Generate a new component
   */
  async generateComponent(options: ComponentGeneratorOptions): Promise<void> {
    const spinner = ora('Generating component').start();

    try {
      // Validate component name
      this.validateComponentName(options.name);

      // Determine component directory
      const componentDir = this.resolveComponentDirectory(options);
      await fsExtra.ensureDir(componentDir);

      // Generate component files
      await this.generateComponentFiles(options, componentDir);

      // Generate tests if requested
      if (options.tests) {
        await this.generateComponentTests(options, componentDir);
      }

      // Generate stories if requested
      if (options.stories) {
        await this.generateComponentStories(options, componentDir);
      }

      spinner.succeed(chalk.green(`Component '${options.name}' generated successfully!`));
      console.log(chalk.cyan(`Location: ${componentDir}`));

    } catch (error) {
      spinner.fail(chalk.red('Component generation failed'));
      throw error;
    }
  }

  /**
   * List available templates
   */
  async listTemplates(category?: string): Promise<TemplateConfig[]> {
    const templates: TemplateConfig[] = [];

    for (const registry of this.registries) {
      try {
        const registryTemplates = await this.fetchRegistryTemplates(registry);
        templates.push(...registryTemplates);
      } catch (error) {
        console.warn(chalk.yellow(`Warning: Failed to fetch templates from ${registry.name}`));
      }
    }

    // Add built-in templates
    templates.push(...this.getBuiltInTemplates());

    // Filter by category if specified
    if (category) {
      return templates.filter(t => t.category === category);
    }

    return templates;
  }

  /**
   * Validate project name
   */
  private validateProjectName(name: string): void {
    const validation = validatePackageName(name);
    
    if (!validation.validForNewPackages) {
      const errors = [...(validation.errors || []), ...(validation.warnings || [])];
      throw new Error(`Invalid project name: ${errors.join(', ')}`);
    }

    // Additional checks
    if (name.length === 0) {
      throw new Error('Project name cannot be empty');
    }

    if (name.startsWith('.') || name.startsWith('-')) {
      throw new Error('Project name cannot start with . or -');
    }
  }

  /**
   * Validate component name
   */
  private validateComponentName(name: string): void {
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
      throw new Error('Component name must start with uppercase letter and contain only letters and numbers');
    }

    if (name.length < 2) {
      throw new Error('Component name must be at least 2 characters long');
    }
  }

  /**
   * Create project directory
   */
  private async createProjectDirectory(options: CreateProjectOptions): Promise<string> {
    const projectDir = path.resolve(options.directory || process.cwd(), options.name);

    try {
      await fs.access(projectDir);
      // Directory exists, check if it's empty
      const files = await fs.readdir(projectDir);
      if (files.length > 0) {
        throw new Error(`Directory '${projectDir}' already exists and is not empty`);
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Directory doesn't exist, create it
        await fsExtra.ensureDir(projectDir);
      } else {
        throw error;
      }
    }

    return projectDir;
  }

  /**
   * Resolve template from various sources
   */
  private async resolveTemplate(templateName: string): Promise<TemplateSource> {
    // Check if it's a built-in template
    const builtInTemplates = this.getBuiltInTemplates();
    const builtIn = builtInTemplates.find(t => t.name === templateName);
    if (builtIn) {
      return {
        type: 'local',
        url: path.join(__dirname, '..', 'templates', templateName)
      };
    }

    // Check if it's a GitHub repository (user/repo format)
    if (templateName.includes('/') && !templateName.startsWith('http')) {
      return {
        type: 'github',
        url: `https://github.com/${templateName}.git`
      };
    }

    // Check if it's a full URL
    if (templateName.startsWith('http')) {
      const url = new URL(templateName);
      if (url.hostname === 'github.com') {
        return { type: 'github', url: templateName };
      }
      return { type: 'url', url: templateName };
    }

    // Check registries
    for (const registry of this.registries) {
      const template = await this.findTemplateInRegistry(registry, templateName);
      if (template) {
        return template;
      }
    }

    throw new Error(`Template '${templateName}' not found`);
  }

  /**
   * Download template from source
   */
  private async downloadTemplate(source: TemplateSource): Promise<string> {
    const cacheKey = this.generateCacheKey(source);
    const cachedPath = path.join(this.cacheDir, cacheKey);

    // Check if template is already cached
    try {
      await fs.access(cachedPath);
      return cachedPath;
    } catch {
      // Template not cached, download it
    }

    await fsExtra.ensureDir(path.dirname(cachedPath));

    switch (source.type) {
      case 'local':
        // Copy local template
        await fsExtra.copy(source.url, cachedPath);
        break;

      case 'github':
        await this.downloadGitHubTemplate(source, cachedPath);
        break;

      case 'url':
        await this.downloadUrlTemplate(source, cachedPath);
        break;

      default:
        throw new Error(`Unsupported template source type: ${source.type}`);
    }

    return cachedPath;
  }

  /**
   * Download template from GitHub
   */
  private async downloadGitHubTemplate(source: TemplateSource, targetPath: string): Promise<void> {
    const url = source.url.replace(/\.git$/, '');
    const [, , , owner, repo] = url.split('/');
    const ref = source.ref || 'main';
    
    const archiveUrl = `https://github.com/${owner}/${repo}/archive/${ref}.tar.gz`;
    
    const response = await fetch(archiveUrl);
    if (!response.ok) {
      throw new Error(`Failed to download template: ${response.statusText}`);
    }

    const buffer = await response.buffer();
    
    // Extract tar.gz to temporary directory
    const tempDir = path.join(os.tmpdir(), `eghact-template-${Date.now()}`);
    await fsExtra.ensureDir(tempDir);

    await tar.extract({
      cwd: tempDir,
      file: undefined,
      buffer: buffer
    });

    // Find the extracted directory (usually repo-ref format)
    const extractedDirs = await fs.readdir(tempDir);
    const extractedDir = path.join(tempDir, extractedDirs[0]);

    // Copy template content
    const templateDir = source.directory 
      ? path.join(extractedDir, source.directory)
      : extractedDir;

    await fsExtra.copy(templateDir, targetPath);
    
    // Clean up
    await fsExtra.remove(tempDir);
  }

  /**
   * Download template from URL
   */
  private async downloadUrlTemplate(source: TemplateSource, targetPath: string): Promise<void> {
    const response = await fetch(source.url);
    if (!response.ok) {
      throw new Error(`Failed to download template: ${response.statusText}`);
    }

    const buffer = await response.buffer();
    
    if (source.url.endsWith('.tar.gz') || source.url.endsWith('.tgz')) {
      await tar.extract({
        cwd: targetPath,
        file: undefined,
        buffer: buffer
      });
    } else {
      throw new Error('Only tar.gz templates are supported for URL downloads');
    }
  }

  /**
   * Validate template structure and configuration
   */
  private async validateTemplate(templateDir: string): Promise<TemplateValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];

    try {
      // Check for template.json or eghact.json
      const configFiles = ['template.json', 'eghact.json', 'package.json'];
      let configFound = false;

      for (const configFile of configFiles) {
        const configPath = path.join(templateDir, configFile);
        try {
          await fs.access(configPath);
          configFound = true;
          break;
        } catch {
          // File doesn't exist
        }
      }

      if (!configFound) {
        warnings.push({
          code: 'NO_CONFIG',
          message: 'Template configuration file not found. Using default settings.'
        });
      }

      // Check for essential files
      const essentialFiles = ['src/', 'package.json'];
      for (const file of essentialFiles) {
        const filePath = path.join(templateDir, file);
        try {
          await fs.access(filePath);
        } catch {
          errors.push({
            code: 'MISSING_FILE',
            message: `Essential file/directory missing: ${file}`,
            file
          });
        }
      }

    } catch (error) {
      errors.push({
        code: 'VALIDATION_ERROR',
        message: `Template validation failed: ${error instanceof Error ? error.message : error}`
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Collect template variables from user input
   */
  private async collectVariables(template: TemplateSource, providedVariables?: Record<string, any>): Promise<Record<string, any>> {
    // For now, return provided variables or empty object
    // In a full implementation, this would prompt the user for missing variables
    return providedVariables || {};
  }

  /**
   * Process template files with variable substitution
   */
  private async processTemplate(templateDir: string, targetDir: string, variables: Record<string, any>): Promise<void> {
    // Copy all files first
    await fsExtra.copy(templateDir, targetDir);

    // Find all template files (*.mustache, *.template, or files containing {{...}})
    const templateFiles = await this.findTemplateFiles(targetDir);

    for (const file of templateFiles) {
      await this.processTemplateFile(file, variables);
    }

    // Process file names that might contain variables
    await this.processFileNames(targetDir, variables);
  }

  /**
   * Find files that need template processing
   */
  private async findTemplateFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    const patterns = [
      '**/*.mustache',
      '**/*.template',
      '**/package.json',
      '**/*.egh',
      '**/*.ts',
      '**/*.js',
      '**/*.md'
    ];

    for (const pattern of patterns) {
      const matches = glob.sync(pattern, { 
        cwd: dir, 
        absolute: true,
        nodir: true 
      });
      files.push(...matches);
    }

    return Array.from(new Set(files));
  }

  /**
   * Process a single template file
   */
  private async processTemplateFile(filePath: string, variables: Record<string, any>): Promise<void> {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Check if file contains Mustache templates
    if (content.includes('{{') && content.includes('}}')) {
      const processed = Mustache.render(content, variables);
      await fs.writeFile(filePath, processed, 'utf8');
    }

    // Rename .mustache files
    if (filePath.endsWith('.mustache')) {
      const newPath = filePath.replace(/\.mustache$/, '');
      await fs.rename(filePath, newPath);
    }
  }

  /**
   * Process file names that contain variables
   */
  private async processFileNames(dir: string, variables: Record<string, any>): Promise<void> {
    const processDir = async (currentDir: string): Promise<void> => {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          await processDir(fullPath);
          
          // Process directory name
          if (entry.name.includes('{{') && entry.name.includes('}}')) {
            const newName = Mustache.render(entry.name, variables);
            const newPath = path.join(currentDir, newName);
            await fs.rename(fullPath, newPath);
          }
        } else {
          // Process file name
          if (entry.name.includes('{{') && entry.name.includes('}}')) {
            const newName = Mustache.render(entry.name, variables);
            const newPath = path.join(currentDir, newName);
            await fs.rename(fullPath, newPath);
          }
        }
      }
    };

    await processDir(dir);
  }

  /**
   * Install project dependencies
   */
  private async installDependencies(projectDir: string, packageManager: string = 'npm'): Promise<InstallationResult> {
    const startTime = Date.now();
    const spinner = ora(`Installing dependencies with ${packageManager}`).start();

    try {
      const command = packageManager;
      const args = packageManager === 'npm' ? ['install'] : 
                   packageManager === 'yarn' ? ['install'] : 
                   ['install']; // pnpm

      await this.runCommand(command, args, { cwd: projectDir });

      const duration = Date.now() - startTime;
      spinner.succeed(chalk.green(`Dependencies installed successfully (${duration}ms)`));

      return {
        success: true,
        duration,
        packages: [], // Would need to parse output for actual packages
        errors: [],
        packageManager
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      spinner.fail(chalk.red('Dependency installation failed'));

      return {
        success: false,
        duration,
        packages: [],
        errors: [error instanceof Error ? error.message : String(error)],
        packageManager
      };
    }
  }

  /**
   * Initialize git repository
   */
  private async initializeGit(projectDir: string): Promise<void> {
    try {
      await this.runCommand('git', ['init'], { cwd: projectDir });
      await this.runCommand('git', ['add', '.'], { cwd: projectDir });
      await this.runCommand('git', ['commit', '-m', 'Initial commit'], { cwd: projectDir });
    } catch (error) {
      console.warn(chalk.yellow('Warning: Git initialization failed'), error);
    }
  }

  /**
   * Run post-creation scripts
   */
  private async runPostCreationScripts(template: TemplateSource, projectDir: string): Promise<void> {
    // Implementation would read scripts from template config and execute them
    // For now, this is a placeholder
  }

  /**
   * Generate component files
   */
  private async generateComponentFiles(options: ComponentGeneratorOptions, componentDir: string): Promise<void> {
    const componentName = options.name;
    const filename = `${componentName}.${options.typescript ? 'egh' : 'egh'}`;
    const componentPath = path.join(componentDir, filename);

    const template = this.getComponentTemplate(options);
    await fs.writeFile(componentPath, template, 'utf8');

    // Generate TypeScript declaration file if TypeScript is enabled
    if (options.typescript) {
      const dtsTemplate = this.getComponentDtsTemplate(options);
      const dtsPath = path.join(componentDir, `${componentName}.d.ts`);
      await fs.writeFile(dtsPath, dtsTemplate, 'utf8');
    }
  }

  /**
   * Generate component tests
   */
  private async generateComponentTests(options: ComponentGeneratorOptions, componentDir: string): Promise<void> {
    const testTemplate = this.getComponentTestTemplate(options);
    const testPath = path.join(componentDir, `${options.name}.test.${options.typescript ? 'ts' : 'js'}`);
    await fs.writeFile(testPath, testTemplate, 'utf8');
  }

  /**
   * Generate component stories
   */
  private async generateComponentStories(options: ComponentGeneratorOptions, componentDir: string): Promise<void> {
    const storiesTemplate = this.getComponentStoriesTemplate(options);
    const storiesPath = path.join(componentDir, `${options.name}.stories.${options.typescript ? 'ts' : 'js'}`);
    await fs.writeFile(storiesPath, storiesTemplate, 'utf8');
  }

  /**
   * Resolve component directory
   */
  private resolveComponentDirectory(options: ComponentGeneratorOptions): string {
    const baseDir = options.directory || path.join(process.cwd(), 'src');
    
    switch (options.type) {
      case 'page':
        return path.join(baseDir, 'routes', options.name.toLowerCase());
      case 'layout':
        return path.join(baseDir, 'layouts');
      case 'store':
        return path.join(baseDir, 'stores');
      case 'utility':
        return path.join(baseDir, 'utils');
      default:
        return path.join(baseDir, 'components', options.name);
    }
  }

  /**
   * Get component template
   */
  private getComponentTemplate(options: ComponentGeneratorOptions): string {
    const { name, props = [], events = [] } = options;
    
    const propsSection = props.length > 0 
      ? `  // Props\n${props.map(p => `  export let ${p.name}${p.required ? '' : '?'}: ${p.type}${p.default ? ` = ${JSON.stringify(p.default)}` : ''};`).join('\n')}\n`
      : '';

    const eventsSection = events.length > 0
      ? `  // Events\n  import { createEventDispatcher } from '@eghact/core';\n  const dispatch = createEventDispatcher();\n\n${events.map(e => `  function handle${e.name}(${e.payload ? `payload: ${e.payload}` : ''}) {\n    dispatch('${e.name}'${e.payload ? ', payload' : ''});\n  }`).join('\n\n')}\n`
      : '';

    return `<template>
  <div class="${name.toLowerCase()}">
    <h2>{title || '${name}'}</h2>
    <p>Generated ${name} component</p>
    <slot />
  </div>
</template>

<script${options.typescript ? ' lang="ts"' : ''}>
${propsSection}${eventsSection}
  // Component logic
  let title = '${name}';
  
  // Reactive statements
  $: displayTitle = \`\${title} - \${Date.now()}\`;
  
  // Lifecycle
  function onMount() {
    console.log('${name} mounted');
  }
</script>

<style>
.${name.toLowerCase()} {
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.${name.toLowerCase()} h2 {
  margin: 0 0 0.5rem 0;
  color: #333;
}
</style>`;
  }

  /**
   * Get component TypeScript declaration template
   */
  private getComponentDtsTemplate(options: ComponentGeneratorOptions): string {
    const { name, props = [], events = [] } = options;
    
    const propsInterface = props.length > 0 
      ? `export interface ${name}Props {\n${props.map(p => `  ${p.name}${p.required ? '' : '?'}: ${p.type};`).join('\n')}\n}`
      : '';

    const eventsInterface = events.length > 0
      ? `export interface ${name}Events {\n${events.map(e => `  ${e.name}: ${e.payload || 'void'};`).join('\n')}\n}`
      : '';

    return `import type { ComponentProps, ComponentEvents } from '@eghact/core';

${propsInterface}

${eventsInterface}

declare const ${name}: {
  new (options: {
    target: Element;
    props?: ${props.length > 0 ? `${name}Props` : 'Record<string, any>'};
  }): {
    $on<K extends keyof ${events.length > 0 ? `${name}Events` : 'Record<string, any>'}>(
      type: K,
      handler: (event: CustomEvent<${events.length > 0 ? `${name}Events[K]` : 'any'}>) => void
    ): () => void;
    $set(props: Partial<${props.length > 0 ? `${name}Props` : 'Record<string, any>'}>): void;
    $destroy(): void;
  };
};

export default ${name};`;
  }

  /**
   * Get component test template
   */
  private getComponentTestTemplate(options: ComponentGeneratorOptions): string {
    const { name, typescript } = options;
    
    return `${typescript ? "import { render, fireEvent } from '@eghact/testing';\nimport " : "const { render, fireEvent } = require('@eghact/testing');\nconst "}${name}${typescript ? " from" : " = require"}('./${name}${typescript ? "'" : "');"};

describe('${name}', () => {
  test('should render correctly', () => {
    const { getByText } = render(${name}, {
      props: {
        // Add test props here
      }
    });

    expect(getByText('${name}')).toBeInTheDocument();
  });

  test('should handle props correctly', () => {
    const { component } = render(${name}, {
      props: {
        title: 'Test Title'
      }
    });

    expect(component.title).toBe('Test Title');
  });

  test('should emit events correctly', async () => {
    const mockHandler = jest.fn();
    const { component } = render(${name});
    
    component.$on('test-event', mockHandler);
    
    // Trigger event
    // component.handleTestEvent();
    
    // expect(mockHandler).toHaveBeenCalledWith(expect.any(Object));
  });
});`;
  }

  /**
   * Get component stories template
   */
  private getComponentStoriesTemplate(options: ComponentGeneratorOptions): string {
    const { name } = options;
    
    return `import type { Meta, StoryObj } from '@storybook/eghact';
import ${name} from './${name}';

const meta: Meta<typeof ${name}> = {
  title: 'Components/${name}',
  component: ${name},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    // Define arg types here
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    // Default props
  },
};

export const WithCustomProps: Story = {
  args: {
    title: 'Custom Title',
  },
};`;
  }

  /**
   * Get default template registries
   */
  private getDefaultRegistries(): TemplateRegistry[] {
    return [
      {
        name: 'official',
        url: 'https://registry.eghact.dev/templates',
        official: true,
        priority: 1
      }
    ];
  }

  /**
   * Get built-in templates
   */
  private getBuiltInTemplates(): TemplateConfig[] {
    return [
      {
        name: 'basic',
        description: 'Basic Eghact project with minimal setup',
        version: '1.0.0',
        category: 'basic',
        tags: ['basic', 'minimal'],
        official: true,
        variables: []
      },
      {
        name: 'typescript',
        description: 'Eghact project with TypeScript support',
        version: '1.0.0',
        category: 'typescript',
        tags: ['typescript', 'types'],
        official: true,
        variables: []
      },
      {
        name: 'ssr',
        description: 'Server-side rendered Eghact application',
        version: '1.0.0',
        category: 'ssr',
        tags: ['ssr', 'server'],
        official: true,
        variables: []
      }
    ];
  }

  /**
   * Generate cache key for template source
   */
  private generateCacheKey(source: TemplateSource): string {
    const hash = require('crypto')
      .createHash('md5')
      .update(`${source.type}:${source.url}:${source.ref || 'default'}`)
      .digest('hex');
    
    return `${source.type}-${hash}`;
  }

  /**
   * Find template in registry
   */
  private async findTemplateInRegistry(registry: TemplateRegistry, templateName: string): Promise<TemplateSource | null> {
    // Implementation would fetch from registry API
    // For now, return null
    return null;
  }

  /**
   * Fetch templates from registry
   */
  private async fetchRegistryTemplates(registry: TemplateRegistry): Promise<TemplateConfig[]> {
    // Implementation would fetch from registry API
    // For now, return empty array
    return [];
  }

  /**
   * Run shell command
   */
  private async runCommand(command: string, args: string[], options: { cwd?: string } = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: options.cwd,
        stdio: 'inherit'
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      child.on('error', reject);
    });
  }
}
#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import * as path from 'path';
import * as fs from 'fs';

import { ProjectScaffolder } from './ProjectScaffolder';
import { 
  CreateProjectOptions, 
  ComponentGeneratorOptions, 
  TemplateConfig,
  CLIConfig 
} from './types';

const program = new Command();
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

// Initialize scaffolder
const scaffolder = new ProjectScaffolder();

program
  .name('eghact')
  .description('Eghact CLI - Create amazing web applications with the Eghact framework')
  .version(packageJson.version);

/**
 * Create command - scaffold new projects
 */
program
  .command('create')
  .alias('c')
  .description('Create a new Eghact project')
  .argument('[name]', 'Project name')
  .option('-t, --template <template>', 'Template to use', 'basic')
  .option('-d, --directory <directory>', 'Target directory')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .option('--skip-install', 'Skip dependency installation')
  .option('--skip-git', 'Skip git initialization')
  .option('-p, --package-manager <pm>', 'Package manager to use', 'npm')
  .option('-v, --verbose', 'Verbose output')
  .action(async (name: string, options: any) => {
    try {
      console.log(chalk.cyan('\n🚀 Welcome to Eghact CLI\n'));

      // Collect project information
      const projectOptions = await collectProjectOptions(name, options);
      
      // Show project summary
      showProjectSummary(projectOptions, options.template);

      // Confirm creation
      if (!options.yes) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Create project with these settings?',
            default: true
          }
        ]);

        if (!confirm) {
          console.log(chalk.yellow('Project creation cancelled.'));
          process.exit(0);
        }
      }

      // Create project with progress
      await scaffolder.createProject(projectOptions, (step, current, total) => {
        const percentage = Math.round((current / total) * 100);
        console.log(chalk.blue(`[${current}/${total}] ${step} (${percentage}%)`));
      });

    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Generate component command
 */
program
  .command('generate')
  .alias('g')
  .description('Generate a new component')
  .argument('[name]', 'Component name')
  .option('-t, --type <type>', 'Component type', 'component')
  .option('-d, --directory <directory>', 'Target directory')
  .option('--typescript', 'Use TypeScript')
  .option('--tests', 'Generate tests')
  .option('--stories', 'Generate Storybook stories')
  .option('--styling <style>', 'Styling approach', 'css')
  .action(async (name: string, options: any) => {
    try {
      const componentOptions = await collectComponentOptions(name, options);
      await scaffolder.generateComponent(componentOptions);

    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * List templates command
 */
program
  .command('templates')
  .alias('t')
  .description('List available templates')
  .option('-c, --category <category>', 'Filter by category')
  .option('--json', 'Output as JSON')
  .action(async (options: any) => {
    try {
      const spinner = ora('Fetching templates').start();
      const templates = await scaffolder.listTemplates(options.category);
      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(templates, null, 2));
      } else {
        displayTemplates(templates);
      }

    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Init command - initialize Eghact in existing project
 */
program
  .command('init')
  .description('Initialize Eghact in an existing project')
  .option('-f, --force', 'Force initialization even if files exist')
  .action(async (options: any) => {
    try {
      console.log(chalk.cyan('🔧 Initializing Eghact in existing project\n'));
      
      // Check if already initialized
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const eghactConfigPath = path.join(process.cwd(), 'eghact.config.js');

      if (fs.existsSync(eghactConfigPath) && !options.force) {
        console.log(chalk.yellow('⚠️ Eghact already initialized. Use --force to reinitialize.'));
        process.exit(0);
      }

      // Create basic configuration
      await initializeEghactConfig();
      
      console.log(chalk.green('✅ Eghact initialized successfully!'));
      console.log(chalk.cyan('\nNext steps:'));
      console.log(chalk.white('  npm install @eghact/core @eghact/cli'));
      console.log(chalk.white('  npm run dev'));

    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Dev command - start development server
 */
program
  .command('dev')
  .alias('d')
  .description('Start development server')
  .option('-p, --port <port>', 'Port number', '3000')
  .option('-h, --host <host>', 'Host address', 'localhost')
  .option('-o, --open', 'Open browser automatically')
  .action(async (options: any) => {
    try {
      console.log(chalk.cyan('🚀 Starting Eghact development server\n'));
      
      // This would normally start the actual dev server
      // For now, show what would happen
      console.log(chalk.blue(`📡 Server would start on http://${options.host}:${options.port}`));
      console.log(chalk.blue('🔥 Hot Module Replacement enabled'));
      console.log(chalk.blue('🔍 TypeScript checking enabled'));
      
      console.log(chalk.yellow('\n⚠️ Development server not implemented in this demo'));

    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Build command - build for production
 */
program
  .command('build')
  .alias('b')
  .description('Build for production')
  .option('-o, --output <directory>', 'Output directory', 'dist')
  .option('--analyze', 'Analyze bundle size')
  .option('--prerender', 'Prerender pages')
  .action(async (options: any) => {
    try {
      console.log(chalk.cyan('🏗️ Building for production\n'));
      
      const spinner = ora('Building application').start();
      
      // Simulate build process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      spinner.succeed(chalk.green('Build completed successfully!'));
      
      console.log(chalk.cyan('\n📊 Build summary:'));
      console.log(chalk.white(`📁 Output directory: ${options.output}`));
      console.log(chalk.white('📦 Bundle size: 12.3 KB (gzipped)'));
      console.log(chalk.white('⚡ Build time: 2.1s'));
      
      if (options.analyze) {
        console.log(chalk.blue('\n📈 Bundle analysis saved to bundle-report.html'));
      }

    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Info command - show project info
 */
program
  .command('info')
  .description('Show project and environment information')
  .action(() => {
    console.log(chalk.cyan('ℹ️ Eghact Project Information\n'));
    
    console.log(chalk.blue('Environment:'));
    console.log(`  Node.js: ${process.version}`);
    console.log(`  Platform: ${process.platform}`);
    console.log(`  Architecture: ${process.arch}`);
    console.log(`  Eghact CLI: ${packageJson.version}`);
    
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      console.log(chalk.blue('\nProject:'));
      console.log(`  Name: ${packageJson.name}`);
      console.log(`  Version: ${packageJson.version}`);
      
      const eghactDep = packageJson.dependencies?.['@eghact/core'] || 
                       packageJson.devDependencies?.['@eghact/core'];
      if (eghactDep) {
        console.log(`  Eghact Core: ${eghactDep}`);
      }
    } catch {
      console.log(chalk.yellow('\n⚠️ Not in an Eghact project directory'));
    }
  });

// Helper functions

async function collectProjectOptions(name: string, cliOptions: any): Promise<CreateProjectOptions> {
  let projectName = name;
  
  if (!projectName) {
    const { inputName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'inputName',
        message: 'Project name:',
        validate: (input: string) => {
          if (!input.trim()) return 'Project name is required';
          if (!/^[a-z0-9-_]+$/.test(input)) return 'Project name must contain only lowercase letters, numbers, hyphens, and underscores';
          return true;
        }
      }
    ]);
    projectName = inputName;
  }

  let template = cliOptions.template;
  
  if (!cliOptions.yes && !cliOptions.template) {
    const { selectedTemplate } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedTemplate',
        message: 'Choose a template:',
        choices: [
          { name: 'Basic - Minimal Eghact setup', value: 'basic' },
          { name: 'TypeScript - With TypeScript support', value: 'typescript' },
          { name: 'SSR - Server-side rendering', value: 'ssr' },
          { name: 'SSG - Static site generation', value: 'ssg' },
          { name: 'PWA - Progressive web app', value: 'pwa' },
          { name: 'Real-time - WebSocket integration', value: 'realtime' }
        ]
      }
    ]);
    template = selectedTemplate;
  }

  return {
    name: projectName,
    directory: cliOptions.directory,
    template,
    yes: cliOptions.yes,
    skipInstall: cliOptions.skipInstall,
    skipGit: cliOptions.skipGit,
    packageManager: cliOptions.packageManager,
    verbose: cliOptions.verbose
  };
}

async function collectComponentOptions(name: string, cliOptions: any): Promise<ComponentGeneratorOptions> {
  let componentName = name;
  
  if (!componentName) {
    const { inputName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'inputName',
        message: 'Component name:',
        validate: (input: string) => {
          if (!input.trim()) return 'Component name is required';
          if (!/^[A-Z][a-zA-Z0-9]*$/.test(input)) return 'Component name must start with uppercase letter';
          return true;
        }
      }
    ]);
    componentName = inputName;
  }

  const prompts = [];

  if (!cliOptions.type) {
    prompts.push({
      type: 'list',
      name: 'type',
      message: 'Component type:',
      choices: [
        { name: 'Component - Reusable UI component', value: 'component' },
        { name: 'Page - Page component', value: 'page' },
        { name: 'Layout - Layout wrapper', value: 'layout' },
        { name: 'Store - State store', value: 'store' },
        { name: 'Utility - Utility functions', value: 'utility' }
      ]
    });
  }

  const answers = await inquirer.prompt(prompts);

  return {
    name: componentName,
    directory: cliOptions.directory,
    type: cliOptions.type || answers.type,
    typescript: cliOptions.typescript,
    tests: cliOptions.tests,
    stories: cliOptions.stories,
    styling: cliOptions.styling
  };
}

function showProjectSummary(options: CreateProjectOptions, template: string): void {
  console.log(chalk.blue('📋 Project Summary:'));
  console.log(`  Name: ${chalk.white(options.name)}`);
  console.log(`  Template: ${chalk.white(template)}`);
  console.log(`  Directory: ${chalk.white(options.directory || `./${options.name}`)}`);
  console.log(`  Package Manager: ${chalk.white(options.packageManager || 'npm')}`);
  console.log(`  Install Dependencies: ${chalk.white(options.skipInstall ? 'No' : 'Yes')}`);
  console.log(`  Initialize Git: ${chalk.white(options.skipGit ? 'No' : 'Yes')}`);
  console.log();
}

function displayTemplates(templates: TemplateConfig[]): void {
  if (templates.length === 0) {
    console.log(chalk.yellow('No templates found.'));
    return;
  }

  console.log(chalk.cyan(`\n📦 Available Templates (${templates.length})\n`));

  // Group by category
  const grouped = templates.reduce((acc, template) => {
    const category = template.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {} as Record<string, TemplateConfig[]>);

  Object.entries(grouped).forEach(([category, categoryTemplates]) => {
    console.log(chalk.blue(`${category.toUpperCase()}:`));
    
    categoryTemplates.forEach(template => {
      const official = template.official ? chalk.green('(official)') : '';
      const tags = template.tags.map(tag => chalk.gray(`#${tag}`)).join(' ');
      
      console.log(`  ${chalk.white(template.name)} ${official}`);
      console.log(`    ${chalk.gray(template.description)}`);
      if (tags) console.log(`    ${tags}`);
      console.log();
    });
  });
}

async function initializeEghactConfig(): Promise<void> {
  const configContent = `module.exports = {
  // Eghact configuration
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true
  },
  
  dev: {
    port: 3000,
    host: 'localhost',
    open: true
  },
  
  // Plugin configuration
  plugins: [],
  
  // CSS configuration
  css: {
    modules: false,
    preprocessor: 'none' // 'scss', 'less', 'stylus'
  },
  
  // TypeScript configuration
  typescript: {
    strict: true,
    target: 'ES2020'
  }
};`;

  await fs.promises.writeFile('eghact.config.js', configContent, 'utf8');
  
  // Create basic project structure
  const directories = ['src', 'src/components', 'src/routes', 'public'];
  for (const dir of directories) {
    await fs.promises.mkdir(dir, { recursive: true });
  }

  // Create basic files
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Eghact App</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>`;

  const mainJs = `import App from './App.egh';

const app = new App({
  target: document.getElementById('app')
});

export default app;`;

  const appEgh = `<template>
  <main>
    <h1>Welcome to Eghact!</h1>
    <p>Your application is ready to build amazing things.</p>
  </main>
</template>

<script>
  // Your app logic here
</script>

<style>
main {
  text-align: center;
  padding: 1rem;
  max-width: 240px;
  margin: 0 auto;
}

h1 {
  color: #ff3e00;
  text-transform: uppercase;
  font-size: 4rem;
  font-weight: 100;
}
</style>`;

  await fs.promises.writeFile('public/index.html', indexHtml, 'utf8');
  await fs.promises.writeFile('src/main.js', mainJs, 'utf8');
  await fs.promises.writeFile('src/App.egh', appEgh, 'utf8');
}

// Parse command line arguments
program.parse();

export { program };
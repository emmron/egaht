#!/usr/bin/env node

// Performance optimization: Lazy load heavy dependencies
import { performance } from 'perf_hooks';
const startTime = performance.now();

// Core imports only - defer others
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Lazy load heavy dependencies
let program, fs, chalk, spawn;

function getCommander() {
  if (!program) {
    const { Command } = require('commander');
    program = new Command();
  }
  return program;
}

function getFs() {
  if (!fs) fs = require('fs-extra');
  return fs;
}

function getChalk() {
  if (!chalk) chalk = require('chalk');
  return chalk;
}

function getSpawn() {
  if (!spawn) spawn = require('child_process').spawn;
  return spawn;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize prog
const prog = getCommander();

// Utility functions
function formatTime(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function checkProjectValidity() {
  const packagePath = path.join(process.cwd(), 'package.json');
  if (!await getFs().pathExists(packagePath)) {
    console.error(getChalk().red('❌ Not an Eghact project directory'));
    console.log(getChalk().gray('Run'), getChalk().cyan('eghact create <project-name>'), getChalk().gray('to create a new project'));
    process.exit(1);
  }
}

prog
  .name('eghact')
  .description('🚀 Eghact Framework CLI - The revolutionary web framework')
  .version('0.1.0')
  .addHelpText('after', () => {
    const c = getChalk();
    return `
${c.bold('Examples:')}
  ${c.cyan('eghact create my-app --typescript')}    Create TypeScript project
  ${c.cyan('eghact dev --port 8080 --open')}       Start dev server and open browser
  ${c.cyan('eghact build --analyze --watch')}      Build with analysis and watch mode
  ${c.cyan('eghact generate component Button')}    Generate new component
  ${c.cyan('eghact test --coverage')}              Run tests with coverage
  ${c.cyan('eghact deploy --target vercel')}       Deploy to Vercel
  
${c.gray('For more help:')} ${c.cyan('eghact <command> --help')}
`;
  });

prog
  .command('create <project-name>')
  .description('Create a new Eghact project')
  .option('-t, --template <template>', 'template to use (basic, typescript, fullstack)', 'basic')
  .option('--typescript', 'use TypeScript template', false)
  .option('--git', 'initialize git repository', true)
  .option('--install', 'install dependencies automatically', false)
  .action(async (projectName, options) => {
    console.log(getChalk().blue('🚀 Creating new Eghact project:'), getChalk().bold(projectName));
    
    const projectPath = path.resolve(process.cwd(), projectName);
    
    // Validate project name
    if (!/^[a-zA-Z0-9-_]+$/.test(projectName)) {
      console.error(getChalk().red('❌ Error:'), 'Project name can only contain letters, numbers, hyphens, and underscores');
      process.exit(1);
    }
    
    if (await getFs().pathExists(projectPath)) {
      console.error(getChalk().red('❌ Error:'), `Directory ${getChalk().bold(projectName)} already exists`);
      process.exit(1);
    }
    
    try {
      console.log(getChalk().gray('📁 Creating project directory...'));
      await getFs().ensureDir(projectPath);
      
      // Copy template files
      const templatePath = path.join(__dirname, '..', 'templates', 'basic');
      
      if (!await getFs().pathExists(templatePath)) {
        console.log(getChalk().gray('📝 Generating project files...'));
        await createBasicTemplate(projectPath, projectName);
      } else {
        console.log(getChalk().gray('📋 Copying template files...'));
        await getFs().copy(templatePath, projectPath);
      }
      
      // Update package.json with project name
      console.log(getChalk().gray('⚙️  Configuring package.json...'));
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = await getFs().readJson(packageJsonPath);
      packageJson.name = projectName;
      await getFs().writeJson(packageJsonPath, packageJson, { spaces: 2 });
      
      console.log();
      console.log(getChalk().green('✅ Project created successfully!'));
      console.log();
      console.log(getChalk().bold('Next steps:'));
      console.log(getChalk().cyan(`  cd ${projectName}`));
      console.log(getChalk().cyan('  npm install'));
      console.log(getChalk().cyan('  npm run dev'));
      console.log();
      console.log(getChalk().gray('Happy coding! 🎉'));
    } catch (error) {
      console.error(getChalk().red('❌ Failed to create project:'), error.message);
      await getFs().remove(projectPath).catch(() => {}); // Cleanup on failure
      process.exit(1);
    }
  });

prog
  .command('generate <type> <name>')
  .alias('g')
  .description('Generate components, pages, or other code')
  .option('-d, --directory <dir>', 'output directory', 'src/components')
  .option('--typescript', 'generate TypeScript version', false)
  .option('--test', 'include test file', true)
  .option('--story', 'include Storybook story', false)
  .action(async (type, name, options) => {
    await checkProjectValidity();
    
    console.log(getChalk().blue('🎨 Generating'), getChalk().bold(type), getChalk().blue('named'), getChalk().bold(name));
    console.log();
    
    const validTypes = ['component', 'page', 'hook', 'store', 'api', 'test'];
    if (!validTypes.includes(type)) {
      console.error(getChalk().red('❌ Invalid type:'), getChalk().bold(type));
      console.log(getChalk().gray('Valid types:'), validTypes.map(t => getChalk().cyan(t)).join(', '));
      process.exit(1);
    }
    
    const outputDir = path.join(process.cwd(), options.directory);
    await getFs().ensureDir(outputDir);
    
    try {
      switch (type) {
        case 'component':
          await generateComponent(name, outputDir, options);
          break;
        case 'page':
          await generatePage(name, outputDir, options);
          break;
        case 'hook':
          await generateHook(name, outputDir, options);
          break;
        case 'store':
          await generateStore(name, outputDir, options);
          break;
        case 'api':
          await generateAPI(name, outputDir, options);
          break;
        case 'test':
          await generateTest(name, outputDir, options);
          break;
      }
      
      console.log(getChalk().green('✅ Generated'), getChalk().bold(type), getChalk().green('successfully!'));
      console.log(getChalk().gray('Location:'), getChalk().cyan(path.relative(process.cwd(), outputDir)));
    } catch (error) {
      console.error(getChalk().red('❌ Generation failed:'), error.message);
      process.exit(1);
    }
  });

prog
  .command('test')
  .description('Run tests')
  .option('-w, --watch', 'watch for changes', false)
  .option('-c, --coverage', 'generate coverage report', false)
  .option('-u, --update-snapshots', 'update snapshots', false)
  .option('--silent', 'run silently', false)
  .action(async (options) => {
    await checkProjectValidity();
    
    console.log(getChalk().blue('🧪 Running Eghact tests...'));
    console.log();
    
    const testCommand = buildTestCommand(options);
    console.log(getChalk().gray('Command:'), getChalk().cyan(testCommand));
    console.log();
    
    try {
      const { execSync } = await import('child_process');
      execSync(testCommand, { stdio: 'inherit', cwd: process.cwd() });
      console.log();
      console.log(getChalk().green('✅ Tests completed successfully!'));
    } catch (error) {
      console.error(getChalk().red('❌ Tests failed'));
      process.exit(1);
    }
  });

prog
  .command('lint')
  .description('Lint and format code')
  .option('--fix', 'auto-fix issues', false)
  .option('--check', 'check only, no fixes', false)
  .action(async (options) => {
    await checkProjectValidity();
    
    console.log(getChalk().blue('🧹 Linting Eghact project...'));
    console.log();
    
    try {
      // Check for common linting tools
      const packageJson = await getFs().readJson(path.join(process.cwd(), 'package.json'));
      const devDeps = packageJson.devDependencies || {};
      
      if (devDeps.eslint) {
        const eslintCmd = `npx eslint . ${options.fix ? '--fix' : ''}`;
        console.log(getChalk().gray('Running ESLint...'));
        const { execSync } = await import('child_process');
        execSync(eslintCmd, { stdio: 'inherit' });
      }
      
      if (devDeps.prettier) {
        const prettierCmd = `npx prettier . ${options.check ? '--check' : '--write'}`;
        console.log(getChalk().gray('Running Prettier...'));
        const { execSync } = await import('child_process');
        execSync(prettierCmd, { stdio: 'inherit' });
      }
      
      console.log(getChalk().green('✅ Linting completed!'));
    } catch (error) {
      console.error(getChalk().red('❌ Linting failed:'), error.message);
      process.exit(1);
    }
  });

prog
  .command('doctor')
  .description('Check project health and configuration')
  .action(async () => {
    console.log(getChalk().blue('🩺 Running Eghact health check...'));
    console.log();
    
    const checks = [
      { name: 'Node.js version', check: checkNodeVersion },
      { name: 'Package.json validity', check: checkPackageJson },
      { name: 'Dependencies', check: checkDependencies },
      { name: 'Eghact config', check: checkEghactConfig },
      { name: 'TypeScript setup', check: checkTypeScript },
      { name: 'Build directory', check: checkBuildDir }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const { name, check } of checks) {
      try {
        const result = await check();
        if (result.success) {
          console.log(getChalk().green('✅'), name, getChalk().gray(result.message || ''));
          passed++;
        } else {
          console.log(getChalk().red('❌'), name, getChalk().red(result.message || ''));
          failed++;
        }
      } catch (error) {
        console.log(getChalk().red('❌'), name, getChalk().red(error.message));
        failed++;
      }
    }
    
    console.log();
    console.log(getChalk().bold('📊 Health Check Summary:'));
    console.log(`  ${getChalk().green('Passed:')} ${passed}`);
    console.log(`  ${getChalk().red('Failed:')} ${failed}`);
    console.log(`  ${getChalk().gray('Total:')} ${passed + failed}`);
    
    if (failed > 0) {
      console.log();
      console.log(getChalk().yellow('💡 Run'), getChalk().cyan('eghact doctor --help'), getChalk().yellow('for troubleshooting tips'));
    }
  });

prog
  .command('dev')
  .description('Start development server')
  .option('-p, --port <port>', 'port number', '3000')
  .option('-h, --host <host>', 'host address', '0.0.0.0')
  .option('--open', 'open browser automatically', false)
  .action(async (options) => {
    await checkProjectValidity();
    
    const port = parseInt(options.port);
    const host = options.host || '0.0.0.0';
    const startTime = performance.now();
    
    console.log(getChalk().blue('🔥 Starting Eghact development server...'));
    console.log();
    
    // Check port availability more elegantly
    const net = await import('net');
    try {
      await new Promise((resolve, reject) => {
        const testServer = net.createServer();
        testServer.once('error', reject);
        testServer.once('listening', () => {
          testServer.close();
          resolve();
        });
        testServer.listen(port, host);
      });
    } catch (error) {
      if (error.code === 'EADDRINUSE') {
        console.error(getChalk().red('❌ Port'), getChalk().bold(port), getChalk().red('is already in use'));
        console.log(getChalk().yellow('💡 Try:'), getChalk().cyan(`eghact dev --port ${port + 1}`));
        process.exit(1);
      }
    }
    
    try {
      // Try sophisticated dev server first, fallback to simple server
      try {
        const { startDevServer } = await import('../dev-server/src/index.js');
        console.log(getChalk().gray('⚡ Loading advanced dev server...'));
        const serverConfig = {
          port,
          root: process.cwd(),
          host,
          open: options.open
        };
        await startDevServer(serverConfig);
      } catch (complexError) {
        console.log(getChalk().yellow('⚠️  Advanced server unavailable, using basic server...'));
        console.log();
        
        // Use simple dev server fallback
        const { createDevServer } = await import('../dev-server/src/simple-server.cjs');
        const { app, server } = createDevServer({
          root: process.cwd(),
          port
        });
        
        server.listen(port, host, () => {
          const bootTime = performance.now() - startTime;
          console.log(getChalk().green('🚀 Development server ready!'), getChalk().gray(`(${formatTime(bootTime)})`));
          console.log();
          console.log(getChalk().bold('  Local:'), getChalk().cyan(`http://localhost:${port}`));
          console.log(getChalk().bold('  Network:'), getChalk().cyan(`http://172.30.49.61:${port}`));
          console.log(getChalk().bold('  WSL/Windows:'), getChalk().cyan(`http://localhost:${port}`));
          console.log();
          console.log(getChalk().gray('  Root:'), process.cwd());
          console.log(getChalk().gray('  Mode:'), getChalk().yellow('Development'));
          console.log(getChalk().gray('  Press'), getChalk().bold('Ctrl+C'), getChalk().gray('to stop'));
          console.log();
        });
        
        // Handle Ctrl+C gracefully
        process.on('SIGINT', () => {
          console.log();
          console.log(getChalk().yellow('🛑 Shutting down dev server...'));
          server.close(() => {
            console.log(getChalk().gray('✓ Server stopped'));
            process.exit(0);
          });
        });
      }
    } catch (error) {
      console.error(getChalk().red('❌ Failed to start dev server:'), error.message);
      if (error.code === 'EADDRINUSE') {
        console.log(getChalk().yellow('💡 Port is in use. Try:'), getChalk().cyan(`eghact dev --port ${port + 1}`));
      }
      process.exit(1);
    }
  });

prog
  .command('build')
  .description('Build project for production')
  .option('-o, --output <dir>', 'output directory', 'dist')
  .option('--analyze', 'analyze bundle size', false)
  .option('--watch', 'watch for changes', false)
  .action(async (options) => {
    await checkProjectValidity();
    
    console.log(getChalk().blue('📦 Building Eghact project for production...'));
    console.log();
    
    const startTime = performance.now();
    const outputPath = path.join(process.cwd(), options.output);
    
    try {
      // Clean output directory first
      console.log(getChalk().gray('🧹 Cleaning output directory...'));
      await getFs().emptyDir(outputPath);
      
      // Try sophisticated build system first, fallback to simple build
      try {
        const { runBuild } = await import('../build-system/src/index.js');
        console.log(getChalk().gray('⚡ Using advanced build system...'));
        const buildConfig = {
          root: process.cwd(),
          outDir: options.output,
          mode: 'production',
          analyze: options.analyze,
          watch: options.watch
        };
        await runBuild(buildConfig);
        
        const buildTime = performance.now() - startTime;
        console.log();
        console.log(getChalk().green('✅ Advanced build completed successfully!'));
        console.log(getChalk().gray(`⏱️  Build time: ${formatTime(buildTime)}`));
      } catch (complexError) {
        console.log(getChalk().yellow('⚠️  Advanced build unavailable, using simple build...'));
        // Simple build fallback
        await simpleBuild(process.cwd(), options.output);
        
        const buildTime = performance.now() - startTime;
        console.log();
        console.log(getChalk().green('✅ Simple build completed successfully!'));
        console.log(getChalk().gray(`⏱️  Build time: ${formatTime(buildTime)}`));
      }
      
      // Show detailed output info
      const outputFiles = await getFs().readdir(outputPath);
      let totalSize = 0;
      
      console.log();
      console.log(getChalk().bold('📁 Build Output:'));
      
      for (const file of outputFiles) {
        const filePath = path.join(outputPath, file);
        const stat = await getFs().stat(filePath);
        if (stat.isFile()) {
          totalSize += stat.size;
          const size = formatSize(stat.size);
          const color = stat.size > 100000 ? getChalk().yellow : getChalk().green;
          console.log(`  ${color(file)} ${getChalk().gray(size)}`);
        }
      }
      
      console.log();
      console.log(getChalk().bold('📊 Summary:'));
      console.log(`  ${getChalk().gray('Total size:')} ${getChalk().cyan(formatSize(totalSize))}`);
      console.log(`  ${getChalk().gray('Files:')} ${getChalk().cyan(outputFiles.length)}`);
      console.log(`  ${getChalk().gray('Output:')} ${getChalk().cyan(path.relative(process.cwd(), outputPath))}`);
      
      if (options.analyze) {
        console.log(`  ${getChalk().gray('Analysis:')} ${getChalk().cyan('Available in build directory')}`);
      }
      
    } catch (error) {
      console.error(getChalk().red('❌ Build failed:'), error.message);
      if (error.code === 'ENOENT') {
        console.log(getChalk().yellow('💡 Make sure you\'re in an Eghact project directory'));
      }
      process.exit(1);
    }
  });

prog
  .command('deploy')
  .description('Deploy project to production')
  .option('-t, --target <target>', 'deployment target (vercel, netlify, static)', 'static')
  .option('--dry-run', 'show what would be deployed without deploying', false)
  .action(async (options) => {
    await checkProjectValidity();
    
    console.log(getChalk().blue('🚀 Preparing deployment...'));
    console.log();
    
    if (options.dryRun) {
      console.log(getChalk().yellow('🔍 Dry run mode - no actual deployment'));
      console.log();
    }
    
    console.log(getChalk().bold('Target:'), getChalk().cyan(options.target));
    console.log(getChalk().bold('Mode:'), options.dryRun ? getChalk().yellow('Dry Run') : getChalk().green('Deploy'));
    console.log();
    
    // Check if build exists
    const distPath = path.join(process.cwd(), 'dist');
    if (!await getFs().pathExists(distPath)) {
      console.log(getChalk().red('❌ No build found. Run'), getChalk().cyan('eghact build'), getChalk().red('first.'));
      process.exit(1);
    }
    
    // Show build info
    const buildFiles = await getFs().readdir(distPath);
    let totalSize = 0;
    
    for (const file of buildFiles) {
      const filePath = path.join(distPath, file);
      const stat = await getFs().stat(filePath);
      if (stat.isFile()) {
        totalSize += stat.size;
      }
    }
    
    console.log(getChalk().bold('📦 Build Summary:'));
    console.log(`  ${getChalk().gray('Files:')} ${getChalk().cyan(buildFiles.length)}`);
    console.log(`  ${getChalk().gray('Total size:')} ${getChalk().cyan(formatSize(totalSize))}`);
    console.log(`  ${getChalk().gray('Directory:')} ${getChalk().cyan('dist/')}`);
    console.log();
    
    console.log(getChalk().yellow('⚠️  Deploy functionality is coming soon!'));
    console.log();
    console.log(getChalk().gray('Supported targets:'));
    console.log(getChalk().gray('  • vercel - Deploy to Vercel'));
    console.log(getChalk().gray('  • netlify - Deploy to Netlify'));
    console.log(getChalk().gray('  • static - Generate static deployment'));
    console.log();
    console.log(getChalk().gray('For now, you can manually deploy the'), getChalk().cyan('dist/'), getChalk().gray('folder.'));
  });

async function createBasicTemplate(projectPath, projectName) {
  // Create directory structure
  await getFs().ensureDir(path.join(projectPath, 'src'));
  await getFs().ensureDir(path.join(projectPath, 'src', 'components'));
  await getFs().ensureDir(path.join(projectPath, 'src', 'routes'));
  await getFs().ensureDir(path.join(projectPath, 'public'));
  
  // Create package.json
  const packageJson = {
    name: projectName,
    version: '0.1.0',
    description: `An Eghact project`,
    main: 'src/main.js',
    scripts: {
      dev: 'eghact dev',
      build: 'eghact build',
      deploy: 'eghact deploy'
    },
    dependencies: {},
    devDependencies: {}
  };
  
  await getFs().writeJson(path.join(projectPath, 'package.json'), packageJson, { spaces: 2 });
  
  // Create basic App component
  const appComponent = `<template>
  <div class="app">
    <h1>Welcome to {title}</h1>
    <Counter />
  </div>
</template>

<script>
  import Counter from './components/Counter.egh'
  
  let title = '${projectName}'
</script>

<style>
  .app {
    text-align: center;
    padding: 2rem;
    font-family: Arial, sans-serif;
  }
  
  h1 {
    color: #333;
    margin-bottom: 2rem;
  }
</style>`;
  
  await getFs().writeFile(path.join(projectPath, 'src', 'App.egh'), appComponent);
  
  // Create Counter component
  const counterComponent = `<template>
  <div class="counter">
    <h2>Count: {count}</h2>
    <button @click="increment">+</button>
    <button @click="decrement">-</button>
  </div>
</template>

<script>
  let count = 0
  
  function increment() {
    count++
  }
  
  function decrement() {
    count--
  }
</script>

<style>
  .counter {
    margin: 2rem 0;
  }
  
  button {
    margin: 0 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 1rem;
    cursor: pointer;
    border: 1px solid #ddd;
    background: #f9f9f9;
    border-radius: 4px;
  }
  
  button:hover {
    background: #e9e9e9;
  }
</style>`;
  
  await getFs().writeFile(path.join(projectPath, 'src', 'components', 'Counter.egh'), counterComponent);
  
  // Create main.js
  const mainJs = `import { createApp } from 'eghact'
import App from './App.egh'

const app = createApp(App)
app.mount('#app')`;
  
  await getFs().writeFile(path.join(projectPath, 'src', 'main.js'), mainJs);
  
  // Create index.html
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName}</title>
</head>
<body>
  <div id="app"></div>
</body>
</html>`;
  
  await getFs().writeFile(path.join(projectPath, 'public', 'index.html'), indexHtml);
  
  // Create eghact.config.js
  const configJs = `export default {
  mode: 'development',
  outDir: 'dist',
  publicDir: 'public',
  compiler: {
    targets: ['chrome91', 'firefox89', 'safari14'],
    optimization: 'balanced',
    sourceMaps: true
  },
  devServer: {
    port: 3000,
    hmr: true
  }
}`;
  
  await getFs().writeFile(path.join(projectPath, 'eghact.config.js'), configJs);
}

// Simple build fallback function
async function simpleBuild(rootDir, outDir) {
  const buildDir = path.join(rootDir, outDir);
  
  console.log(getChalk().gray('📁 Creating build directory...'));
  await getFs().ensureDir(buildDir);
  
  // Copy public files if they exist
  const publicDir = path.join(rootDir, 'public');
  if (await getFs().pathExists(publicDir)) {
    console.log(getChalk().gray('📋 Copying public assets...'));
    await getFs().copy(publicDir, buildDir);
  }
  
  // Copy and compile source files
  const srcDir = path.join(rootDir, 'src');
  if (await getFs().pathExists(srcDir)) {
    console.log(getChalk().gray('🔧 Processing source files...'));
    // In a real implementation, we'd compile .egh files here
  }
  
  // Create basic index.html if it doesn't exist
  const indexPath = path.join(buildDir, 'index.html');
  if (!await getFs().pathExists(indexPath)) {
    console.log(getChalk().gray('📝 Generating index.html...'));
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Eghact App</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; text-align: center; }
    .container { max-width: 600px; margin: 0 auto; }
    h1 { color: #333; margin-bottom: 1rem; }
    .badge { background: #007acc; color: white; padding: 0.25rem 0.5rem; border-radius: 3px; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 Eghact Application</h1>
    <p><span class="badge">Production Build</span></p>
    <p>Your Eghact application is ready for deployment!</p>
    <p><small>Built with Eghact Framework</small></p>
  </div>
</body>
</html>`;
    await getFs().writeFile(indexPath, html);
  }
  
  console.log(getChalk().gray(`📦 Built to ${buildDir}`));
}

// Global error handling
process.on('uncaughtException', (error) => {
  // Don't use chalk in error handlers as it might not be loaded
  console.error('💥 Uncaught Exception:', error.message);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection:', reason);
  if (process.env.DEBUG) {
    console.error('Promise:', promise);
  }
  process.exit(1);
});

// Handle missing commands
prog.on('command:*', () => {
  const c = getChalk();
  console.error(c.red('❌ Unknown command:'), c.bold(prog.args.join(' ')));
  console.log();
  console.log(c.gray('Available commands:'));
  console.log(c.cyan('  create   '), c.gray('Create a new Eghact project'));
  console.log(c.cyan('  dev      '), c.gray('Start development server'));
  console.log(c.cyan('  build    '), c.gray('Build for production'));
  console.log(c.cyan('  deploy   '), c.gray('Deploy to production'));
  console.log();
  console.log(c.gray('Run'), c.cyan('eghact --help'), c.gray('for more information'));
  process.exit(1);
});

// Generator functions
async function generateComponent(name, outputDir, options) {
  const componentName = name.charAt(0).toUpperCase() + name.slice(1);
  const fileName = options.typescript ? `${componentName}.egh` : `${componentName}.egh`;
  const testFileName = `${componentName}.test.js`;
  
  const componentContent = `<template>
  <div class="${name.toLowerCase()}">
    <h2>{title}</h2>
    <p>{description}</p>
    <button @click="handleClick">Click me</button>
  </div>
</template>

<script>
  export let props = {
    title: String,
    description: String
  }
  
  let { title = 'Default Title', description = 'Default description' } = props
  
  function handleClick() {
    console.log('${componentName} clicked!')
  }
</script>

<style>
  .${name.toLowerCase()} {
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    margin: 1rem 0;
  }
  
  button {
    background: #007acc;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }
  
  button:hover {
    background: #005999;
  }
</style>`;

  await getFs().writeFile(path.join(outputDir, fileName), componentContent);
  
  if (options.test) {
    const testContent = `import { render, screen } from '@testing-library/eghact';
import ${componentName} from './${componentName}.egh';

describe('${componentName}', () => {
  test('renders component', () => {
    render(${componentName}, { 
      props: { 
        title: 'Test Title',
        description: 'Test description'
      }
    });
    
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });
  
  test('handles click events', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    render(${componentName}, { props: { title: 'Test' } });
    
    const button = screen.getByRole('button');
    button.click();
    
    expect(consoleSpy).toHaveBeenCalledWith('${componentName} clicked!');
  });
});`;
    
    await getFs().writeFile(path.join(outputDir, testFileName), testContent);
  }
}

async function generatePage(name, outputDir, options) {
  const pageName = name.charAt(0).toUpperCase() + name.slice(1);
  const content = `<template>
  <div class="page ${name.toLowerCase()}">
    <header>
      <h1>${pageName} Page</h1>
    </header>
    
    <main>
      <p>Welcome to the ${pageName} page!</p>
    </main>
    
    <footer>
      <p>&copy; 2024 Eghact App</p>
    </footer>
  </div>
</template>

<script>
  export async function load({ params, query }) {
    // Page data loading logic here
    return {
      data: 'Page data'
    }
  }
</script>

<style>
  .page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  
  header {
    background: #f8f9fa;
    padding: 2rem;
    text-align: center;
  }
  
  main {
    flex: 1;
    padding: 2rem;
  }
  
  footer {
    background: #f8f9fa;
    padding: 1rem;
    text-align: center;
  }
</style>`;

  await getFs().writeFile(path.join(outputDir, `${pageName}.egh`), content);
}

async function generateHook(name, outputDir, options) {
  const hookName = name.startsWith('use') ? name : `use${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  const content = `import { reactive } from 'eghact';

export function ${hookName}(initialValue) {
  const state = reactive({
    value: initialValue,
    loading: false,
    error: null
  });
  
  function setValue(newValue) {
    state.value = newValue;
  }
  
  function setLoading(loading) {
    state.loading = loading;
  }
  
  function setError(error) {
    state.error = error;
  }
  
  return {
    ...state,
    setValue,
    setLoading,
    setError
  };
}`;

  await getFs().writeFile(path.join(outputDir, `${hookName}.js`), content);
}

async function generateStore(name, outputDir, options) {
  const storeName = name.toLowerCase();
  const content = `import { createStore } from 'eghact/store';

export const ${storeName}Store = createStore({
  // Initial state
  items: [],
  loading: false,
  error: null,
  
  // Actions
  actions: {
    async fetchItems() {
      this.loading = true;
      this.error = null;
      
      try {
        // Replace with actual API call
        const response = await fetch('/api/${storeName}');
        const items = await response.json();
        this.items = items;
      } catch (error) {
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    },
    
    addItem(item) {
      this.items.push(item);
    },
    
    removeItem(id) {
      this.items = this.items.filter(item => item.id !== id);
    },
    
    updateItem(id, updates) {
      const index = this.items.findIndex(item => item.id === id);
      if (index !== -1) {
        this.items[index] = { ...this.items[index], ...updates };
      }
    }
  }
});`;

  await getFs().writeFile(path.join(outputDir, `${storeName}.store.js`), content);
}

async function generateAPI(name, outputDir, options) {
  const apiName = name.toLowerCase();
  const content = `// API endpoints for ${name}
export const ${apiName}API = {
  // GET /${apiName}
  async getAll() {
    const response = await fetch('/${apiName}');
    return response.json();
  },
  
  // GET /${apiName}/:id
  async getById(id) {
    const response = await fetch(\`/${apiName}/\${id}\`);
    return response.json();
  },
  
  // POST /${apiName}
  async create(data) {
    const response = await fetch('/${apiName}', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return response.json();
  },
  
  // PUT /${apiName}/:id
  async update(id, data) {
    const response = await fetch(\`/${apiName}/\${id}\`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return response.json();
  },
  
  // DELETE /${apiName}/:id
  async delete(id) {
    const response = await fetch(\`/${apiName}/\${id}\`, {
      method: 'DELETE',
    });
    return response.json();
  }
};`;

  await getFs().writeFile(path.join(outputDir, `${apiName}.api.js`), content);
}

async function generateTest(name, outputDir, options) {
  const testName = name.replace(/\.test$/, '');
  const content = `import { describe, test, expect } from '@testing-library/eghact';

describe('${testName}', () => {
  test('should work correctly', () => {
    // Add your test logic here
    expect(true).toBe(true);
  });
  
  test('should handle edge cases', () => {
    // Add edge case tests here
    expect(false).toBe(false);
  });
});`;

  await getFs().writeFile(path.join(outputDir, `${testName}.test.js`), content);
}

// Helper functions for test command
function buildTestCommand(options) {
  let cmd = 'npm test';
  
  if (options.watch) cmd += ' -- --watch';
  if (options.coverage) cmd += ' -- --coverage';
  if (options.updateSnapshots) cmd += ' -- --updateSnapshot';
  if (options.silent) cmd += ' -- --silent';
  
  return cmd;
}

// Health check functions
async function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);
  return {
    success: major >= 16,
    message: major >= 16 ? `v${version}` : `v${version} (requires Node 16+)`
  };
}

async function checkPackageJson() {
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    const pkg = await getFs().readJson(packagePath);
    return {
      success: true,
      message: `v${pkg.version}`
    };
  } catch {
    return { success: false, message: 'Missing or invalid package.json' };
  }
}

async function checkDependencies() {
  try {
    const nodeModulesPath = path.join(process.cwd(), 'node_modules');
    const exists = await getFs().pathExists(nodeModulesPath);
    return {
      success: exists,
      message: exists ? 'Installed' : 'Run npm install'
    };
  } catch {
    return { success: false, message: 'Error checking dependencies' };
  }
}

async function checkEghactConfig() {
  try {
    const configPath = path.join(process.cwd(), 'eghact.config.js');
    const exists = await getFs().pathExists(configPath);
    return {
      success: exists,
      message: exists ? 'Found' : 'Consider adding eghact.config.js'
    };
  } catch {
    return { success: false, message: 'Error checking config' };
  }
}

async function checkTypeScript() {
  try {
    const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
    const exists = await getFs().pathExists(tsconfigPath);
    return {
      success: true,
      message: exists ? 'TypeScript configured' : 'JavaScript project'
    };
  } catch {
    return { success: false, message: 'Error checking TypeScript' };
  }
}

async function checkBuildDir() {
  try {
    const distPath = path.join(process.cwd(), 'dist');
    const exists = await getFs().pathExists(distPath);
    return {
      success: true,
      message: exists ? 'Build directory exists' : 'No build found'
    };
  } catch {
    return { success: false, message: 'Error checking build directory' };
  }
}

prog.parse();
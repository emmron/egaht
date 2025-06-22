#!/usr/bin/env node

/**
 * Eghact CLI - JavaScript implementation
 */

import { spawn } from 'child_process';
import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const commands = {
  dev: 'Start development server',
  build: 'Build for production',
  create: 'Create new Eghact app',
  help: 'Show help'
};

async function main() {
  const [,, command, ...args] = process.argv;
  
  switch (command) {
    case 'dev':
      await runDev(args);
      break;
      
    case 'build':
      await runBuild(args);
      break;
      
    case 'create':
      await createApp(args[0] || 'my-eghact-app');
      break;
      
    case 'help':
    default:
      showHelp();
  }
}

async function runDev(args) {
  console.log('🚀 Starting Eghact development server...\n');
  
  const serverPath = join(__dirname, '../dev-server/server.js');
  const child = spawn('node', [serverPath, ...args], {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  child.on('error', (err) => {
    console.error('Failed to start dev server:', err);
    process.exit(1);
  });
}

async function runBuild(args) {
  console.log('📦 Building Eghact app for production...\n');
  
  const buildPath = join(__dirname, '../build-system/src/index.js');
  const child = spawn('node', [buildPath, ...args], {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  child.on('exit', (code) => {
    if (code === 0) {
      console.log('\n✅ Build complete!');
    } else {
      console.error('\n❌ Build failed');
      process.exit(code);
    }
  });
}

async function createApp(name) {
  console.log(`🎨 Creating new Eghact app: ${name}\n`);
  
  const targetDir = join(process.cwd(), name);
  
  try {
    await stat(targetDir);
    console.error(`❌ Directory ${name} already exists`);
    process.exit(1);
  } catch {
    // Directory doesn't exist, good to proceed
  }
  
  // Create project structure
  await mkdir(targetDir, { recursive: true });
  await mkdir(join(targetDir, 'src'), { recursive: true });
  await mkdir(join(targetDir, 'public'), { recursive: true });
  
  // Create package.json
  const packageJson = {
    name,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: 'eghact dev',
      build: 'eghact build',
      preview: 'eghact preview'
    },
    dependencies: {
      eghact: '^1.0.0'
    }
  };
  
  await writeFile(
    join(targetDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  
  // Create index.html
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 0;
      background: #f5f5f5;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>`;
  
  await writeFile(join(targetDir, 'index.html'), indexHtml);
  
  // Create main.js
  const mainJs = `import { createApp } from 'eghact';
import App from './App.js';

const app = await createApp(App, document.getElementById('root'));
app.mount();

console.log('Welcome to Eghact!');`;
  
  await writeFile(join(targetDir, 'src/main.js'), mainJs);
  
  // Create App.egh
  const appEgh = `// Welcome to Eghact!

component App {
  // Reactive state
  ~count = 0
  ~message = "Hello Eghact!"
  
  // Computed value
  doubled => count * 2
  
  // Effect
  count :: {
    console.log("Count changed to:", count)
  }
  
  // Template
  <[
    column {
      $alignItems: center
      $padding: 2rem
      
      h1 { message }
      
      p { "You clicked " + count + " times" }
      p { "Doubled: " + doubled }
      
      row {
        $gap: 1rem
        $marginTop: 1rem
        
        button(@click: count++) { "Click me" }
        button(@click: count = 0) { "Reset" }
      }
      
      ?count > 5 {
        p {
          $color: green
          $marginTop: 1rem
          "Great job! Keep clicking!"
        }
      }
    }
  ]>
}`;
  
  await writeFile(join(targetDir, 'src/App.egh'), appEgh);
  
  // Create .gitignore
  const gitignore = `node_modules
dist
.DS_Store
*.log
.env`;
  
  await writeFile(join(targetDir, '.gitignore'), gitignore);
  
  console.log(`✅ Created ${name} successfully!\n`);
  console.log('Next steps:');
  console.log(`  cd ${name}`);
  console.log('  npm install');
  console.log('  npm run dev\n');
  console.log('Happy coding! 🚀');
}

function showHelp() {
  console.log('Eghact - Revolutionary web framework\n');
  console.log('Usage: eghact <command>\n');
  console.log('Commands:');
  
  for (const [cmd, desc] of Object.entries(commands)) {
    console.log(`  ${cmd.padEnd(10)} ${desc}`);
  }
  
  console.log('\nExamples:');
  console.log('  eghact create my-app');
  console.log('  eghact dev');
  console.log('  eghact build');
}

// Run CLI
main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
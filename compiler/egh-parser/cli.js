#!/usr/bin/env node

/**
 * EGH Compiler CLI
 */

import { EGHCompiler } from './src/compiler.js';
import { program } from 'commander';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';

// CLI setup
program
  .name('eghc')
  .description('Eghact Hyperlanguage Compiler')
  .version('1.0.0');

// Compile command
program
  .command('compile <input> [output]')
  .description('Compile EGH files to JavaScript')
  .option('-w, --watch', 'Watch for changes')
  .option('-s, --source-map', 'Generate source maps', true)
  .option('-o, --optimize', 'Optimize output', true)
  .option('-r, --runtime <path>', 'Runtime import path', '@eghact/runtime-pure')
  .action(async (input, output, options) => {
    const compiler = new EGHCompiler({
      sourceMap: options.sourceMap,
      optimize: options.optimize,
      runtime: options.runtime
    });
    
    try {
      const stats = await fs.stat(input);
      
      if (stats.isDirectory()) {
        // Compile directory
        output = output || input.replace(/\.egh$/, '.js');
        
        if (options.watch) {
          await compiler.watch(input, output);
          console.log(chalk.green(`Watching ${input} for changes...`));
        } else {
          console.log(chalk.blue(`Compiling directory ${input}...`));
          const results = await compiler.compileDirectory(input, output);
          
          const successful = results.filter(r => r.success).length;
          const failed = results.filter(r => !r.success).length;
          
          console.log(chalk.green(`✓ Compiled ${successful} files`));
          if (failed > 0) {
            console.log(chalk.red(`✗ Failed to compile ${failed} files`));
          }
        }
      } else {
        // Compile single file
        output = output || input.replace(/\.egh$/, '.js');
        
        console.log(chalk.blue(`Compiling ${input}...`));
        const result = await compiler.compileFile(input);
        
        await fs.writeFile(output, result.code);
        if (options.sourceMap && result.sourceMap) {
          await fs.writeFile(output + '.map', JSON.stringify(result.sourceMap));
        }
        
        console.log(chalk.green(`✓ Compiled to ${output}`));
      }
    } catch (error) {
      console.error(chalk.red('Compilation error:'), error.message);
      process.exit(1);
    }
  });

// Init command
program
  .command('init')
  .description('Initialize a new EGH project')
  .option('-n, --name <name>', 'Project name', 'my-egh-app')
  .action(async (options) => {
    const projectDir = options.name;
    
    console.log(chalk.blue(`Creating new EGH project: ${projectDir}`));
    
    // Create project structure
    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(path.join(projectDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(projectDir, 'dist'), { recursive: true });
    
    // Create package.json
    const packageJson = {
      name: options.name,
      version: '0.1.0',
      type: 'module',
      scripts: {
        build: 'eghc compile src dist',
        dev: 'eghc compile src dist --watch',
        serve: 'npx serve dist'
      },
      dependencies: {
        '@eghact/runtime-pure': '^1.0.0'
      },
      devDependencies: {
        '@eghact/compiler': '^1.0.0'
      }
    };
    
    await fs.writeFile(
      path.join(projectDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // Create example component
    const exampleComponent = `component App {
  ~count = 0
  ~message = "Welcome to Eghact!"
  
  doubled => count * 2
  
  count :: {
    console.log("Count changed:", count)
    if (count > 5) message = "That's a lot of clicks!"
  }
  
  <[
    column {
      h1 { message }
      p { "You clicked " + count + " times" }
      p { "Doubled: " + doubled }
      
      row {
        button(@click: count++) { "Click me" }
        button(@click: count = 0) { "Reset" }
      }
      
      ?count > 0 {
        p {
          $color: count > 5 ? 'red' : 'blue'
          "Keep going!"
        }
      }
    }
  ]>
}`;
    
    await fs.writeFile(
      path.join(projectDir, 'src', 'App.egh'),
      exampleComponent
    );
    
    // Create index.html
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.name}</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }
    button {
      padding: 0.5rem 1rem;
      margin: 0.25rem;
      border: none;
      border-radius: 4px;
      background: #007bff;
      color: white;
      cursor: pointer;
    }
    button:hover {
      background: #0056b3;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    import { createApp } from '@eghact/runtime-pure';
    import { App } from './App.js';
    
    const app = await createApp(App, document.getElementById('root'));
    app.mount();
  </script>
</body>
</html>`;
    
    await fs.writeFile(
      path.join(projectDir, 'dist', 'index.html'),
      indexHtml
    );
    
    console.log(chalk.green(`✓ Created project: ${projectDir}`));
    console.log('\nNext steps:');
    console.log(chalk.cyan(`  cd ${projectDir}`));
    console.log(chalk.cyan('  npm install'));
    console.log(chalk.cyan('  npm run dev'));
  });

// Parse command line
program.parse(process.argv);
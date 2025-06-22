#!/usr/bin/env node

/**
 * EPkg - Eghact Package Manager (JavaScript implementation)
 * Since Rust is not available, this is a pure JS version
 */

import { spawn } from 'child_process';
import { readFile, writeFile, mkdir, stat, readdir } from 'fs/promises';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

class EPkg {
  constructor() {
    this.commands = {
      init: 'Initialize a new Eghact project',
      install: 'Install dependencies',
      add: 'Add a new package',
      remove: 'Remove a package',
      run: 'Run a script',
      build: 'Build for production',
      dev: 'Start development server',
      publish: 'Publish package to registry',
      audit: 'Security audit'
    };
  }

  async run() {
    const [,, command, ...args] = process.argv;
    
    try {
      switch (command) {
        case 'init':
          await this.init(args[0]);
          break;
        case 'install':
        case 'i':
          await this.install(args);
          break;
        case 'add':
          await this.add(args);
          break;
        case 'run':
          await this.runScript(args);
          break;
        case 'dev':
          await this.dev();
          break;
        case 'build':
          await this.build();
          break;
        default:
          this.showHelp();
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }

  async init(name = 'my-eghact-app') {
    console.log(`🎨 Initializing new Eghact project: ${name}\n`);
    
    const targetDir = join(process.cwd(), name);
    
    // Check if directory exists
    try {
      await stat(targetDir);
      throw new Error(`Directory ${name} already exists`);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    
    // Create project structure
    await mkdir(join(targetDir, 'src'), { recursive: true });
    await mkdir(join(targetDir, 'public'), { recursive: true });
    
    // Create epkg.json (instead of package.json)
    const epkgJson = {
      name,
      version: '0.1.0',
      type: 'eghact-app',
      main: 'src/main.js',
      scripts: {
        dev: 'epkg dev',
        build: 'epkg build',
        test: 'epkg test',
        lint: 'epkg lint'
      },
      dependencies: {
        '@eghact/runtime': '^1.0.0'
      },
      devDependencies: {
        '@eghact/compiler': '^1.0.0'
      },
      eghact: {
        runtime: 'pure',
        compiler: {
          target: 'es2022',
          optimize: true
        }
      }
    };
    
    await writeFile(
      join(targetDir, 'epkg.json'),
      JSON.stringify(epkgJson, null, 2)
    );
    
    // Create index.html
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>`;
    
    await writeFile(join(targetDir, 'public/index.html'), indexHtml);
    
    // Create style.css
    const styleCss = `body {
  font-family: system-ui, -apple-system, sans-serif;
  margin: 0;
  padding: 0;
  background: #f5f5f5;
  color: #333;
}

#root {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

button {
  padding: 10px 20px;
  margin: 5px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  background: #007bff;
  color: white;
  transition: all 0.3s ease;
}

button:hover {
  background: #0056b3;
  transform: translateY(-1px);
}

input {
  padding: 10px;
  margin: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}`;
    
    await writeFile(join(targetDir, 'public/style.css'), styleCss);
    
    // Create main.js
    const mainJs = `import { createApp } from '@eghact/runtime';
import App from './App.egh';

async function main() {
  const app = await createApp(App, document.getElementById('root'));
  app.mount();
  
  console.log('🚀 Eghact app started!');
}

main().catch(console.error);`;
    
    await writeFile(join(targetDir, 'src/main.js'), mainJs);
    
    // Create App.egh with the updated syntax
    const appEgh = `component App {
  ~count = 0
  ~name = "Developer"
  ~todos = []
  ~newTodo = ""
  
  // Methods
  addTodo() => {
    if (newTodo.trim()) {
      todos.push({ 
        id: Date.now(), 
        text: newTodo, 
        done: false 
      })
      newTodo = ""
    }
  }
  
  toggleTodo(id) => {
    const todo = todos.find(t => t.id === id)
    if (todo) todo.done = !todo.done
  }
  
  // Computed
  completedCount => todos.filter(t => t.done).length
  totalCount => todos.length
  
  // Template
  <[
    column {
      $padding: 2rem
      $maxWidth: 800px
      $margin: "0 auto"
      
      h1 {
        $textAlign: center
        $color: "#333"
        "🚀 Welcome to Eghact!"
      }
      
      row {
        $justifyContent: center
        $gap: 1rem
        $marginBottom: 2rem
        
        input <~> name {
          $width: 200px
          placeholder: "Your name"
        }
        
        span {
          $fontSize: 1.2rem
          "Hello, " + name + "!"
        }
      }
      
      row {
        $justifyContent: center
        $gap: 1rem
        
        button(@click: count++) {
          "Clicked: " + count
        }
        
        button(@click: count = 0) {
          $background: "#dc3545"
          "Reset"
        }
      }
      
      // Todo Section
      column {
        $marginTop: 3rem
        $background: white
        $padding: 2rem
        $borderRadius: 8px
        $boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
        
        h2 { "Todo List" }
        
        row {
          $marginBottom: 1rem
          
          input <~> newTodo {
            $flex: 1
            placeholder: "Add a todo..."
            @keyup.enter: addTodo()
          }
          
          button(@click: addTodo()) {
            "Add"
          }
        }
        
        ?todos.length > 0 {
          column {
            $gap: 0.5rem
            
            *~todos as todo {
              row {
                $padding: 0.5rem
                $background: todo.done ? "#f0f0f0" : "#fff"
                $borderRadius: 4px
                
                input {
                  type: "checkbox"
                  checked: todo.done
                  @change: () => toggleTodo(todo.id)
                }
                
                span {
                  $flex: 1
                  $textDecoration: todo.done ? "line-through" : "none"
                  todo.text
                }
                
                button(@click: () => todos = todos.filter(t => t.id !== todo.id)) {
                  $background: "#dc3545"
                  $padding: "4px 8px"
                  $fontSize: 12px
                  "Delete"
                }
              }
            }
            
            p {
              $marginTop: 1rem
              $textAlign: center
              $color: "#666"
              completedCount + " of " + totalCount + " completed"
            }
          }
        } : {
          p {
            $textAlign: center
            $color: "#999"
            "No todos yet. Add one above!"
          }
        }
      }
    }
  ]>
}`;
    
    await writeFile(join(targetDir, 'src/App.egh'), appEgh);
    
    // Create .gitignore
    const gitignore = `node_modules
.epkg-cache
dist
.DS_Store
*.log
.env
.eghact-lock.json`;
    
    await writeFile(join(targetDir, '.gitignore'), gitignore);
    
    console.log(`✅ Project created successfully!\n`);
    console.log('Next steps:');
    console.log(`  cd ${name}`);
    console.log('  epkg install');
    console.log('  epkg dev\n');
  }

  async install(packages = []) {
    console.log('📦 Installing dependencies...\n');
    
    // Read epkg.json
    const epkgPath = join(process.cwd(), 'epkg.json');
    let epkg;
    
    try {
      epkg = JSON.parse(await readFile(epkgPath, 'utf-8'));
    } catch {
      throw new Error('No epkg.json found. Run "epkg init" first.');
    }
    
    // For now, just create a symlink to the runtime
    const nodeModules = join(process.cwd(), 'node_modules/@eghact');
    await mkdir(nodeModules, { recursive: true });
    
    // Link to local runtime
    const runtimeSource = join(__dirname, '../runtime-pure/dist');
    const runtimeDest = join(nodeModules, 'runtime');
    
    try {
      await stat(runtimeDest);
    } catch {
      // Create the directory and copy files
      await mkdir(runtimeDest, { recursive: true });
      const files = await readdir(runtimeSource);
      
      for (const file of files) {
        const content = await readFile(join(runtimeSource, file));
        await writeFile(join(runtimeDest, file), content);
      }
    }
    
    console.log('✅ Dependencies installed\n');
  }

  async dev() {
    console.log('🚀 Starting development server...\n');
    
    // Start the Eghact dev server
    const serverPath = join(__dirname, '../dev-server/server.js');
    const child = spawn('node', [serverPath], {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env, PORT: process.env.PORT || 3000 }
    });
    
    child.on('error', (err) => {
      console.error('Failed to start dev server:', err);
      process.exit(1);
    });
  }

  async build() {
    console.log('📦 Building for production...\n');
    
    // For now, just compile all .egh files
    const { EGHLoader } = await import('../build-system/src/egh-loader.js');
    const loader = new EGHLoader({ optimize: true });
    
    const srcDir = join(process.cwd(), 'src');
    const distDir = join(process.cwd(), 'dist');
    
    await mkdir(distDir, { recursive: true });
    
    // Find all .egh files
    const files = await this.findFiles(srcDir, '.egh');
    
    for (const file of files) {
      const relativePath = relative(srcDir, file);
      const outPath = join(distDir, relativePath.replace('.egh', '.js'));
      
      console.log(`  Compiling ${relativePath}...`);
      
      const result = await loader.load(file);
      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(outPath, result.code);
    }
    
    console.log('\n✅ Build complete!\n');
  }

  async findFiles(dir, ext) {
    const files = [];
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        files.push(...await this.findFiles(fullPath, ext));
      } else if (entry.name.endsWith(ext)) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  async runScript(args) {
    const [script, ...scriptArgs] = args;
    
    if (!script) {
      console.error('❌ No script specified');
      return;
    }
    
    // Read epkg.json
    const epkg = JSON.parse(await readFile('epkg.json', 'utf-8'));
    const command = epkg.scripts?.[script];
    
    if (!command) {
      console.error(`❌ Script "${script}" not found`);
      return;
    }
    
    // Run the script
    const child = spawn('sh', ['-c', command], {
      stdio: 'inherit',
      env: { ...process.env, ...scriptArgs }
    });
    
    child.on('exit', (code) => {
      process.exit(code);
    });
  }

  showHelp() {
    console.log('EPkg - Eghact Package Manager\n');
    console.log('Usage: epkg <command> [options]\n');
    console.log('Commands:');
    
    for (const [cmd, desc] of Object.entries(this.commands)) {
      console.log(`  ${cmd.padEnd(10)} ${desc}`);
    }
    
    console.log('\nExamples:');
    console.log('  epkg init my-app');
    console.log('  epkg install');
    console.log('  epkg dev');
    console.log('  epkg build');
  }
}

// Run EPkg
const epkg = new EPkg();
epkg.run().catch(console.error);
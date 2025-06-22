import chokidar from 'chokidar';
import path from 'path';
import chalk from 'chalk';

export function createWatcher(moduleGraph, hmrServer) {
  const watcher = chokidar.watch('.', {
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/.eghact/**'
    ],
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 10
    }
  });
  
  watcher.on('change', async (file) => {
    const ext = path.extname(file);
    
    if (ext === '.egh') {
      // Handle .egh file changes
      await handleEghChange(file, moduleGraph, hmrServer);
    } else if (ext === '.css' || ext === '.scss') {
      // Handle style changes
      await handleStyleChange(file, moduleGraph, hmrServer);
    } else if (ext === '.js' || ext === '.ts') {
      // Handle script changes
      await handleScriptChange(file, moduleGraph, hmrServer);
    } else {
      // Other files might trigger full reload
      console.log(chalk.yellow(`File changed: ${file} - full reload may be required`));
    }
  });
  
  watcher.on('add', (file) => {
    console.log(chalk.green(`File added: ${file}`));
  });
  
  watcher.on('unlink', (file) => {
    console.log(chalk.red(`File removed: ${file}`));
    // Remove from module graph
    const modules = moduleGraph.getModulesByFile(file);
    for (const module of modules) {
      moduleGraph.invalidateModule(module.id);
    }
  });
  
  return watcher;
}

async function handleEghChange(file, moduleGraph, hmrServer) {
  try {
    // Re-compile the component
    const { compileEghFile } = await import('./compiler.js');
    const compiled = await compileEghFile(file, moduleGraph);
    
    // Update module graph
    moduleGraph.updateModule(file, {
      code: compiled.code,
      dependencies: compiled.dependencies,
      hot: compiled.hasHMR
    });
    
    // Trigger HMR update
    await hmrServer.handleFileChange(file, 'change');
    
  } catch (error) {
    console.error(chalk.red(`Error processing ${file}:`), error);
    hmrServer.notifyError(error, file);
  }
}

async function handleStyleChange(file, moduleGraph, hmrServer) {
  // For style changes, we can often do CSS-only HMR
  const updates = [{
    type: 'css-update',
    path: file,
    timestamp: Date.now()
  }];
  
  hmrServer.notifyUpdate({ updates });
}

async function handleScriptChange(file, moduleGraph, hmrServer) {
  // Handle changes to non-.egh JavaScript files
  await hmrServer.handleFileChange(file, 'change');
}
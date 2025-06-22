import chalk from 'chalk';

export class HMRServer {
  constructor(app, moduleGraph) {
    this.moduleGraph = moduleGraph;
    this.clients = new Set();
    
    // WebSocket endpoint for HMR
    app.get('/__eghact/hmr', { websocket: true }, (connection, req) => {
      const socket = connection.socket;
      
      this.clients.add(socket);
      console.log(chalk.gray('HMR client connected'));
      
      // Send initial connection message
      this.send(socket, {
        type: 'connected',
        timestamp: Date.now()
      });
      
      socket.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.handleClientMessage(socket, message);
        } catch (err) {
          console.error('Invalid HMR message:', err);
        }
      });
      
      socket.on('close', () => {
        this.clients.delete(socket);
        console.log(chalk.gray('HMR client disconnected'));
      });
    });
  }
  
  handleClientMessage(socket, message) {
    switch (message.type) {
      case 'ping':
        this.send(socket, { type: 'pong' });
        break;
        
      case 'prune':
        // Client is pruning unused modules
        this.moduleGraph.prunePaths(message.paths);
        break;
        
      case 'error':
        console.error(chalk.red('HMR client error:'), message.error);
        break;
        
      default:
        console.warn('Unknown HMR message type:', message.type);
    }
  }
  
  notifyUpdate(updateInfo) {
    const message = {
      type: 'update',
      updates: updateInfo.updates.map(update => ({
        type: update.type,
        path: update.path,
        timestamp: update.timestamp,
        acceptedPath: update.acceptedPath
      }))
    };
    
    this.broadcast(message);
  }
  
  notifyFullReload(reason) {
    console.log(chalk.yellow(`Full reload required: ${reason}`));
    
    this.broadcast({
      type: 'full-reload',
      reason,
      timestamp: Date.now()
    });
  }
  
  notifyError(error, file) {
    this.broadcast({
      type: 'error',
      error: {
        message: error.message,
        stack: error.stack,
        file,
        timestamp: Date.now()
      }
    });
  }
  
  send(socket, message) {
    if (socket.readyState === 1) { // WebSocket.OPEN
      socket.send(JSON.stringify(message));
    }
  }
  
  broadcast(message) {
    const payload = JSON.stringify(message);
    
    for (const client of this.clients) {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(payload);
      }
    }
  }
  
  async handleFileChange(file, changeType) {
    console.log(chalk.gray(`File ${changeType}: ${file}`));
    
    const modules = this.moduleGraph.getModulesByFile(file);
    
    if (modules.length === 0) {
      // New file
      return;
    }
    
    const updates = [];
    const invalidated = new Set();
    
    for (const module of modules) {
      const affected = this.moduleGraph.invalidateModule(module.id);
      
      for (const mod of affected) {
        if (!invalidated.has(mod.id)) {
          invalidated.add(mod.id);
          
          // Check if module accepts self-updates
          if (mod.hot && mod.acceptedDeps.has(mod.id)) {
            updates.push({
              type: 'js-update',
              path: mod.url,
              timestamp: mod.timestamp,
              acceptedPath: mod.url
            });
          } else {
            // Check if any importer accepts this module
            let accepted = false;
            for (const importerId of mod.importers) {
              const importer = this.moduleGraph.getModule(importerId);
              if (importer?.acceptedDeps.has(mod.id)) {
                updates.push({
                  type: 'js-update',
                  path: mod.url,
                  timestamp: mod.timestamp,
                  acceptedPath: importer.url
                });
                accepted = true;
                break;
              }
            }
            
            if (!accepted) {
              // No HMR boundary found, need full reload
              this.notifyFullReload(`No HMR boundary found for ${file}`);
              return;
            }
          }
        }
      }
    }
    
    if (updates.length > 0) {
      this.notifyUpdate({ updates });
    }
  }
}
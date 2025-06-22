/**
 * Hot Module Replacement (HMR) server
 */

import WebSocket from 'ws';
import chalk from 'chalk';

export function createHMRServer({ app, moduleGraph, compiler }) {
  const clients = new Set();
  
  // Register WebSocket route for HMR
  app.register(async function (fastify) {
    await fastify.register(import('@fastify/websocket'));
    
    fastify.get('/__eghact/hmr', { websocket: true }, (connection, req) => {
      console.log(chalk.blue('[HMR] Client connected'));
      clients.add(connection.socket);
      
      // Send initial connection message
      connection.socket.send(JSON.stringify({
        type: 'connected',
        message: 'HMR ready'
      }));
      
      connection.socket.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          handleClientMessage(data, connection.socket);
        } catch (err) {
          console.error(chalk.red('[HMR] Invalid message:'), err);
        }
      });
      
      connection.socket.on('close', () => {
        console.log(chalk.blue('[HMR] Client disconnected'));
        clients.delete(connection.socket);
      });
      
      connection.socket.on('error', (err) => {
        console.error(chalk.red('[HMR] WebSocket error:'), err);
        clients.delete(connection.socket);
      });
    });
  });
  
  function handleClientMessage(data, socket) {
    switch (data.type) {
      case 'ping':
        socket.send(JSON.stringify({ type: 'pong' }));
        break;
      case 'error':
        console.error(chalk.red('[HMR] Client error:'), data.error);
        break;
      default:
        console.warn('[HMR] Unknown message type:', data.type);
    }
  }
  
  async function sendUpdate(update) {
    const message = JSON.stringify({
      type: 'update',
      updates: Array.isArray(update) ? update : [update]
    });
    
    console.log(chalk.yellow('[HMR] Broadcasting update to'), clients.size, 'clients');
    
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      } else {
        clients.delete(client);
      }
    }
  }
  
  function notifyError(error, file) {
    const message = JSON.stringify({
      type: 'error',
      error: {
        message: error.message,
        stack: error.stack,
        file
      }
    });
    
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }
  
  function notifyUpdate(update) {
    sendUpdate(update);
  }
  
  async function handleFileChange(filePath, eventType) {
    console.log(chalk.yellow(`[HMR] File ${eventType}:`), filePath);
    
    try {
      if (filePath.endsWith('.egh')) {
        // Re-compile and send update
        const compiled = await compiler.compile(filePath);
        
        await sendUpdate({
          type: 'js-update',
          path: filePath,
          code: compiled.code,
          timestamp: Date.now()
        });
      } else if (filePath.endsWith('.css')) {
        await sendUpdate({
          type: 'css-update',
          path: filePath,
          timestamp: Date.now()
        });
      } else {
        // Full reload for other files
        await sendUpdate({
          type: 'full-reload',
          reason: `File changed: ${filePath}`
        });
      }
    } catch (error) {
      console.error(chalk.red('[HMR] Error handling file change:'), error);
      notifyError(error, filePath);
    }
  }
  
  return {
    sendUpdate,
    notifyError,
    notifyUpdate,
    handleFileChange,
    get clientCount() {
      return clients.size;
    }
  };
}
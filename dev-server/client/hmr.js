/**
 * Client-side HMR runtime
 */

const HMR_PORT = window.location.port || '3000';
const HMR_PROTOCOL = window.location.protocol === 'https:' ? 'wss' : 'ws';
const HMR_URL = `${HMR_PROTOCOL}://${window.location.hostname}:${HMR_PORT}/__eghact/hmr`;

// Store for preserving component state during hot reload
window.__eghact_hot_state = window.__eghact_hot_state || new Map();

export function createHMRClient() {
  let socket;
  let reconnectTimer;
  let messageQueue = [];
  
  const client = {
    connect() {
      console.log('[HMR] Connecting...');
      
      socket = new WebSocket(HMR_URL);
      
      socket.addEventListener('open', () => {
        console.log('[HMR] Connected');
        clearTimeout(reconnectTimer);
        
        // Send queued messages
        while (messageQueue.length > 0) {
          const msg = messageQueue.shift();
          socket.send(JSON.stringify(msg));
        }
      });
      
      socket.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (err) {
          console.error('[HMR] Invalid message:', err);
        }
      });
      
      socket.addEventListener('close', () => {
        console.log('[HMR] Connection lost, reconnecting...');
        reconnect();
      });
      
      socket.addEventListener('error', (err) => {
        console.error('[HMR] WebSocket error:', err);
      });
    },
    
    send(message) {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      } else {
        messageQueue.push(message);
      }
    },
    
    disconnect() {
      if (socket) {
        socket.close();
        socket = null;
      }
      clearTimeout(reconnectTimer);
    }
  };
  
  function reconnect() {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      client.connect();
    }, 1000);
  }
  
  function handleMessage(message) {
    switch (message.type) {
      case 'connected':
        console.log('[HMR] Connected to dev server');
        break;
        
      case 'update':
        handleUpdate(message.updates);
        break;
        
      case 'full-reload':
        console.log(`[HMR] Full reload: ${message.reason}`);
        window.location.reload();
        break;
        
      case 'error':
        handleError(message.error);
        break;
        
      case 'pong':
        // Keep-alive response
        break;
        
      default:
        console.warn('[HMR] Unknown message type:', message.type);
    }
  }
  
  async function handleUpdate(updates) {
    console.log('[HMR] Applying updates:', updates);
    
    for (const update of updates) {
      try {
        switch (update.type) {
          case 'js-update':
            await handleJSUpdate(update);
            break;
            
          case 'css-update':
            await handleCSSUpdate(update);
            break;
            
          default:
            console.warn('[HMR] Unknown update type:', update.type);
        }
      } catch (err) {
        console.error('[HMR] Failed to apply update:', err);
        client.send({
          type: 'error',
          error: {
            message: err.message,
            stack: err.stack
          }
        });
      }
    }
  }
  
  async function handleJSUpdate(update) {
    const { path, acceptedPath, timestamp } = update;
    
    // Import the updated module
    const url = `${path}?t=${timestamp}`;
    const newModule = await import(url);
    
    // Find modules that accept this update
    const acceptingModule = moduleMap.get(acceptedPath);
    if (acceptingModule && acceptingModule.hot) {
      // Save current state
      const state = {};
      if (acceptingModule.hot.dispose) {
        acceptingModule.hot.dispose(state);
      }
      
      // Apply update
      if (acceptingModule.hot.accept) {
        acceptingModule.hot.accept(newModule, state);
      }
      
      console.log('[HMR] Module updated:', path);
    } else {
      console.warn('[HMR] No accepting module found for:', path);
    }
  }
  
  async function handleCSSUpdate(update) {
    const { path, timestamp } = update;
    
    // Find existing style link
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    let updated = false;
    
    for (const link of links) {
      const href = new URL(link.href);
      if (href.pathname === path) {
        // Update with cache buster
        href.searchParams.set('t', timestamp);
        link.href = href.toString();
        updated = true;
        console.log('[HMR] CSS updated:', path);
      }
    }
    
    if (!updated) {
      // Create new link
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${path}?t=${timestamp}`;
      document.head.appendChild(link);
      console.log('[HMR] CSS added:', path);
    }
  }
  
  function handleError(error) {
    console.error('[HMR] Server error:', error);
    
    // Show error overlay
    showErrorOverlay(error);
  }
  
  function showErrorOverlay(error) {
    // Remove existing overlay
    const existing = document.getElementById('eghact-error-overlay');
    if (existing) {
      existing.remove();
    }
    
    // Create error overlay
    const overlay = document.createElement('div');
    overlay.id = 'eghact-error-overlay';
    overlay.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.85);
        color: #e8e8e8;
        font-family: monospace;
        font-size: 14px;
        padding: 20px;
        overflow: auto;
        z-index: 99999;
      ">
        <div style="
          max-width: 800px;
          margin: 0 auto;
          background: #1e1e1e;
          padding: 20px;
          border-radius: 8px;
          border: 2px solid #f44336;
        ">
          <h2 style="color: #f44336; margin: 0 0 10px;">Compilation Error</h2>
          <div style="color: #ff9800; margin-bottom: 10px;">${error.file || 'Unknown file'}</div>
          <pre style="
            background: #2d2d2d;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            white-space: pre-wrap;
          ">${error.message}</pre>
          ${error.stack ? `
            <details style="margin-top: 15px;">
              <summary style="cursor: pointer; color: #888;">Stack trace</summary>
              <pre style="
                background: #2d2d2d;
                padding: 15px;
                border-radius: 4px;
                overflow-x: auto;
                margin-top: 10px;
                font-size: 12px;
              ">${error.stack}</pre>
            </details>
          ` : ''}
          <button onclick="document.getElementById('eghact-error-overlay').remove()" style="
            margin-top: 15px;
            padding: 8px 16px;
            background: #f44336;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          ">Dismiss</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
  }
  
  // Keep connection alive
  setInterval(() => {
    client.send({ type: 'ping' });
  }, 30000);
  
  return client;
}

// Module map for tracking HMR boundaries
const moduleMap = new Map();

// Enhanced import.meta.hot API
export function createHotContext(id, meta) {
  const hot = {
    id,
    data: {},
    
    accept(deps, callback) {
      if (typeof deps === 'function') {
        callback = deps;
        deps = [id];
      } else if (typeof deps === 'string') {
        deps = [deps];
      } else if (!deps) {
        deps = [id];
      }
      
      // Store accept callback
      this._acceptCallbacks = this._acceptCallbacks || [];
      this._acceptCallbacks.push({
        deps,
        callback
      });
    },
    
    dispose(callback) {
      this._disposeCallbacks = this._disposeCallbacks || [];
      this._disposeCallbacks.push(callback);
    },
    
    invalidate() {
      // Force reload this module
      location.reload();
    },
    
    decline() {
      this._declined = true;
    }
  };
  
  moduleMap.set(id, { hot, meta });
  return hot;
}
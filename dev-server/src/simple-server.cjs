const express = require('express');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const WebSocket = require('ws');
const http = require('http');

function createDevServer(options = {}) {
  const {
    root = process.cwd(),
    port = 3000,
    host = '0.0.0.0'
  } = options;

  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocket.WebSocketServer({ server });

  // WebSocket for HMR
  wss.on('connection', (ws) => {
    console.log('HMR client connected');
    
    ws.on('close', () => {
      console.log('HMR client disconnected');
    });
  });

  function broadcastReload() {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'reload' }));
      }
    });
  }

  // Serve static files from public directory
  app.use('/public', express.static(path.join(root, 'public')));

  // Serve HMR client script
  app.get('/__eghact/hmr.js', (req, res) => {
    res.type('application/javascript');
    res.send(`
      (function() {
        const ws = new WebSocket('ws://localhost:${port}');
        
        ws.onmessage = function(event) {
          const data = JSON.parse(event.data);
          if (data.type === 'reload') {
            console.log('[HMR] Reloading page...');
            window.location.reload();
          }
        };
        
        ws.onopen = function() {
          console.log('[HMR] Connected to dev server');
        };
        
        ws.onclose = function() {
          console.log('[HMR] Connection lost, attempting to reconnect...');
          setTimeout(() => window.location.reload(), 1000);
        };
      })();
    `);
  });

  // Simple .egh file compiler (basic transformation)
  app.get('*.egh', (req, res) => {
    const filePath = path.join(root, 'src', req.path);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Component not found');
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const compiled = compileEghComponent(content, req.path);
      
      res.type('application/javascript');
      res.send(compiled);
    } catch (error) {
      console.error('Compilation error:', error);
      res.status(500).send(`// Compilation error: ${error.message}`);
    }
  });

  // Main route handler - serve the SPA shell
  app.get('*', (req, res) => {
    const html = generateHTML();
    res.type('text/html');
    res.send(html);
  });

  // File watcher for HMR
  const watcher = chokidar.watch(path.join(root, 'src'), {
    ignored: /node_modules/,
    persistent: true
  });

  watcher.on('change', (filePath) => {
    console.log(`File changed: ${filePath}`);
    broadcastReload();
  });

  return { app, server, wss };
}

function compileEghComponent(content, componentPath) {
  // Very basic .egh compilation - extract template, script, and style
  const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/);
  const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);
  const styleMatch = content.match(/<style>([\s\S]*?)<\/style>/);

  const template = templateMatch ? templateMatch[1].trim() : '';
  const script = scriptMatch ? scriptMatch[1].trim() : '';
  const style = styleMatch ? styleMatch[1].trim() : '';

  // Generate a simple JavaScript module
  return `
// Compiled from ${componentPath}
export default function() {
  // Component state and methods
  ${script}
  
  // Component render function
  function render() {
    const template = \`${template.replace(/`/g, '\\`')}\`;
    return template;
  }
  
  // Component styles
  const styles = \`${style.replace(/`/g, '\\`')}\`;
  
  // Apply styles to document
  if (styles && !document.querySelector('style[data-component="${componentPath}"]')) {
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-component', '${componentPath}');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }
  
  return {
    render,
    template: \`${template.replace(/`/g, '\\`')}\`,
    styles
  };
}
`;
}

function generateHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Eghact App</title>
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f9f9f9;
    }
    
    #app {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .app-container {
      text-align: center;
      padding: 2rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      max-width: 600px;
      width: 100%;
    }
    
    .loading {
      color: #666;
    }
    
    .error {
      color: #e74c3c;
      background: #fee;
      padding: 1rem;
      border-radius: 4px;
      margin: 1rem 0;
    }
  </style>
</head>
<body>
  <div id="app">
    <div class="app-container">
      <h1>🚀 Eghact Dev Server</h1>
      <p class="loading">Development server is running...</p>
      <p>Create your components in the <code>src/</code> directory with <code>.egh</code> extensions.</p>
      
      <div style="margin-top: 2rem; padding: 1rem; background: #f8f9fa; border-radius: 4px;">
        <h3>Example Component Structure:</h3>
        <pre style="text-align: left; background: white; padding: 1rem; border-radius: 4px; overflow-x: auto;">
&lt;template&gt;
  &lt;div class="counter"&gt;
    &lt;h2&gt;Count: {count}&lt;/h2&gt;
    &lt;button onclick="increment()"&gt;+&lt;/button&gt;
    &lt;button onclick="decrement()"&gt;-&lt;/button&gt;
  &lt;/div&gt;
&lt;/template&gt;

&lt;script&gt;
  let count = 0;
  
  function increment() {
    count++;
    render();
  }
  
  function decrement() {
    count--;
    render();
  }
&lt;/script&gt;

&lt;style&gt;
  .counter {
    padding: 1rem;
    text-align: center;
  }
  
  button {
    margin: 0 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 1rem;
    cursor: pointer;
  }
&lt;/style&gt;</pre>
      </div>
    </div>
  </div>
  
  <script src="/__eghact/hmr.js"></script>
</body>
</html>`;
}

module.exports = { createDevServer };
#!/usr/bin/env node

/**
 * Eghact Development Server with EGH compilation
 */

import { createServer } from 'http';
import { readFile, writeFile, stat } from 'fs/promises';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import { EGHLoader } from '../build-system/src/egh-loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// Initialize EGH loader
const eghLoader = new EGHLoader({
  sourceMap: true,
  optimize: false,
  runtime: '/@eghact/runtime'
});

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.egh': 'application/javascript', // Serve compiled EGH as JS
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Create development server
const server = createServer(async (req, res) => {
  try {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    
    // Remove query string
    filePath = filePath.split('?')[0];
    
    // Security: prevent directory traversal
    if (filePath.includes('..')) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    
    // Handle runtime requests
    if (filePath === '/@eghact/runtime') {
      const runtimePath = join(__dirname, '../runtime-pure/dist/eghact-runtime.dev.js');
      const content = await readFile(runtimePath);
      res.writeHead(200, {
        'Content-Type': 'application/javascript',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
      return;
    }
    
    // Determine actual file path
    let actualPath = join(process.cwd(), filePath);
    
    // Check if it's an EGH file request (might be imported as .js)
    if (filePath.endsWith('.js')) {
      const eghPath = actualPath.replace('.js', '.egh');
      try {
        await stat(eghPath);
        actualPath = eghPath;
        filePath = filePath.replace('.js', '.egh');
      } catch {
        // Not an EGH file, continue with JS
      }
    }
    
    const ext = extname(actualPath);
    const contentType = MIME_TYPES[ext] || 'text/plain';
    
    try {
      let content;
      
      // Compile EGH files on the fly
      if (ext === '.egh') {
        const result = await eghLoader.load(actualPath);
        content = result.code;
        
        // Add source map comment if available
        if (result.map) {
          content += `\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(JSON.stringify(result.map)).toString('base64')}`;
        }
      } else {
        content = await readFile(actualPath);
      }
      
      // Inject live reload script into HTML
      if (ext === '.html') {
        const liveReloadScript = `
<script>
  // Live reload for development
  let lastCheck = Date.now();
  setInterval(async () => {
    try {
      const res = await fetch('/_check');
      const data = await res.json();
      if (data.lastModified > lastCheck) {
        location.reload();
      }
    } catch (e) {}
  }, 1000);
</script>`;
        content = content.toString().replace('</body>', liveReloadScript + '</body>');
      }
      
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      });
      res.end(content);
    } catch (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end(`File not found: ${filePath}`);
      } else {
        console.error(`Error serving ${filePath}:`, err);
        res.writeHead(500);
        res.end(`Server Error: ${err.message}`);
      }
    }
  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

// Create index.html if it doesn't exist
async function createDefaultIndex() {
  const indexPath = join(process.cwd(), 'index.html');
  try {
    await stat(indexPath);
  } catch {
    const defaultHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Eghact App</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    #root {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    import { createApp } from '/@eghact/runtime';
    import App from './App.js';
    
    const app = await createApp(App, document.getElementById('root'));
    app.mount();
  </script>
</body>
</html>`;
    
    await writeFile(indexPath, defaultHtml);
    console.log('Created default index.html');
  }
}

// Start server
server.listen(PORT, async () => {
  await createDefaultIndex();
  
  console.log(`
🚀 Eghact Development Server
   Running at: http://localhost:${PORT}
   
   Features:
   ✅ EGH file compilation
   ✅ Live reload
   ✅ Source maps
   ✅ Zero configuration
   
   Create an App.egh file to get started!
   
   Press Ctrl+C to stop
  `);
});
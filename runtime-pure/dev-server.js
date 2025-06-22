#!/usr/bin/env node

/**
 * Simple development server for Eghact runtime
 */

import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = createServer(async (req, res) => {
  try {
    // Default to index.html for root
    let filePath = req.url === '/' ? '/test/test-runtime.html' : req.url;
    
    // Remove query string
    filePath = filePath.split('?')[0];
    
    // Security: prevent directory traversal
    if (filePath.includes('..')) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    
    const fullPath = join(__dirname, filePath);
    const ext = extname(fullPath);
    const contentType = MIME_TYPES[ext] || 'text/plain';
    
    try {
      const content = await readFile(fullPath);
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    } catch (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end(`File not found: ${filePath}`);
      } else {
        throw err;
      }
    }
  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

server.listen(PORT, () => {
  console.log(`
🚀 Eghact Development Server
   Running at: http://localhost:${PORT}
   
   Test apps:
   - http://localhost:${PORT}/test/test-runtime.html
   - http://localhost:${PORT}/test/simple-test.html
   - http://localhost:${PORT}/test/index.html
   
   Press Ctrl+C to stop
  `);
});
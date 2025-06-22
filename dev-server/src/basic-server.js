import express from 'express';
import path from 'path';
import fs from 'fs';

export function createDevServer(options = {}) {
  const {
    root = process.cwd(),
    port = 3000,
    host = 'localhost'
  } = options;

  const app = express();

  // Serve static files from public directory
  const publicDir = path.join(root, 'public');
  if (fs.existsSync(publicDir)) {
    app.use('/public', express.static(publicDir));
  }

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

  const server = app.listen(port, host, () => {
    // Server startup is handled by CLI now
  });

  return { app, server };
}

function compileEghComponent(content, componentPath) {
  // Basic .egh compilation - extract template, script, and style
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
  </style>
</head>
<body>
  <div id="app">
    <div class="app-container">
      <h1>🚀 Eghact Dev Server</h1>
      <p class="loading">Development server is running...</p>
      <p>Create your components in the <code>src/</code> directory with <code>.egh</code> extensions.</p>
    </div>
  </div>
</body>
</html>`;
}
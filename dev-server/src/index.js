import fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import portfinder from 'portfinder';
import { createServer } from './server.js';
import { createHMRServer } from './hmr.js';
import { ModuleGraph } from './module-graph.js';
import { createCompiler } from './compiler.js';
import { FileSystemRouter } from './router.js';
import { serveRuntime } from './runtime-loader.js';
import { dataLoader, generateClientDataLoader } from './data-loader.js';
import { generateErrorBoundaryClient } from './error-boundary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function startDevServer(options = {}) {
  const {
    root = process.cwd(),
    port = 3000,
    host = 'localhost',
    https = false,
    open = false,
  } = options;

  // Find available port
  const availablePort = await portfinder.getPortPromise({ port });
  
  // Create module graph
  const moduleGraph = new ModuleGraph();
  
  // Create compiler instance
  const compiler = createCompiler({ root, moduleGraph });
  
  // Create filesystem router
  const router = new FileSystemRouter({ routesDir: 'src/routes' });
  await router.discoverRoutes(root);
  
  // Create Fastify server
  const app = fastify({
    logger: false,
    https: https ? await createHTTPSConfig() : false,
  });

  // Register WebSocket plugin
  await app.register(fastifyWebsocket);
  
  // Create HMR server
  const hmr = createHMRServer({ 
    app, 
    moduleGraph,
    compiler,
  });

  // Serve static files
  await app.register(fastifyStatic, {
    root: path.join(root, 'public'),
    prefix: '/public/',
  });

  // Runtime routes
  app.get('/__eghact/runtime.js', serveRuntime);
  app.get('/__eghact/runtime.wasm', serveRuntime);
  
  // Router manifest
  app.get('/__eghact/routes.js', async (request, reply) => {
    const clientRouter = router.generateClientRouter();
    reply.type('application/javascript').send(clientRouter);
  });
  
  // HMR client
  app.get('/__eghact/client/hmr.js', async (request, reply) => {
    const hmrClient = await fs.readFile(path.join(__dirname, '../client/hmr.js'), 'utf-8');
    reply.type('application/javascript').send(hmrClient);
  });

  // Data loader client
  app.get('/__eghact/data-loader.js', async (request, reply) => {
    const clientLoader = generateClientDataLoader();
    reply.type('application/javascript').send(clientLoader);
  });

  // Error boundary client
  app.get('/__eghact/error-boundary.js', async (request, reply) => {
    const errorBoundaryClient = generateErrorBoundaryClient();
    reply.type('application/javascript').send(errorBoundaryClient);
  });

  // Data loading endpoint
  app.post('/__eghact/load-data', async (request, reply) => {
    try {
      const { route, params = {}, query = {} } = request.body;
      
      if (!route) {
        return reply.code(400).send({ error: 'Route is required' });
      }

      const context = {
        request: request.raw,
        params,
        query,
        headers: request.headers,
        url: new URL(route, `http://${request.headers.host}`),
        cookies: request.cookies || {}
      };

      const result = await dataLoader.loadRouteData(route, context);
      reply.send(result);
    } catch (error) {
      console.error('Data loading error:', error);
      reply.code(500).send({
        success: false,
        error: {
          message: error.message,
          type: 'ServerDataLoadError'
        }
      });
    }
  });

  // Error reporting endpoint
  app.post('/__eghact/error-report', async (request, reply) => {
    try {
      const { error, context } = request.body;
      
      console.error('Client Error Report:');
      console.error('Error:', error);
      console.error('Context:', context);
      
      // In a real implementation, you might want to:
      // - Log to a file
      // - Send to error tracking service
      // - Store in database
      
      reply.send({ success: true });
    } catch (reportError) {
      console.error('Failed to process error report:', reportError);
      reply.code(500).send({ success: false });
    }
  });

  // Main route handler
  app.get('/*', async (request, reply) => {
    const url = request.url;
    
    try {
      // Handle .egh files
      if (url.endsWith('.egh')) {
        const filePath = path.join(root, url);
        const compiled = await compiler.compile(filePath);
        reply.type('application/javascript').send(compiled.code);
        return;
      }
      
      // Handle route requests (SPA routing)
      const routeMatch = router.matchRoute(url);
      if (routeMatch) {
        const html = await generateHTML({ root, url, route: routeMatch });
        reply.type('text/html').send(html);
        return;
      }
      
      // Handle static assets
      const filePath = path.join(root, url);
      try {
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          reply.sendFile(path.basename(filePath), path.dirname(filePath));
          return;
        }
      } catch {
        // File doesn't exist, continue to 404
      }
      
      // 404 - serve SPA shell for client-side routing
      const html = await generateHTML({ root, url });
      reply.type('text/html').send(html);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      reply.code(500).send({ error: error.message });
    }
  });

  // File watcher
  const watcher = chokidar.watch(root, {
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
    ],
    persistent: true,
  });

  watcher.on('change', async (filePath) => {
    console.log(chalk.yellow('File changed:'), filePath);
    
    // Invalidate module graph
    moduleGraph.invalidate(filePath);
    
    // Trigger HMR update
    if (filePath.endsWith('.egh')) {
      await hmr.sendUpdate({
        type: 'update',
        path: filePath,
        timestamp: Date.now(),
      });
    } else if (filePath.endsWith('.css')) {
      await hmr.sendUpdate({
        type: 'css-update',
        path: filePath,
        timestamp: Date.now(),
      });
    } else {
      // Full reload for other files
      await hmr.sendUpdate({
        type: 'full-reload',
      });
    }
  });

  // Start server
  try {
    await app.listen({ port: availablePort, host });
    
    const protocol = https ? 'https' : 'http';
    const url = `${protocol}://${host}:${availablePort}`;
    
    console.log('');
    console.log(chalk.green('  Eghact Dev Server'));
    console.log('');
    console.log(`  ${chalk.bold('Local:')}   ${chalk.cyan(url)}`);
    console.log(`  ${chalk.bold('Network:')} ${chalk.cyan(url.replace('localhost', await getNetworkAddress()))}`);
    console.log('');
    console.log(chalk.gray('  press ') + chalk.bold('h') + chalk.gray(' to show help'));
    console.log('');
    
    // Open browser if requested
    if (open) {
      const { default: openBrowser } = await import('open');
      await openBrowser(url);
    }
    
    return { app, url, hmr };
  } catch (err) {
    console.error(chalk.red('Failed to start server:'), err);
    process.exit(1);
  }
}

async function generateHTML({ root, url, route }) {
  // Generate SPA shell with router, data loading, error boundaries, and HMR
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Eghact App</title>
  <script type="module">
    // Set development mode flag
    window.__EGHACT_DEV__ = true;
    
    // Load core systems
    import { router, $route } from '/__eghact/routes.js';
    import { runtime } from '/__eghact/runtime.js';
    import { dataLoader } from '/__eghact/data-loader.js';
    import '/__eghact/error-boundary.js';
    
    // Initialize runtime
    await runtime.init?.();
    
    // Start router with data loading integration
    router.navigate(window.location.pathname);
    
    // Pre-load data for current route if available
    if (window.location.pathname !== '/') {
      try {
        const routeParams = router.matchRoute(window.location.pathname)?.params || {};
        await dataLoader.loadData(window.location.pathname, routeParams);
      } catch (error) {
        console.warn('Failed to pre-load route data:', error);
      }
    }
    
    // HMR Client
    import { createHMRClient } from '/__eghact/client/hmr.js';
    const hmr = createHMRClient();
    hmr.connect();
    
    // Global API access
    window.$route = $route;
    window.$dataLoader = dataLoader;
    
    console.log('[Eghact] Development server ready');
  </script>
</head>
<body>
  <div id="app">
    <div class="loading" style="
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #666;
    ">
      <div>
        <div style="margin-bottom: 8px;">Loading Eghact app...</div>
        <div style="
          width: 200px;
          height: 2px;
          background: #f0f0f0;
          border-radius: 1px;
          overflow: hidden;
        ">
          <div style="
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, #007acc 0%, #007acc 50%, transparent 50%);
            animation: loading 1.5s ease-in-out infinite;
          "></div>
        </div>
      </div>
    </div>
  </div>
  
  <style>
    @keyframes loading {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
  </style>
</body>
</html>`;
}

async function createHTTPSConfig() {
  const selfsigned = await import('selfsigned');
  const attrs = [{ name: 'commonName', value: 'localhost' }];
  const pems = selfsigned.default.generate(attrs, { days: 365 });
  
  return {
    key: pems.private,
    cert: pems.cert,
  };
}

async function getNetworkAddress() {
  const os = await import('os');
  const interfaces = os.default.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  
  return 'localhost';
}

// Export for programmatic use
export { createServer, createHMRServer, ModuleGraph };
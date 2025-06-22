/**
 * Cloudflare Workers Adapter for Eghact
 * Deploy to Cloudflare's global edge network
 */

import { BaseAdapter } from '@eghact/adapter-base';
import fs from 'fs-extra';
import path from 'path';

export class CloudflareAdapter extends BaseAdapter {
  constructor(options = {}) {
    super({
      ...options,
      platform: 'cloudflare'
    });
    this.name = '@eghact/adapter-cloudflare';
    this.workerDir = 'worker';
    this.assetsDir = 'assets';
  }

  /**
   * Transform build output for Cloudflare Workers
   */
  async transform(outputPath) {
    console.log('🔄 Transforming build for Cloudflare Workers...');

    // Create directory structure
    const workerPath = path.join(outputPath, this.workerDir);
    const assetsPath = path.join(outputPath, this.assetsDir);
    
    await fs.ensureDir(workerPath);
    await fs.ensureDir(assetsPath);

    // Copy static assets
    await this.copyStaticAssets(assetsPath);

    // Create worker script
    await this.createWorkerScript(workerPath);

    // Extract SSR routes and create handlers
    const ssrRoutes = await this.extractServerRoutes();
    if (ssrRoutes.length > 0) {
      await this.createRouteHandlers(workerPath, ssrRoutes);
    }

    // Generate wrangler configuration
    await this.createWranglerConfig(outputPath);

    console.log('✅ Cloudflare Workers transformation complete');
  }

  /**
   * Create the main worker script
   */
  async createWorkerScript(workerPath) {
    const workerCode = `
import { Router } from './router.js';
import { handleSSR } from './ssr-handler.js';
import { serveStatic } from './static-handler.js';

// Initialize router
const router = new Router();

// Static asset routes
router.get('/assets/*', serveStatic);
router.get('/favicon.ico', serveStatic);
router.get('/robots.txt', serveStatic);

// SSR routes (dynamically imported)
import { setupSSRRoutes } from './routes.js';
setupSSRRoutes(router);

// Default route for client-side routing
router.get('/*', async (request, env, ctx) => {
  return serveStatic(request, env, ctx, '/index.html');
});

// Export worker
export default {
  async fetch(request, env, ctx) {
    try {
      return await router.handle(request, env, ctx);
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};
`.trim();

    await fs.writeFile(path.join(workerPath, 'index.js'), workerCode);

    // Create router utility
    await this.createRouterUtility(workerPath);
    
    // Create static handler
    await this.createStaticHandler(workerPath);
    
    // Create SSR handler
    await this.createSSRHandler(workerPath);
  }

  /**
   * Create router utility for Cloudflare Workers
   */
  async createRouterUtility(workerPath) {
    const routerCode = `
export class Router {
  constructor() {
    this.routes = new Map();
  }

  get(pattern, handler) {
    this.routes.set({ method: 'GET', pattern }, handler);
  }

  post(pattern, handler) {
    this.routes.set({ method: 'POST', pattern }, handler);
  }

  async handle(request, env, ctx) {
    const url = new URL(request.url);
    
    for (const [route, handler] of this.routes) {
      if (request.method !== route.method) continue;
      
      const match = this.matchRoute(url.pathname, route.pattern);
      if (match) {
        request.params = match.params;
        return await handler(request, env, ctx);
      }
    }
    
    return new Response('Not Found', { status: 404 });
  }

  matchRoute(pathname, pattern) {
    if (pattern.includes('*')) {
      const regex = pattern.replace(/\\*/g, '.*');
      if (new RegExp('^' + regex + '$').test(pathname)) {
        return { params: {} };
      }
    }
    
    const patternParts = pattern.split('/');
    const pathParts = pathname.split('/');
    
    if (patternParts.length !== pathParts.length) return null;
    
    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        return null;
      }
    }
    
    return { params };
  }
}
`.trim();

    await fs.writeFile(path.join(workerPath, 'router.js'), routerCode);
  }

  /**
   * Create static asset handler
   */
  async createStaticHandler(workerPath) {
    const handlerCode = `
import manifest from '../assets-manifest.json';

export async function serveStatic(request, env, ctx, fallbackPath) {
  const url = new URL(request.url);
  const pathname = fallbackPath || url.pathname;
  
  // Check if asset exists in manifest
  const assetPath = pathname.replace(/^\\//, '');
  const asset = manifest[assetPath];
  
  if (!asset) {
    return new Response('Not Found', { status: 404 });
  }
  
  // Fetch from KV or R2 storage
  const content = await env.ASSETS.get(asset.key);
  
  if (!content) {
    return new Response('Not Found', { status: 404 });
  }
  
  // Set appropriate headers
  const headers = new Headers({
    'content-type': asset.type || 'text/plain',
    'cache-control': asset.immutable 
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=3600',
    'etag': asset.hash
  });
  
  return new Response(content, { headers });
}
`.trim();

    await fs.writeFile(path.join(workerPath, 'static-handler.js'), handlerCode);
  }

  /**
   * Create SSR handler
   */
  async createSSRHandler(workerPath) {
    const handlerCode = `
export async function handleSSR(component, request, env, ctx) {
  try {
    const url = new URL(request.url);
    
    // Import and render component
    const { render } = await import(\`./ssr/\${component}.js\`);
    
    const { html, headers } = await render({
      url: url.href,
      params: request.params || {},
      headers: Object.fromEntries(request.headers.entries()),
      method: request.method,
      env,
      ctx
    });
    
    return new Response(html, {
      headers: {
        'content-type': 'text/html;charset=UTF-8',
        ...headers
      }
    });
  } catch (error) {
    console.error('SSR Error:', error);
    throw error;
  }
}
`.trim();

    await fs.writeFile(path.join(workerPath, 'ssr-handler.js'), handlerCode);
  }

  /**
   * Create route handlers for SSR
   */
  async createRouteHandlers(workerPath, routes) {
    const routesCode = `
import { handleSSR } from './ssr-handler.js';

export function setupSSRRoutes(router) {
${routes.map(route => `  router.get('${route.pattern}', (req, env, ctx) => handleSSR('${route.component}', req, env, ctx));`).join('\n')}
}
`.trim();

    await fs.writeFile(path.join(workerPath, 'routes.js'), routesCode);

    // Create SSR component modules
    const ssrPath = path.join(workerPath, 'ssr');
    await fs.ensureDir(ssrPath);

    // Copy SSR components from build
    for (const route of routes) {
      const componentPath = path.join(this.buildDir, 'ssr', `${route.component}.js`);
      if (await fs.pathExists(componentPath)) {
        await fs.copy(
          componentPath,
          path.join(ssrPath, `${route.component}.js`)
        );
      }
    }
  }

  /**
   * Generate Cloudflare wrangler configuration
   */
  async generateConfig(outputPath) {
    const config = {
      name: 'eghact-app',
      main: 'worker/index.js',
      compatibility_date: '2023-12-01',
      compatibility_flags: ['nodejs_compat'],
      
      // KV namespace for static assets
      kv_namespaces: [
        {
          binding: 'ASSETS',
          id: 'YOUR_KV_NAMESPACE_ID',
          preview_id: 'YOUR_PREVIEW_KV_ID'
        }
      ],
      
      // Build configuration
      build: {
        command: '',
        cwd: '.',
        watch_paths: ['worker']
      },
      
      // Routes
      routes: [
        {
          pattern: 'your-domain.com/*',
          zone_name: 'your-domain.com'
        }
      ],
      
      // Environment variables
      vars: {
        ENVIRONMENT: 'production'
      }
    };

    // Write wrangler.toml
    const tomlContent = this.objectToToml(config);
    await fs.writeFile(
      path.join(outputPath, 'wrangler.toml'),
      tomlContent
    );

    // Create assets manifest
    const assets = await this.createAssetsManifest(outputPath);
    await fs.writeJson(
      path.join(outputPath, 'assets-manifest.json'),
      assets,
      { spaces: 2 }
    );

    console.log('📄 Generated wrangler.toml configuration');
    return config;
  }

  /**
   * Create wrangler configuration
   */
  async createWranglerConfig(outputPath) {
    // Create upload script for assets
    const uploadScript = `#!/bin/bash
# Upload static assets to Cloudflare KV

echo "📤 Uploading assets to Cloudflare KV..."

# Upload each asset
for file in assets/*; do
  if [ -f "$file" ]; then
    key=$(basename "$file")
    wrangler kv:key put --binding=ASSETS "$key" --path="$file"
  fi
done

echo "✅ Assets uploaded successfully"
`.trim();

    await fs.writeFile(
      path.join(outputPath, 'upload-assets.sh'),
      uploadScript,
      { mode: 0o755 }
    );

    // Create .gitignore
    const gitignoreContent = `
# Cloudflare
.wrangler/
dist/
node_modules/
.env*
    `.trim();

    await fs.writeFile(
      path.join(outputPath, '.gitignore'),
      gitignoreContent
    );
  }

  /**
   * Create assets manifest for KV storage
   */
  async createAssetsManifest(outputPath) {
    const assetsPath = path.join(outputPath, this.assetsDir);
    const files = await glob('**/*', {
      cwd: assetsPath,
      nodir: true
    });

    const manifest = {};
    
    for (const file of files) {
      const filePath = path.join(assetsPath, file);
      const stat = await fs.stat(filePath);
      const content = await fs.readFile(filePath);
      
      manifest[file] = {
        key: file,
        size: stat.size,
        type: this.getMimeType(file),
        hash: this.generateHash(content),
        immutable: file.includes('.') && !file.endsWith('.html')
      };
    }

    return manifest;
  }

  /**
   * Convert object to TOML format
   */
  objectToToml(obj, depth = 0) {
    let toml = '';
    const indent = '  '.repeat(depth);
    
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        value.forEach(item => {
          toml += `\n${indent}[[${key}]]\n`;
          toml += this.objectToToml(item, depth + 1);
        });
      } else if (typeof value === 'object') {
        toml += `\n${indent}[${key}]\n`;
        toml += this.objectToToml(value, depth + 1);
      } else {
        toml += `${indent}${key} = ${JSON.stringify(value)}\n`;
      }
    }
    
    return toml;
  }

  /**
   * Get MIME type for file
   */
  getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const types = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };
    return types[ext] || 'application/octet-stream';
  }

  /**
   * Generate hash for content
   */
  generateHash(content) {
    // Simple hash for demo - use crypto in production
    return Buffer.from(content).toString('base64').slice(0, 8);
  }

  /**
   * Get deployment instructions
   */
  getInstructions() {
    return `
🚀 Cloudflare Workers Deployment Instructions:

1. Install Wrangler CLI (if not already installed):
   npm i -g wrangler

2. Navigate to the deployment directory:
   cd ${this.outputDir}

3. Configure your Cloudflare account:
   wrangler login

4. Update wrangler.toml:
   - Set your KV namespace ID
   - Update route patterns with your domain
   - Configure environment variables

5. Upload static assets to KV:
   ./upload-assets.sh

6. Deploy to Cloudflare Workers:
   wrangler deploy

7. Your app will be available at:
   https://your-worker.your-subdomain.workers.dev

📝 Additional Options:
- Preview deployment: wrangler dev
- Tail logs: wrangler tail
- Custom domain: Configure in Cloudflare dashboard
- Environment variables: Update in wrangler.toml

⚡ Edge Features:
- Global distribution across 200+ cities
- Zero cold starts
- Automatic SSL/TLS
- DDoS protection included
- WebSocket support
    `.trim();
  }
}

// Export default adapter instance
export default function cloudflareAdapter(options) {
  return new CloudflareAdapter(options);
}
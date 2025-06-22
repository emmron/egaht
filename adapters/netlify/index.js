/**
 * Netlify Adapter for Eghact
 * Zero-configuration deployment to Netlify with Edge Functions
 */

import { BaseAdapter } from '@eghact/adapter-base';
import fs from 'fs-extra';
import path from 'path';

export class NetlifyAdapter extends BaseAdapter {
  constructor(options = {}) {
    super({
      ...options,
      platform: 'netlify'
    });
    this.name = '@eghact/adapter-netlify';
    this.functionsDir = 'netlify/functions';
    this.edgeDir = 'netlify/edge-functions';
    this.publishDir = 'dist';
  }

  /**
   * Transform build output for Netlify deployment
   */
  async transform(outputPath) {
    console.log('🔄 Transforming build for Netlify...');

    // Create Netlify directory structure
    const functionsPath = path.join(outputPath, this.functionsDir);
    const edgePath = path.join(outputPath, this.edgeDir);
    const distPath = path.join(outputPath, this.publishDir);
    
    await fs.ensureDir(functionsPath);
    await fs.ensureDir(edgePath);
    await fs.ensureDir(distPath);

    // Copy static assets to publish directory
    await this.copyStaticAssets(distPath);

    // Extract and transform SSR routes
    const ssrRoutes = await this.extractServerRoutes();
    
    if (ssrRoutes.length > 0) {
      console.log(`🔧 Creating ${ssrRoutes.length} edge functions...`);
      await this.createEdgeFunctions(edgePath, ssrRoutes);
    }

    // Create Netlify configuration files
    await this.createNetlifyConfig(outputPath);
    await this.createRedirects(outputPath, ssrRoutes);

    console.log('✅ Netlify transformation complete');
  }

  /**
   * Create edge functions for SSR routes
   */
  async createEdgeFunctions(edgePath, routes) {
    for (const route of routes) {
      const functionName = this.routeToFunctionName(route.path);
      const functionPath = path.join(edgePath, `${functionName}.js`);
      
      const functionCode = `
import { render } from '../../dist/ssr/${route.component}.js';

export default async (request, context) => {
  try {
    const url = new URL(request.url);
    
    // Extract params from URL
    const params = extractParams(url.pathname, '${route.pattern}');
    
    // Server-side render the component
    const { html, headers } = await render({
      url: url.href,
      params,
      headers: Object.fromEntries(request.headers.entries()),
      method: request.method,
      context: context.geo // Netlify geo data
    });

    // Return HTML response with headers
    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html;charset=UTF-8',
        ...headers
      }
    });
  } catch (error) {
    console.error('SSR Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal Server Error',
        message: context.dev ? error.message : undefined
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' }
      }
    );
  }
};

export const config = {
  path: "${route.pattern}"
};

function extractParams(pathname, pattern) {
  // Simple param extraction for dynamic routes
  const params = {};
  const patternParts = pattern.split('/');
  const pathParts = pathname.split('/');
  
  patternParts.forEach((part, i) => {
    if (part.startsWith('[') && part.endsWith(']')) {
      const paramName = part.slice(1, -1);
      params[paramName] = pathParts[i];
    }
  });
  
  return params;
}
`.trim();

      await fs.writeFile(functionPath, functionCode);
    }
  }

  /**
   * Convert route path to function name
   */
  routeToFunctionName(routePath) {
    return routePath
      .replace(/^\//, '')
      .replace(/\//g, '-')
      .replace(/\[([^\]]+)\]/g, '$1');
  }

  /**
   * Generate Netlify configuration
   */
  async generateConfig(outputPath) {
    const config = {
      build: {
        publish: this.publishDir,
        edge_functions: this.edgeDir
      },
      functions: {
        included_files: ["dist/**"]
      },
      headers: [
        {
          for: "/assets/*",
          values: {
            "Cache-Control": "public, max-age=31536000, immutable"
          }
        },
        {
          for: "/*.js",
          values: {
            "Cache-Control": "public, max-age=3600"
          }
        }
      ]
    };

    // Write netlify.toml
    const tomlContent = this.objectToToml(config);
    const configPath = path.join(outputPath, 'netlify.toml');
    await fs.writeFile(configPath, tomlContent);

    console.log('📄 Generated netlify.toml configuration');
    return config;
  }

  /**
   * Convert object to TOML format
   */
  objectToToml(obj, prefix = '') {
    let toml = '';
    
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (Array.isArray(value)) {
        value.forEach(item => {
          toml += `\n[[${fullKey}]]\n`;
          if (typeof item === 'object') {
            toml += this.objectToToml(item, '');
          }
        });
      } else if (typeof value === 'object') {
        toml += `\n[${fullKey}]\n`;
        toml += this.objectToToml(value, '');
      } else {
        toml += `${key} = ${JSON.stringify(value)}\n`;
      }
    }
    
    return toml;
  }

  /**
   * Create _redirects file for client-side routing
   */
  async createRedirects(outputPath, ssrRoutes) {
    let redirects = '';
    
    // Add SSR routes
    ssrRoutes.forEach(route => {
      const pattern = route.pattern.replace(/\[([^\]]+)\]/g, ':$1');
      redirects += `${pattern} /.netlify/edge-functions/${this.routeToFunctionName(route.path)} 200\n`;
    });
    
    // Add static asset rules
    redirects += '/assets/* /assets/:splat 200\n';
    
    // Add SPA fallback
    redirects += '/* /index.html 200\n';
    
    await fs.writeFile(
      path.join(outputPath, this.publishDir, '_redirects'),
      redirects
    );
    
    console.log('📄 Generated _redirects file');
  }

  /**
   * Create additional Netlify-specific files
   */
  async createNetlifyConfig(outputPath) {
    // Create .gitignore
    const gitignoreContent = `
# Netlify
.netlify
netlify/functions/
netlify/edge-functions/

# Dependencies
node_modules/

# Build output
dist/
.eghact-deploy/

# Environment
.env*
    `.trim();

    await fs.writeFile(
      path.join(outputPath, '.gitignore'),
      gitignoreContent
    );

    // Create package.json for functions
    const packageJson = {
      name: "eghact-netlify-deployment",
      version: "1.0.0",
      private: true,
      type: "module",
      dependencies: {
        "@eghact/runtime": "file:../../runtime"
      }
    };

    await fs.writeJson(
      path.join(outputPath, 'package.json'),
      packageJson,
      { spaces: 2 }
    );
  }

  /**
   * Get deployment instructions
   */
  getInstructions() {
    return `
🚀 Netlify Deployment Instructions:

1. Install Netlify CLI (if not already installed):
   npm i -g netlify-cli

2. Navigate to the deployment directory:
   cd ${this.outputDir}

3. Initialize Netlify site:
   netlify init

4. Deploy to Netlify:
   netlify deploy

5. For production deployment:
   netlify deploy --prod

6. Your app will be available at:
   https://your-site.netlify.app

📝 Additional Options:
- Custom domain: Configure in Netlify dashboard
- Environment variables: netlify env:set KEY value
- Edge function logs: netlify functions:log

⚡ Features Enabled:
- Edge Functions for SSR routes
- Automatic HTTPS
- Global CDN distribution
- Instant cache invalidation
- Branch previews
    `.trim();
  }
}

// Export default adapter instance
export default function netlifyAdapter(options) {
  return new NetlifyAdapter(options);
}
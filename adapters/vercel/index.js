/**
 * Vercel Adapter for Eghact
 * Zero-configuration deployment to Vercel platform
 */

import { BaseAdapter } from '@eghact/adapter-base';
import fs from 'fs-extra';
import path from 'path';

export class VercelAdapter extends BaseAdapter {
  constructor(options = {}) {
    super({
      ...options,
      platform: 'vercel'
    });
    this.name = '@eghact/adapter-vercel';
    this.functionsDir = 'api';
    this.publicDir = 'public';
  }

  /**
   * Transform build output for Vercel deployment
   */
  async transform(outputPath) {
    console.log('🔄 Transforming build for Vercel...');

    // Create Vercel directory structure
    const publicPath = path.join(outputPath, this.publicDir);
    const apiPath = path.join(outputPath, this.functionsDir);
    
    await fs.ensureDir(publicPath);
    await fs.ensureDir(apiPath);

    // Copy static assets to public directory
    await this.copyStaticAssets(publicPath);

    // Extract and transform SSR routes
    const ssrRoutes = await this.extractServerRoutes();
    
    if (ssrRoutes.length > 0) {
      console.log(`🔧 Creating ${ssrRoutes.length} serverless functions...`);
      await this.createServerlessFunctions(apiPath, ssrRoutes);
    }

    // Create Vercel configuration
    await this.createVercelConfig(outputPath);

    console.log('✅ Vercel transformation complete');
  }

  /**
   * Create serverless functions for SSR routes
   */
  async createServerlessFunctions(apiPath, routes) {
    for (const route of routes) {
      const functionName = this.routeToFunctionName(route.path);
      const functionPath = path.join(apiPath, `${functionName}.js`);
      
      const functionCode = `
import { render } from '../../dist/ssr/${route.component}.js';

export default async function handler(req, res) {
  try {
    // Extract params from URL
    const params = extractParams(req.url, '${route.pattern}');
    
    // Server-side render the component
    const { html, headers } = await render({
      url: req.url,
      params,
      headers: req.headers,
      method: req.method
    });

    // Set response headers
    Object.entries(headers || {}).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Send HTML response
    res.status(200).send(html);
  } catch (error) {
    console.error('SSR Error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

function extractParams(url, pattern) {
  // Simple param extraction (implement based on your routing logic)
  const params = {};
  // ... param extraction logic ...
  return params;
}
`.trim();

      await fs.writeFile(functionPath, functionCode);
    }
  }

  /**
   * Convert route path to Vercel function name
   */
  routeToFunctionName(routePath) {
    // Convert /users/[id] to users-[id]
    return routePath
      .replace(/^\//, '')
      .replace(/\//g, '-')
      .replace(/\[([^\]]+)\]/g, '[$1]');
  }

  /**
   * Generate Vercel configuration
   */
  async generateConfig(outputPath) {
    const config = {
      version: 2,
      builds: [
        {
          src: "public/**",
          use: "@vercel/static"
        }
      ],
      routes: [
        // API routes
        {
          src: "/api/(.*)",
          dest: "/api/$1"
        },
        // Static assets
        {
          src: "/assets/(.*)",
          dest: "/public/assets/$1",
          headers: {
            "cache-control": "public, max-age=31536000, immutable"
          }
        },
        // Client-side routing fallback
        {
          src: "/(.*)",
          dest: "/public/index.html"
        }
      ],
      functions: {
        "api/**/*.js": {
          runtime: "nodejs18.x",
          maxDuration: 10
        }
      }
    };

    // Add SSR routes to config
    const ssrRoutes = await this.extractServerRoutes();
    if (ssrRoutes.length > 0) {
      // Insert SSR routes before client-side fallback
      const ssrRouteConfigs = ssrRoutes.map(route => ({
        src: route.pattern.replace(/\[([^\]]+)\]/g, '(?<$1>[^/]+)'),
        dest: `/api/${this.routeToFunctionName(route.path)}`
      }));
      
      config.routes.splice(-1, 0, ...ssrRouteConfigs);
    }

    const configPath = path.join(outputPath, 'vercel.json');
    await fs.writeJson(configPath, config, { spaces: 2 });

    console.log('📄 Generated vercel.json configuration');
    return config;
  }

  /**
   * Create additional Vercel-specific files
   */
  async createVercelConfig(outputPath) {
    // Create .vercelignore
    const ignoreContent = `
node_modules
.git
.gitignore
README.md
.env*
dist
src
    `.trim();

    await fs.writeFile(
      path.join(outputPath, '.vercelignore'),
      ignoreContent
    );

    // Create package.json for Vercel Functions
    const packageJson = {
      name: "eghact-vercel-deployment",
      version: "1.0.0",
      private: true,
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
🚀 Vercel Deployment Instructions:

1. Install Vercel CLI (if not already installed):
   npm i -g vercel

2. Navigate to the deployment directory:
   cd ${this.outputDir}

3. Deploy to Vercel:
   vercel

4. Follow the prompts:
   - Link to existing project or create new
   - Confirm deployment settings
   - Wait for deployment to complete

5. Your app will be available at:
   https://your-project.vercel.app

📝 Additional Options:
- Production deployment: vercel --prod
- Custom domain: Configure in Vercel dashboard
- Environment variables: Set in Vercel dashboard
    `.trim();
  }
}

// Export default adapter instance
export default function vercelAdapter(options) {
  return new VercelAdapter(options);
}
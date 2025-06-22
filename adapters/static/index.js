/**
 * Static Export Adapter for Eghact
 * Generate static HTML/CSS/JS files for traditional hosting
 */

import { BaseAdapter } from '@eghact/adapter-base';
import fs from 'fs-extra';
import path from 'path';

export class StaticAdapter extends BaseAdapter {
  constructor(options = {}) {
    super({
      ...options,
      platform: 'static'
    });
    this.name = '@eghact/adapter-static';
    this.prerender = options.prerender !== false;
    this.fallback = options.fallback || '404.html';
  }

  /**
   * Transform build output for static hosting
   */
  async transform(outputPath) {
    console.log('🔄 Transforming build for static export...');

    // Copy all static assets
    const buildPath = path.resolve(this.buildDir);
    await fs.copy(buildPath, outputPath);

    if (this.prerender) {
      console.log('📄 Pre-rendering routes...');
      await this.prerenderRoutes(outputPath);
    }

    // Create fallback page for client-side routing
    await this.createFallbackPage(outputPath);

    // Optimize assets
    await this.optimizeAssets(outputPath);

    // Generate hosting configurations
    await this.generateHostingConfigs(outputPath);

    console.log('✅ Static export complete');
  }

  /**
   * Pre-render all routes to static HTML
   */
  async prerenderRoutes(outputPath) {
    const ssrRoutes = await this.extractServerRoutes();
    
    if (ssrRoutes.length === 0) {
      console.log('ℹ️  No SSR routes found, skipping pre-rendering');
      return;
    }

    // Get dynamic route parameters
    const routeParams = await this.getRouteParams();

    for (const route of ssrRoutes) {
      if (route.dynamic) {
        // Pre-render dynamic routes with provided params
        const params = routeParams[route.path] || [];
        for (const paramSet of params) {
          await this.prerenderRoute(outputPath, route, paramSet);
        }
      } else {
        // Pre-render static routes
        await this.prerenderRoute(outputPath, route);
      }
    }

    console.log(`✅ Pre-rendered ${ssrRoutes.length} routes`);
  }

  /**
   * Pre-render a single route
   */
  async prerenderRoute(outputPath, route, params = {}) {
    try {
      // Import and render the route component
      const componentPath = path.join(this.buildDir, 'ssr', `${route.component}.js`);
      
      if (!await fs.pathExists(componentPath)) {
        console.warn(`⚠️  Component not found: ${route.component}`);
        return;
      }

      const { render } = await import(componentPath);
      
      // Render to HTML
      const { html } = await render({
        url: this.buildRouteUrl(route.path, params),
        params,
        isStatic: true
      });

      // Determine output path
      const htmlPath = this.getHtmlPath(route.path, params);
      const fullPath = path.join(outputPath, htmlPath);

      // Ensure directory exists
      await fs.ensureDir(path.dirname(fullPath));

      // Write HTML file
      await fs.writeFile(fullPath, html);

      console.log(`  ✓ ${htmlPath}`);
    } catch (error) {
      console.error(`  ✗ Failed to pre-render ${route.path}:`, error.message);
    }
  }

  /**
   * Build URL from route path and params
   */
  buildRouteUrl(routePath, params) {
    let url = routePath;
    
    for (const [key, value] of Object.entries(params)) {
      url = url.replace(`[${key}]`, value);
    }
    
    return url;
  }

  /**
   * Get HTML file path for a route
   */
  getHtmlPath(routePath, params) {
    let htmlPath = routePath;
    
    // Replace dynamic segments
    for (const [key, value] of Object.entries(params)) {
      htmlPath = htmlPath.replace(`[${key}]`, value);
    }
    
    // Convert to file path
    if (htmlPath === '/') {
      return 'index.html';
    }
    
    // Remove leading slash and add index.html
    htmlPath = htmlPath.replace(/^\//, '');
    
    if (!htmlPath.endsWith('.html')) {
      htmlPath = path.join(htmlPath, 'index.html');
    }
    
    return htmlPath;
  }

  /**
   * Get route parameters for dynamic routes
   */
  async getRouteParams() {
    const paramsFile = path.join(this.buildDir, 'route-params.json');
    
    if (await fs.pathExists(paramsFile)) {
      return await fs.readJson(paramsFile);
    }
    
    // Default params for common patterns
    return {
      '/blog/[slug]': [
        { slug: 'hello-world' },
        { slug: 'getting-started' }
      ],
      '/users/[id]': [
        { id: '1' },
        { id: '2' }
      ]
    };
  }

  /**
   * Create fallback page for client-side routing
   */
  async createFallbackPage(outputPath) {
    const indexPath = path.join(outputPath, 'index.html');
    const fallbackPath = path.join(outputPath, this.fallback);
    
    if (await fs.pathExists(indexPath)) {
      await fs.copy(indexPath, fallbackPath);
      console.log(`📄 Created fallback page: ${this.fallback}`);
    }
  }

  /**
   * Optimize static assets
   */
  async optimizeAssets(outputPath) {
    // Set cache headers in .htaccess for Apache
    const htaccessContent = `
# Enable compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css text/javascript application/javascript application/json image/svg+xml
</IfModule>

# Set cache headers
<IfModule mod_expires.c>
  ExpiresActive On
  
  # HTML files - no cache
  ExpiresByType text/html "access plus 0 seconds"
  
  # Static assets - 1 year cache
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/gif "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType font/woff2 "access plus 1 year"
</IfModule>

# Handle client-side routing
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  
  # Don't rewrite files or directories
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  
  # Rewrite everything else to index.html
  RewriteRule . /index.html [L]
</IfModule>
`.trim();

    await fs.writeFile(
      path.join(outputPath, '.htaccess'),
      htaccessContent
    );
  }

  /**
   * Generate platform-specific configurations
   */
  async generateConfig(outputPath) {
    // Create configurations for various hosting platforms
    
    // _redirects for Netlify/Vercel (basic static hosting)
    const redirectsContent = `
# Fallback for client-side routing
/*    /index.html   200
    `.trim();

    await fs.writeFile(
      path.join(outputPath, '_redirects'),
      redirectsContent
    );

    // nginx.conf sample
    const nginxConfig = `
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/eghact;
    index index.html;

    # Compression
    gzip on;
    gzip_types text/plain text/css text/javascript application/javascript application/json image/svg+xml;

    # Cache static assets
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Handle client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
`.trim();

    await fs.writeFile(
      path.join(outputPath, 'nginx.conf.sample'),
      nginxConfig
    );

    // Create deployment guide
    await this.createDeploymentGuide(outputPath);

    return {
      files: await this.listFiles(outputPath),
      size: await this.calculateSize(outputPath)
    };
  }

  /**
   * List all files in output
   */
  async listFiles(dir) {
    const files = [];
    
    async function walk(currentDir) {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.relative(dir, fullPath);
        
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          files.push(relativePath);
        }
      }
    }
    
    await walk(dir);
    return files;
  }

  /**
   * Calculate total size of output
   */
  async calculateSize(dir) {
    let totalSize = 0;
    
    async function walk(currentDir) {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          const stat = await fs.stat(fullPath);
          totalSize += stat.size;
        }
      }
    }
    
    await walk(dir);
    return totalSize;
  }

  /**
   * Create deployment guide
   */
  async createDeploymentGuide(outputPath) {
    const guideContent = `
# Static Deployment Guide

Your Eghact app has been exported as static files and can be deployed to any web server.

## Quick Deploy Options

### GitHub Pages
1. Push the contents of this directory to a GitHub repository
2. Enable GitHub Pages in repository settings
3. Select the branch and root directory

### Netlify Drop
1. Visit https://app.netlify.com/drop
2. Drag and drop this folder
3. Your site will be live instantly

### Surge.sh
1. Install surge: npm install -g surge
2. Run: surge ${this.outputDir}
3. Follow the prompts

### Traditional Web Hosting
1. Upload all files via FTP/SFTP
2. Ensure .htaccess is uploaded (for Apache)
3. Set document root to this directory

## Advanced Deployment

### Nginx
See nginx.conf.sample for configuration

### Apache
.htaccess is already configured for:
- Client-side routing
- Compression
- Cache headers

### CDN Setup
1. Upload files to your CDN
2. Set index.html as default document
3. Configure 404 fallback to index.html

## Files Generated
- index.html - Main entry point
- ${this.fallback} - 404 fallback for routing
- .htaccess - Apache configuration
- _redirects - Netlify/Vercel redirects
- nginx.conf.sample - Nginx configuration
`.trim();

    await fs.writeFile(
      path.join(outputPath, 'DEPLOYMENT.md'),
      guideContent
    );
  }

  /**
   * Get deployment instructions
   */
  getInstructions() {
    return `
🚀 Static Export Complete!

Your Eghact app has been exported as static files ready for deployment anywhere.

📁 Output: ${this.outputDir}

Quick deployment options:

1. **Netlify Drop**:
   - Visit https://app.netlify.com/drop
   - Drag and drop the ${this.outputDir} folder

2. **Surge.sh**:
   npm install -g surge
   surge ${this.outputDir}

3. **GitHub Pages**:
   - Push to GitHub repository
   - Enable Pages in settings

4. **Any Web Server**:
   - Upload all files via FTP
   - Done! No server configuration needed

📝 See DEPLOYMENT.md for detailed instructions

✨ Features included:
- Pre-rendered routes for SEO
- Client-side routing support
- Optimized cache headers
- Fallback page for SPAs
- Platform-specific configs
    `.trim();
  }
}

// Export default adapter instance
export default function staticAdapter(options) {
  return new StaticAdapter(options);
}
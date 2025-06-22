import fs from 'fs/promises';
import path from 'path';
import { SSRRenderer } from './ssr-renderer.js';

export class StaticGenerator {
  constructor(config = {}) {
    this.config = {
      outDir: 'dist',
      routes: [],
      baseUrl: '',
      ...config
    };
    this.renderer = new SSRRenderer(config.runtime, config.compiler);
    this.routeMap = new Map();
    this.generatedFiles = new Set();
  }

  async generateSite(options = {}) {
    const startTime = Date.now();
    console.log('🏗️  Starting static site generation...');

    try {
      // Clean output directory
      await this.cleanOutputDir();

      // Discover all routes
      const routes = await this.discoverRoutes();
      console.log(`📊 Found ${routes.length} routes to generate`);

      // Generate pages in parallel batches
      await this.generatePagesInBatches(routes, options.batchSize || 10);

      // Copy static assets
      await this.copyStaticAssets();

      // Generate sitemap and robots.txt
      await this.generateSitemap(routes);
      await this.generateRobotsTxt();

      // Generate build manifest
      await this.generateBuildManifest(routes);

      const duration = Date.now() - startTime;
      console.log(`✅ Static generation complete in ${duration}ms`);
      console.log(`📦 Generated ${this.generatedFiles.size} files`);

      return {
        success: true,
        routes: routes.length,
        files: this.generatedFiles.size,
        duration
      };
    } catch (error) {
      console.error('❌ Static generation failed:', error);
      throw error;
    }
  }

  async discoverRoutes() {
    const routes = [];
    
    // Add static routes from config
    routes.push(...(this.config.routes || []));

    // Discover file-based routes
    const fileRoutes = await this.discoverFileRoutes();
    routes.push(...fileRoutes);

    // Generate dynamic routes
    const dynamicRoutes = await this.generateDynamicRoutes();
    routes.push(...dynamicRoutes);

    // Remove duplicates and validate
    const uniqueRoutes = [...new Set(routes)].filter(route => route && typeof route === 'string');
    
    return uniqueRoutes.map(route => ({
      path: route,
      outputPath: this.getOutputPath(route),
      isDynamic: route.includes('[') || route.includes('*'),
      priority: this.getRoutePriority(route)
    }));
  }

  async discoverFileRoutes() {
    const routes = [];
    const srcDir = path.join(process.cwd(), 'src/routes');
    
    try {
      const files = await this.walkDirectory(srcDir);
      
      for (const file of files) {
        if (file.endsWith('.egh')) {
          const relativePath = path.relative(srcDir, file);
          const route = this.filePathToRoute(relativePath);
          routes.push(route);
        }
      }
    } catch (error) {
      console.warn('No routes directory found, skipping file-based route discovery');
    }

    return routes;
  }

  async generateDynamicRoutes() {
    const dynamicRoutes = [];
    
    // Find routes with dynamic segments like [slug] or [...path]
    for (const route of this.config.routes || []) {
      if (route.includes('[')) {
        const generatedPaths = await this.generatePathsForDynamicRoute(route);
        dynamicRoutes.push(...generatedPaths);
      }
    }

    return dynamicRoutes;
  }

  async generatePathsForDynamicRoute(routePattern) {
    // Extract parameter names from route pattern
    const paramMatches = routePattern.match(/\[([^\]]+)\]/g);
    if (!paramMatches) return [routePattern];

    // Call user-defined getStaticPaths function if available
    const routeFile = this.findRouteFile(routePattern);
    if (routeFile) {
      try {
        const module = await import(routeFile);
        if (module.getStaticPaths) {
          const { paths } = await module.getStaticPaths();
          return paths.map(pathData => {
            let resolvedPath = routePattern;
            Object.entries(pathData.params || {}).forEach(([key, value]) => {
              resolvedPath = resolvedPath.replace(`[${key}]`, value);
            });
            return resolvedPath;
          });
        }
      } catch (error) {
        console.warn(`Could not load getStaticPaths for ${routePattern}:`, error.message);
      }
    }

    return [routePattern];
  }

  async generatePagesInBatches(routes, batchSize = 10) {
    // Sort routes by priority (static first, then dynamic)
    routes.sort((a, b) => b.priority - a.priority);

    for (let i = 0; i < routes.length; i += batchSize) {
      const batch = routes.slice(i, i + batchSize);
      const batchPromises = batch.map(route => this.generatePage(route));
      
      try {
        await Promise.all(batchPromises);
        console.log(`📄 Generated batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(routes.length / batchSize)}`);
      } catch (error) {
        console.error(`❌ Batch generation failed:`, error);
        // Continue with remaining batches
      }
    }
  }

  async generatePage(route) {
    try {
      const context = {
        url: route.path,
        params: this.extractParams(route.path),
        query: {},
        isStatic: true,
        buildTime: new Date().toISOString()
      };

      // Find and load the component
      const component = await this.findComponent(route.path);
      if (!component) {
        console.warn(`⚠️  No component found for route: ${route.path}`);
        return;
      }

      // Render the page
      const renderResult = await this.renderer.renderToHTML(component, {}, context);
      
      // Extract and inline critical CSS
      const criticalCSS = await this.extractCriticalCSS(renderResult.html);
      
      // Optimize the HTML
      const optimizedHTML = await this.optimizeHTML(renderResult.html, {
        criticalCSS,
        route: route.path,
        meta: renderResult.meta
      });

      // Write to output directory
      await this.writePageToDisk(route, optimizedHTML);

      // Generate additional assets if needed
      await this.generatePageAssets(route, renderResult);

      this.generatedFiles.add(route.outputPath);
      
    } catch (error) {
      console.error(`❌ Failed to generate page ${route.path}:`, error);
      throw error;
    }
  }

  async findComponent(routePath) {
    const routeFile = this.findRouteFile(routePath);
    if (routeFile) {
      return { path: routeFile, route: routePath };
    }
    return null;
  }

  findRouteFile(routePath) {
    const possiblePaths = [
      path.join(process.cwd(), 'src/routes', routePath, 'index.egh'),
      path.join(process.cwd(), 'src/routes', routePath + '.egh'),
      path.join(process.cwd(), 'src/routes', routePath, '+page.egh')
    ];

    for (const filePath of possiblePaths) {
      try {
        if (fs.access(filePath)) {
          return filePath;
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  async extractCriticalCSS(html) {
    // Extract critical CSS for above-the-fold content
    // This is a simplified implementation - in production you'd use tools like Puppeteer
    const criticalSelectors = [
      'body', 'html', 'h1', 'h2', 'h3', 'p', 'header', 'nav', '.hero', '.above-fold'
    ];

    let criticalCSS = '';
    
    try {
      const cssFiles = await this.findCSSFiles();
      for (const cssFile of cssFiles) {
        const css = await fs.readFile(cssFile, 'utf8');
        const critical = this.extractCriticalRules(css, criticalSelectors);
        criticalCSS += critical;
      }
    } catch (error) {
      console.warn('Could not extract critical CSS:', error.message);
    }

    return criticalCSS;
  }

  extractCriticalRules(css, selectors) {
    // Simple critical CSS extraction - match selectors to rules
    const lines = css.split('\n');
    let critical = '';
    let inRule = false;
    let currentRule = '';

    for (const line of lines) {
      if (line.includes('{')) {
        inRule = true;
        currentRule = line;
      } else if (line.includes('}') && inRule) {
        currentRule += line;
        
        // Check if this rule contains critical selectors
        const isCritical = selectors.some(selector => 
          currentRule.toLowerCase().includes(selector.toLowerCase())
        );
        
        if (isCritical) {
          critical += currentRule + '\n';
        }
        
        inRule = false;
        currentRule = '';
      } else if (inRule) {
        currentRule += line + '\n';
      }
    }

    return critical;
  }

  async optimizeHTML(html, options) {
    let optimized = html;

    // Inline critical CSS
    if (options.criticalCSS) {
      optimized = optimized.replace(
        '</head>',
        `  <style data-critical>${options.criticalCSS}</style>\n</head>`
      );
    }

    // Add resource hints
    const resourceHints = this.generateResourceHints(options.route);
    optimized = optimized.replace('</head>', `${resourceHints}</head>`);

    // Minify HTML in production
    if (process.env.NODE_ENV === 'production') {
      optimized = this.minifyHTML(optimized);
    }

    return optimized;
  }

  generateResourceHints(route) {
    let hints = '';
    
    // Preload critical resources
    hints += '  <link rel="preload" href="/runtime/eghact.js" as="script">\n';
    
    // DNS prefetch for external domains
    const externalDomains = this.config.externalDomains || [];
    externalDomains.forEach(domain => {
      hints += `  <link rel="dns-prefetch" href="//${domain}">\n`;
    });

    return hints;
  }

  minifyHTML(html) {
    return html
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .trim();
  }

  async writePageToDisk(route, html) {
    const outputPath = path.join(this.config.outDir, route.outputPath);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, html, 'utf8');
  }

  async generatePageAssets(route, renderResult) {
    // Generate page-specific assets like critical CSS files
    if (renderResult.criticalCSS) {
      const cssPath = path.join(this.config.outDir, 'assets', `${route.path.replace(/[^a-z0-9]/gi, '-')}.css`);
      await fs.mkdir(path.dirname(cssPath), { recursive: true });
      await fs.writeFile(cssPath, renderResult.criticalCSS, 'utf8');
    }
  }

  async copyStaticAssets() {
    const staticDir = path.join(process.cwd(), 'static');
    const publicDir = path.join(process.cwd(), 'public');
    
    for (const sourceDir of [staticDir, publicDir]) {
      try {
        await this.copyDirectory(sourceDir, this.config.outDir);
      } catch (error) {
        // Directory doesn't exist, skip
      }
    }
  }

  async generateSitemap(routes) {
    const baseUrl = this.config.baseUrl || 'https://example.com';
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map(route => `  <url>
    <loc>${baseUrl}${route.path}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${route.priority / 10}</priority>
  </url>`).join('\n')}
</urlset>`;

    const sitemapPath = path.join(this.config.outDir, 'sitemap.xml');
    await fs.writeFile(sitemapPath, sitemap, 'utf8');
    this.generatedFiles.add('sitemap.xml');
  }

  async generateRobotsTxt() {
    const baseUrl = this.config.baseUrl || 'https://example.com';
    const robots = `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml`;

    const robotsPath = path.join(this.config.outDir, 'robots.txt');
    await fs.writeFile(robotsPath, robots, 'utf8');
    this.generatedFiles.add('robots.txt');
  }

  async generateBuildManifest(routes) {
    const manifest = {
      buildTime: new Date().toISOString(),
      routes: routes.length,
      files: Array.from(this.generatedFiles),
      config: {
        outDir: this.config.outDir,
        baseUrl: this.config.baseUrl
      }
    };

    const manifestPath = path.join(this.config.outDir, 'build-manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  }

  // Utility methods
  
  async cleanOutputDir() {
    try {
      await fs.rm(this.config.outDir, { recursive: true, force: true });
      await fs.mkdir(this.config.outDir, { recursive: true });
    } catch (error) {
      console.warn('Could not clean output directory:', error.message);
    }
  }

  async walkDirectory(dir, fileList = []) {
    try {
      const files = await fs.readdir(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isDirectory()) {
          await this.walkDirectory(filePath, fileList);
        } else {
          fileList.push(filePath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or is not accessible
    }
    
    return fileList;
  }

  async copyDirectory(source, destination) {
    await fs.mkdir(destination, { recursive: true });
    const entries = await fs.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
        this.generatedFiles.add(path.relative(this.config.outDir, destPath));
      }
    }
  }

  async findCSSFiles() {
    const cssFiles = [];
    const dirs = ['src/styles', 'src/css', 'styles', 'css'];
    
    for (const dir of dirs) {
      try {
        const files = await this.walkDirectory(dir);
        cssFiles.push(...files.filter(file => file.endsWith('.css')));
      } catch {
        continue;
      }
    }
    
    return cssFiles;
  }

  filePathToRoute(filePath) {
    return '/' + filePath
      .replace(/\\/g, '/')
      .replace(/\.egh$/, '')
      .replace(/\/index$/, '')
      .replace(/\+page$/, '');
  }

  getOutputPath(routePath) {
    if (routePath === '/') return 'index.html';
    if (routePath.endsWith('/')) return routePath + 'index.html';
    return routePath + '/index.html';
  }

  extractParams(routePath) {
    const params = {};
    const paramMatches = routePath.match(/\[([^\]]+)\]/g);
    
    if (paramMatches) {
      paramMatches.forEach(match => {
        const paramName = match.slice(1, -1);
        params[paramName] = 'static-param';
      });
    }
    
    return params;
  }

  getRoutePriority(route) {
    // Static routes get higher priority than dynamic ones
    if (route.includes('[') || route.includes('*')) return 5;
    if (route === '/') return 10;
    return 8;
  }
}
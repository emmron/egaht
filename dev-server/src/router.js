/**
 * File-based routing system for Eghact
 * Discovers routes from filesystem and generates route manifest
 */

import fs from 'fs/promises';
import path from 'path';
import micromatch from 'micromatch';

export class FileSystemRouter {
  constructor(options = {}) {
    this.routesDir = options.routesDir || 'src/routes';
    this.routeManifest = new Map();
    this.layoutStack = [];
  }

  async discoverRoutes(rootDir) {
    const routesPath = path.join(rootDir, this.routesDir);
    
    try {
      await fs.access(routesPath);
    } catch {
      // Create routes directory if it doesn't exist
      await fs.mkdir(routesPath, { recursive: true });
      
      // Create basic example routes
      await this.createExampleRoutes(routesPath);
    }

    const routes = await this.scanDirectory(routesPath, '');
    await this.generateRouteManifest(routes);
    
    return this.routeManifest;
  }

  async scanDirectory(dirPath, relativePath = '') {
    const routes = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const entryRelativePath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subRoutes = await this.scanDirectory(fullPath, entryRelativePath);
        routes.push(...subRoutes);
      } else if (entry.name.endsWith('.egh')) {
        const route = this.parseRouteFromPath(entryRelativePath);
        if (route) {
          routes.push({
            ...route,
            filePath: fullPath,
            relativePath: entryRelativePath
          });
        }
      }
    }

    return routes;
  }

  parseRouteFromPath(filePath) {
    // Remove .egh extension
    let routePath = filePath.replace(/\.egh$/, '');
    
    // Handle special files
    if (routePath.endsWith('/_layout')) {
      return {
        type: 'layout',
        path: routePath.replace('/_layout', ''),
        pattern: routePath.replace('/_layout', '') + '/*'
      };
    }

    if (routePath.endsWith('/_error')) {
      return {
        type: 'error',
        path: routePath.replace('/_error', ''),
        pattern: routePath.replace('/_error', '') + '/*'
      };
    }

    // Handle index routes
    if (routePath.endsWith('/index')) {
      routePath = routePath.replace('/index', '') || '/';
    }

    // Convert file-system path to route pattern
    const pattern = this.convertToRoutePattern(routePath);
    
    return {
      type: 'page',
      path: routePath === '' ? '/' : routePath,
      pattern,
      params: this.extractParamsFromPattern(pattern)
    };
  }

  convertToRoutePattern(routePath) {
    return routePath
      // Dynamic segments: [id] -> :id
      .replace(/\[([^\]]+)\]/g, ':$1')
      // Catch-all segments: [...rest] -> *rest
      .replace(/\[\.\.\.([^\]]+)\]/g, '*$1')
      // Ensure leading slash
      .replace(/^(?!\/)/, '/');
  }

  extractParamsFromPattern(pattern) {
    const params = [];
    
    // Extract dynamic parameters
    const dynamicMatches = pattern.matchAll(/:(\w+)/g);
    for (const match of dynamicMatches) {
      params.push({
        name: match[1],
        type: 'dynamic'
      });
    }
    
    // Extract catch-all parameters
    const catchAllMatches = pattern.matchAll(/\*(\w+)/g);
    for (const match of catchAllMatches) {
      params.push({
        name: match[1],
        type: 'catchall'
      });
    }
    
    return params;
  }

  async generateRouteManifest(routes) {
    this.routeManifest.clear();
    
    // Group routes by type
    const pages = routes.filter(r => r.type === 'page');
    const layouts = routes.filter(r => r.type === 'layout');
    const errors = routes.filter(r => r.type === 'error');
    
    // Build layout hierarchy
    const layoutHierarchy = this.buildLayoutHierarchy(layouts);
    
    // Generate manifest entries
    for (const page of pages) {
      const matchingLayouts = this.findMatchingLayouts(page.path, layoutHierarchy);
      
      this.routeManifest.set(page.pattern, {
        ...page,
        layouts: matchingLayouts,
        component: this.getComponentImportPath(page.relativePath)
      });
    }
    
    // Add error routes
    for (const error of errors) {
      this.routeManifest.set(`${error.pattern}:error`, {
        ...error,
        component: this.getComponentImportPath(error.relativePath)
      });
    }
  }

  buildLayoutHierarchy(layouts) {
    const hierarchy = new Map();
    
    for (const layout of layouts) {
      const depth = layout.path.split('/').filter(Boolean).length;
      hierarchy.set(layout.path, {
        ...layout,
        depth,
        component: this.getComponentImportPath(layout.relativePath)
      });
    }
    
    return hierarchy;
  }

  findMatchingLayouts(pagePath, layoutHierarchy) {
    const matchingLayouts = [];
    
    for (const [layoutPath, layout] of layoutHierarchy) {
      if (this.pathMatches(pagePath, layoutPath)) {
        matchingLayouts.push(layout);
      }
    }
    
    // Sort by depth (shallowest first)
    return matchingLayouts.sort((a, b) => a.depth - b.depth);
  }

  pathMatches(pagePath, layoutPath) {
    if (layoutPath === '') return true; // Root layout matches all
    return pagePath.startsWith(layoutPath + '/') || pagePath === layoutPath;
  }

  getComponentImportPath(relativePath) {
    return `/${this.routesDir}/${relativePath}`;
  }

  async createExampleRoutes(routesPath) {
    // Create basic route structure
    await fs.writeFile(
      path.join(routesPath, 'index.egh'),
      `<template>
  <div class="home">
    <h1>Welcome to Eghact</h1>
    <p>The revolutionary web framework</p>
    <nav>
      <a href="/about">About</a>
      <a href="/users">Users</a>
    </nav>
  </div>
</template>

<style>
.home {
  text-align: center;
  padding: 2rem;
}

nav a {
  margin: 0 1rem;
  color: #007acc;
  text-decoration: none;
}
</style>`
    );

    await fs.writeFile(
      path.join(routesPath, 'about.egh'),
      `<template>
  <div class="about">
    <h1>About Eghact</h1>
    <p>Compile-time reactivity, zero runtime overhead.</p>
    <a href="/">← Back home</a>
  </div>
</template>

<style>
.about {
  padding: 2rem;
  max-width: 600px;
  margin: 0 auto;
}
</style>`
    );

    // Create users directory with dynamic routes
    await fs.mkdir(path.join(routesPath, 'users'), { recursive: true });
    
    await fs.writeFile(
      path.join(routesPath, 'users', 'index.egh'),
      `<template>
  <div class="users">
    <h1>Users</h1>
    <ul>
      <li><a href="/users/1">User 1</a></li>
      <li><a href="/users/2">User 2</a></li>
    </ul>
    <a href="/">← Back home</a>
  </div>
</template>

<style>
.users {
  padding: 2rem;
}

.users ul {
  list-style: none;
  padding: 0;
}

.users li {
  margin: 0.5rem 0;
}
</style>`
    );

    await fs.writeFile(
      path.join(routesPath, 'users', '[id].egh'),
      `<template>
  <div class="user">
    <h1>User {userId}</h1>
    <p>This is user with ID: {userId}</p>
    <a href="/users">← Back to users</a>
  </div>
</template>

<script>
// Get user ID from route params
const userId = $route.params.id;
</script>

<style>
.user {
  padding: 2rem;
}
</style>`
    );

    // Create root layout
    await fs.writeFile(
      path.join(routesPath, '_layout.egh'),
      `<template>
  <div class="app">
    <header>
      <h1>Eghact App</h1>
    </header>
    <main>
      <slot />
    </main>
    <footer>
      <p>Powered by Eghact Framework</p>
    </footer>
  </div>
</template>

<style>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

header {
  background: #f5f5f5;
  padding: 1rem;
  border-bottom: 1px solid #ddd;
}

main {
  flex: 1;
}

footer {
  background: #f5f5f5;
  padding: 1rem;
  border-top: 1px solid #ddd;
  text-align: center;
  color: #666;
}
</style>`
    );
  }

  // Match route pattern against URL path
  matchRoute(urlPath) {
    for (const [pattern, route] of this.routeManifest) {
      const match = this.matchPattern(pattern, urlPath);
      if (match) {
        return {
          route,
          params: match.params
        };
      }
    }
    return null;
  }

  matchPattern(pattern, path) {
    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/:\w+/g, '([^/]+)')
      .replace(/\*\w+/g, '(.*)');
    
    const regex = new RegExp(`^${regexPattern}$`);
    const match = path.match(regex);
    
    if (!match) return null;
    
    // Extract parameter values
    const params = {};
    const paramNames = [...pattern.matchAll(/:(\w+)|\*(\w+)/g)];
    
    for (let i = 0; i < paramNames.length; i++) {
      const paramName = paramNames[i][1] || paramNames[i][2];
      params[paramName] = match[i + 1];
    }
    
    return { params };
  }

  // Generate client-side router code
  generateClientRouter() {
    const routes = Array.from(this.routeManifest.entries()).map(([pattern, route]) => ({
      pattern,
      component: route.component,
      layouts: route.layouts || [],
      params: route.params || []
    }));

    return `
// Generated router configuration
export const routes = ${JSON.stringify(routes, null, 2)};

export class EghactRouter {
  constructor() {
    this.currentRoute = null;
    this.params = {};
    this.listeners = new Set();
    
    // Bind to browser navigation
    window.addEventListener('popstate', () => this.navigate(location.pathname));
    document.addEventListener('click', this.handleClick.bind(this));
  }
  
  handleClick(event) {
    const link = event.target.closest('a[href]');
    if (link && this.isInternalLink(link.href)) {
      event.preventDefault();
      this.navigate(link.pathname);
    }
  }
  
  isInternalLink(href) {
    return href.startsWith('/') || href.startsWith(location.origin);
  }
  
  navigate(path) {
    const match = this.matchRoute(path);
    if (match) {
      this.currentRoute = match.route;
      this.params = match.params;
      
      // Update browser history
      if (location.pathname !== path) {
        history.pushState({}, '', path);
      }
      
      this.notifyListeners();
      this.renderRoute();
    }
  }
  
  matchRoute(path) {
    for (const route of routes) {
      const match = this.matchPattern(route.pattern, path);
      if (match) {
        return {
          route,
          params: match.params
        };
      }
    }
    return null;
  }
  
  matchPattern(pattern, path) {
    const regexPattern = pattern
      .replace(/:\\w+/g, '([^/]+)')
      .replace(/\\*\\w+/g, '(.*)');
    
    const regex = new RegExp(\`^\${regexPattern}$\`);
    const match = path.match(regex);
    
    if (!match) return null;
    
    const params = {};
    const paramNames = [...pattern.matchAll(/:(\w+)|\\*(\\w+)/g)];
    
    for (let i = 0; i < paramNames.length; i++) {
      const paramName = paramNames[i][1] || paramNames[i][2];
      params[paramName] = match[i + 1];
    }
    
    return { params };
  }
  
  async renderRoute() {
    if (!this.currentRoute) return;
    
    const app = document.getElementById('app');
    if (!app) return;
    
    try {
      // Load and render layouts (outermost first)
      let container = app;
      for (const layout of this.currentRoute.layouts) {
        const layoutModule = await import(layout.component);
        const layoutElement = layoutModule.default();
        
        // Find slot element to render into
        const slot = layoutElement.querySelector('slot') || layoutElement;
        container.appendChild(layoutElement);
        container = slot;
      }
      
      // Load and render the page component
      const pageModule = await import(this.currentRoute.component);
      const pageElement = pageModule.default();
      
      // Inject route params into component
      pageElement.setAttribute('data-route-params', JSON.stringify(this.params));
      
      container.appendChild(pageElement);
    } catch (error) {
      console.error('Failed to render route:', error);
      this.renderError(error);
    }
  }
  
  renderError(error) {
    const app = document.getElementById('app');
    app.innerHTML = \`
      <div class="error">
        <h1>Route Error</h1>
        <p>\${error.message}</p>
      </div>
    \`;
  }
  
  onRouteChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  notifyListeners() {
    for (const listener of this.listeners) {
      listener(this.currentRoute, this.params);
    }
  }
}

// Global router instance
export const router = new EghactRouter();

// Route store for reactive access
export const $route = {
  get current() { return router.currentRoute; },
  get params() { return router.params; },
  get path() { return location.pathname; },
  
  onChange(callback) {
    return router.onRouteChange(callback);
  }
};
`;
  }
}
/**
 * Data loading system for Eghact
 * Handles server-side and client-side data fetching with error boundaries
 */

import fs from 'fs/promises';
import path from 'path';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class DataLoader {
  constructor({ root, cache = new Map() }) {
    this.root = root;
    this.cache = cache;
    this.loadFunctions = new Map();
    this.requestDeduplication = new Map();
  }

  async extractLoadFunction(filePath) {
    if (this.loadFunctions.has(filePath)) {
      return this.loadFunctions.get(filePath);
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);
    
    if (!scriptMatch) {
      this.loadFunctions.set(filePath, null);
      return null;
    }

    const script = scriptMatch[1];
    const loadFunctionMatch = script.match(/export\s+async\s+function\s+load\s*\([^)]*\)\s*{[\s\S]*?}/);
    
    if (!loadFunctionMatch) {
      this.loadFunctions.set(filePath, null);
      return null;
    }

    const loadFunction = loadFunctionMatch[0];
    this.loadFunctions.set(filePath, loadFunction);
    return loadFunction;
  }

  async executeLoadFunction(filePath, context) {
    const loadFunction = await this.extractLoadFunction(filePath);
    if (!loadFunction) {
      return null;
    }

    // Create cache key for deduplication
    const cacheKey = `${filePath}:${JSON.stringify(context.params)}:${context.url}`;
    
    // Check if request is already in progress
    if (this.requestDeduplication.has(cacheKey)) {
      return this.requestDeduplication.get(cacheKey);
    }

    // Execute in isolated context for security
    const promise = this.executeInIsolatedContext(loadFunction, context);
    this.requestDeduplication.set(cacheKey, promise);

    try {
      const result = await promise;
      
      // Cache successful results
      if (result && !result.error) {
        this.cache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
          maxAge: result.cache?.maxAge || 300000 // 5 minutes default
        });
      }
      
      return result;
    } catch (error) {
      throw error;
    } finally {
      this.requestDeduplication.delete(cacheKey);
    }
  }

  async executeInIsolatedContext(loadFunction, context) {
    // Simplified execution for development - in production would use Worker
    try {
      const mockContext = {
        params: context.params || {},
        url: new URL(context.url || 'http://localhost:3000'),
        fetch: async (url, options = {}) => {
          const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
          return fetch(fullUrl, options);
        },
        session: context.session || {},
        cookies: context.cookies || {},
        route: context.route || {}
      };

      // Create a function from the load function string
      const funcBody = loadFunction.replace('export async function load', 'async function load');
      const func = new Function('context', `
        ${funcBody}
        return load(context);
      `);

      return await func(mockContext);
    } catch (error) {
      throw error;
    }
  }

  async loadRouteData(routePath, context) {
    try {
      const filePath = path.join(this.root, 'src/routes', routePath);
      const data = await this.executeLoadFunction(filePath, context);
      
      return {
        success: true,
        data,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          stack: error.stack,
          code: error.code || 'LOAD_ERROR'
        },
        timestamp: Date.now()
      };
    }
  }

  async loadLayoutHierarchy(routePath, context) {
    const layoutPaths = this.getLayoutPaths(routePath);
    const results = await Promise.all(
      layoutPaths.map(async (layoutPath) => {
        const filePath = path.join(this.root, 'src/routes', layoutPath);
        try {
          const data = await this.executeLoadFunction(filePath, context);
          return { path: layoutPath, data, error: null };
        } catch (error) {
          return { 
            path: layoutPath, 
            data: null, 
            error: {
              message: error.message,
              stack: error.stack
            }
          };
        }
      })
    );

    // Merge layout data (parent to child)
    const mergedData = {};
    for (const result of results) {
      if (result.data) {
        Object.assign(mergedData, result.data);
      }
    }

    return {
      layoutData: mergedData,
      results
    };
  }

  getLayoutPaths(routePath) {
    const segments = routePath.split('/').filter(Boolean);
    const layouts = [];
    
    // Root layout
    layouts.push('_layout.egh');
    
    // Nested layouts
    let currentPath = '';
    for (const segment of segments) {
      currentPath += `/${segment}`;
      layouts.push(`${currentPath}/_layout.egh`);
    }
    
    return layouts.filter(layout => 
      layout !== routePath // Don't include the route itself
    );
  }

  getCachedData(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > cached.maxAge;
    if (isExpired) {
      this.cache.delete(cacheKey);
      return null;
    }
    
    return cached.data;
  }

  generateDataHydrationScript(routeData) {
    return `
<script id="__EGHACT_DATA__" type="application/json">
${JSON.stringify(routeData, null, 2)}
</script>
<script>
  // Hydrate client-side data
  window.__EGHACT_DATA__ = JSON.parse(
    document.getElementById('__EGHACT_DATA__').textContent
  );
  
  // Clean up script tag
  document.getElementById('__EGHACT_DATA__').remove();
</script>`;
  }
}

// Generate client-side data loader
export function generateClientDataLoader() {
  return `
// Client-side data loader for Eghact
class ClientDataLoader {
  constructor() {
    this.cache = new Map();
    this.loadingPromises = new Map();
  }

  async loadData(route, params = {}) {
    const cacheKey = \`\${route}:\${JSON.stringify(params)}\`;
    
    // Return cached data if fresh
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;
    
    // Return existing promise if loading
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey);
    }
    
    // Start loading
    const promise = this.fetchData(route, params);
    this.loadingPromises.set(cacheKey, promise);
    
    try {
      const result = await promise;
      
      // Cache successful results
      if (result.success) {
        this.cache.set(cacheKey, {
          data: result.data,
          timestamp: Date.now(),
          maxAge: 300000 // 5 minutes
        });
      }
      
      return result;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }
  
  async fetchData(route, params) {
    try {
      const response = await fetch('/__eghact/load-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route, params })
      });
      
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          type: 'NetworkError'
        }
      };
    }
  }
  
  getCachedData(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > cached.maxAge;
    if (isExpired) {
      this.cache.delete(cacheKey);
      return null;
    }
    
    return { success: true, data: cached.data };
  }
  
  invalidateCache(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

// Global instance
window.dataLoader = new ClientDataLoader();
export const dataLoader = window.dataLoader;
`;
}

// Global data loader instance
export const dataLoader = new DataLoader({ root: process.cwd() });
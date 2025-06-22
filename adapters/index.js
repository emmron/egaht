/**
 * Eghact Deployment Adapters
 * Export all available adapters for easy import
 */

export { default as vercel } from './vercel/index.js';
export { default as netlify } from './netlify/index.js';
export { default as cloudflare } from './cloudflare/index.js';
export { default as static } from './static/index.js';

// Re-export base adapter for custom implementations
export { BaseAdapter } from './base/index.js';

/**
 * Auto-detect and recommend adapter based on environment
 */
export function detectAdapter() {
  // Check for platform-specific environment variables
  if (process.env.VERCEL) {
    return 'vercel';
  }
  
  if (process.env.NETLIFY) {
    return 'netlify';
  }
  
  if (process.env.CF_PAGES || process.env.CF_ACCOUNT_ID) {
    return 'cloudflare';
  }
  
  // Default to static for maximum compatibility
  return 'static';
}

/**
 * Get adapter by name
 */
export function getAdapter(name) {
  const adapters = {
    vercel: () => import('./vercel/index.js'),
    netlify: () => import('./netlify/index.js'),
    cloudflare: () => import('./cloudflare/index.js'),
    static: () => import('./static/index.js')
  };
  
  const loader = adapters[name];
  if (!loader) {
    throw new Error(`Unknown adapter: ${name}. Available: ${Object.keys(adapters).join(', ')}`);
  }
  
  return loader();
}
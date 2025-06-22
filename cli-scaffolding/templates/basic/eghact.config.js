/**
 * Eghact Configuration
 * 
 * This file configures your Eghact application build and development settings.
 * Visit https://eghact.dev/docs/config for detailed documentation.
 */

export default {
  // Build configuration
  build: {
    // Target environment
    target: 'es2020',
    
    // Output directory
    outDir: 'dist',
    
    // Generate source maps
    sourcemap: true,
    
    // Minify output
    minify: true,
    
    // Bundle splitting strategy
    splitting: 'auto', // 'auto', 'manual', 'none'
    
    // Asset optimization
    assets: {
      // Inline assets smaller than this (bytes)
      inlineLimit: 4096,
      
      // Image optimization
      images: {
        webp: true,
        avif: false,
        quality: 85
      }
    }
  },

  // Development server configuration  
  dev: {
    // Server port
    port: 3000,
    
    // Server host
    host: 'localhost',
    
    // Open browser automatically
    open: true,
    
    // Enable HTTPS
    https: false,
    
    // Hot Module Replacement
    hmr: {
      enabled: true,
      port: 24678
    },
    
    // CORS configuration
    cors: true
  },

  // CSS configuration
  css: {
    // CSS modules
    modules: false,
    
    // CSS preprocessor
    preprocessor: 'none', // 'scss', 'less', 'stylus', 'postcss'
    
    // PostCSS plugins
    postcss: {
      plugins: [
        // Add PostCSS plugins here
      ]
    },
    
    // CSS extraction in production
    extract: true
  },

  // TypeScript configuration
  typescript: {
    // Strict mode
    strict: true,
    
    // Target version
    target: 'ES2020',
    
    // Generate .d.ts files
    declaration: false,
    
    // Type checking in development
    typeCheck: true
  },

  // Plugin configuration
  plugins: [
    // Add Eghact plugins here
    // Example: '@eghact/plugin-pwa'
  ],

  // Security configuration
  security: {
    // Content Security Policy
    csp: {
      enabled: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"]
      }
    },
    
    // CSRF protection
    csrf: {
      enabled: true,
      tokenName: '_csrf'
    }
  },

  // Optimization configuration
  optimization: {
    // Tree shaking
    treeShaking: true,
    
    // Dead code elimination
    deadCodeElimination: true,
    
    // Bundle analysis
    analyze: false,
    
    // Compression
    compression: {
      gzip: true,
      brotli: true
    }
  },

  // Testing configuration
  testing: {
    // Test environment
    environment: 'jsdom',
    
    // Test file patterns
    testMatch: [
      '**/__tests__/**/*.(test|spec).(js|ts)',
      '**/*.(test|spec).(js|ts)'
    ],
    
    // Coverage configuration
    coverage: {
      enabled: false,
      threshold: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  },

  // Alias configuration
  alias: {
    // Example aliases
    '@': './src',
    '@components': './src/components',
    '@routes': './src/routes',
    '@lib': './src/lib'
  },

  // Environment variables
  define: {
    // Global constants
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __DEV__: process.env.NODE_ENV === 'development'
  }
};
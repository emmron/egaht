import { Plugin } from 'vite';
import { CSPGenerator, CSPConfig } from './csp-generator';
import * as fs from 'fs';
import * as path from 'path';

export interface CSPPluginOptions extends CSPConfig {
  enabled?: boolean;
  outputFile?: string;
  injectMeta?: boolean;
  development?: {
    enabled?: boolean;
    allowUnsafeInline?: boolean;
    allowUnsafeEval?: boolean;
  };
}

export function eghactCSP(options: CSPPluginOptions = {}): Plugin {
  const {
    enabled = true,
    outputFile = 'csp-headers.json',
    injectMeta = true,
    development = {},
    ...cspConfig
  } = options;

  let isDev = false;
  let generator: CSPGenerator;

  return {
    name: 'eghact-csp',
    
    configResolved(config) {
      isDev = config.mode === 'development';
      
      // Skip CSP in development unless explicitly enabled
      if (isDev && !development.enabled) {
        return;
      }
      
      // Create CSP generator with appropriate config
      const config = isDev ? {
        ...cspConfig,
        customDirectives: {
          'script-src': development.allowUnsafeInline ? ["'unsafe-inline'"] : [],
          'style-src': development.allowUnsafeInline ? ["'unsafe-inline'"] : [],
          ...(development.allowUnsafeEval ? { 'script-src': ["'unsafe-eval'"] } : {}),
          ...cspConfig.customDirectives,
        },
      } : cspConfig;
      
      generator = new CSPGenerator(config);
    },
    
    writeBundle(options, bundle) {
      if (!enabled || (isDev && !development.enabled)) {
        return;
      }
      
      const outputDir = options.dir || 'dist';
      
      // Analyze all generated assets
      generator.analyzeAssets(outputDir);
      
      // Generate CSP header
      const cspHeader = generator.generateCSPHeader();
      
      // Write CSP to file for server configuration
      const headerFile = path.join(outputDir, outputFile);
      const headers = {
        'Content-Security-Policy': cspHeader,
        nonces: Object.fromEntries(generator.getNonces()),
        hashes: Object.fromEntries(generator.getHashes()),
      };
      
      fs.writeFileSync(headerFile, JSON.stringify(headers, null, 2));
      
      // Inject CSP meta tag into HTML files if enabled
      if (injectMeta) {
        for (const [fileName, asset] of Object.entries(bundle)) {
          if (fileName.endsWith('.html') && asset.type === 'asset' && typeof asset.source === 'string') {
            const metaTag = generator.generateMetaTag();
            const html = asset.source as string;
            
            // Inject after <head> tag
            const injectedHtml = html.replace(
              /<head([^>]*)>/i,
              `<head$1>\n  ${metaTag}`
            );
            
            // Write updated HTML
            const htmlPath = path.join(outputDir, fileName);
            fs.writeFileSync(htmlPath, injectedHtml);
          }
        }
      }
      
      console.log(`✓ CSP generated and saved to ${headerFile}`);
    },
  };
}

// Export for use in build tools
export { CSPGenerator, CSPConfig } from './csp-generator';
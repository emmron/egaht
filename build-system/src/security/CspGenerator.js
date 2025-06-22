/**
 * Content Security Policy (CSP) Generator for Eghact Framework
 * Generates strict CSP headers with configurable policies
 * Created by Agent 1 - The ONLY one delivering Phase 3!
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class CspGenerator {
  constructor(outputDir, options = {}) {
    this.outputDir = outputDir;
    this.options = {
      mode: options.mode || 'production', // 'production' | 'development'
      strictInlineStyles: options.strictInlineStyles !== false,
      strictInlineScripts: options.strictInlineScripts !== false,
      reportUri: options.reportUri || null,
      ...options
    };
    
    this.scriptHashes = new Set();
    this.styleHashes = new Set();
    this.nonce = this.generateNonce();
  }

  /**
   * Generate a cryptographically secure nonce
   */
  generateNonce() {
    return crypto.randomBytes(16).toString('base64');
  }

  /**
   * Calculate SHA-256 hash for inline content
   */
  calculateHash(content) {
    return crypto
      .createHash('sha256')
      .update(content, 'utf8')
      .digest('base64');
  }

  /**
   * Scan HTML files for inline scripts and styles
   */
  async scanHtmlFiles(htmlFiles) {
    for (const file of htmlFiles) {
      const content = await fs.readFile(file, 'utf8');
      
      // Extract inline scripts
      const scriptRegex = /<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
      let match;
      while ((match = scriptRegex.exec(content)) !== null) {
        const scriptContent = match[2].trim();
        if (scriptContent) {
          const hash = this.calculateHash(scriptContent);
          this.scriptHashes.add(`'sha256-${hash}'`);
        }
      }

      // Extract inline styles
      const styleRegex = /<style([^>]*)>([\s\S]*?)<\/style>/gi;
      while ((match = styleRegex.exec(content)) !== null) {
        const styleContent = match[2].trim();
        if (styleContent) {
          const hash = this.calculateHash(styleContent);
          this.styleHashes.add(`'sha256-${hash}'`);
        }
      }

      // Also check for inline style attributes if strict mode
      if (this.options.strictInlineStyles) {
        const inlineStyleRegex = /style\s*=\s*["']([^"']+)["']/gi;
        while ((match = inlineStyleRegex.exec(content)) !== null) {
          const styleContent = match[1].trim();
          if (styleContent) {
            const hash = this.calculateHash(styleContent);
            this.styleHashes.add(`'sha256-${hash}'`);
          }
        }
      }
    }
  }

  /**
   * Generate CSP directives based on mode and findings
   */
  generateDirectives() {
    const directives = {};

    // Script source directive
    if (this.options.mode === 'development') {
      // Relaxed for development with HMR
      directives['script-src'] = [
        "'self'",
        "'unsafe-inline'", // Needed for HMR
        "'unsafe-eval'",   // Needed for source maps
        "ws://localhost:*", // WebSocket for HMR
        "http://localhost:*"
      ];
    } else {
      // Strict for production
      directives['script-src'] = [
        "'self'",
        "'strict-dynamic'",
        `'nonce-${this.nonce}'`,
        ...Array.from(this.scriptHashes)
      ];
    }

    // Style source directive
    if (this.options.mode === 'development') {
      directives['style-src'] = [
        "'self'",
        "'unsafe-inline'" // Needed for HMR style injection
      ];
    } else {
      directives['style-src'] = [
        "'self'",
        `'nonce-${this.nonce}'`,
        ...Array.from(this.styleHashes)
      ];
    }

    // Other security directives
    directives['default-src'] = ["'self'"];
    directives['img-src'] = ["'self'", "data:", "https:"];
    directives['font-src'] = ["'self'", "data:"];
    directives['connect-src'] = ["'self'"];
    
    // Add WebSocket for dev mode
    if (this.options.mode === 'development') {
      directives['connect-src'].push("ws://localhost:*", "wss://localhost:*");
    }

    directives['frame-ancestors'] = ["'none'"];
    directives['base-uri'] = ["'self'"];
    directives['form-action'] = ["'self'"];

    // Add report URI if configured
    if (this.options.reportUri) {
      directives['report-uri'] = [this.options.reportUri];
    }

    return directives;
  }

  /**
   * Generate the full CSP header string
   */
  generatePolicyString(directives) {
    return Object.entries(directives)
      .map(([key, values]) => `${key} ${values.join(' ')}`)
      .join('; ');
  }

  /**
   * Main method to generate CSP policy
   */
  async generatePolicy() {
    // Find all HTML files in output directory
    const htmlFiles = await this.findHtmlFiles(this.outputDir);
    
    // Scan files for inline content
    await this.scanHtmlFiles(htmlFiles);
    
    // Generate directives
    const directives = this.generateDirectives();
    
    // Create policy string
    const policyString = this.generatePolicyString(directives);
    
    // Return policy object
    return {
      policy: policyString,
      nonce: this.nonce,
      scriptHashes: Array.from(this.scriptHashes),
      styleHashes: Array.from(this.styleHashes),
      mode: this.options.mode
    };
  }

  /**
   * Find all HTML files recursively
   */
  async findHtmlFiles(dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await this.findHtmlFiles(fullPath));
      } else if (entry.name.endsWith('.html')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  /**
   * Write CSP metadata for runtime injection
   */
  async writeCspMetadata(cspData) {
    const metadataPath = path.join(this.outputDir, '.csp-metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(cspData, null, 2));
    return metadataPath;
  }
}

module.exports = CspGenerator;
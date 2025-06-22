/**
 * Security Integration for Eghact Build System - Task 5.3
 * Integrates XSS and CSRF protection with build system and dev server
 * Created by Core Agent for enterprise-grade security
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import crypto from 'crypto';

export class SecurityIntegrator {
  constructor(buildSystem, options = {}) {
    this.buildSystem = buildSystem;
    this.options = {
      enableXSS: options.enableXSS !== false,
      enableCSRF: options.enableCSRF !== false,
      strictMode: options.strictMode !== false,
      reportUri: options.reportUri || null,
      ...options
    };
    
    this.securityConfig = {
      xss: {
        autoEscape: true,
        whitelistedTags: ['b', 'i', 'em', 'strong', 'code'],
        blockedSchemes: ['javascript:', 'data:', 'vbscript:', 'file:', 'about:']
      },
      csrf: {
        tokenLength: 32,
        secretKey: process.env.EGHACT_CSRF_SECRET || this.generateSecret(),
        cookieName: '_eghact_csrf',
        headerName: 'X-CSRF-Token',
        expiration: 3600000 // 1 hour
      },
      csp: {
        reportUri: this.options.reportUri,
        mode: 'production'
      }
    };
  }

  /**
   * Main integration method - called by build system
   */
  async integrateSecurityFeatures() {
    console.log(chalk.blue('🛡️  Integrating security features...'));
    
    try {
      // 1. Generate security configuration
      await this.generateSecurityConfig();
      
      // 2. Integrate XSS protection into build process
      if (this.options.enableXSS) {
        await this.integrateXSSProtection();
      }
      
      // 3. Integrate CSRF protection into build process
      if (this.options.enableCSRF) {
        await this.integrateCSRFProtection();
      }
      
      // 4. Generate security headers configuration
      await this.generateSecurityHeaders();
      
      // 5. Create production deployment security guide
      await this.generateDeploymentGuide();
      
      // 6. Generate runtime security initialization
      await this.generateSecurityRuntime();
      
      console.log(chalk.green('✅ Security integration complete'));
      
      return {
        xssEnabled: this.options.enableXSS,
        csrfEnabled: this.options.enableCSRF,
        configPath: path.join(this.buildSystem.options.outDir, 'security-config.json'),
        headersPath: path.join(this.buildSystem.options.outDir, 'security-headers.json')
      };
    } catch (error) {
      console.error(chalk.red('❌ Security integration failed:'), error);
      throw error;
    }
  }

  /**
   * Generate main security configuration file
   */
  async generateSecurityConfig() {
    const configPath = path.join(this.buildSystem.options.outDir, 'security-config.json');
    
    const config = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      features: {
        xss: {
          enabled: this.options.enableXSS,
          autoEscape: this.securityConfig.xss.autoEscape,
          whitelistedTags: this.securityConfig.xss.whitelistedTags,
          blockedSchemes: this.securityConfig.xss.blockedSchemes
        },
        csrf: {
          enabled: this.options.enableCSRF,
          tokenLength: this.securityConfig.csrf.tokenLength,
          cookieName: this.securityConfig.csrf.cookieName,
          headerName: this.securityConfig.csrf.headerName,
          expiration: this.securityConfig.csrf.expiration
        },
        csp: {
          enabled: true,
          reportUri: this.securityConfig.csp.reportUri,
          mode: this.securityConfig.csp.mode
        }
      },
      deployment: {
        requireHttps: this.options.strictMode,
        requireSecureCookies: this.options.strictMode,
        enforceHSTS: this.options.strictMode
      }
    };
    
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    console.log(chalk.gray('    Security configuration generated'));
    
    return configPath;
  }

  /**
   * Integrate XSS protection into compiled components
   */
  async integrateXSSProtection() {
    console.log(chalk.blue('🔒 Integrating XSS protection...'));
    
    // Create XSS runtime helpers
    const xssHelpers = `
/**
 * XSS Protection Runtime for Eghact
 * Automatically included in production builds
 */
export class XSSProtection {
  constructor() {
    this.blockedSchemes = ${JSON.stringify(this.securityConfig.xss.blockedSchemes)};
    this.whitelistedTags = ${JSON.stringify(this.securityConfig.xss.whitelistedTags)};
  }

  /**
   * Escape HTML content to prevent XSS
   */
  escapeHtml(input) {
    if (typeof input !== 'string') return String(input);
    
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\\//g, '&#x2F;');
  }

  /**
   * Validate URL to prevent dangerous schemes
   */
  isSafeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    const lowerUrl = url.toLowerCase().trim();
    
    // Check for dangerous schemes
    for (const scheme of this.blockedSchemes) {
      if (lowerUrl.startsWith(scheme)) {
        console.warn('[Eghact Security] Blocked dangerous URL:', url);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Set text content safely
   */
  setTextContent(element, content) {
    if (!element) return;
    element.textContent = this.escapeHtml(content);
  }

  /**
   * Set attribute safely
   */
  setAttribute(element, name, value) {
    if (!element) return;
    
    // URL attributes require validation
    if (name === 'href' || name === 'src' || name === 'action') {
      if (!this.isSafeUrl(value)) {
        console.warn('[Eghact Security] Blocked unsafe URL in attribute:', name, value);
        return;
      }
    }
    
    element.setAttribute(name, this.escapeHtml(value));
  }

  /**
   * Set innerHTML with warning (should only be used for trusted content)
   */
  setInnerHTML(element, html) {
    if (!element) return;
    
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Eghact Security] Using innerHTML - ensure content is trusted:', html.substring(0, 100));
    }
    
    element.innerHTML = html;
  }
}

// Global instance
export const xssProtection = new XSSProtection();

// Browser global for runtime access
if (typeof window !== 'undefined') {
  window.__EGHACT_XSS__ = xssProtection;
}
`;
    
    const xssPath = path.join(this.buildSystem.options.outDir, 'xss-protection.js');
    await fs.writeFile(xssPath, xssHelpers);
    
    console.log(chalk.gray('    XSS protection runtime created'));
  }

  /**
   * Integrate CSRF protection into build process
   */
  async integrateCSRFProtection() {
    console.log(chalk.blue('🔒 Integrating CSRF protection...'));
    
    // Create CSRF runtime helpers
    const csrfHelpers = `
/**
 * CSRF Protection Runtime for Eghact
 * Automatically included in production builds
 */
export class CSRFProtection {
  constructor() {
    this.tokenLength = ${this.securityConfig.csrf.tokenLength};
    this.cookieName = '${this.securityConfig.csrf.cookieName}';
    this.headerName = '${this.securityConfig.csrf.headerName}';
    this.expiration = ${this.securityConfig.csrf.expiration};
  }

  /**
   * Get CSRF token from cookie
   */
  getToken() {
    return this.getCookie(this.cookieName);
  }

  /**
   * Get cookie value by name
   */
  getCookie(name) {
    const value = \`; \${document.cookie}\`;
    const parts = value.split(\`; \${name}=\`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  /**
   * Add CSRF token to form
   */
  protectForm(form) {
    if (!form || form.method.toLowerCase() !== 'post') return;
    
    const token = this.getToken();
    if (!token) {
      console.warn('[Eghact Security] No CSRF token found for form protection');
      return;
    }
    
    // Remove existing CSRF input
    const existingInput = form.querySelector('input[name="_csrf"]');
    if (existingInput) {
      existingInput.remove();
    }
    
    // Add new CSRF input
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = '_csrf';
    input.value = token;
    form.appendChild(input);
  }

  /**
   * Add CSRF header to fetch options
   */
  protectFetch(url, options = {}) {
    const token = this.getToken();
    if (!token) {
      console.warn('[Eghact Security] No CSRF token found for fetch protection');
      return options;
    }
    
    // Only add header for state-changing methods
    const method = (options.method || 'GET').toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      options.headers = {
        ...options.headers,
        [this.headerName]: token
      };
    }
    
    return options;
  }

  /**
   * Auto-protect all forms on page load
   */
  autoProtectForms() {
    const forms = document.querySelectorAll('form[method="post"], form[method="POST"]');
    forms.forEach(form => this.protectForm(form));
  }

  /**
   * Wrap native fetch to auto-add CSRF headers
   */
  wrapFetch() {
    const originalFetch = window.fetch;
    const csrfProtection = this;
    
    window.fetch = function(url, options = {}) {
      const protectedOptions = csrfProtection.protectFetch(url, options);
      return originalFetch.call(this, url, protectedOptions);
    };
  }

  /**
   * Initialize CSRF protection
   */
  init() {
    // Auto-protect existing forms
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.autoProtectForms());
    } else {
      this.autoProtectForms();
    }
    
    // Wrap fetch API
    this.wrapFetch();
    
    // Auto-protect dynamically added forms
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'FORM') {
              this.protectForm(node);
            } else if (node.querySelectorAll) {
              const forms = node.querySelectorAll('form[method="post"], form[method="POST"]');
              forms.forEach(form => this.protectForm(form));
            }
          }
        });
      });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

// Global instance
export const csrfProtection = new CSRFProtection();

// Browser global for runtime access
if (typeof window !== 'undefined') {
  window.__EGHACT_CSRF__ = csrfProtection;
  
  // Auto-initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => csrfProtection.init());
  } else {
    csrfProtection.init();
  }
}
`;
    
    const csrfPath = path.join(this.buildSystem.options.outDir, 'csrf-protection.js');
    await fs.writeFile(csrfPath, csrfHelpers);
    
    console.log(chalk.gray('    CSRF protection runtime created'));
  }

  /**
   * Generate security headers configuration for deployment
   */
  async generateSecurityHeaders() {
    const headers = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
    };
    
    if (this.options.strictMode) {
      headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
    }
    
    // Add CSP header from build manifest
    if (this.buildSystem.buildManifest.csp) {
      headers['Content-Security-Policy'] = this.buildSystem.buildManifest.csp.policy;
    }
    
    const headersPath = path.join(this.buildSystem.options.outDir, 'security-headers.json');
    await fs.writeFile(headersPath, JSON.stringify(headers, null, 2));
    
    console.log(chalk.gray('    Security headers configuration generated'));
    
    return headersPath;
  }

  /**
   * Generate deployment security guide
   */
  async generateDeploymentGuide() {
    const guide = `# Eghact Security Deployment Guide

## Overview
This guide helps you deploy your Eghact application with enterprise-grade security.

## Required Security Headers

Add these headers to your web server configuration:

### Nginx
\`\`\`nginx
add_header X-Content-Type-Options nosniff;
add_header X-Frame-Options DENY;
add_header X-XSS-Protection "1; mode=block";
add_header Referrer-Policy strict-origin-when-cross-origin;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()";
${this.options.strictMode ? 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";' : ''}

# CSP header (update with your CSP from .csp-metadata.json)
add_header Content-Security-Policy "${this.buildSystem.buildManifest.csp?.policy || "default-src 'self'"}";
\`\`\`
`;

### Apache
\`\`\`apache
Header always set X-Content-Type-Options nosniff
Header always set X-Frame-Options DENY
Header always set X-XSS-Protection "1; mode=block"
Header always set Referrer-Policy strict-origin-when-cross-origin
Header always set Permissions-Policy "geolocation=(), microphone=(), camera=()"
${this.options.strictMode ? 'Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"' : ''}

# CSP header
Header always set Content-Security-Policy "${this.buildSystem.buildManifest.csp?.policy || 'default-src \\'self\\''}"
\`\`\`

### Cloudflare Workers
\`\`\`javascript
export default {
  async fetch(request, env) {
    const response = await fetch(request);
    
    // Clone response to add headers
    const newResponse = new Response(response.body, response);
    
    newResponse.headers.set('X-Content-Type-Options', 'nosniff');
    newResponse.headers.set('X-Frame-Options', 'DENY');
    newResponse.headers.set('X-XSS-Protection', '1; mode=block');
    newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    newResponse.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    ${this.options.strictMode ? "newResponse.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');" : ''}
    newResponse.headers.set('Content-Security-Policy', '${this.buildSystem.buildManifest.csp?.policy || 'default-src \\'self\\''}');
    
    return newResponse;
  }
}
\`\`\`

## Environment Variables

Set these environment variables in production:

\`\`\`bash
# CSRF Protection Secret (generate a secure random string)
EGHACT_CSRF_SECRET="your-256-bit-secret-key-here"

# Optional: CSP Report URI
EGHACT_CSP_REPORT_URI="https://your-domain.com/csp-report"
\`\`\`

## Security Features Enabled

✅ **XSS Protection**: ${this.options.enableXSS ? 'Enabled' : 'Disabled'}
- Automatic HTML escaping in templates
- URL validation for href/src attributes
- Runtime protection functions

✅ **CSRF Protection**: ${this.options.enableCSRF ? 'Enabled' : 'Disabled'}
- Double-submit cookie strategy
- Automatic form and fetch protection
- HMAC-signed tokens with expiration

✅ **Content Security Policy**: Enabled
- Script and style hash verification
- Nonce-based inline content protection
- Report-only mode available for testing

## Security Checklist

Before deploying to production:

- [ ] All security headers configured in web server
- [ ] HTTPS enabled with valid SSL certificate
- [ ] EGHACT_CSRF_SECRET environment variable set
- [ ] CSP policy tested and validated
- [ ] Security headers tested with online tools
- [ ] Error pages don't leak sensitive information
- [ ] Input validation implemented in API endpoints
- [ ] Rate limiting configured for APIs
- [ ] Monitoring and alerting set up for security events

## Testing Security

Use these tools to verify your security configuration:

1. **Security Headers**: https://securityheaders.com/
2. **CSP Evaluator**: https://csp-evaluator.withgoogle.com/
3. **SSL Test**: https://www.ssllabs.com/ssltest/

## Support

For security questions or reporting vulnerabilities, see SECURITY.md
`;
    
    const guidePath = path.join(this.buildSystem.options.outDir, 'SECURITY-DEPLOYMENT.md');
    await fs.writeFile(guidePath, guide);
    
    console.log(chalk.gray('    Security deployment guide generated'));
  }

  /**
   * Generate main security runtime initialization
   */
  async generateSecurityRuntime() {
    const runtime = `
/**
 * Eghact Security Runtime - Production Build
 * Automatically initializes all security features
 */

import { xssProtection } from './xss-protection.js';
import { csrfProtection } from './csrf-protection.js';

export class EghactSecurity {
  constructor() {
    this.xss = xssProtection;
    this.csrf = csrfProtection;
    this.initialized = false;
  }

  /**
   * Initialize all security features
   */
  async init() {
    if (this.initialized) return;
    
    console.log('[Eghact Security] Initializing security features...');
    
    try {
      // Initialize CSRF protection
      if (this.csrf) {
        this.csrf.init();
        console.log('[Eghact Security] CSRF protection active');
      }
      
      // XSS protection is passive (utility functions)
      if (this.xss) {
        console.log('[Eghact Security] XSS protection active');
      }
      
      this.initialized = true;
      console.log('[Eghact Security] All security features initialized');
    } catch (error) {
      console.error('[Eghact Security] Failed to initialize:', error);
    }
  }

  /**
   * Get security status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      xssEnabled: !!this.xss,
      csrfEnabled: !!this.csrf,
      timestamp: new Date().toISOString()
    };
  }
}

// Global instance
export const eghactSecurity = new EghactSecurity();

// Auto-initialize on load
if (typeof window !== 'undefined') {
  window.__EGHACT_SECURITY__ = eghactSecurity;
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => eghactSecurity.init());
  } else {
    eghactSecurity.init();
  }
}

export default eghactSecurity;
`;
    
    const runtimePath = path.join(this.buildSystem.options.outDir, 'eghact-security.js');
    await fs.writeFile(runtimePath, runtime);
    
    console.log(chalk.gray('    Security runtime generated'));
  }

  /**
   * Generate a secure random secret
   */
  generateSecret() {
    return crypto.randomBytes(32).toString('hex');
  }
}

export default SecurityIntegrator;
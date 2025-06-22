/**
 * Production security configuration for Eghact applications
 * Provides hardened security settings for production deployments
 */
export class ProductionSecurityConfig {
  constructor(options = {}) {
    this.options = {
      enableStrictCSP: true,
      enableHSTS: true,
      enableSecurityHeaders: true,
      enableIntegrityChecking: true,
      enableRateLimiting: true,
      domain: options.domain || 'localhost',
      ...options
    };
  }

  /**
   * Generate production-ready Content Security Policy
   */
  generateCSP(assetHashes = {}, nonces = {}) {
    const directives = [];

    // Default source
    directives.push("default-src 'self'");

    // Script sources with hashes and nonces
    const scriptSources = ["'self'"];
    if (nonces.script) {
      scriptSources.push(`'nonce-${nonces.script}'`);
    }
    if (assetHashes.scripts && assetHashes.scripts.length > 0) {
      assetHashes.scripts.forEach(hash => {
        scriptSources.push(`'sha256-${hash}'`);
      });
    }
    // Remove unsafe-inline and unsafe-eval for production
    directives.push(`script-src ${scriptSources.join(' ')}`);

    // Style sources with hashes and nonces
    const styleSources = ["'self'"];
    if (nonces.style) {
      styleSources.push(`'nonce-${nonces.style}'`);
    }
    if (assetHashes.styles && assetHashes.styles.length > 0) {
      assetHashes.styles.forEach(hash => {
        styleSources.push(`'sha256-${hash}'`);
      });
    }
    directives.push(`style-src ${styleSources.join(' ')}`);

    // Other directives
    directives.push("img-src 'self' data: https:");
    directives.push("font-src 'self' data:");
    directives.push("connect-src 'self' https:");
    directives.push("media-src 'self'");
    directives.push("object-src 'none'");
    directives.push("child-src 'self'");
    directives.push("frame-src 'self'");
    directives.push("worker-src 'self' blob:");
    directives.push("manifest-src 'self'");
    directives.push("base-uri 'self'");
    directives.push("form-action 'self'");
    directives.push("frame-ancestors 'none'");
    directives.push("upgrade-insecure-requests");

    return directives.join('; ');
  }

  /**
   * Generate all production security headers
   */
  generateSecurityHeaders(assetHashes = {}, nonces = {}) {
    const headers = {};

    // Content Security Policy
    if (this.options.enableStrictCSP) {
      headers['Content-Security-Policy'] = this.generateCSP(assetHashes, nonces);
    }

    // HTTP Strict Transport Security
    if (this.options.enableHSTS) {
      headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
    }

    // Other security headers
    if (this.options.enableSecurityHeaders) {
      headers['X-Content-Type-Options'] = 'nosniff';
      headers['X-Frame-Options'] = 'DENY';
      headers['X-XSS-Protection'] = '1; mode=block';
      headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
      headers['Permissions-Policy'] = this.generatePermissionsPolicy();
      headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
      headers['Cross-Origin-Opener-Policy'] = 'same-origin';
      headers['Cross-Origin-Resource-Policy'] = 'same-origin';
    }

    // Cache control
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    headers['Pragma'] = 'no-cache';
    headers['Expires'] = '0';

    return headers;
  }

  /**
   * Generate Permissions Policy (Feature Policy)
   */
  generatePermissionsPolicy() {
    const policies = [
      'accelerometer=()',
      'ambient-light-sensor=()',
      'autoplay=()',
      'battery=()',
      'camera=()',
      'cross-origin-isolated=()',
      'display-capture=()',
      'document-domain=()',
      'encrypted-media=()',
      'execution-while-not-rendered=()',
      'execution-while-out-of-viewport=()',
      'fullscreen=(self)',
      'geolocation=()',
      'gyroscope=()',
      'keyboard-map=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'navigation-override=()',
      'payment=()',
      'picture-in-picture=()',
      'publickey-credentials-get=()',
      'screen-wake-lock=()',
      'sync-xhr=()',
      'usb=()',
      'web-share=()',
      'xr-spatial-tracking=()'
    ];

    return policies.join(', ');
  }

  /**
   * Generate rate limiting configuration
   */
  generateRateLimitConfig() {
    if (!this.options.enableRateLimiting) return null;

    return {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests',
        message: 'Rate limit exceeded, please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: (req) => {
        return req.ip || req.connection.remoteAddress;
      }
    };
  }

  /**
   * Generate CSRF configuration for production
   */
  generateCSRFConfig() {
    return {
      secretKey: process.env.EGHACT_CSRF_SECRET || this.generateSecureSecret(),
      tokenExpiry: 3600000, // 1 hour
      cookieName: '__eghact-csrf',
      headerName: 'X-CSRF-Token',
      fieldName: '_token',
      sameSite: 'strict',
      secure: true,
      httpOnly: true,
      domain: this.options.domain,
      ignorePaths: [
        /^\/api\/webhook\//,
        /^\/health$/,
        /^\/metrics$/
      ],
      protectedMethods: ['POST', 'PUT', 'DELETE', 'PATCH'],
      onError: this.createCSRFErrorHandler()
    };
  }

  /**
   * Generate secure session configuration
   */
  generateSessionConfig() {
    return {
      secret: process.env.EGHACT_SESSION_SECRET || this.generateSecureSecret(),
      name: 'eghact.sid',
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        secure: true,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'strict',
        domain: this.options.domain
      },
      genid: () => {
        const crypto = require('crypto');
        return crypto.randomBytes(32).toString('hex');
      }
    };
  }

  /**
   * Generate Express.js middleware configuration
   */
  generateExpressMiddleware() {
    const middlewares = [];

    // Helmet for security headers
    middlewares.push({
      name: 'helmet',
      config: {
        contentSecurityPolicy: false, // We handle CSP ourselves
        hsts: this.options.enableHSTS ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        } : false,
        noSniff: true,
        frameguard: { action: 'deny' },
        xssFilter: true,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
      }
    });

    // Rate limiting
    if (this.options.enableRateLimiting) {
      middlewares.push({
        name: 'express-rate-limit',
        config: this.generateRateLimitConfig()
      });
    }

    // Request sanitization
    middlewares.push({
      name: 'express-validator',
      config: {
        customValidators: this.getCustomValidators()
      }
    });

    return middlewares;
  }

  /**
   * Generate Fastify plugin configuration
   */
  generateFastifyPlugins() {
    const plugins = [];

    // Rate limiting
    if (this.options.enableRateLimiting) {
      plugins.push({
        name: '@fastify/rate-limit',
        config: this.generateRateLimitConfig()
      });
    }

    // Helmet
    plugins.push({
      name: '@fastify/helmet',
      config: {
        contentSecurityPolicy: false, // We handle CSP ourselves
        hsts: this.options.enableHSTS ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        } : false
      }
    });

    // CORS
    plugins.push({
      name: '@fastify/cors',
      config: {
        origin: (origin, callback) => {
          // Strict origin checking for production
          const allowedOrigins = [
            `https://${this.options.domain}`,
            `https://www.${this.options.domain}`
          ];
          
          if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'), false);
          }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
      }
    });

    return plugins;
  }

  /**
   * Get custom validators for input sanitization
   */
  getCustomValidators() {
    return {
      isSecureString: (value) => {
        // Check for common XSS patterns
        const xssPatterns = [
          /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
          /javascript:/gi,
          /vbscript:/gi,
          /on\w+\s*=/gi
        ];
        
        return !xssPatterns.some(pattern => pattern.test(value));
      },
      
      isValidPath: (value) => {
        // Prevent path traversal
        return !value.includes('..') && !value.includes('//');
      },
      
      isValidFileType: (filename) => {
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
        const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        return allowedExtensions.includes(ext);
      }
    };
  }

  /**
   * Create CSRF error handler
   */
  createCSRFErrorHandler() {
    return (error, req, res) => {
      console.error('CSRF Error:', {
        error: error.message,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        url: req.url,
        timestamp: new Date().toISOString()
      });

      if (res.json) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'CSRF token validation failed',
          code: 'CSRF_ERROR'
        });
      } else {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('CSRF token validation failed');
      }
    };
  }

  /**
   * Generate a cryptographically secure secret
   */
  generateSecureSecret() {
    const crypto = require('crypto');
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Generate security.txt file content
   */
  generateSecurityTxt() {
    return `# Security Policy for ${this.options.domain}

Contact: security@${this.options.domain}
Expires: ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()}
Encryption: https://${this.options.domain}/.well-known/pgp-key.txt
Acknowledgments: https://${this.options.domain}/security/acknowledgments
Policy: https://${this.options.domain}/security/policy
Hiring: https://${this.options.domain}/careers

# Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. Email: security@${this.options.domain}
2. Include detailed steps to reproduce
3. Wait for confirmation before public disclosure
4. Allow 90 days for resolution

# Scope

This security policy applies to:
- Main application (${this.options.domain})
- API endpoints (api.${this.options.domain})
- Developer tools and extensions

Out of scope:
- Third-party integrations
- User-generated content
- Social engineering attacks

# Rewards

We offer recognition and rewards for responsibly disclosed vulnerabilities:
- Critical: $1000+
- High: $500+
- Medium: $100+
- Low: Recognition only

Thank you for helping keep our users safe!
`;
  }

  /**
   * Generate complete production security configuration
   */
  generateCompleteConfig(assetHashes = {}, nonces = {}) {
    return {
      headers: this.generateSecurityHeaders(assetHashes, nonces),
      csrf: this.generateCSRFConfig(),
      session: this.generateSessionConfig(),
      rateLimit: this.generateRateLimitConfig(),
      express: this.generateExpressMiddleware(),
      fastify: this.generateFastifyPlugins(),
      permissions: this.generatePermissionsPolicy(),
      securityTxt: this.generateSecurityTxt(),
      environment: {
        NODE_ENV: 'production',
        EGHACT_SECURITY_MODE: 'strict',
        EGHACT_ENABLE_SECURITY_HEADERS: 'true',
        EGHACT_ENABLE_CSP: 'true',
        EGHACT_ENABLE_HSTS: 'true'
      }
    };
  }

  /**
   * Validate production security configuration
   */
  validateConfig(config = {}) {
    const issues = [];

    // Check for required environment variables
    const requiredEnvVars = [
      'EGHACT_CSRF_SECRET',
      'EGHACT_SESSION_SECRET'
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        issues.push({
          type: 'MISSING_ENV_VAR',
          severity: 'critical',
          message: `Required environment variable ${envVar} is not set`,
          recommendation: `Set ${envVar} to a cryptographically secure random string`
        });
      }
    }

    // Check CSP configuration
    if (config.headers && config.headers['Content-Security-Policy']) {
      const csp = config.headers['Content-Security-Policy'];
      
      if (csp.includes("'unsafe-inline'")) {
        issues.push({
          type: 'UNSAFE_CSP',
          severity: 'high',
          message: "CSP contains 'unsafe-inline' directive",
          recommendation: 'Use nonces or hashes instead of unsafe-inline'
        });
      }
      
      if (csp.includes("'unsafe-eval'")) {
        issues.push({
          type: 'UNSAFE_CSP',
          severity: 'high',
          message: "CSP contains 'unsafe-eval' directive",
          recommendation: 'Remove unsafe-eval and refactor code to avoid eval()'
        });
      }
    }

    // Check HTTPS enforcement
    if (!this.options.enableHSTS) {
      issues.push({
        type: 'MISSING_HSTS',
        severity: 'medium',
        message: 'HSTS is not enabled',
        recommendation: 'Enable HSTS for production deployments'
      });
    }

    return {
      valid: issues.filter(i => i.severity === 'critical').length === 0,
      issues,
      score: this.calculateSecurityScore(issues)
    };
  }

  /**
   * Calculate security score based on configuration
   */
  calculateSecurityScore(issues) {
    let score = 100;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 25;
          break;
        case 'high':
          score -= 15;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    }

    return Math.max(0, score);
  }
}
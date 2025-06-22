import crypto from 'crypto';
// Use local CSRF middleware for now until TypeScript compilation is set up
// import { CsrfMiddleware } from '../../../security/csrf/src/CsrfMiddleware.js';

/**
 * Security middleware for Eghact development server
 * Provides XSS/CSRF protection, security headers, and content validation
 */
export class SecurityMiddleware {
  constructor(options = {}) {
    this.options = {
      enableCsrf: true,
      enableXssProtection: true,
      enableSecurityHeaders: true,
      enableContentValidation: true,
      developmentMode: true,
      ...options
    };

    // Initialize CSRF middleware
    // TODO: Re-enable when TypeScript compilation is set up
    /*
    if (this.options.enableCsrf) {
      this.csrfMiddleware = new CsrfMiddleware({
        secretKey: options.csrfSecret || this.generateSecret(),
        tokenExpiry: 3600000, // 1 hour in development
        ignorePaths: [
          /^\/__eghact\//,  // Ignore dev server endpoints
          /^\/hmr$/,        // Ignore HMR endpoint
          /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i, // Static assets
          ...(options.csrfIgnorePaths || [])
        ],
        protectedMethods: ['POST', 'PUT', 'DELETE', 'PATCH'],
        developmentMode: this.options.developmentMode
      });
    }
    */

    // XSS protection patterns
    this.xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /onclick\s*=/gi,
      /onmouseover\s*=/gi,
      /expression\s*\(/gi,
      /@import/gi
    ];

    // Content Security Policy nonce
    this.generateNonce();
  }

  /**
   * Generate a secure secret for CSRF protection
   */
  generateSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate a new CSP nonce
   */
  generateNonce() {
    this.nonce = crypto.randomBytes(16).toString('base64');
    return this.nonce;
  }

  /**
   * Main security middleware function for Fastify
   */
  getMiddleware() {
    return async (request, reply) => {
      // Apply security headers
      if (this.options.enableSecurityHeaders) {
        this.applySecurityHeaders(request, reply);
      }

      // Apply CSRF protection
      if (this.options.enableCsrf && this.requiresCsrfProtection(request)) {
        const csrfResult = await this.applyCsrfProtection(request, reply);
        if (!csrfResult.success) {
          return reply.code(csrfResult.statusCode).send({
            error: 'CSRF Protection',
            message: csrfResult.message,
            timestamp: new Date().toISOString()
          });
        }
      }

      // Apply XSS protection
      if (this.options.enableXssProtection) {
        const xssResult = this.applyXssProtection(request);
        if (!xssResult.success) {
          return reply.code(400).send({
            error: 'XSS Protection',
            message: xssResult.message,
            timestamp: new Date().toISOString()
          });
        }
      }

      // Content validation
      if (this.options.enableContentValidation) {
        const contentResult = await this.validateContent(request);
        if (!contentResult.success) {
          return reply.code(400).send({
            error: 'Content Validation',
            message: contentResult.message,
            timestamp: new Date().toISOString()
          });
        }
      }
    };
  }

  /**
   * Apply security headers for development
   */
  applySecurityHeaders(request, reply) {
    // Generate new nonce for each request
    this.generateNonce();

    // Development-friendly CSP
    const csp = this.buildDevelopmentCSP();
    
    reply.headers({
      // Content Security Policy
      'Content-Security-Policy': csp,
      
      // XSS Protection
      'X-XSS-Protection': '1; mode=block',
      
      // Content Type Options
      'X-Content-Type-Options': 'nosniff',
      
      // Frame Options (relaxed for development)
      'X-Frame-Options': 'SAMEORIGIN',
      
      // Referrer Policy
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      
      // HSTS (disabled in development)
      ...(process.env.NODE_ENV === 'production' ? {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
      } : {}),
      
      // Cache Control
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Add CSP nonce to response locals for template rendering
    if (!reply.locals) reply.locals = {};
    reply.locals.nonce = this.nonce;
    reply.locals.csrfToken = this.getCurrentCsrfToken(request);
  }

  /**
   * Build development-friendly Content Security Policy
   */
  buildDevelopmentCSP() {
    const nonce = `'nonce-${this.nonce}'`;
    
    return [
      `default-src 'self'`,
      `script-src 'self' 'unsafe-eval' ${nonce} ws: wss:`, // unsafe-eval for HMR
      `style-src 'self' 'unsafe-inline' ${nonce}`, // unsafe-inline for dev styles
      `img-src 'self' data: blob:`,
      `font-src 'self' data:`,
      `connect-src 'self' ws: wss: http: https:`, // Allow websockets for HMR
      `object-src 'none'`,
      `media-src 'self'`,
      `frame-src 'self'`,
      `worker-src 'self' blob:`,
      `base-uri 'self'`,
      `form-action 'self'`,
      `frame-ancestors 'self'`,
      `manifest-src 'self'`
    ].join('; ');
  }

  /**
   * Apply CSRF protection
   */
  async applyCsrfProtection(request, reply) {
    try {
      // Skip if CSRF middleware is not initialized
      if (!this.csrfMiddleware) {
        return { success: true };
      }

      // Convert Fastify request/reply to middleware-compatible format
      const req = {
        method: request.method,
        headers: request.headers,
        cookies: request.cookies,
        body: request.body,
        url: request.url,
        path: request.url.split('?')[0]
      };

      const res = {
        setHeader: (name, value) => reply.header(name, value),
        setCookie: (name, value, options) => reply.setCookie(name, value, options),
        status: (code) => reply.code(code),
        json: (data) => reply.send(data),
        send: (data) => reply.send(data)
      };

      // Get session ID (simple UUID generation for dev server)
      const sessionId = request.session?.id || 
                       request.headers['x-session-id'] ||
                       this.generateSessionId();

      const result = await this.csrfMiddleware.processRequest(req, res, sessionId);

      if (!result.continue && result.error) {
        return {
          success: false,
          message: result.error.message,
          statusCode: result.error.statusCode
        };
      }

      // Add token to response if generated
      if (result.newToken) {
        reply.header('X-CSRF-Token', result.newToken);
      }

      return { success: true };
    } catch (error) {
      console.error('CSRF protection error:', error);
      return {
        success: false,
        message: 'CSRF validation failed',
        statusCode: 500
      };
    }
  }

  /**
   * Apply XSS protection by scanning request content
   */
  applyXssProtection(request) {
    try {
      const content = this.extractRequestContent(request);
      
      for (const pattern of this.xssPatterns) {
        if (pattern.test(content)) {
          console.warn(`XSS attempt detected: ${pattern.source}`);
          return {
            success: false,
            message: 'Potentially malicious content detected'
          };
        }
      }

      return { success: true };
    } catch (error) {
      console.error('XSS protection error:', error);
      return {
        success: false,
        message: 'Content validation error'
      };
    }
  }

  /**
   * Validate request content for security issues
   */
  async validateContent(request) {
    try {
      // File upload validation
      if (request.isMultipart()) {
        const uploadResult = await this.validateFileUploads(request);
        if (!uploadResult.success) {
          return uploadResult;
        }
      }

      // Query parameter validation
      const queryResult = this.validateQueryParameters(request);
      if (!queryResult.success) {
        return queryResult;
      }

      // Request size validation
      const sizeResult = this.validateRequestSize(request);
      if (!sizeResult.success) {
        return sizeResult;
      }

      return { success: true };
    } catch (error) {
      console.error('Content validation error:', error);
      return {
        success: false,
        message: 'Content validation failed'
      };
    }
  }

  /**
   * Check if request requires CSRF protection
   */
  requiresCsrfProtection(request) {
    const method = request.method.toUpperCase();
    return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
  }

  /**
   * Extract content from request for XSS scanning
   */
  extractRequestContent(request) {
    let content = '';
    
    // Add URL and query parameters
    content += request.url || '';
    
    // Add body content
    if (request.body) {
      content += typeof request.body === 'string' 
        ? request.body 
        : JSON.stringify(request.body);
    }
    
    // Add headers (excluding sensitive ones)
    const safeHeaders = ['user-agent', 'referer', 'accept'];
    for (const header of safeHeaders) {
      if (request.headers[header]) {
        content += request.headers[header];
      }
    }
    
    return content;
  }

  /**
   * Validate file uploads
   */
  async validateFileUploads(request) {
    const allowedExtensions = ['.js', '.ts', '.egh', '.css', '.json', '.md'];
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    
    try {
      const parts = await request.parts();
      
      for await (const part of parts) {
        if (part.file) {
          // Check file extension
          const hasValidExtension = allowedExtensions.some(ext => 
            part.filename?.toLowerCase().endsWith(ext)
          );
          
          if (!hasValidExtension) {
            return {
              success: false,
              message: `File type not allowed: ${part.filename}`
            };
          }
          
          // Check file size
          if (part.file.bytesRead > maxFileSize) {
            return {
              success: false,
              message: `File too large: ${part.filename}`
            };
          }
        }
      }
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: 'File upload validation failed'
      };
    }
  }

  /**
   * Validate query parameters
   */
  validateQueryParameters(request) {
    const query = request.query || {};
    const maxParamLength = 1000;
    const maxParams = 50;
    
    // Check number of parameters
    if (Object.keys(query).length > maxParams) {
      return {
        success: false,
        message: 'Too many query parameters'
      };
    }
    
    // Check parameter values
    for (const [key, value] of Object.entries(query)) {
      const valueStr = Array.isArray(value) ? value.join('') : String(value);
      
      if (valueStr.length > maxParamLength) {
        return {
          success: false,
          message: `Query parameter too long: ${key}`
        };
      }
      
      // Check for malicious patterns
      for (const pattern of this.xssPatterns) {
        if (pattern.test(valueStr)) {
          return {
            success: false,
            message: `Invalid query parameter: ${key}`
          };
        }
      }
    }
    
    return { success: true };
  }

  /**
   * Validate request size
   */
  validateRequestSize(request) {
    const maxRequestSize = 50 * 1024 * 1024; // 50MB for development
    const contentLength = parseInt(request.headers['content-length'] || '0', 10);
    
    if (contentLength > maxRequestSize) {
      return {
        success: false,
        message: 'Request too large'
      };
    }
    
    return { success: true };
  }

  /**
   * Generate a session ID for development
   */
  generateSessionId() {
    return crypto.randomUUID();
  }

  /**
   * Get current CSRF token for the request
   */
  getCurrentCsrfToken(request) {
    if (!this.csrfMiddleware) return null;
    
    try {
      // Try to extract existing token from request
      const existingToken = request.headers['x-csrf-token'] || 
                           request.cookies?.['eghact-csrf-token'];
      
      if (existingToken) {
        const validation = this.csrfMiddleware.validateToken(existingToken);
        if (validation.valid) {
          return existingToken;
        }
      }
      
      // Generate new token if none exists or invalid
      const sessionId = request.session?.id || this.generateSessionId();
      return this.csrfMiddleware.generateTokenForResponse({
        setHeader: () => {},
        setCookie: () => {}
      }, sessionId);
    } catch (error) {
      console.error('Error getting CSRF token:', error);
      return null;
    }
  }

  /**
   * Get security statistics for monitoring
   */
  getSecurityStats() {
    return {
      csrfEnabled: this.options.enableCsrf,
      xssEnabled: this.options.enableXssProtection,
      headersEnabled: this.options.enableSecurityHeaders,
      contentValidationEnabled: this.options.enableContentValidation,
      currentNonce: this.nonce,
      protectedEndpoints: this.csrfMiddleware?.getConfig().protectedMethods || [],
      ignoredPaths: this.csrfMiddleware?.getConfig().ignorePaths?.length || 0
    };
  }

  /**
   * Create development security report
   */
  generateSecurityReport() {
    const stats = this.getSecurityStats();
    
    return {
      timestamp: new Date().toISOString(),
      environment: 'development',
      security: {
        csrf: {
          enabled: stats.csrfEnabled,
          protectedMethods: stats.protectedEndpoints,
          ignoredPaths: stats.ignoredPaths
        },
        xss: {
          enabled: stats.xssEnabled,
          patternsCount: this.xssPatterns.length
        },
        headers: {
          enabled: stats.headersEnabled,
          cspNonce: stats.currentNonce
        },
        contentValidation: {
          enabled: stats.contentValidationEnabled
        }
      },
      recommendations: this.getSecurityRecommendations()
    };
  }

  /**
   * Get security recommendations for development
   */
  getSecurityRecommendations() {
    const recommendations = [];
    
    if (!this.options.enableCsrf) {
      recommendations.push('Enable CSRF protection for better security');
    }
    
    if (!this.options.enableXssProtection) {
      recommendations.push('Enable XSS protection to prevent script injection');
    }
    
    if (!this.options.enableSecurityHeaders) {
      recommendations.push('Enable security headers for better protection');
    }
    
    recommendations.push('Test security features before production deployment');
    recommendations.push('Review CSP policy for production environment');
    recommendations.push('Implement rate limiting for production use');
    
    return recommendations;
  }
}
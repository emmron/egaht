import { randomBytes, createHmac } from 'crypto';

export interface CSRFOptions {
  secret?: string;
  tokenName?: string;
  cookieName?: string;
  headerName?: string;
  saltLength?: number;
  skipFailureCallback?: boolean;
  ignoreMethods?: string[];
  value?: (req: any) => string;
}

export interface CSRFToken {
  token: string;
  secret: string;
  timestamp: number;
}

/**
 * CSRF Protection implementation using double-submit cookie pattern
 * Provides secure token generation and validation
 */
export class CSRFProtection {
  private options: Required<CSRFOptions>;
  private readonly defaultSecret: string;

  constructor(options: CSRFOptions = {}) {
    this.defaultSecret = randomBytes(32).toString('hex');
    
    this.options = {
      secret: options.secret || this.defaultSecret,
      tokenName: options.tokenName || '_csrf',
      cookieName: options.cookieName || '_csrf_token',
      headerName: options.headerName || 'X-CSRF-Token',
      saltLength: options.saltLength || 8,
      skipFailureCallback: options.skipFailureCallback ?? false,
      ignoreMethods: options.ignoreMethods || ['GET', 'HEAD', 'OPTIONS'],
      value: options.value || this.defaultTokenExtractor
    };
  }

  /**
   * Generate a new CSRF token
   */
  generateToken(): CSRFToken {
    const salt = randomBytes(this.options.saltLength);
    const secret = this.options.secret;
    const timestamp = Date.now();
    
    // Create token using HMAC with salt and timestamp
    const hmac = createHmac('sha256', secret);
    hmac.update(salt);
    hmac.update(timestamp.toString());
    
    const hash = hmac.digest('hex');
    const token = salt.toString('hex') + hash;
    
    return {
      token,
      secret,
      timestamp
    };
  }

  /**
   * Validate a CSRF token
   */
  validateToken(token: string, maxAge: number = 3600000): boolean { // 1 hour default
    if (!token || typeof token !== 'string') {
      return false;
    }

    try {
      // Extract salt and hash from token
      const saltLength = this.options.saltLength * 2; // hex encoding doubles length
      if (token.length <= saltLength) {
        return false;
      }

      const saltHex = token.substring(0, saltLength);
      const providedHash = token.substring(saltLength);
      
      // Find valid timestamp by trying recent timestamps
      const currentTime = Date.now();
      const startTime = currentTime - maxAge;
      
      // Try timestamps in 1-second intervals
      for (let timestamp = currentTime; timestamp >= startTime; timestamp -= 1000) {
        const expectedHash = this.computeTokenHash(saltHex, timestamp);
        if (this.secureCompare(providedHash, expectedHash)) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create CSRF middleware for Express-like frameworks
   */
  middleware() {
    return (req: any, res: any, next: any) => {
      const method = req.method?.toUpperCase();
      
      // Skip validation for safe methods
      if (this.options.ignoreMethods.includes(method)) {
        return next();
      }

      // Generate token if not present
      if (!req.csrfToken) {
        const tokenData = this.generateToken();
        req.csrfToken = () => tokenData.token;
        
        // Set cookie with token
        res.cookie(this.options.cookieName, tokenData.token, {
          httpOnly: true,
          secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
          sameSite: 'strict'
        });
      }

      // For state-changing methods, validate token
      if (!this.options.ignoreMethods.includes(method)) {
        const providedToken = this.extractToken(req);
        const cookieToken = req.cookies?.[this.options.cookieName];
        
        // Double-submit cookie validation
        if (!providedToken || !cookieToken || !this.validateToken(providedToken)) {
          const error = new Error('Invalid CSRF token');
          (error as any).code = 'EBADCSRFTOKEN';
          (error as any).status = 403;
          
          if (this.options.skipFailureCallback) {
            return next();
          }
          return next(error);
        }

        // Additional validation: cookie and form token should match
        if (providedToken !== cookieToken) {
          const error = new Error('CSRF token mismatch');
          (error as any).code = 'EBADCSRFTOKEN';
          (error as any).status = 403;
          return next(error);
        }
      }

      next();
    };
  }

  /**
   * Generate HTML hidden input for forms
   */
  generateFormField(token: string): string {
    return `<input type="hidden" name="${this.options.tokenName}" value="${token}">`;
  }

  /**
   * Generate meta tag for client-side access
   */
  generateMetaTag(token: string): string {
    return `<meta name="csrf-token" content="${token}">`;
  }

  /**
   * Client-side JavaScript code for automatic form enhancement
   */
  generateClientScript(): string {
    return `
      (function() {
        // Get CSRF token from meta tag
        function getCSRFToken() {
          const meta = document.querySelector('meta[name="csrf-token"]');
          return meta ? meta.getAttribute('content') : null;
        }

        // Add CSRF token to all forms
        function enhanceForms() {
          const token = getCSRFToken();
          if (!token) return;

          const forms = document.querySelectorAll('form');
          forms.forEach(form => {
            // Skip if already has CSRF field
            if (form.querySelector('input[name="${this.options.tokenName}"]')) return;
            
            // Skip GET forms
            if (form.method.toLowerCase() === 'get') return;

            // Add hidden CSRF field
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = '${this.options.tokenName}';
            input.value = token;
            form.appendChild(input);
          });
        }

        // Enhance fetch requests
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
          const token = getCSRFToken();
          if (token && options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase())) {
            options.headers = options.headers || {};
            options.headers['${this.options.headerName}'] = token;
          }
          return originalFetch.call(this, url, options);
        };

        // Enhance XMLHttpRequest
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
          this._method = method;
          return originalOpen.call(this, method, url, async, user, password);
        };
        
        XMLHttpRequest.prototype.send = function(data) {
          const token = getCSRFToken();
          if (token && this._method && !['GET', 'HEAD', 'OPTIONS'].includes(this._method.toUpperCase())) {
            this.setRequestHeader('${this.options.headerName}', token);
          }
          return originalSend.call(this, data);
        };

        // Run enhancement on DOM ready
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', enhanceForms);
        } else {
          enhanceForms();
        }

        // Re-enhance when new content is added
        const observer = new MutationObserver(enhanceForms);
        observer.observe(document.body, { childList: true, subtree: true });
      })();
    `;
  }

  private extractToken(req: any): string | null {
    // Try to extract token from various sources
    return this.options.value(req) ||
           req.body?.[this.options.tokenName] ||
           req.query?.[this.options.tokenName] ||
           req.headers?.[this.options.headerName.toLowerCase()] ||
           null;
  }

  private defaultTokenExtractor(req: any): string | null {
    return req.body?._csrf || 
           req.query?._csrf ||
           req.headers?.['x-csrf-token'] ||
           null;
  }

  private computeTokenHash(saltHex: string, timestamp: number): string {
    const hmac = createHmac('sha256', this.options.secret);
    hmac.update(Buffer.from(saltHex, 'hex'));
    hmac.update(timestamp.toString());
    return hmac.digest('hex');
  }

  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Rotate the secret key (for key rotation security)
   */
  rotateSecret(): string {
    const newSecret = randomBytes(32).toString('hex');
    this.options.secret = newSecret;
    return newSecret;
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<CSRFOptions>> {
    return { ...this.options };
  }

  /**
   * Create a validator function for custom implementations
   */
  createValidator(maxAge?: number) {
    return (token: string) => this.validateToken(token, maxAge);
  }
}
import { CsrfTokenGenerator, CsrfConfig, CsrfValidationResult } from './CsrfTokenGenerator';

/**
 * HTTP request interface (framework agnostic)
 */
export interface HttpRequest {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
  body?: any;
  url?: string;
  path?: string;
}

/**
 * HTTP response interface (framework agnostic)
 */
export interface HttpResponse {
  setHeader(name: string, value: string): void;
  setCookie?(name: string, value: string, options?: any): void;
  status?(code: number): void;
  json?(data: any): void;
  send?(data: any): void;
}

/**
 * CSRF middleware configuration
 */
export interface CsrfMiddlewareConfig extends CsrfConfig {
  /** Methods that require CSRF protection (default: ['POST', 'PUT', 'DELETE', 'PATCH']) */
  protectedMethods?: string[];
  /** Paths to ignore CSRF protection (regex patterns) */
  ignorePaths?: (string | RegExp)[];
  /** Custom error handler */
  onError?: (error: CsrfError, req: HttpRequest, res: HttpResponse) => void;
  /** Custom token extraction function */
  extractToken?: (req: HttpRequest) => string | null;
  /** Whether to automatically refresh tokens nearing expiration */
  autoRefresh?: boolean;
  /** Threshold for auto-refresh in milliseconds (default: 5 minutes) */
  refreshThreshold?: number;
}

/**
 * CSRF error types
 */
export enum CsrfErrorType {
  MISSING_TOKEN = 'MISSING_TOKEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  EXPIRED_TOKEN = 'EXPIRED_TOKEN',
  SESSION_MISMATCH = 'SESSION_MISMATCH',
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED'
}

/**
 * CSRF validation error
 */
export class CsrfError extends Error {
  constructor(
    public readonly type: CsrfErrorType,
    message: string,
    public readonly statusCode: number = 403
  ) {
    super(message);
    this.name = 'CsrfError';
  }
}

/**
 * Result of CSRF middleware processing
 */
export interface CsrfMiddlewareResult {
  /** Whether the request should continue */
  continue: boolean;
  /** Error if validation failed */
  error?: CsrfError;
  /** New token if auto-refresh was triggered */
  newToken?: string;
}

/**
 * CSRF protection middleware for Eghact framework
 * 
 * Provides comprehensive CSRF protection including:
 * - Double-submit cookie validation
 * - Configurable protected methods
 * - Path-based exclusions
 * - Automatic token refresh
 * - Framework-agnostic design
 * - Session integration
 */
export class CsrfMiddleware {
  private readonly generator: CsrfTokenGenerator;
  private readonly config: Required<CsrfMiddlewareConfig>;

  constructor(config: CsrfMiddlewareConfig = {}) {
    this.generator = new CsrfTokenGenerator(config);
    this.config = {
      ...config,
      protectedMethods: config.protectedMethods ?? ['POST', 'PUT', 'DELETE', 'PATCH'],
      ignorePaths: config.ignorePaths ?? [],
      autoRefresh: config.autoRefresh ?? true,
      refreshThreshold: config.refreshThreshold ?? 300000, // 5 minutes
      onError: config.onError ?? this.defaultErrorHandler,
      extractToken: config.extractToken ?? this.defaultTokenExtractor,
    } as Required<CsrfMiddlewareConfig>;
  }

  /**
   * Process incoming request for CSRF protection
   */
  async processRequest(req: HttpRequest, res: HttpResponse, sessionId?: string): Promise<CsrfMiddlewareResult> {
    // Check if method requires protection
    if (!this.requiresProtection(req)) {
      return { continue: true };
    }

    // Check if path should be ignored
    if (this.shouldIgnorePath(req)) {
      return { continue: true };
    }

    try {
      // Extract token from request
      const token = this.config.extractToken(req);
      
      if (!token) {
        const error = new CsrfError(
          CsrfErrorType.MISSING_TOKEN,
          'CSRF token is required for this request',
          403
        );
        return { continue: false, error };
      }

      // Validate token
      const validation = this.generator.validateToken(token, sessionId);
      
      if (!validation.valid) {
        const errorType = validation.expired 
          ? CsrfErrorType.EXPIRED_TOKEN 
          : CsrfErrorType.INVALID_TOKEN;
        
        const error = new CsrfError(
          errorType,
          validation.error || 'Invalid CSRF token',
          403
        );
        return { continue: false, error };
      }

      // Check for auto-refresh
      let newToken: string | undefined;
      if (this.config.autoRefresh && this.generator.isTokenExpiringSoon(token, this.config.refreshThreshold)) {
        const newTokenData = this.generator.generateToken(sessionId);
        newToken = newTokenData.token;
        
        // Set new token in response
        this.setTokenInResponse(res, newToken);
      }

      return { continue: true, newToken };
    } catch (error) {
      const csrfError = new CsrfError(
        CsrfErrorType.INVALID_TOKEN,
        `CSRF validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
      return { continue: false, error: csrfError };
    }
  }

  /**
   * Generate and set a new CSRF token in the response
   */
  generateTokenForResponse(res: HttpResponse, sessionId?: string): string {
    const tokenData = this.generator.generateToken(sessionId);
    this.setTokenInResponse(res, tokenData.token);
    return tokenData.token;
  }

  /**
   * Middleware function for Express.js-style frameworks
   */
  middleware() {
    return async (req: any, res: any, next: any) => {
      try {
        // Extract session ID (framework-specific logic)
        const sessionId = req.session?.id || req.sessionID || undefined;

        const result = await this.processRequest(req, res, sessionId);

        if (!result.continue && result.error) {
          this.config.onError(result.error, req, res);
          return;
        }

        // Add token to locals for template rendering
        if (res.locals) {
          res.locals.csrfToken = this.extractTokenFromRequest(req) || 
                                this.generateTokenForResponse(res, sessionId);
        }

        next();
      } catch (error) {
        const csrfError = new CsrfError(
          CsrfErrorType.INVALID_TOKEN,
          `CSRF middleware error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          500
        );
        this.config.onError(csrfError, req, res);
      }
    };
  }

  /**
   * Check if request method requires CSRF protection
   */
  private requiresProtection(req: HttpRequest): boolean {
    return this.config.protectedMethods.includes(req.method.toUpperCase());
  }

  /**
   * Check if request path should be ignored
   */
  private shouldIgnorePath(req: HttpRequest): boolean {
    const path = req.path || req.url || '';
    
    return this.config.ignorePaths.some(pattern => {
      if (typeof pattern === 'string') {
        return path === pattern;
      }
      return pattern.test(path);
    });
  }

  /**
   * Default token extraction function
   */
  private defaultTokenExtractor(req: HttpRequest): string | null {
    const config = this.generator.getConfig();
    
    // Try header first
    const headerToken = req.headers[config.headerName.toLowerCase()] || 
                       req.headers[config.headerName];
    if (headerToken) {
      return Array.isArray(headerToken) ? headerToken[0] : headerToken;
    }

    // Try cookie
    if (req.cookies && req.cookies[config.cookieName]) {
      return req.cookies[config.cookieName];
    }

    // Try body field
    if (req.body && typeof req.body === 'object') {
      return req.body[config.fieldName] || null;
    }

    return null;
  }

  /**
   * Extract token from request for template rendering
   */
  private extractTokenFromRequest(req: HttpRequest): string | null {
    return this.config.extractToken(req);
  }

  /**
   * Set token in response (both cookie and header)
   */
  private setTokenInResponse(res: HttpResponse, token: string): void {
    const config = this.generator.getConfig();
    const cookieOptions = this.generator.getCookieOptions();

    // Set cookie if setCookie method exists
    if (res.setCookie) {
      res.setCookie(config.cookieName, token, cookieOptions);
    }

    // Set header for AJAX requests
    res.setHeader(config.headerName, token);
  }

  /**
   * Default error handler
   */
  private defaultErrorHandler(error: CsrfError, req: HttpRequest, res: HttpResponse): void {
    // Set status if method exists
    if (res.status) {
      res.status(error.statusCode);
    }

    // Send JSON response if method exists
    if (res.json) {
      res.json({
        error: 'CSRF Protection',
        message: error.message,
        type: error.type,
        statusCode: error.statusCode,
      });
    } else if (res.send) {
      res.send(`CSRF Error: ${error.message}`);
    }
  }

  /**
   * Get middleware configuration
   */
  getConfig(): Readonly<CsrfMiddlewareConfig> {
    return { ...this.config };
  }

  /**
   * Validate a token manually
   */
  validateToken(token: string, sessionId?: string): CsrfValidationResult {
    return this.generator.validateToken(token, sessionId);
  }
}
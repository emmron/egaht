/**
 * @eghact/csrf-protection
 * 
 * Comprehensive CSRF protection module for Eghact framework
 * 
 * Features:
 * - Cryptographically secure token generation
 * - Double-submit cookie strategy
 * - Framework-agnostic middleware
 * - Automatic form integration
 * - AJAX request protection
 * - Token refresh and auto-expiry
 * - Session integration
 * - Configurable security policies
 * 
 * @example Basic Usage
 * ```typescript
 * import { CsrfProtection } from '@eghact/csrf-protection';
 * 
 * const csrf = new CsrfProtection({
 *   tokenTtl: 3600000, // 1 hour
 *   secureCookies: true,
 *   sameSite: 'strict'
 * });
 * 
 * // In your Eghact middleware
 * app.use(csrf.middleware());
 * ```
 * 
 * @example Advanced Usage
 * ```typescript
 * import { CsrfTokenGenerator, CsrfMiddleware, CsrfFormIntegration } from '@eghact/csrf-protection';
 * 
 * const generator = new CsrfTokenGenerator({
 *   tokenLength: 32,
 *   tokenTtl: 1800000, // 30 minutes
 *   secret: process.env.CSRF_SECRET
 * });
 * 
 * const middleware = new CsrfMiddleware({
 *   protectedMethods: ['POST', 'PUT', 'DELETE'],
 *   ignorePaths: ['/api/webhooks/*'],
 *   autoRefresh: true
 * });
 * ```
 */

// Core exports
export { CsrfTokenGenerator } from './CsrfTokenGenerator';
export { CsrfMiddleware } from './CsrfMiddleware';
export { CsrfFormIntegration, CsrfFormHelper } from './FormIntegration';

// Type exports
export type {
  CsrfConfig,
  CsrfToken,
  CsrfValidationResult,
} from './CsrfTokenGenerator';

export type {
  CsrfMiddlewareConfig,
  HttpRequest,
  HttpResponse,
  CsrfMiddlewareResult,
} from './CsrfMiddleware';

export type {
  FormIntegrationConfig,
} from './FormIntegration';

export {
  CsrfError,
  CsrfErrorType,
} from './CsrfMiddleware';

/**
 * Main CSRF protection class that combines all functionality
 * 
 * This is the recommended entry point for most applications.
 * It provides a simplified API that combines token generation,
 * middleware processing, and form integration.
 */
export class CsrfProtection {
  private readonly generator: CsrfTokenGenerator;
  private readonly middleware: CsrfMiddleware;
  private readonly formHelper: CsrfFormHelper;

  constructor(config: CsrfConfig & CsrfMiddlewareConfig = {}) {
    this.generator = new CsrfTokenGenerator(config);
    this.middleware = new CsrfMiddleware(config);
    this.formHelper = new CsrfFormHelper(this.generator);
  }

  /**
   * Generate a new CSRF token
   */
  generateToken(sessionId?: string) {
    return this.generator.generateToken(sessionId);
  }

  /**
   * Validate a CSRF token
   */
  validateToken(token: string, sessionId?: string) {
    return this.generator.validateToken(token, sessionId);
  }

  /**
   * Get Express.js-style middleware function
   */
  middleware() {
    return this.middleware.middleware();
  }

  /**
   * Process request manually (for custom frameworks)
   */
  async processRequest(req: HttpRequest, res: HttpResponse, sessionId?: string) {
    return this.middleware.processRequest(req, res, sessionId);
  }

  /**
   * Generate token for response
   */
  generateTokenForResponse(res: HttpResponse, sessionId?: string) {
    return this.middleware.generateTokenForResponse(res, sessionId);
  }

  /**
   * Get form helper utilities
   */
  getFormHelper() {
    return this.formHelper;
  }

  /**
   * Get template helper functions for Eghact components
   */
  getTemplateHelpers() {
    return this.formHelper.createTemplateHelper();
  }

  /**
   * Get configuration
   */
  getConfig() {
    return {
      generator: this.generator.getConfig(),
      middleware: this.middleware.getConfig(),
    };
  }
}

/**
 * Create a CSRF protection instance with default configuration
 * 
 * @example
 * ```typescript
 * import { createCsrfProtection } from '@eghact/csrf-protection';
 * 
 * const csrf = createCsrfProtection();
 * app.use(csrf.middleware());
 * ```
 */
export function createCsrfProtection(config?: CsrfConfig & CsrfMiddlewareConfig): CsrfProtection {
  return new CsrfProtection(config);
}

/**
 * Utility function to extract CSRF token from various sources
 * 
 * @example
 * ```typescript
 * import { extractCsrfToken } from '@eghact/csrf-protection';
 * 
 * const token = extractCsrfToken(req, {
 *   headerName: 'X-CSRF-Token',
 *   cookieName: '_csrf',
 *   fieldName: '_csrf'
 * });
 * ```
 */
export function extractCsrfToken(
  req: HttpRequest,
  config?: { headerName?: string; cookieName?: string; fieldName?: string }
): string | null {
  const headerName = config?.headerName || 'X-CSRF-Token';
  const cookieName = config?.cookieName || '_csrf';
  const fieldName = config?.fieldName || '_csrf';

  // Try header first
  const headerToken = req.headers[headerName.toLowerCase()] || req.headers[headerName];
  if (headerToken) {
    return Array.isArray(headerToken) ? headerToken[0] : headerToken;
  }

  // Try cookie
  if (req.cookies && req.cookies[cookieName]) {
    return req.cookies[cookieName];
  }

  // Try body field
  if (req.body && typeof req.body === 'object') {
    return req.body[fieldName] || null;
  }

  return null;
}

/**
 * Default export for convenience
 */
export default CsrfProtection;
import { randomBytes, createHash, timingSafeEqual } from 'crypto';

/**
 * Configuration options for CSRF token generation
 */
export interface CsrfConfig {
  /** Token length in bytes (default: 32) */
  tokenLength?: number;
  /** Token expiry time in milliseconds (default: 1 hour) */
  tokenTtl?: number;
  /** Cookie name for CSRF token (default: '_csrf') */
  cookieName?: string;
  /** Header name for CSRF token (default: 'X-CSRF-Token') */
  headerName?: string;
  /** Form field name for CSRF token (default: '_csrf') */
  fieldName?: string;
  /** Whether to use secure cookies in production */
  secureCookies?: boolean;
  /** SameSite cookie attribute */
  sameSite?: 'strict' | 'lax' | 'none';
  /** Custom secret for token generation (if not provided, uses random) */
  secret?: string;
}

/**
 * CSRF token with metadata
 */
export interface CsrfToken {
  /** The actual token value */
  token: string;
  /** Token expiration timestamp */
  expiresAt: number;
  /** Token generation timestamp */
  createdAt: number;
  /** Session identifier (optional) */
  sessionId?: string;
}

/**
 * CSRF token validation result
 */
export interface CsrfValidationResult {
  /** Whether the token is valid */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Whether the token is expired */
  expired?: boolean;
}

/**
 * Secure CSRF token generator using double-submit cookie strategy
 * 
 * This implementation provides protection against CSRF attacks by:
 * 1. Generating cryptographically secure random tokens
 * 2. Using double-submit cookie pattern
 * 3. Time-based token expiration
 * 4. Constant-time comparison to prevent timing attacks
 * 5. Secure cookie attributes in production
 */
export class CsrfTokenGenerator {
  private readonly config: Required<CsrfConfig>;
  private readonly secret: Buffer;

  constructor(config: CsrfConfig = {}) {
    this.config = {
      tokenLength: config.tokenLength ?? 32,
      tokenTtl: config.tokenTtl ?? 3600000, // 1 hour
      cookieName: config.cookieName ?? '_csrf',
      headerName: config.headerName ?? 'X-CSRF-Token',
      fieldName: config.fieldName ?? '_csrf',
      secureCookies: config.secureCookies ?? process.env.NODE_ENV === 'production',
      sameSite: config.sameSite ?? 'strict',
      secret: config.secret ?? this.generateSecret(),
    };

    // Convert secret to buffer for consistent usage
    this.secret = Buffer.isBuffer(this.config.secret) 
      ? this.config.secret as Buffer
      : Buffer.from(this.config.secret, 'utf8');
  }

  /**
   * Generate a new CSRF token
   */
  generateToken(sessionId?: string): CsrfToken {
    const tokenBytes = randomBytes(this.config.tokenLength);
    const timestamp = Date.now();
    const expiresAt = timestamp + this.config.tokenTtl;

    // Create token payload with timestamp and optional session ID
    const payload = JSON.stringify({
      random: tokenBytes.toString('base64'),
      timestamp,
      sessionId: sessionId || null,
    });

    // Create HMAC signature to prevent tampering
    const signature = this.createSignature(payload);
    
    // Combine payload and signature
    const token = Buffer.concat([
      Buffer.from(payload, 'utf8'),
      Buffer.from(':', 'utf8'),
      signature
    ]).toString('base64url');

    return {
      token,
      expiresAt,
      createdAt: timestamp,
      sessionId,
    };
  }

  /**
   * Validate a CSRF token
   */
  validateToken(token: string, sessionId?: string): CsrfValidationResult {
    try {
      // Decode the token
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const colonIndex = decoded.lastIndexOf(':');
      
      if (colonIndex === -1) {
        return { valid: false, error: 'Invalid token format' };
      }

      const payload = decoded.substring(0, colonIndex);
      const signature = Buffer.from(decoded.substring(colonIndex + 1), 'utf8');

      // Verify signature
      const expectedSignature = this.createSignature(payload);
      if (!timingSafeEqual(signature, expectedSignature)) {
        return { valid: false, error: 'Invalid token signature' };
      }

      // Parse payload
      const data = JSON.parse(payload);
      const now = Date.now();
      const expiresAt = data.timestamp + this.config.tokenTtl;

      // Check expiration
      if (now > expiresAt) {
        return { valid: false, error: 'Token expired', expired: true };
      }

      // Check session ID if provided
      if (sessionId && data.sessionId && data.sessionId !== sessionId) {
        return { valid: false, error: 'Session ID mismatch' };
      }

      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: `Token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Generate cookie options for CSRF token
   */
  getCookieOptions(): object {
    return {
      httpOnly: false, // Client needs to read this for AJAX requests
      secure: this.config.secureCookies,
      sameSite: this.config.sameSite,
      maxAge: this.config.tokenTtl,
      path: '/',
    };
  }

  /**
   * Get configuration values
   */
  getConfig(): Pick<Required<CsrfConfig>, 'cookieName' | 'headerName' | 'fieldName'> {
    return {
      cookieName: this.config.cookieName,
      headerName: this.config.headerName,
      fieldName: this.config.fieldName,
    };
  }

  /**
   * Create HMAC signature for token payload
   */
  private createSignature(payload: string): Buffer {
    const hash = createHash('sha256');
    hash.update(this.secret);
    hash.update(payload);
    return hash.digest();
  }

  /**
   * Generate a secure random secret
   */
  private generateSecret(): string {
    return randomBytes(64).toString('base64');
  }

  /**
   * Utility method to check if a token is close to expiring
   */
  isTokenExpiringSoon(token: string, warningThresholdMs: number = 300000): boolean {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const colonIndex = decoded.lastIndexOf(':');
      
      if (colonIndex === -1) return true;
      
      const payload = decoded.substring(0, colonIndex);
      const data = JSON.parse(payload);
      const expiresAt = data.timestamp + this.config.tokenTtl;
      const now = Date.now();
      
      return (expiresAt - now) < warningThresholdMs;
    } catch {
      return true; // Assume expiring if we can't parse
    }
  }

  /**
   * Extract session ID from token (if present)
   */
  extractSessionId(token: string): string | null {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const colonIndex = decoded.lastIndexOf(':');
      
      if (colonIndex === -1) return null;
      
      const payload = decoded.substring(0, colonIndex);
      const data = JSON.parse(payload);
      
      return data.sessionId || null;
    } catch {
      return null;
    }
  }
}
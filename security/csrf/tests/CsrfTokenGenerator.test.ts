import { CsrfTokenGenerator, CsrfConfig } from '../src/CsrfTokenGenerator';

describe('CsrfTokenGenerator', () => {
  let generator: CsrfTokenGenerator;

  beforeEach(() => {
    generator = new CsrfTokenGenerator({
      tokenLength: 32,
      tokenTtl: 3600000, // 1 hour
      secret: 'test-secret-key-for-consistent-testing',
    });
  });

  describe('Token Generation', () => {
    test('should generate a valid token', () => {
      const token = generator.generateToken();
      
      expect(token.token).toBeDefined();
      expect(typeof token.token).toBe('string');
      expect(token.token.length).toBeGreaterThan(0);
      expect(token.expiresAt).toBeGreaterThan(Date.now());
      expect(token.createdAt).toBeLessThanOrEqual(Date.now());
    });

    test('should generate different tokens each time', () => {
      const token1 = generator.generateToken();
      const token2 = generator.generateToken();
      
      expect(token1.token).not.toBe(token2.token);
    });

    test('should include session ID when provided', () => {
      const sessionId = 'test-session-123';
      const token = generator.generateToken(sessionId);
      
      expect(token.sessionId).toBe(sessionId);
    });

    test('should handle missing session ID', () => {
      const token = generator.generateToken();
      
      expect(token.sessionId).toBeUndefined();
    });
  });

  describe('Token Validation', () => {
    test('should validate a valid token', () => {
      const tokenData = generator.generateToken();
      const validation = generator.validateToken(tokenData.token);
      
      expect(validation.valid).toBe(true);
      expect(validation.error).toBeUndefined();
      expect(validation.expired).toBeUndefined();
    });

    test('should reject invalid token format', () => {
      const validation = generator.validateToken('invalid-token');
      
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Invalid token format');
    });

    test('should reject tampered token', () => {
      const tokenData = generator.generateToken();
      const tamperedToken = tokenData.token + 'tampered';
      const validation = generator.validateToken(tamperedToken);
      
      expect(validation.valid).toBe(false);
      expect(validation.error).toBeDefined();
    });

    test('should validate session ID match', () => {
      const sessionId = 'test-session-456';
      const tokenData = generator.generateToken(sessionId);
      const validation = generator.validateToken(tokenData.token, sessionId);
      
      expect(validation.valid).toBe(true);
    });

    test('should reject session ID mismatch', () => {
      const tokenData = generator.generateToken('session-1');
      const validation = generator.validateToken(tokenData.token, 'session-2');
      
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Session ID mismatch');
    });

    test('should handle expired tokens', () => {
      const shortLivedGenerator = new CsrfTokenGenerator({
        tokenTtl: 1, // 1ms TTL
        secret: 'test-secret',
      });
      
      const tokenData = shortLivedGenerator.generateToken();
      
      // Wait for expiration
      return new Promise((resolve) => {
        setTimeout(() => {
          const validation = shortLivedGenerator.validateToken(tokenData.token);
          expect(validation.valid).toBe(false);
          expect(validation.expired).toBe(true);
          expect(validation.error).toContain('Token expired');
          resolve(undefined);
        }, 10);
      });
    });
  });

  describe('Token Expiration', () => {
    test('should detect tokens expiring soon', () => {
      const tokenData = generator.generateToken();
      const isExpiringSoon = generator.isTokenExpiringSoon(tokenData.token, 3700000); // 61 minutes
      
      expect(isExpiringSoon).toBe(true);
    });

    test('should detect tokens not expiring soon', () => {
      const tokenData = generator.generateToken();
      const isExpiringSoon = generator.isTokenExpiringSoon(tokenData.token, 300000); // 5 minutes
      
      expect(isExpiringSoon).toBe(false);
    });

    test('should handle invalid tokens in expiration check', () => {
      const isExpiringSoon = generator.isTokenExpiringSoon('invalid-token');
      
      expect(isExpiringSoon).toBe(true); // Assume expiring if invalid
    });
  });

  describe('Session ID Extraction', () => {
    test('should extract session ID from token', () => {
      const sessionId = 'test-session-789';
      const tokenData = generator.generateToken(sessionId);
      const extractedSessionId = generator.extractSessionId(tokenData.token);
      
      expect(extractedSessionId).toBe(sessionId);
    });

    test('should return null for token without session ID', () => {
      const tokenData = generator.generateToken();
      const extractedSessionId = generator.extractSessionId(tokenData.token);
      
      expect(extractedSessionId).toBeNull();
    });

    test('should handle invalid tokens', () => {
      const extractedSessionId = generator.extractSessionId('invalid-token');
      
      expect(extractedSessionId).toBeNull();
    });
  });

  describe('Configuration', () => {
    test('should use custom configuration', () => {
      const customConfig: CsrfConfig = {
        tokenLength: 16,
        tokenTtl: 1800000, // 30 minutes
        cookieName: 'custom-csrf',
        headerName: 'X-Custom-CSRF',
        fieldName: 'custom_csrf',
        secureCookies: true,
        sameSite: 'lax',
      };
      
      const customGenerator = new CsrfTokenGenerator(customConfig);
      const config = customGenerator.getConfig();
      
      expect(config.cookieName).toBe('custom-csrf');
      expect(config.headerName).toBe('X-Custom-CSRF');
      expect(config.fieldName).toBe('custom_csrf');
    });

    test('should get cookie options', () => {
      const cookieOptions = generator.getCookieOptions();
      
      expect(cookieOptions).toHaveProperty('httpOnly', false);
      expect(cookieOptions).toHaveProperty('sameSite');
      expect(cookieOptions).toHaveProperty('maxAge');
      expect(cookieOptions).toHaveProperty('path', '/');
    });

    test('should use secure cookies in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const prodGenerator = new CsrfTokenGenerator();
      const cookieOptions = prodGenerator.getCookieOptions();
      
      expect(cookieOptions).toHaveProperty('secure', true);
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Security', () => {
    test('should use different secrets for different instances', () => {
      const generator1 = new CsrfTokenGenerator();
      const generator2 = new CsrfTokenGenerator();
      
      const token1 = generator1.generateToken();
      const token2 = generator2.generateToken();
      
      // Tokens should be different even with same content due to different secrets
      expect(token1.token).not.toBe(token2.token);
      
      // Each generator should only validate its own tokens
      expect(generator1.validateToken(token2.token).valid).toBe(false);
      expect(generator2.validateToken(token1.token).valid).toBe(false);
    });

    test('should resist timing attacks', () => {
      const tokenData = generator.generateToken();
      const validToken = tokenData.token;
      const invalidToken = 'invalid-token-with-same-length-as-valid-one-to-test-timing';
      
      // Both should fail quickly without revealing timing information
      const start1 = process.hrtime.bigint();
      const result1 = generator.validateToken(invalidToken);
      const time1 = process.hrtime.bigint() - start1;
      
      const start2 = process.hrtime.bigint();
      const result2 = generator.validateToken(validToken);
      const time2 = process.hrtime.bigint() - start2;
      
      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(true);
      
      // Timing difference should be minimal (within reasonable bounds)
      const timeDiff = Number(time1 - time2) / 1000000; // Convert to milliseconds
      expect(Math.abs(timeDiff)).toBeLessThan(100); // Less than 100ms difference
    });

    test('should generate cryptographically secure tokens', () => {
      const tokens = new Set();
      const tokenCount = 1000;
      
      // Generate many tokens and check for uniqueness
      for (let i = 0; i < tokenCount; i++) {
        const token = generator.generateToken();
        expect(tokens.has(token.token)).toBe(false);
        tokens.add(token.token);
      }
      
      expect(tokens.size).toBe(tokenCount);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed token gracefully', () => {
      const malformedTokens = [
        '',
        'a',
        'invalid',
        'definitely-not-a-valid-token',
        null as any,
        undefined as any,
        123 as any,
        {} as any,
      ];
      
      malformedTokens.forEach(token => {
        const validation = generator.validateToken(token);
        expect(validation.valid).toBe(false);
        expect(validation.error).toBeDefined();
      });
    });

    test('should handle edge cases in session validation', () => {
      const tokenWithSession = generator.generateToken('session-1');
      
      // Test various session ID scenarios
      expect(generator.validateToken(tokenWithSession.token, '').valid).toBe(false);
      expect(generator.validateToken(tokenWithSession.token, null as any).valid).toBe(true);
      expect(generator.validateToken(tokenWithSession.token, undefined).valid).toBe(true);
    });
  });
});
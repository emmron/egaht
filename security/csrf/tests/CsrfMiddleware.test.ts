import { CsrfMiddleware, CsrfError, CsrfErrorType, HttpRequest, HttpResponse } from '../src/CsrfMiddleware';

// Mock response object for testing
class MockResponse implements HttpResponse {
  public headers: Record<string, string> = {};
  public cookies: Record<string, { value: string; options: any }> = {};
  public statusCode: number = 200;
  public body: any = null;

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  setCookie(name: string, value: string, options?: any): void {
    this.cookies[name] = { value, options: options || {} };
  }

  status(code: number): void {
    this.statusCode = code;
  }

  json(data: any): void {
    this.body = data;
  }

  send(data: any): void {
    this.body = data;
  }
}

describe('CsrfMiddleware', () => {
  let middleware: CsrfMiddleware;
  let mockResponse: MockResponse;

  beforeEach(() => {
    middleware = new CsrfMiddleware({
      tokenTtl: 3600000, // 1 hour
      secret: 'test-secret-for-consistency',
      protectedMethods: ['POST', 'PUT', 'DELETE', 'PATCH'],
    });
    mockResponse = new MockResponse();
  });

  describe('Request Processing', () => {
    test('should allow GET requests without token', async () => {
      const request: HttpRequest = {
        method: 'GET',
        headers: {},
        url: '/test',
      };

      const result = await middleware.processRequest(request, mockResponse);
      
      expect(result.continue).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should require token for POST requests', async () => {
      const request: HttpRequest = {
        method: 'POST',
        headers: {},
        url: '/test',
      };

      const result = await middleware.processRequest(request, mockResponse);
      
      expect(result.continue).toBe(false);
      expect(result.error).toBeInstanceOf(CsrfError);
      expect(result.error?.type).toBe(CsrfErrorType.MISSING_TOKEN);
    });

    test('should validate valid token in header', async () => {
      // First generate a token
      const token = middleware.generateTokenForResponse(mockResponse);
      
      const request: HttpRequest = {
        method: 'POST',
        headers: {
          'x-csrf-token': token,
        },
        url: '/test',
      };

      const result = await middleware.processRequest(request, mockResponse);
      
      expect(result.continue).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should validate valid token in cookie', async () => {
      // First generate a token
      const token = middleware.generateTokenForResponse(mockResponse);
      
      const request: HttpRequest = {
        method: 'POST',
        headers: {},
        cookies: {
          '_csrf': token,
        },
        url: '/test',
      };

      const result = await middleware.processRequest(request, mockResponse);
      
      expect(result.continue).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should validate valid token in body', async () => {
      // First generate a token
      const token = middleware.generateTokenForResponse(mockResponse);
      
      const request: HttpRequest = {
        method: 'POST',
        headers: {},
        body: {
          '_csrf': token,
          'other': 'data',
        },
        url: '/test',
      };

      const result = await middleware.processRequest(request, mockResponse);
      
      expect(result.continue).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should reject invalid token', async () => {
      const request: HttpRequest = {
        method: 'POST',
        headers: {
          'x-csrf-token': 'invalid-token',
        },
        url: '/test',
      };

      const result = await middleware.processRequest(request, mockResponse);
      
      expect(result.continue).toBe(false);
      expect(result.error).toBeInstanceOf(CsrfError);
      expect(result.error?.type).toBe(CsrfErrorType.INVALID_TOKEN);
    });

    test('should handle session ID validation', async () => {
      const sessionId = 'test-session-123';
      
      // Generate token with session ID
      const token = middleware.generateTokenForResponse(mockResponse, sessionId);
      
      const request: HttpRequest = {
        method: 'POST',
        headers: {
          'x-csrf-token': token,
        },
        url: '/test',
      };

      // Validate with correct session ID
      const result1 = await middleware.processRequest(request, mockResponse, sessionId);
      expect(result1.continue).toBe(true);

      // Validate with wrong session ID
      const result2 = await middleware.processRequest(request, mockResponse, 'wrong-session');
      expect(result2.continue).toBe(false);
      expect(result2.error?.type).toBe(CsrfErrorType.INVALID_TOKEN);
    });
  });

  describe('Path Ignoring', () => {
    test('should ignore specified paths', async () => {
      const middlewareWithIgnorePaths = new CsrfMiddleware({
        ignorePaths: ['/api/webhook', /^\/public\/.*$/],
        secret: 'test-secret',
      });

      const requests = [
        { method: 'POST', url: '/api/webhook', headers: {} },
        { method: 'POST', url: '/public/upload', headers: {} },
        { method: 'POST', url: '/public/data.json', headers: {} },
      ];

      for (const request of requests) {
        const result = await middlewareWithIgnorePaths.processRequest(request, mockResponse);
        expect(result.continue).toBe(true);
      }
    });

    test('should not ignore non-matching paths', async () => {
      const middlewareWithIgnorePaths = new CsrfMiddleware({
        ignorePaths: ['/api/webhook'],
        secret: 'test-secret',
      });

      const request: HttpRequest = {
        method: 'POST',
        headers: {},
        url: '/api/other',
      };

      const result = await middlewareWithIgnorePaths.processRequest(request, mockResponse);
      
      expect(result.continue).toBe(false);
      expect(result.error?.type).toBe(CsrfErrorType.MISSING_TOKEN);
    });
  });

  describe('Token Auto-Refresh', () => {
    test('should auto-refresh expiring tokens', async () => {
      const middlewareWithShortTtl = new CsrfMiddleware({
        tokenTtl: 100, // Very short TTL
        refreshThreshold: 200, // Refresh threshold longer than TTL
        autoRefresh: true,
        secret: 'test-secret',
      });

      // Generate a token
      const token = middlewareWithShortTtl.generateTokenForResponse(mockResponse);
      
      const request: HttpRequest = {
        method: 'POST',
        headers: {
          'x-csrf-token': token,
        },
        url: '/test',
      };

      const result = await middlewareWithShortTtl.processRequest(request, mockResponse);
      
      expect(result.continue).toBe(true);
      expect(result.newToken).toBeDefined();
      expect(result.newToken).not.toBe(token);
    });

    test('should not refresh non-expiring tokens', async () => {
      const middlewareWithLongTtl = new CsrfMiddleware({
        tokenTtl: 3600000, // 1 hour
        refreshThreshold: 300000, // 5 minutes
        autoRefresh: true,
        secret: 'test-secret',
      });

      // Generate a token
      const token = middlewareWithLongTtl.generateTokenForResponse(mockResponse);
      
      const request: HttpRequest = {
        method: 'POST',
        headers: {
          'x-csrf-token': token,
        },
        url: '/test',
      };

      const result = await middlewareWithLongTtl.processRequest(request, mockResponse);
      
      expect(result.continue).toBe(true);
      expect(result.newToken).toBeUndefined();
    });
  });

  describe('Express Middleware', () => {
    test('should work as Express middleware', (done) => {
      const expressMiddleware = middleware.middleware();
      
      // Generate a token first
      const token = middleware.generateTokenForResponse(mockResponse);
      
      const req = {
        method: 'POST',
        headers: {
          'x-csrf-token': token,
        },
        url: '/test',
        session: {
          id: 'test-session',
        },
      };

      const res = {
        ...mockResponse,
        locals: {},
      };

      const next = (error?: any) => {
        expect(error).toBeUndefined();
        expect(res.locals.csrfToken).toBeDefined();
        done();
      };

      expressMiddleware(req, res, next);
    });

    test('should handle errors in Express middleware', (done) => {
      const middlewareWithCustomError = new CsrfMiddleware({
        secret: 'test-secret',
        onError: (error, req, res) => {
          expect(error).toBeInstanceOf(CsrfError);
          expect(error.type).toBe(CsrfErrorType.MISSING_TOKEN);
          done();
        },
      });

      const expressMiddleware = middlewareWithCustomError.middleware();
      
      const req = {
        method: 'POST',
        headers: {},
        url: '/test',
      };

      const res = mockResponse;
      const next = () => {
        // Should not reach here
        expect(true).toBe(false);
        done();
      };

      expressMiddleware(req, res, next);
    });
  });

  describe('Configuration', () => {
    test('should use custom configuration', () => {
      const customMiddleware = new CsrfMiddleware({
        protectedMethods: ['POST', 'PUT'],
        cookieName: 'custom-csrf',
        headerName: 'X-Custom-CSRF',
        fieldName: 'custom_csrf',
        secret: 'custom-secret',
      });

      const config = customMiddleware.getConfig();
      
      expect(config.protectedMethods).toEqual(['POST', 'PUT']);
    });

    test('should allow custom token extraction', async () => {
      const customMiddleware = new CsrfMiddleware({
        extractToken: (req) => {
          return req.headers['custom-token'] as string || null;
        },
        secret: 'test-secret',
      });

      const token = customMiddleware.generateTokenForResponse(mockResponse);
      
      const request: HttpRequest = {
        method: 'POST',
        headers: {
          'custom-token': token,
        },
        url: '/test',
      };

      const result = await customMiddleware.processRequest(request, mockResponse);
      
      expect(result.continue).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle various error types', async () => {
      const requests = [
        {
          name: 'missing token',
          request: { method: 'POST', headers: {}, url: '/test' },
          expectedType: CsrfErrorType.MISSING_TOKEN,
        },
        {
          name: 'invalid token',
          request: { method: 'POST', headers: { 'x-csrf-token': 'invalid' }, url: '/test' },
          expectedType: CsrfErrorType.INVALID_TOKEN,
        },
      ];

      for (const testCase of requests) {
        const result = await middleware.processRequest(testCase.request, mockResponse);
        
        expect(result.continue).toBe(false);
        expect(result.error).toBeInstanceOf(CsrfError);
        expect(result.error?.type).toBe(testCase.expectedType);
      }
    });

    test('should use default error handler', async () => {
      const request: HttpRequest = {
        method: 'POST',
        headers: {},
        url: '/test',
      };

      await middleware.processRequest(request, mockResponse);
      
      // Test that default error handler sets appropriate response
      const config = middleware.getConfig();
      if (config.onError) {
        const error = new CsrfError(CsrfErrorType.MISSING_TOKEN, 'Test error', 403);
        config.onError(error, request, mockResponse);
        
        expect(mockResponse.statusCode).toBe(403);
        expect(mockResponse.body).toMatchObject({
          error: 'CSRF Protection',
          type: CsrfErrorType.MISSING_TOKEN,
          statusCode: 403,
        });
      }
    });
  });

  describe('Security', () => {
    test('should protect against CSRF attacks', async () => {
      // Simulate a CSRF attack where attacker tries to use a token from different session
      const legitimateSessionId = 'legitimate-session';
      const attackerSessionId = 'attacker-session';
      
      // Generate token for legitimate user
      const token = middleware.generateTokenForResponse(mockResponse, legitimateSessionId);
      
      // Attacker tries to use the token with their session
      const attackRequest: HttpRequest = {
        method: 'POST',
        headers: {
          'x-csrf-token': token,
        },
        url: '/transfer-money',
      };

      const result = await middleware.processRequest(attackRequest, mockResponse, attackerSessionId);
      
      expect(result.continue).toBe(false);
      expect(result.error?.type).toBe(CsrfErrorType.INVALID_TOKEN);
    });

    test('should prevent token replay attacks with expiration', async () => {
      const shortLivedMiddleware = new CsrfMiddleware({
        tokenTtl: 1, // 1ms TTL
        secret: 'test-secret',
      });

      const token = shortLivedMiddleware.generateTokenForResponse(mockResponse);
      
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const request: HttpRequest = {
        method: 'POST',
        headers: {
          'x-csrf-token': token,
        },
        url: '/test',
      };

      const result = await shortLivedMiddleware.processRequest(request, mockResponse);
      
      expect(result.continue).toBe(false);
      expect(result.error?.type).toBe(CsrfErrorType.EXPIRED_TOKEN);
    });
  });
});
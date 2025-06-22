/**
 * @jest-environment jsdom
 */

import { CsrfFormIntegration, CsrfFormHelper } from '../src/FormIntegration';
import { CsrfTokenGenerator } from '../src/CsrfTokenGenerator';

// Mock XMLHttpRequest for testing
class MockXMLHttpRequest {
  public method: string = '';
  public url: string = '';
  public headers: Record<string, string> = {};
  public readyState: number = 0;
  public status: number = 200;
  public response: any = '';
  public responseText: string = '';

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  send(data?: any): void {
    // Simulate async response
    setTimeout(() => {
      this.readyState = 4;
      this.status = 200;
      if (this.onload) {
        this.onload();
      }
    }, 0);
  }

  getResponseHeader(name: string): string | null {
    return this.headers[name] || null;
  }

  addEventListener(type: string, listener: any): void {
    if (type === 'load') {
      this.onload = listener;
    }
  }

  onload: (() => void) | null = null;
}

// Mock fetch for testing
const mockFetch = jest.fn();

describe('CsrfFormIntegration', () => {
  let integration: CsrfFormIntegration;
  let testToken: string;

  beforeEach(() => {
    // Reset DOM
    document.head.innerHTML = '';
    document.body.innerHTML = '';

    // Mock global objects
    global.XMLHttpRequest = MockXMLHttpRequest as any;
    global.fetch = mockFetch;

    integration = new CsrfFormIntegration({
      formSelector: 'form[method="POST"], form[method="PUT"], form[method="DELETE"]',
      protectAjax: true,
    });

    testToken = 'test-csrf-token-12345';
    
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with token from meta tag', () => {
      // Create meta tag
      const metaTag = document.createElement('meta');
      metaTag.name = 'csrf-token';
      metaTag.content = testToken;
      document.head.appendChild(metaTag);

      integration.initialize();

      expect(integration.getCurrentToken()).toBe(testToken);
    });

    test('should initialize with provided token', () => {
      integration.initialize(testToken);

      expect(integration.getCurrentToken()).toBe(testToken);
    });

    test('should warn when no token is available', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      integration.initialize();

      expect(consoleSpy).toHaveBeenCalledWith('CSRF: No token found on page initialization');
      expect(integration.getCurrentToken()).toBeNull();

      consoleSpy.mockRestore();
    });
  });

  describe('Form Protection', () => {
    test('should protect existing forms on initialization', () => {
      // Create a form
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/test';
      document.body.appendChild(form);

      integration.initialize(testToken);

      const tokenInput = form.querySelector('input[name="_csrf"]') as HTMLInputElement;
      expect(tokenInput).toBeTruthy();
      expect(tokenInput.value).toBe(testToken);
      expect(tokenInput.type).toBe('hidden');
    });

    test('should protect manually specified forms', () => {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/test';
      document.body.appendChild(form);

      integration.initialize(testToken);
      integration.protectForm(form);

      // Should have only one token input (not duplicated)
      const tokenInputs = form.querySelectorAll('input[name="_csrf"]');
      expect(tokenInputs.length).toBe(1);
    });

    test('should detect protected forms', () => {
      const form = document.createElement('form');
      form.method = 'POST';
      document.body.appendChild(form);

      expect(integration.isFormProtected(form)).toBe(false);

      integration.initialize(testToken);
      integration.protectForm(form);

      expect(integration.isFormProtected(form)).toBe(true);
    });

    test('should add form validation', () => {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/test';
      document.body.appendChild(form);

      integration.initialize(testToken);

      // Try to submit form without token
      const tokenInput = form.querySelector('input[name="_csrf"]') as HTMLInputElement;
      tokenInput.value = '';

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const submitEvent = new Event('submit', { cancelable: true });
      form.dispatchEvent(submitEvent);

      expect(submitEvent.defaultPrevented).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('CSRF: Form submission blocked - missing or empty CSRF token');

      consoleSpy.mockRestore();
    });
  });

  describe('Dynamic Form Detection', () => {
    test('should protect dynamically added forms', (done) => {
      integration.initialize(testToken);

      // Add form after initialization
      setTimeout(() => {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/dynamic';
        document.body.appendChild(form);

        // Give mutation observer time to detect
        setTimeout(() => {
          const tokenInput = form.querySelector('input[name="_csrf"]') as HTMLInputElement;
          expect(tokenInput).toBeTruthy();
          expect(tokenInput.value).toBe(testToken);
          done();
        }, 10);
      }, 0);
    });

    test('should protect forms within added containers', (done) => {
      integration.initialize(testToken);

      setTimeout(() => {
        const container = document.createElement('div');
        const form = document.createElement('form');
        form.method = 'POST';
        container.appendChild(form);
        document.body.appendChild(container);

        setTimeout(() => {
          const tokenInput = form.querySelector('input[name="_csrf"]') as HTMLInputElement;
          expect(tokenInput).toBeTruthy();
          done();
        }, 10);
      }, 0);
    });
  });

  describe('Token Updates', () => {
    test('should update all forms when token changes', () => {
      // Create multiple forms
      const form1 = document.createElement('form');
      form1.method = 'POST';
      const form2 = document.createElement('form');
      form2.method = 'PUT';
      document.body.appendChild(form1);
      document.body.appendChild(form2);

      integration.initialize(testToken);

      const newToken = 'new-token-67890';
      integration.updateToken(newToken);

      const tokenInput1 = form1.querySelector('input[name="_csrf"]') as HTMLInputElement;
      const tokenInput2 = form2.querySelector('input[name="_csrf"]') as HTMLInputElement;

      expect(tokenInput1.value).toBe(newToken);
      expect(tokenInput2.value).toBe(newToken);
    });

    test('should update meta tag when token changes', () => {
      const metaTag = document.createElement('meta');
      metaTag.name = 'csrf-token';
      metaTag.content = testToken;
      document.head.appendChild(metaTag);

      integration.initialize(testToken);

      const newToken = 'new-token-67890';
      integration.updateToken(newToken);

      expect(metaTag.content).toBe(newToken);
    });

    test('should create meta tag if it does not exist', () => {
      integration.initialize(testToken);

      const newToken = 'new-token-67890';
      integration.updateToken(newToken);

      const metaTag = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement;
      expect(metaTag).toBeTruthy();
      expect(metaTag.content).toBe(newToken);
    });

    test('should call custom refresh handler', () => {
      const onTokenRefresh = jest.fn();
      const customIntegration = new CsrfFormIntegration({
        onTokenRefresh,
      });

      customIntegration.initialize(testToken);

      const newToken = 'new-token-67890';
      customIntegration.updateToken(newToken);

      expect(onTokenRefresh).toHaveBeenCalledWith(newToken);
    });
  });

  describe('AJAX Protection', () => {
    test('should add CSRF header to XMLHttpRequest', () => {
      integration.initialize(testToken);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/test');
      xhr.send();

      expect(xhr.headers['X-CSRF-Token']).toBe(testToken);
    });

    test('should add CSRF header to fetch requests', () => {
      integration.initialize(testToken);

      const mockHeaders = new Map();
      const mockHeadersSet = jest.fn((key, value) => mockHeaders.set(key, value));
      const mockHeadersHas = jest.fn((key) => mockHeaders.has(key));

      mockFetch.mockImplementation((input, init) => {
        if (init?.headers) {
          const headers = {
            set: mockHeadersSet,
            has: mockHeadersHas,
          };
          init.headers = headers;
        }
        return Promise.resolve(new Response());
      });

      global.Headers = jest.fn().mockImplementation(() => ({
        set: mockHeadersSet,
        has: mockHeadersHas,
      }));

      window.fetch('/api/test', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
      });

      expect(mockHeadersSet).toHaveBeenCalledWith('X-CSRF-Token', testToken);
    });

    test('should not add header to GET requests', () => {
      integration.initialize(testToken);

      const xhr = new XMLHttpRequest();
      xhr.open('GET', '/api/test');
      xhr.send();

      expect(xhr.headers['X-CSRF-Token']).toBeUndefined();
    });

    test('should not override existing CSRF header', () => {
      integration.initialize(testToken);

      const customToken = 'custom-token';
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/test');
      xhr.setRequestHeader('X-CSRF-Token', customToken);
      xhr.send();

      // Should keep the custom token, not override with default
      expect(xhr.headers['X-CSRF-Token']).toBe(customToken);
    });
  });

  describe('Token Refresh Detection', () => {
    test('should handle custom token refresh events', () => {
      integration.initialize(testToken);

      const newToken = 'refreshed-token-99999';
      const event = new CustomEvent('csrf:token-refresh', {
        detail: { token: newToken },
      });

      document.dispatchEvent(event);

      expect(integration.getCurrentToken()).toBe(newToken);
    });

    test('should handle token refresh from response headers', () => {
      integration.initialize(testToken);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/test');
      
      // Mock getting response header
      xhr.getResponseHeader = jest.fn().mockReturnValue('refreshed-token-from-header');
      
      xhr.send();

      // Trigger the load event manually
      if (xhr.onload) {
        xhr.onload();
      }

      expect(integration.getCurrentToken()).toBe('refreshed-token-from-header');
    });
  });

  describe('Error Handling', () => {
    test('should handle form submission without token gracefully', async () => {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/test';
      document.body.appendChild(form);

      integration.initialize(testToken);

      // Remove token
      const tokenInput = form.querySelector('input[name="_csrf"]') as HTMLInputElement;
      tokenInput.remove();

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: 'new-token-from-server' }),
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const submitEvent = new Event('submit', { cancelable: true });
      form.dispatchEvent(submitEvent);

      expect(submitEvent.defaultPrevented).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();

      // Wait for async token refresh attempt
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockFetch).toHaveBeenCalledWith('/csrf-token', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      consoleSpy.mockRestore();
    });

    test('should handle token refresh failure gracefully', async () => {
      const form = document.createElement('form');
      form.method = 'POST';
      document.body.appendChild(form);

      integration.initialize(testToken);

      const tokenInput = form.querySelector('input[name="_csrf"]') as HTMLInputElement;
      tokenInput.value = '';

      mockFetch.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const submitEvent = new Event('submit', { cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalledWith('CSRF: Failed to refresh token:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });
});

describe('CsrfFormHelper', () => {
  let helper: CsrfFormHelper;
  let generator: CsrfTokenGenerator;

  beforeEach(() => {
    generator = new CsrfTokenGenerator({ secret: 'test-secret' });
    helper = new CsrfFormHelper(generator);
  });

  describe('HTML Generation', () => {
    test('should generate token input field', () => {
      const token = 'test-token-123';
      const html = helper.generateTokenField(token);

      expect(html).toBe('<input type="hidden" name="_csrf" value="test-token-123" data-csrf-token="true">');
    });

    test('should generate token input field with custom field name', () => {
      const token = 'test-token-123';
      const html = helper.generateTokenField(token, 'custom_csrf');

      expect(html).toBe('<input type="hidden" name="custom_csrf" value="test-token-123" data-csrf-token="true">');
    });

    test('should generate meta tag', () => {
      const token = 'test-token-456';
      const html = helper.generateMetaTag(token);

      expect(html).toBe('<meta name="csrf-token" content="test-token-456">');
    });

    test('should generate initialization script', () => {
      const token = 'test-token-789';
      const config = { protectAjax: false };
      const html = helper.generateInitScript(token, config);

      expect(html).toContain('new CsrfFormIntegration({"protectAjax":false})');
      expect(html).toContain(`initialize('${token}')`);
      expect(html).toContain('window.csrfIntegration = csrfIntegration');
    });
  });

  describe('Template Helpers', () => {
    test('should create template helper functions', () => {
      const helpers = helper.createTemplateHelper();

      expect(helpers).toHaveProperty('csrfField');
      expect(helpers).toHaveProperty('csrfMeta');
      expect(helpers).toHaveProperty('csrfInit');

      const token = 'helper-token-123';
      
      expect(helpers.csrfField(token)).toContain(token);
      expect(helpers.csrfMeta(token)).toContain(token);
      expect(helpers.csrfInit(token)).toContain(token);
    });
  });
});
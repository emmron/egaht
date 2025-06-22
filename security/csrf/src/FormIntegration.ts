/**
 * Form integration utilities for automatic CSRF protection
 * 
 * This module provides utilities to automatically inject CSRF tokens
 * into forms and AJAX requests in Eghact applications.
 */

import { CsrfTokenGenerator } from './CsrfTokenGenerator';

/**
 * Configuration for form integration
 */
export interface FormIntegrationConfig {
  /** Selector for forms to protect (default: 'form[method="POST"], form[method="PUT"], form[method="DELETE"], form[method="PATCH"]') */
  formSelector?: string;
  /** Whether to auto-submit forms on token refresh */
  autoSubmitOnRefresh?: boolean;
  /** Custom token refresh callback */
  onTokenRefresh?: (newToken: string) => void;
  /** Whether to protect AJAX requests automatically */
  protectAjax?: boolean;
  /** Custom AJAX token header name */
  ajaxHeaderName?: string;
}

/**
 * Client-side CSRF form integration
 * 
 * Automatically handles:
 * - Injecting CSRF tokens into forms
 * - Updating tokens on refresh
 * - Protecting AJAX requests
 * - Form validation before submission
 */
export class CsrfFormIntegration {
  private readonly config: Required<FormIntegrationConfig>;
  private currentToken: string | null = null;
  private tokenFieldName: string = '_csrf';
  private tokenHeaderName: string = 'X-CSRF-Token';

  constructor(config: FormIntegrationConfig = {}) {
    this.config = {
      formSelector: config.formSelector ?? 'form[method="POST"], form[method="PUT"], form[method="DELETE"], form[method="PATCH"]',
      autoSubmitOnRefresh: config.autoSubmitOnRefresh ?? false,
      onTokenRefresh: config.onTokenRefresh ?? (() => {}),
      protectAjax: config.protectAjax ?? true,
      ajaxHeaderName: config.ajaxHeaderName ?? 'X-CSRF-Token',
    };

    this.tokenHeaderName = this.config.ajaxHeaderName;
  }

  /**
   * Initialize CSRF protection on the page
   */
  initialize(token?: string): void {
    // Get token from various sources
    this.currentToken = token || this.extractTokenFromPage();

    if (!this.currentToken) {
      console.warn('CSRF: No token found on page initialization');
      return;
    }

    // Protect existing forms
    this.protectExistingForms();

    // Set up mutation observer for dynamic forms
    this.setupFormObserver();

    // Protect AJAX requests if enabled
    if (this.config.protectAjax) {
      this.setupAjaxProtection();
    }

    // Set up token refresh detection
    this.setupTokenRefreshDetection();
  }

  /**
   * Update the current token and refresh all forms
   */
  updateToken(newToken: string): void {
    const oldToken = this.currentToken;
    this.currentToken = newToken;

    // Update all existing form tokens
    this.updateAllFormTokens();

    // Update meta tag if present
    this.updateMetaTag(newToken);

    // Call custom refresh handler
    this.config.onTokenRefresh(newToken);

    console.log('CSRF: Token updated from', oldToken?.substring(0, 8) + '...', 'to', newToken.substring(0, 8) + '...');
  }

  /**
   * Manually protect a specific form
   */
  protectForm(form: HTMLFormElement): void {
    if (!this.currentToken) {
      console.warn('CSRF: Cannot protect form - no token available');
      return;
    }

    // Remove existing CSRF input if present
    const existingInput = form.querySelector(`input[name="${this.tokenFieldName}"]`);
    if (existingInput) {
      existingInput.remove();
    }

    // Create new hidden input
    const csrfInput = document.createElement('input');
    csrfInput.type = 'hidden';
    csrfInput.name = this.tokenFieldName;
    csrfInput.value = this.currentToken;
    csrfInput.setAttribute('data-csrf-token', 'true');

    // Insert at the beginning of the form
    form.insertBefore(csrfInput, form.firstChild);

    // Add form validation
    this.addFormValidation(form);
  }

  /**
   * Get the current token
   */
  getCurrentToken(): string | null {
    return this.currentToken;
  }

  /**
   * Check if a form is protected
   */
  isFormProtected(form: HTMLFormElement): boolean {
    return form.querySelector(`input[name="${this.tokenFieldName}"][data-csrf-token="true"]`) !== null;
  }

  /**
   * Extract token from page (meta tag, cookie, etc.)
   */
  private extractTokenFromPage(): string | null {
    // Try meta tag first
    const metaTag = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement;
    if (metaTag?.content) {
      return metaTag.content;
    }

    // Try cookie
    const cookieToken = this.getCookie('_csrf');
    if (cookieToken) {
      return cookieToken;
    }

    // Try global variable
    if ((window as any).csrfToken) {
      return (window as any).csrfToken;
    }

    return null;
  }

  /**
   * Protect all existing forms on the page
   */
  private protectExistingForms(): void {
    const forms = document.querySelectorAll(this.config.formSelector) as NodeListOf<HTMLFormElement>;
    forms.forEach(form => this.protectForm(form));
  }

  /**
   * Set up mutation observer to protect dynamically added forms
   */
  private setupFormObserver(): void {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            
            // Check if the added node is a form
            if (element.tagName === 'FORM' && element.matches(this.config.formSelector)) {
              this.protectForm(element as HTMLFormElement);
            }
            
            // Check for forms within the added node
            const forms = element.querySelectorAll(this.config.formSelector) as NodeListOf<HTMLFormElement>;
            forms.forEach(form => this.protectForm(form));
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Set up AJAX request protection
   */
  private setupAjaxProtection(): void {
    // Intercept XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: any[]) {
      (this as any)._method = method.toUpperCase();
      (this as any)._url = url.toString();
      return originalXHROpen.apply(this, [method, url, ...args] as any);
    };

    XMLHttpRequest.prototype.send = function(data?: any) {
      const method = (this as any)._method;
      const url = (this as any)._url;

      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && !this.getResponseHeader(this.config.ajaxHeaderName)) {
        if (this.currentToken) {
          this.setRequestHeader(this.config.ajaxHeaderName, this.currentToken);
        }
      }

      return originalXHRSend.call(this, data);
    }.bind(this);

    // Intercept fetch API
    const originalFetch = window.fetch;
    window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
      const method = init?.method?.toUpperCase() || 'GET';
      
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        init = init || {};
        init.headers = init.headers || {};
        
        const headers = new Headers(init.headers);
        if (!headers.has(this.config.ajaxHeaderName) && this.currentToken) {
          headers.set(this.config.ajaxHeaderName, this.currentToken);
        }
        
        init.headers = headers;
      }

      return originalFetch.call(this, input, init);
    }.bind(this);
  }

  /**
   * Set up token refresh detection from server responses
   */
  private setupTokenRefreshDetection(): void {
    // Listen for custom events from server-side token refresh
    document.addEventListener('csrf:token-refresh', (event: any) => {
      if (event.detail?.token) {
        this.updateToken(event.detail.token);
      }
    });

    // Check for new tokens in response headers
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(...args: any[]) {
      this.addEventListener('load', function() {
        const newToken = this.getResponseHeader('X-CSRF-Token-Refresh');
        if (newToken && this.currentToken !== newToken) {
          this.updateToken(newToken);
        }
      }.bind(this));
      
      return originalXHROpen.apply(this, args);
    }.bind(this);
  }

  /**
   * Update all form tokens
   */
  private updateAllFormTokens(): void {
    const forms = document.querySelectorAll(this.config.formSelector) as NodeListOf<HTMLFormElement>;
    forms.forEach(form => {
      const tokenInput = form.querySelector(`input[name="${this.tokenFieldName}"][data-csrf-token="true"]`) as HTMLInputElement;
      if (tokenInput && this.currentToken) {
        tokenInput.value = this.currentToken;
      }
    });
  }

  /**
   * Update meta tag with new token
   */
  private updateMetaTag(token: string): void {
    let metaTag = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement;
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.name = 'csrf-token';
      document.head.appendChild(metaTag);
    }
    metaTag.content = token;
  }

  /**
   * Add form validation to ensure token is present before submission
   */
  private addFormValidation(form: HTMLFormElement): void {
    form.addEventListener('submit', (event) => {
      const tokenInput = form.querySelector(`input[name="${this.tokenFieldName}"]`) as HTMLInputElement;
      
      if (!tokenInput || !tokenInput.value) {
        event.preventDefault();
        console.error('CSRF: Form submission blocked - missing or empty CSRF token');
        
        // Try to get a new token and retry
        this.refreshTokenAndRetry(form);
        return false;
      }
      
      return true;
    });
  }

  /**
   * Attempt to refresh token and retry form submission
   */
  private async refreshTokenAndRetry(form: HTMLFormElement): Promise<void> {
    try {
      // Make a request to get a new token
      const response = await fetch('/csrf-token', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          this.updateToken(data.token);
          
          // Retry form submission if auto-submit is enabled
          if (this.config.autoSubmitOnRefresh) {
            form.submit();
          }
        }
      }
    } catch (error) {
      console.error('CSRF: Failed to refresh token:', error);
    }
  }

  /**
   * Get cookie value by name
   */
  private getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null;
    }
    return null;
  }
}

/**
 * Server-side form helper for rendering CSRF tokens in templates
 */
export class CsrfFormHelper {
  constructor(private readonly generator: CsrfTokenGenerator) {}

  /**
   * Generate HTML input field for CSRF token
   */
  generateTokenField(token: string, fieldName: string = '_csrf'): string {
    return `<input type="hidden" name="${fieldName}" value="${token}" data-csrf-token="true">`;
  }

  /**
   * Generate meta tag for CSRF token
   */
  generateMetaTag(token: string): string {
    return `<meta name="csrf-token" content="${token}">`;
  }

  /**
   * Generate JavaScript initialization code
   */
  generateInitScript(token: string, config?: Partial<FormIntegrationConfig>): string {
    const configStr = config ? JSON.stringify(config) : '{}';
    return `
      <script>
        (function() {
          const csrfIntegration = new CsrfFormIntegration(${configStr});
          csrfIntegration.initialize('${token}');
          window.csrfIntegration = csrfIntegration;
        })();
      </script>
    `;
  }

  /**
   * Create template helper function for Eghact components
   */
  createTemplateHelper() {
    return {
      csrfField: (token: string, fieldName?: string) => this.generateTokenField(token, fieldName),
      csrfMeta: (token: string) => this.generateMetaTag(token),
      csrfInit: (token: string, config?: Partial<FormIntegrationConfig>) => this.generateInitScript(token, config),
    };
  }
}
/**
 * Error boundary system for Eghact
 * Provides automatic error handling for components and data loading
 */

export function generateErrorBoundaryClient() {
  return `
// Eghact Error Boundary System
class ErrorBoundary {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      fallback: options.fallback || this.defaultErrorFallback,
      onError: options.onError || this.defaultErrorHandler,
      retryable: options.retryable !== false,
      reportErrors: options.reportErrors !== false,
      ...options
    };
    this.errorCount = 0;
    this.lastError = null;
  }

  wrap(renderFunction) {
    return async (...args) => {
      try {
        return await renderFunction(...args);
      } catch (error) {
        return this.handleError(error, renderFunction, args);
      }
    };
  }

  async handleError(error, renderFunction, originalArgs) {
    this.errorCount++;
    this.lastError = error;

    // Log error to console in development
    if (window.__EGHACT_DEV__) {
      console.error('[ErrorBoundary] Component error:', error);
    }

    // Report error to server
    if (this.options.reportErrors) {
      this.reportError(error, {
        component: renderFunction.name,
        args: originalArgs,
        errorCount: this.errorCount,
        timestamp: new Date().toISOString()
      });
    }

    // Call custom error handler
    if (this.options.onError) {
      try {
        await this.options.onError(error, {
          retry: () => this.retry(renderFunction, originalArgs),
          reset: () => this.reset()
        });
      } catch (handlerError) {
        console.error('[ErrorBoundary] Error handler failed:', handlerError);
      }
    }

    // Render error fallback
    this.renderErrorFallback(error, renderFunction, originalArgs);
  }

  async retry(renderFunction, originalArgs) {
    try {
      this.clearErrorUI();
      const result = await renderFunction(...originalArgs);
      this.errorCount = 0;
      this.lastError = null;
      return result;
    } catch (error) {
      return this.handleError(error, renderFunction, originalArgs);
    }
  }

  reset() {
    this.errorCount = 0;
    this.lastError = null;
    this.clearErrorUI();
  }

  renderErrorFallback(error, renderFunction, originalArgs) {
    const errorElement = this.options.fallback(error, {
      retry: () => this.retry(renderFunction, originalArgs),
      reset: () => this.reset(),
      errorCount: this.errorCount
    });

    if (this.container) {
      this.container.innerHTML = '';
      this.container.appendChild(errorElement);
    }
  }

  clearErrorUI() {
    if (this.container && this.container.querySelector('.error-boundary')) {
      this.container.innerHTML = '';
    }
  }

  defaultErrorFallback(error, { retry, reset, errorCount }) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-boundary';
    errorDiv.innerHTML = \`
      <div style="
        border: 2px solid #ff6b6b;
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
        background: #fff5f5;
        color: #c92a2a;
        font-family: monospace;
      ">
        <h3 style="margin: 0 0 10px 0; color: #c92a2a;">
          Component Error
        </h3>
        <p style="margin: 0 0 15px 0; font-size: 14px;">
          \${error.message}
        </p>
        <div style="margin: 15px 0;">
          <button onclick="this.parentElement.parentElement.dispatchEvent(new CustomEvent('retry'))"
                  style="
                    background: #ff6b6b;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-right: 10px;
                  ">
            Retry (\${errorCount} attempts)
          </button>
          <button onclick="this.parentElement.parentElement.dispatchEvent(new CustomEvent('reset'))"
                  style="
                    background: #868e96;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                  ">
            Reset
          </button>
        </div>
        <details style="margin-top: 15px;">
          <summary style="cursor: pointer; color: #666;">Stack trace</summary>
          <pre style="
            font-size: 12px;
            background: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
            margin-top: 10px;
          ">\${error.stack || 'No stack trace available'}</pre>
        </details>
      </div>
    \`;

    errorDiv.addEventListener('retry', retry);
    errorDiv.addEventListener('reset', reset);

    return errorDiv;
  }

  defaultErrorHandler(error, { retry, reset }) {
    // Default behavior: just log the error
    console.error('[ErrorBoundary] Unhandled component error:', error);
  }

  async reportError(error, context) {
    try {
      await fetch('/__eghact/error-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name
          },
          context,
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString()
        })
      });
    } catch (reportError) {
      console.error('[ErrorBoundary] Failed to report error:', reportError);
    }
  }
}

// Export classes
window.ErrorBoundary = ErrorBoundary;

// Auto-wrap the main app in an error boundary
document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  if (app) {
    window.globalErrorBoundary = new ErrorBoundary(app, {
      reportErrors: true
    });
  }
});
`;
}
// Set up global test utilities
import '@testing-library/jest-dom';
import { cleanup } from './component-test-utils';

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Extend Jest matchers
expect.extend({
  toBeInTheDocument(received: HTMLElement | null) {
    const pass = received !== null && document.body.contains(received);
    
    return {
      pass,
      message: () =>
        pass
          ? `expected element not to be in the document`
          : `expected element to be in the document`,
    };
  },
  
  toHaveClass(received: HTMLElement, className: string) {
    const pass = received.classList.contains(className);
    
    return {
      pass,
      message: () =>
        pass
          ? `expected element not to have class "${className}"`
          : `expected element to have class "${className}"`,
    };
  },
  
  toHaveAttribute(received: HTMLElement, attribute: string, value?: string) {
    const hasAttribute = received.hasAttribute(attribute);
    const attributeValue = received.getAttribute(attribute);
    const pass = value === undefined
      ? hasAttribute
      : hasAttribute && attributeValue === value;
    
    return {
      pass,
      message: () => {
        if (value === undefined) {
          return pass
            ? `expected element not to have attribute "${attribute}"`
            : `expected element to have attribute "${attribute}"`;
        } else {
          return pass
            ? `expected element not to have attribute "${attribute}" with value "${value}"`
            : `expected element to have attribute "${attribute}" with value "${value}", but got "${attributeValue}"`;
        }
      },
    };
  },
  
  toHaveTextContent(received: HTMLElement, text: string | RegExp) {
    const content = received.textContent || '';
    const pass = typeof text === 'string'
      ? content.includes(text)
      : text.test(content);
    
    return {
      pass,
      message: () =>
        pass
          ? `expected element not to have text content matching "${text}"`
          : `expected element to have text content matching "${text}", but got "${content}"`,
    };
  },
  
  toBeVisible(received: HTMLElement) {
    const style = window.getComputedStyle(received);
    const pass = style.display !== 'none' &&
                 style.visibility !== 'hidden' &&
                 style.opacity !== '0';
    
    return {
      pass,
      message: () =>
        pass
          ? `expected element not to be visible`
          : `expected element to be visible`,
    };
  },
  
  toBeDisabled(received: HTMLElement) {
    const pass = received.hasAttribute('disabled') ||
                 received.getAttribute('aria-disabled') === 'true';
    
    return {
      pass,
      message: () =>
        pass
          ? `expected element not to be disabled`
          : `expected element to be disabled`,
    };
  },
});

// Mock console methods during tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Add custom test environment variables
process.env.NODE_ENV = 'test';

// TypeScript types for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveClass(className: string): R;
      toHaveAttribute(attribute: string, value?: string): R;
      toHaveTextContent(text: string | RegExp): R;
      toBeVisible(): R;
      toBeDisabled(): R;
    }
  }
}
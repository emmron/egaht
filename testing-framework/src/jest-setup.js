// Jest setup file for Eghact testing framework
import '@testing-library/jest-dom';
import { cleanup } from './eghact-test-utils.js';
import { teardownVisualTesting } from './visual-regression.js';

// Extend Jest matchers
import './matchers.js';

// Set up global test environment
global.beforeEach(() => {
  // Reset any global state
  if (window.__EGHACT_DEVTOOLS__) {
    window.__EGHACT_DEVTOOLS__.clear();
  }
  
  // Clear any cached modules
  if (window.__EGHACT_MODULES__) {
    window.__EGHACT_MODULES__.clear();
  }
  
  // Reset signal subscriptions
  if (window.__EGHACT_SIGNALS__) {
    window.__EGHACT_SIGNALS__.forEach(signal => signal._reset?.());
    window.__EGHACT_SIGNALS__.clear();
  }
});

// Clean up after each test
global.afterEach(() => {
  cleanup();
  
  // Clear all mocks
  jest.clearAllMocks();
  
  // Clear all timers
  jest.clearAllTimers();
});

// Global teardown
global.afterAll(async () => {
  await teardownVisualTesting();
});

// Configure test timeouts
jest.setTimeout(30000); // 30 seconds for visual tests

// Mock fetch for tests
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    headers: new Headers()
  })
);

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    this.elements = new Set();
  }
  
  observe(element) {
    this.elements.add(element);
    // Immediately trigger callback with all entries visible
    this.callback([{
      target: element,
      isIntersecting: true,
      intersectionRatio: 1,
      boundingClientRect: element.getBoundingClientRect(),
      intersectionRect: element.getBoundingClientRect(),
      rootBounds: null,
      time: Date.now()
    }], this);
  }
  
  unobserve(element) {
    this.elements.delete(element);
  }
  
  disconnect() {
    this.elements.clear();
  }
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.elements = new Set();
  }
  
  observe(element) {
    this.elements.add(element);
    // Immediately trigger callback
    this.callback([{
      target: element,
      contentRect: element.getBoundingClientRect(),
      borderBoxSize: [{ 
        blockSize: element.offsetHeight,
        inlineSize: element.offsetWidth 
      }],
      contentBoxSize: [{
        blockSize: element.clientHeight,
        inlineSize: element.clientWidth
      }],
      devicePixelContentBoxSize: [{
        blockSize: element.clientHeight,
        inlineSize: element.clientWidth
      }]
    }], this);
  }
  
  unobserve(element) {
    this.elements.delete(element);
  }
  
  disconnect() {
    this.elements.clear();
  }
};

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback) => {
  return setTimeout(callback, 16); // ~60fps
};

global.cancelAnimationFrame = (id) => {
  clearTimeout(id);
};

// Add custom console for better test output
const originalConsoleError = console.error;
console.error = (...args) => {
  // Filter out expected React/testing-library warnings
  const message = args[0]?.toString() || '';
  if (
    message.includes('Warning: ReactDOM.render is no longer supported') ||
    message.includes('Warning: An invalid form control') ||
    message.includes('Not implemented: HTMLFormElement.prototype.submit')
  ) {
    return;
  }
  originalConsoleError.apply(console, args);
};

// Suppress specific warnings during tests
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  const message = args[0]?.toString() || '';
  if (
    message.includes('componentWillReceiveProps has been renamed') ||
    message.includes('componentWillMount has been renamed')
  ) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};
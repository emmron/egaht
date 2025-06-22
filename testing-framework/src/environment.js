// Test environment setup and teardown for Eghact
import { JSDOM } from 'jsdom';

let originalWindow = null;
let originalDocument = null;
let dom = null;

/**
 * Set up Eghact test environment
 * @param {Object} options - Environment options
 */
export function setupEghactEnvironment(options = {}) {
  const {
    url = 'http://localhost',
    html = '<!DOCTYPE html><html><body><div id="root"></div></body></html>',
    runScripts = 'dangerously',
    resources = 'usable',
    features = {
      FetchExternalResources: ['script'],
      ProcessExternalResources: ['script'],
      SkipExternalResources: false
    }
  } = options;

  // Save original globals if in Node
  if (typeof window === 'undefined') {
    originalWindow = global.window;
    originalDocument = global.document;
  }

  // Create JSDOM instance
  dom = new JSDOM(html, {
    url,
    runScripts,
    resources,
    pretendToBeVisual: true,
    beforeParse(window) {
      // Add Eghact runtime globals
      window.__EGHACT_RUNTIME__ = createMockRuntime();
      window.__EGHACT_DEV__ = true;
      window.__EGHACT_VERSION__ = '0.1.0';
      
      // Add test utilities
      window.__EGHACT_TEST__ = {
        components: new Map(),
        events: [],
        errors: [],
        warnings: []
      };
      
      // Mock fetch
      window.fetch = global.fetch || createMockFetch();
      
      // Add performance API if missing
      if (!window.performance) {
        window.performance = {
          now: () => Date.now(),
          mark: () => {},
          measure: () => {},
          getEntriesByName: () => [],
          getEntriesByType: () => []
        };
      }
    }
  });

  // Set up globals
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.navigator = window.navigator;
  global.location = window.location;
  global.history = window.history;
  global.HTMLElement = window.HTMLElement;
  global.HTMLInputElement = window.HTMLInputElement;
  global.HTMLTextAreaElement = window.HTMLTextAreaElement;
  global.HTMLSelectElement = window.HTMLSelectElement;
  global.Element = window.Element;
  global.SVGElement = window.SVGElement;
  global.Event = window.Event;
  global.KeyboardEvent = window.KeyboardEvent;
  global.MouseEvent = window.MouseEvent;
  global.CustomEvent = window.CustomEvent;
  global.NodeList = window.NodeList;
  global.HTMLCollection = window.HTMLCollection;

  // Copy over other useful globals
  const windowProps = Object.getOwnPropertyNames(window)
    .filter(prop => !prop.startsWith('_') && !(prop in global));
  
  windowProps.forEach(prop => {
    if (typeof window[prop] !== 'undefined') {
      global[prop] = window[prop];
    }
  });

  return { dom, window, document: window.document };
}

/**
 * Tear down test environment
 */
export function teardownEghactEnvironment() {
  // Clean up JSDOM
  if (dom) {
    dom.window.close();
    dom = null;
  }

  // Restore original globals if saved
  if (originalWindow !== null) {
    global.window = originalWindow;
    global.document = originalDocument;
  }

  // Clean up other globals
  const globalProps = [
    'navigator', 'location', 'history', 'HTMLElement',
    'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement',
    'Element', 'SVGElement', 'Event', 'KeyboardEvent',
    'MouseEvent', 'CustomEvent', 'NodeList', 'HTMLCollection'
  ];
  
  globalProps.forEach(prop => {
    if (global[prop] && !originalWindow?.[prop]) {
      delete global[prop];
    }
  });
}

/**
 * Create mock Eghact runtime
 */
function createMockRuntime() {
  const componentRegistry = new Map();
  const eventBus = new Map();
  
  return {
    version: '0.1.0',
    
    // DOM manipulation
    createElement(tag, props, ...children) {
      const element = document.createElement(tag);
      
      if (props) {
        Object.entries(props).forEach(([key, value]) => {
          if (key === 'className') {
            element.className = value;
          } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
          } else if (key.startsWith('on')) {
            const eventName = key.slice(2).toLowerCase();
            element.addEventListener(eventName, value);
          } else if (key !== 'children') {
            element.setAttribute(key, value);
          }
        });
      }
      
      children.forEach(child => {
        if (typeof child === 'string') {
          element.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
          element.appendChild(child);
        }
      });
      
      return element;
    },
    
    createTextNode(text) {
      return document.createTextNode(text);
    },
    
    appendChild(parent, child) {
      return parent.appendChild(child);
    },
    
    removeChild(parent, child) {
      return parent.removeChild(child);
    },
    
    setAttribute(element, name, value) {
      element.setAttribute(name, value);
    },
    
    removeAttribute(element, name) {
      element.removeAttribute(name);
    },
    
    addEventListener(element, event, handler) {
      element.addEventListener(event, handler);
    },
    
    removeEventListener(element, event, handler) {
      element.removeEventListener(event, handler);
    },
    
    // Component registry
    registerComponent(name, component) {
      componentRegistry.set(name, component);
    },
    
    getComponent(name) {
      return componentRegistry.get(name);
    },
    
    // Event bus
    emit(event, data) {
      const handlers = eventBus.get(event) || [];
      handlers.forEach(handler => handler(data));
    },
    
    on(event, handler) {
      if (!eventBus.has(event)) {
        eventBus.set(event, []);
      }
      eventBus.get(event).push(handler);
    },
    
    off(event, handler) {
      const handlers = eventBus.get(event) || [];
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    },
    
    // Reactivity
    createSignal(initialValue) {
      let value = initialValue;
      const subscribers = new Set();
      
      return {
        get value() {
          return value;
        },
        set value(newValue) {
          if (value !== newValue) {
            value = newValue;
            subscribers.forEach(fn => fn(newValue));
          }
        },
        subscribe(fn) {
          subscribers.add(fn);
          return () => subscribers.delete(fn);
        }
      };
    },
    
    // Effects
    createEffect(fn, deps = []) {
      let cleanup = null;
      
      const run = () => {
        if (cleanup) cleanup();
        cleanup = fn();
      };
      
      run();
      
      return () => {
        if (cleanup) cleanup();
      };
    }
  };
}

/**
 * Create mock fetch
 */
function createMockFetch() {
  return jest.fn((url, options) => {
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({
        'content-type': 'application/json'
      }),
      json: () => Promise.resolve({ data: 'mock' }),
      text: () => Promise.resolve('mock response'),
      blob: () => Promise.resolve(new Blob(['mock'])),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      formData: () => Promise.resolve(new FormData()),
      clone: () => ({ ...this })
    });
  });
}
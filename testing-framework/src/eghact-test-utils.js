// Eghact Test Utils - Core testing utilities for Eghact components
import { JSDOM } from 'jsdom';
import { 
  getQueriesForElement,
  prettyDOM,
  fireEvent as dtlFireEvent,
  waitFor as dtlWaitFor 
} from '@testing-library/dom';
import { act } from './act-compat.js';

// Global container for rendered components
let container = null;
let componentInstances = new Set();

/**
 * Render an Eghact component for testing
 * @param {Function} Component - The Eghact component to render
 * @param {Object} options - Render options
 * @returns {RenderResult} - Queries and utilities for the rendered component
 */
export function render(Component, options = {}) {
  const {
    container: customContainer,
    props = {},
    baseElement = document.body,
    queries,
    hydrate = false,
    wrapper: WrapperComponent
  } = options;

  // Clean up any previous render
  if (container && container.parentNode === document.body) {
    cleanup();
  }

  // Create container
  container = customContainer || document.createElement('div');
  if (!customContainer) {
    baseElement.appendChild(container);
  }

  let component;
  
  act(() => {
    // Import Eghact runtime
    const runtime = window.__EGHACT_RUNTIME__ || {};
    
    // Create component instance
    const ComponentFactory = Component.createComponent || Component;
    component = ComponentFactory();
    
    // Track instance for cleanup
    componentInstances.add(component);
    
    // Render component
    let rendered;
    if (WrapperComponent) {
      const Wrapper = WrapperComponent.createComponent || WrapperComponent;
      const wrapper = Wrapper();
      rendered = wrapper.render({
        children: component.render(props)
      });
    } else {
      rendered = component.render(props);
    }
    
    // Handle hydration vs fresh render
    if (hydrate && container.innerHTML) {
      runtime.hydrate?.(rendered, container);
    } else {
      container.innerHTML = '';
      if (typeof rendered === 'string') {
        container.innerHTML = rendered;
      } else {
        container.appendChild(rendered);
      }
    }
  });

  // Return queries and utilities
  const containerQueries = getQueriesForElement(container, queries);
  
  return {
    container,
    baseElement,
    debug: (element = baseElement, maxLength, options) =>
      console.log(prettyDOM(element, maxLength, options)),
    rerender: (newProps) => {
      act(() => {
        const rendered = component.render(newProps);
        if (typeof rendered === 'string') {
          container.innerHTML = rendered;
        } else {
          container.innerHTML = '';
          container.appendChild(rendered);
        }
      });
    },
    unmount: () => {
      act(() => {
        if (component.unmount) {
          component.unmount();
        }
        componentInstances.delete(component);
        if (container.parentNode === baseElement) {
          baseElement.removeChild(container);
        }
        container = null;
      });
    },
    asFragment: () => {
      const template = document.createElement('template');
      template.innerHTML = container.innerHTML;
      return template.content;
    },
    ...containerQueries,
    component
  };
}

/**
 * Clean up after tests
 */
export function cleanup() {
  // Unmount all tracked components
  componentInstances.forEach(component => {
    if (component.unmount) {
      component.unmount();
    }
  });
  componentInstances.clear();

  // Remove container
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
  container = null;

  // Clean up any global event listeners or timers
  if (window.__EGHACT_CLEANUP__) {
    window.__EGHACT_CLEANUP__();
  }
}

/**
 * Fire events on elements with Eghact-specific handling
 */
export const fireEvent = Object.assign(dtlFireEvent, {
  // Add Eghact-specific event handling
  signal: (element, signalName, value) => {
    act(() => {
      const event = new CustomEvent('eghact:signal', {
        detail: { signal: signalName, value },
        bubbles: true
      });
      element.dispatchEvent(event);
    });
  },
  
  // Handle reactive bindings
  binding: (element, bindingName, value) => {
    act(() => {
      if (element.__eghactBindings && element.__eghactBindings[bindingName]) {
        element.__eghactBindings[bindingName](value);
      }
    });
  }
});

/**
 * Wait for condition with Eghact act() wrapping
 */
export async function waitFor(callback, options) {
  return dtlWaitFor(() => {
    let result;
    act(() => {
      result = callback();
    });
    return result;
  }, options);
}

/**
 * Screen object with all queries pre-bound to document.body
 */
export const screen = getQueriesForElement(document.body);

// Auto cleanup after each test if using Jest
if (typeof afterEach !== 'undefined' && !process.env.EGHACT_SKIP_AUTO_CLEANUP) {
  afterEach(() => {
    cleanup();
  });
}

// Set up JSDOM environment if not in browser
if (typeof window === 'undefined') {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
    resources: 'usable'
  });
  
  global.window = dom.window;
  global.document = window.document;
  global.navigator = window.navigator;
  
  // Add Eghact runtime stub
  window.__EGHACT_RUNTIME__ = {
    createElement: (tag) => document.createElement(tag),
    createTextNode: (text) => document.createTextNode(text),
    appendChild: (parent, child) => parent.appendChild(child),
    removeChild: (parent, child) => parent.removeChild(child),
    setAttribute: (element, name, value) => element.setAttribute(name, value),
    removeAttribute: (element, name) => element.removeAttribute(name),
    addEventListener: (element, event, handler) => element.addEventListener(event, handler),
    removeEventListener: (element, event, handler) => element.removeEventListener(event, handler)
  };
}
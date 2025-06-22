// Component testing helper utilities for Eghact
import { render } from './eghact-test-utils.js';
import { act } from './act-compat.js';

/**
 * Mount a component with full lifecycle
 * @param {Function} Component - Eghact component
 * @param {Object} options - Mount options
 * @returns {Object} Mounted component wrapper
 */
export function mount(Component, options = {}) {
  const result = render(Component, options);
  
  // Add helper methods
  return {
    ...result,
    
    /**
     * Get component instance
     */
    instance() {
      return result.component;
    },
    
    /**
     * Get props
     */
    props() {
      return result.component.props || {};
    },
    
    /**
     * Set props and re-render
     */
    setProps(newProps) {
      act(() => {
        result.rerender(newProps);
      });
    },
    
    /**
     * Get state (if component has state)
     */
    state() {
      return result.component.state || {};
    },
    
    /**
     * Set state (if component supports it)
     */
    setState(newState) {
      act(() => {
        if (result.component.setState) {
          result.component.setState(newState);
        } else if (result.component.state) {
          Object.assign(result.component.state, newState);
          result.rerender(result.component.props);
        }
      });
    },
    
    /**
     * Find element by selector
     */
    find(selector) {
      return result.container.querySelector(selector);
    },
    
    /**
     * Find all elements by selector
     */
    findAll(selector) {
      return Array.from(result.container.querySelectorAll(selector));
    },
    
    /**
     * Check if element exists
     */
    exists(selector) {
      return !!result.container.querySelector(selector);
    },
    
    /**
     * Get text content
     */
    text() {
      return result.container.textContent;
    },
    
    /**
     * Get HTML content
     */
    html() {
      return result.container.innerHTML;
    },
    
    /**
     * Trigger event
     */
    trigger(selector, eventType, eventData) {
      const element = typeof selector === 'string' 
        ? result.container.querySelector(selector)
        : selector;
        
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      
      act(() => {
        const event = new Event(eventType, { bubbles: true, ...eventData });
        element.dispatchEvent(event);
      });
    },
    
    /**
     * Wait for async updates
     */
    async waitForUpdate() {
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
    }
  };
}

/**
 * Shallow render a component (no children)
 * @param {Function} Component - Eghact component
 * @param {Object} options - Render options
 * @returns {Object} Shallow wrapper
 */
export function shallow(Component, options = {}) {
  // Create shallow render by mocking child components
  const originalCreateElement = window.__EGHACT_RUNTIME__?.createElement;
  const renderedComponents = new Map();
  
  // Override createElement to track child components
  if (window.__EGHACT_RUNTIME__) {
    window.__EGHACT_RUNTIME__.createElement = (tag, props, ...children) => {
      if (typeof tag === 'function' && tag !== Component) {
        // Mock child component
        const mockElement = document.createElement('div');
        mockElement.dataset.mockComponent = tag.name || 'Component';
        mockElement.dataset.shallowRender = 'true';
        
        // Store component info
        renderedComponents.set(mockElement, { component: tag, props });
        
        return mockElement;
      }
      
      return originalCreateElement?.(tag, props, ...children) || 
             document.createElement(tag);
    };
  }
  
  // Render component
  const result = render(Component, options);
  
  // Restore original createElement
  if (window.__EGHACT_RUNTIME__ && originalCreateElement) {
    window.__EGHACT_RUNTIME__.createElement = originalCreateElement;
  }
  
  // Add shallow-specific methods
  return {
    ...result,
    
    /**
     * Get rendered child components
     */
    childComponents() {
      return Array.from(renderedComponents.entries()).map(([element, info]) => ({
        element,
        component: info.component,
        props: info.props
      }));
    },
    
    /**
     * Find child component by type
     */
    findComponent(ComponentType) {
      const found = this.childComponents().find(
        child => child.component === ComponentType
      );
      return found || null;
    },
    
    /**
     * Find all child components by type
     */
    findAllComponents(ComponentType) {
      return this.childComponents().filter(
        child => child.component === ComponentType
      );
    },
    
    /**
     * Check if component exists
     */
    containsComponent(ComponentType) {
      return this.findComponent(ComponentType) !== null;
    }
  };
}

/**
 * Debug component output
 * @param {Object} wrapper - Component wrapper from mount/shallow
 * @param {Object} options - Debug options
 */
export function debug(wrapper, options = {}) {
  const {
    props = true,
    state = true,
    html = true,
    events = true
  } = options;
  
  console.group(`🐛 Eghact Component Debug`);
  
  if (props && wrapper.component) {
    console.log('Props:', wrapper.component.props || {});
  }
  
  if (state && wrapper.component?.state) {
    console.log('State:', wrapper.component.state);
  }
  
  if (html) {
    console.log('HTML:', wrapper.container.innerHTML);
  }
  
  if (events && wrapper.component?._events) {
    console.log('Event Listeners:', wrapper.component._events);
  }
  
  console.log('Container:', wrapper.container);
  console.log('Component Instance:', wrapper.component);
  
  console.groupEnd();
  
  // Also call the built-in debug
  wrapper.debug();
}

/**
 * Create a test harness for component testing
 * @param {Function} Component - Component to test
 * @param {Object} defaultProps - Default props
 * @returns {Object} Test harness
 */
export function createTestHarness(Component, defaultProps = {}) {
  let wrapper = null;
  
  return {
    /**
     * Mount with props
     */
    mount(props = {}) {
      wrapper = mount(Component, {
        props: { ...defaultProps, ...props }
      });
      return wrapper;
    },
    
    /**
     * Shallow render with props
     */
    shallow(props = {}) {
      wrapper = shallow(Component, {
        props: { ...defaultProps, ...props }
      });
      return wrapper;
    },
    
    /**
     * Get current wrapper
     */
    wrapper() {
      return wrapper;
    },
    
    /**
     * Clean up
     */
    cleanup() {
      if (wrapper) {
        wrapper.unmount();
        wrapper = null;
      }
    }
  };
}
// Mocking utilities for Eghact component testing

/**
 * Create a mock component for testing
 * @param {string} name - Component name
 * @param {Object} options - Mock options
 * @returns {Function} Mock component
 */
export function createMockComponent(name, options = {}) {
  const {
    template = `<div data-testid="${name}-mock">${name} Mock</div>`,
    props = {},
    events = {},
    slots = {},
    methods = {}
  } = options;

  const mockComponent = {
    name,
    _isMock: true,
    
    createComponent() {
      let state = { ...props };
      const eventHandlers = new Map();
      const slotContent = { ...slots };
      
      return {
        render(renderProps = {}) {
          // Merge props
          const mergedProps = { ...state, ...renderProps };
          
          // Create mock element
          const element = document.createElement('div');
          element.innerHTML = template;
          element.dataset.mockComponent = name;
          
          // Attach props as data attributes
          Object.entries(mergedProps).forEach(([key, value]) => {
            if (typeof value !== 'function' && typeof value !== 'object') {
              element.dataset[key] = value;
            }
          });
          
          // Set up event tracking
          Object.entries(events).forEach(([eventName, handler]) => {
            const mockHandler = jest.fn(handler);
            eventHandlers.set(eventName, mockHandler);
            element.addEventListener(eventName, mockHandler);
          });
          
          // Add slot content
          Object.entries(slotContent).forEach(([slotName, content]) => {
            const slotElement = element.querySelector(`[slot="${slotName}"]`);
            if (slotElement) {
              slotElement.innerHTML = content;
            }
          });
          
          return element;
        },
        
        setState(newState) {
          state = { ...state, ...newState };
        },
        
        getEventHandler(eventName) {
          return eventHandlers.get(eventName);
        },
        
        ...methods
      };
    }
  };
  
  // Add static mock tracking
  mockComponent.mock = {
    calls: [],
    instances: [],
    clear() {
      this.calls = [];
      this.instances = [];
    }
  };
  
  return mockComponent;
}

/**
 * Create mock props with spy functions
 * @param {Object} propDefinitions - Prop definitions
 * @returns {Object} Mock props
 */
export function mockProps(propDefinitions) {
  const mocks = {};
  
  Object.entries(propDefinitions).forEach(([propName, propConfig]) => {
    if (typeof propConfig === 'function') {
      // Function prop
      mocks[propName] = jest.fn(propConfig);
    } else if (propConfig && typeof propConfig === 'object') {
      // Complex prop with configuration
      const { type, defaultValue, validator } = propConfig;
      
      if (type === Function) {
        mocks[propName] = jest.fn(defaultValue || (() => {}));
      } else {
        mocks[propName] = defaultValue !== undefined ? defaultValue : getMockValue(type);
      }
      
      // Add validator if provided
      if (validator) {
        Object.defineProperty(mocks, `${propName}Validator`, {
          value: validator,
          enumerable: false
        });
      }
    } else {
      // Simple value prop
      mocks[propName] = propConfig;
    }
  });
  
  return mocks;
}

/**
 * Create mock event handlers
 * @param {Array<string>} eventNames - Event names to mock
 * @returns {Object} Mock event handlers
 */
export function mockEvents(eventNames) {
  const handlers = {};
  
  eventNames.forEach(eventName => {
    // Convert event name to handler name (click -> onClick)
    const handlerName = `on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`;
    
    handlers[handlerName] = jest.fn((event) => {
      // Default mock implementation
      console.log(`Mock event handler called: ${eventName}`, event);
    });
    
    // Add utility methods
    handlers[handlerName].mockEvent = (detail = {}) => {
      const event = new CustomEvent(eventName, {
        detail,
        bubbles: true,
        cancelable: true
      });
      handlers[handlerName](event);
      return event;
    };
  });
  
  return handlers;
}

/**
 * Get mock value for a type
 * @param {Function} type - Type constructor
 * @returns {*} Mock value
 */
function getMockValue(type) {
  switch (type) {
    case String:
      return 'mock-string';
    case Number:
      return 42;
    case Boolean:
      return true;
    case Array:
      return [];
    case Object:
      return {};
    case Date:
      return new Date('2023-01-01');
    case Function:
      return jest.fn();
    default:
      return null;
  }
}

/**
 * Mock Eghact signals
 * @param {Object} signalDefinitions - Signal definitions
 * @returns {Object} Mock signals
 */
export function mockSignals(signalDefinitions) {
  const signals = {};
  
  Object.entries(signalDefinitions).forEach(([signalName, initialValue]) => {
    let value = initialValue;
    const subscribers = new Set();
    
    signals[signalName] = {
      get value() {
        return value;
      },
      
      set value(newValue) {
        value = newValue;
        subscribers.forEach(callback => callback(newValue));
      },
      
      subscribe(callback) {
        subscribers.add(callback);
        return () => subscribers.delete(callback);
      },
      
      // Testing utilities
      _getValue: () => value,
      _getSubscriberCount: () => subscribers.size,
      _reset: () => {
        value = initialValue;
        subscribers.clear();
      }
    };
  });
  
  return signals;
}

/**
 * Create a mock store for testing
 * @param {Object} initialState - Initial store state
 * @returns {Object} Mock store
 */
export function createMockStore(initialState = {}) {
  let state = { ...initialState };
  const subscribers = new Set();
  const actions = new Map();
  
  return {
    getState() {
      return { ...state };
    },
    
    setState(newState) {
      state = { ...state, ...newState };
      this.dispatch({ type: '@@SET_STATE', payload: newState });
    },
    
    dispatch: jest.fn((action) => {
      // Apply action
      const handler = actions.get(action.type);
      if (handler) {
        const newState = handler(state, action);
        if (newState !== state) {
          state = newState;
        }
      }
      
      // Notify subscribers
      subscribers.forEach(callback => callback(state, action));
      
      return action;
    }),
    
    subscribe(callback) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    
    registerAction(type, handler) {
      actions.set(type, handler);
    },
    
    // Testing utilities
    _reset() {
      state = { ...initialState };
      subscribers.clear();
      actions.clear();
      this.dispatch.mockClear();
    }
  };
}
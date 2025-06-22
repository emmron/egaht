/**
 * Eghact Store System - Built-in Global State Management
 * Builds upon the signals-based reactivity from Task #4
 */

import { Signal } from 'signal-polyfill';

// Global store registry
const stores = new Map();
const storeSubscriptions = new Map();
const devtools = globalThis.__EGHACT_DEVTOOLS__ || null;

/**
 * Create a reactive store with automatic component subscription
 */
export function createStore(initialValue, options = {}) {
  const { name = 'anonymous', persist = false, middleware = [] } = options;
  
  // Create signal for reactive value
  const signal = new Signal.State(initialValue);
  
  const store = {
    // Get current value
    get value() {
      return signal.get();
    },
    
    // Set new value with optional updater function
    set(newValue) {
      const prevValue = signal.get();
      const nextValue = typeof newValue === 'function' ? newValue(prevValue) : newValue;
      
      // Apply middleware
      let finalValue = nextValue;
      for (const mw of middleware) {
        finalValue = mw(finalValue, prevValue, name);
      }
      
      signal.set(finalValue);
      
      // Notify devtools
      if (devtools) {
        devtools.storeUpdate(name, prevValue, finalValue);
      }
      
      return finalValue;
    },
    
    // Update with function
    update(updater) {
      return this.set(updater);
    },
    
    // Subscribe to changes
    subscribe(callback) {
      const unsubscribe = signal.subscribe(() => {
        callback(signal.get());
      });
      
      if (!storeSubscriptions.has(this)) {
        storeSubscriptions.set(this, new Set());
      }
      storeSubscriptions.get(this).add(unsubscribe);
      
      return unsubscribe;
    },
    
    // Get reactive signal for direct use in components
    getSignal() {
      return signal;
    },
    
    // Store metadata
    _meta: {
      name,
      persist,
      created: Date.now()
    }
  };
  
  // Register store globally
  stores.set(name, store);
  
  // Handle persistence
  if (persist && typeof window !== 'undefined') {
    // Try to restore from localStorage
    try {
      const saved = localStorage.getItem(`eghact:store:${name}`);
      if (saved) {
        const parsedValue = JSON.parse(saved);
        signal.set(parsedValue);
      }
    } catch (e) {
      console.warn(`Failed to restore store ${name}:`, e);
    }
    
    // Auto-save on changes
    store.subscribe((value) => {
      try {
        localStorage.setItem(`eghact:store:${name}`, JSON.stringify(value));
      } catch (e) {
        console.warn(`Failed to persist store ${name}:`, e);
      }
    });
  }
  
  return store;
}

/**
 * Get existing store by name
 */
export function getStore(name) {
  return stores.get(name);
}

/**
 * Create derived store that automatically updates based on other stores
 */
export function derived(dependencies, compute) {
  const derivedSignal = new Signal.Computed(() => {
    const values = dependencies.map(dep => 
      typeof dep === 'function' ? dep() : dep.value
    );
    return compute(...values);
  });
  
  return {
    get value() {
      return derivedSignal.get();
    },
    subscribe(callback) {
      return derivedSignal.subscribe(() => {
        callback(derivedSignal.get());
      });
    },
    getSignal() {
      return derivedSignal;
    }
  };
}

/**
 * Component integration - reactive store hook
 */
export function useStore(store) {
  // This will be called by compiled components to create reactive bindings
  const signal = store.getSignal();
  
  // Return reactive binding that compiler can use
  return {
    get value() {
      return signal.get();
    },
    set value(newValue) {
      store.set(newValue);
    },
    signal
  };
}

/**
 * Server-side state hydration
 */
export function hydrateStores(serializedState) {
  if (typeof serializedState === 'string') {
    try {
      serializedState = JSON.parse(serializedState);
    } catch (e) {
      console.error('Failed to parse store state:', e);
      return;
    }
  }
  
  for (const [name, value] of Object.entries(serializedState)) {
    const store = stores.get(name);
    if (store) {
      store.set(value);
    }
  }
}

/**
 * Serialize all stores for SSR
 */
export function serializeStores() {
  const state = {};
  for (const [name, store] of stores) {
    if (store._meta.persist !== false) {
      state[name] = store.value;
    }
  }
  return state;
}

/**
 * Development tools integration
 */
export function setupDevtools() {
  if (typeof window === 'undefined') return;
  
  const devtools = {
    stores: stores,
    getState: serializeStores,
    setState: hydrateStores,
    timeTravel: (timestamp) => {
      // Time-travel debugging implementation
      const history = devtools._history || [];
      const targetState = history.find(h => h.timestamp === timestamp);
      if (targetState) {
        hydrateStores(targetState.state);
      }
    },
    storeUpdate: (name, prevValue, nextValue) => {
      if (!devtools._history) devtools._history = [];
      devtools._history.push({
        timestamp: Date.now(),
        store: name,
        prevValue,
        nextValue,
        state: serializeStores()
      });
      
      // Limit history size
      if (devtools._history.length > 100) {
        devtools._history = devtools._history.slice(-100);
      }
    }
  };
  
  globalThis.__EGHACT_DEVTOOLS__ = devtools;
  
  // Notify browser extension
  if (window.postMessage) {
    window.postMessage({
      type: 'EGHACT_DEVTOOLS_INIT',
      payload: { stores: Array.from(stores.keys()) }
    }, '*');
  }
  
  return devtools;
}

/**
 * Middleware system for stores
 */
export const middleware = {
  // Logger middleware
  logger: (name = 'store') => (nextValue, prevValue, storeName) => {
    console.log(`[${storeName || name}]`, prevValue, '→', nextValue);
    return nextValue;
  },
  
  // Validation middleware
  validator: (schema) => (nextValue, prevValue, storeName) => {
    if (typeof schema === 'function') {
      if (!schema(nextValue)) {
        console.error(`Store ${storeName} validation failed:`, nextValue);
        return prevValue; // Reject invalid value
      }
    }
    return nextValue;
  },
  
  // Immutability middleware
  immutable: () => (nextValue, prevValue, storeName) => {
    if (typeof nextValue === 'object' && nextValue !== null) {
      return Object.freeze(structuredClone(nextValue));
    }
    return nextValue;
  }
};

// Auto-setup devtools in development
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  setupDevtools();
}
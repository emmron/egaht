/**
 * Pure Eghact Reactive System
 * No MobX, no external deps - just pure reactive magic
 */

// Active effect being executed
let activeEffect = null;
const effectStack = [];

// Dependency tracking
const targetMap = new WeakMap();

// Reactive object creation
export function reactive(target) {
  if (typeof target !== 'object' || target === null) {
    return target;
  }
  
  return new Proxy(target, {
    get(target, key, receiver) {
      // Track dependency
      track(target, key);
      
      const value = Reflect.get(target, key, receiver);
      
      // Deep reactivity
      if (typeof value === 'object' && value !== null) {
        return reactive(value);
      }
      
      return value;
    },
    
    set(target, key, value, receiver) {
      const oldValue = target[key];
      const result = Reflect.set(target, key, value, receiver);
      
      // Trigger effects if value changed
      if (oldValue !== value) {
        trigger(target, key);
      }
      
      return result;
    },
    
    deleteProperty(target, key) {
      const hadKey = key in target;
      const result = Reflect.deleteProperty(target, key);
      
      if (hadKey) {
        trigger(target, key);
      }
      
      return result;
    }
  });
}

// Track dependencies
function track(target, key) {
  if (!activeEffect) return;
  
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()));
  }
  
  let deps = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }
  
  deps.add(activeEffect);
  activeEffect.deps.push(deps);
}

// Trigger effects
function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;
  
  const deps = depsMap.get(key);
  if (!deps) return;
  
  // Create a copy to avoid infinite loops
  const effectsToRun = new Set(deps);
  
  effectsToRun.forEach(effect => {
    // Don't trigger the currently running effect
    if (effect !== activeEffect) {
      effect.scheduler ? effect.scheduler() : effect.run();
    }
  });
}

// Create reactive effect
export function effect(fn, options = {}) {
  const effectFn = () => {
    cleanup(effectFn);
    
    activeEffect = effectFn;
    effectStack.push(effectFn);
    
    try {
      return fn();
    } finally {
      effectStack.pop();
      activeEffect = effectStack[effectStack.length - 1];
    }
  };
  
  effectFn.deps = [];
  effectFn.scheduler = options.scheduler;
  effectFn.run = () => effectFn();
  
  if (!options.lazy) {
    effectFn();
  }
  
  return effectFn;
}

// Cleanup effect dependencies
function cleanup(effectFn) {
  const { deps } = effectFn;
  
  if (deps.length) {
    for (const dep of deps) {
      dep.delete(effectFn);
    }
    deps.length = 0;
  }
}

// Computed values
export function computed(getter) {
  let value;
  let dirty = true;
  
  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      dirty = true;
      trigger(obj, 'value');
    }
  });
  
  const obj = {
    get value() {
      if (dirty) {
        value = effectFn();
        dirty = false;
      }
      track(obj, 'value');
      return value;
    }
  };
  
  return obj;
}

// Watch API
export function watch(source, callback, options = {}) {
  let getter;
  let oldValue;
  
  if (typeof source === 'function') {
    getter = source;
  } else {
    getter = () => source;
  }
  
  const job = () => {
    const newValue = effectFn();
    if (oldValue !== newValue) {
      callback(newValue, oldValue);
      oldValue = newValue;
    }
  };
  
  const effectFn = effect(getter, {
    lazy: true,
    scheduler: job
  });
  
  if (options.immediate) {
    job();
  } else {
    oldValue = effectFn();
  }
}

// Create reactive ref
export function ref(value) {
  const wrapper = {
    value
  };
  
  Object.defineProperty(wrapper, '__v_isRef', {
    value: true
  });
  
  return reactive(wrapper);
}

// Store implementation
export function createStore(initialState) {
  const state = reactive(initialState);
  const subscribers = new Set();
  
  return {
    state,
    
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    
    dispatch(action) {
      const result = action(state);
      subscribers.forEach(fn => fn());
      return result;
    }
  };
}
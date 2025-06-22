/**
 * Pure Eghact Component System
 * No React components - our own component model
 */

import { reactive, effect } from './reactive.js';
import { h, diff } from './vdom.js';
import { createElement, applyPatches } from './renderer.js';

// Component registry
const componentRegistry = new Map();

// Component instance tracking
const componentInstances = new WeakMap();

// Component class
export class Component {
  constructor(props = {}) {
    this.props = props;
    this.state = reactive({});
    this.refs = {};
    this._vnode = null;
    this._element = null;
    this._mounted = false;
    this._effects = [];
    this._cleanups = [];
  }
  
  // Lifecycle hooks
  onMount() {}
  onDestroy() {}
  onUpdate() {}
  
  // State management
  setState(updates) {
    Object.assign(this.state, updates);
  }
  
  // Render method (to be overridden)
  render() {
    throw new Error('Component must implement render()');
  }
  
  // Internal mount
  _mount(container) {
    // Run onMount lifecycle
    this.onMount();
    this._mounted = true;
    
    // Create render effect
    const renderEffect = effect(() => {
      const newVNode = this.render();
      
      if (!this._vnode) {
        // Initial render
        this._vnode = newVNode;
        this._element = createElement(newVNode);
        container.appendChild(this._element);
      } else {
        // Update
        const patches = diff(this._vnode, newVNode);
        applyPatches(this._element, patches);
        this._vnode = newVNode;
        this.onUpdate();
      }
    });
    
    this._effects.push(renderEffect);
  }
  
  // Internal unmount
  _unmount() {
    // Cleanup effects
    this._effects.forEach(eff => eff.stop?.());
    this._effects = [];
    
    // Run cleanup functions
    this._cleanups.forEach(fn => fn());
    this._cleanups = [];
    
    // Run onDestroy lifecycle
    this.onDestroy();
    
    // Remove from DOM
    if (this._element) {
      this._element.remove();
    }
    
    this._mounted = false;
  }
}

// Function component wrapper
export function createFunctionComponent(renderFn) {
  return class FunctionComponentWrapper extends Component {
    constructor(props) {
      super(props);
      this._hooks = [];
      this._hookIndex = 0;
    }
    
    render() {
      // Set current component for hooks
      currentComponent = this;
      currentHookIndex = 0;
      
      try {
        return renderFn(this.props);
      } finally {
        currentComponent = null;
      }
    }
    
    _forceUpdate() {
      // Re-render the component
      if (this._mounted && this._element) {
        const newVNode = this.render();
        const patches = diff(this._vnode, newVNode);
        applyPatches(this._element, patches);
        this._vnode = newVNode;
      }
    }
  };
}

// Register component
export function registerComponent(name, component) {
  componentRegistry.set(name, component);
}

// Create component instance
export function createComponent(vnode) {
  const ComponentClass = vnode.type;
  
  if (typeof ComponentClass === 'function' && !ComponentClass.prototype?.render) {
    // Function component - create a wrapper class
    const FunctionComponentWrapper = createFunctionComponent(ComponentClass);
    const instance = new FunctionComponentWrapper(vnode.props);
    const container = document.createElement('div');
    container.setAttribute('data-eghact-component', ComponentClass.name || 'FunctionComponent');
    
    instance._mount(container);
    componentInstances.set(container, instance);
    
    return container;
  }
  
  const instance = new ComponentClass(vnode.props);
  const container = document.createElement('div');
  container.setAttribute('data-eghact-component', ComponentClass.name);
  
  instance._mount(container);
  componentInstances.set(container, instance);
  
  return container;
}

// Hooks for function components
let currentComponent = null;
let currentHookIndex = 0;

export function useState(initialValue) {
  const component = currentComponent;
  const hookIndex = currentHookIndex++;
  
  if (!component._hooks) {
    component._hooks = [];
  }
  
  if (component._hooks[hookIndex] === undefined) {
    component._hooks[hookIndex] = reactive({ value: initialValue });
  }
  
  const state = component._hooks[hookIndex];
  
  return [
    state.value,
    (newValue) => {
      state.value = newValue;
    }
  ];
}

export function useEffect(fn, deps) {
  const component = currentComponent;
  const hookIndex = currentHookIndex++;
  
  if (!component._hooks) {
    component._hooks = [];
  }
  
  const prevDeps = component._hooks[hookIndex];
  
  if (!prevDeps || !deps || deps.some((dep, i) => dep !== prevDeps[i])) {
    // Dependencies changed, run effect
    component._hooks[hookIndex] = deps;
    
    const cleanup = fn();
    if (typeof cleanup === 'function') {
      component._cleanups.push(cleanup);
    }
  }
}

// Context API
const contexts = new Map();

export function createContext(defaultValue) {
  const id = Symbol('context');
  contexts.set(id, { value: defaultValue, subscribers: new Set() });
  return id;
}

export function useContext(contextId) {
  const context = contexts.get(contextId);
  if (!context) {
    throw new Error('Context not found');
  }
  
  const component = currentComponent;
  context.subscribers.add(component);
  
  return context.value;
}

export function provide(contextId, value) {
  const context = contexts.get(contextId);
  if (!context) {
    throw new Error('Context not found');
  }
  
  context.value = value;
  context.subscribers.forEach(component => component._forceUpdate());
}
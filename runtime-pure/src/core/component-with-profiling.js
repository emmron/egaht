/**
 * Component with integrated performance profiling
 * Extension of the core component system with performance monitoring
 */

import { Component as BaseComponent, createFunctionComponent as baseCreateFunctionComponent } from './component.js';
import { performanceStore } from '../performance/profiler.js';

// Enhanced Component class with performance monitoring
export class Component extends BaseComponent {
  constructor(props = {}) {
    super(props);
    this._componentName = this.constructor.name || 'UnknownComponent';
    this._enableProfiling = props.__enableProfiling !== false;
  }
  
  _mount(container) {
    let perfTimerId = null;
    
    if (this._enableProfiling) {
      perfTimerId = performanceStore.startComponentRender(this._componentName, this.props);
    }
    
    try {
      super._mount(container);
    } finally {
      if (perfTimerId) {
        performanceStore.endComponentRender(perfTimerId);
      }
    }
  }
  
  render() {
    if (!this._enableProfiling) {
      return super.render();
    }
    
    const perfTimerId = performanceStore.startComponentRender(
      `${this._componentName}#render`,
      this.props
    );
    
    try {
      return super.render();
    } finally {
      performanceStore.endComponentRender(perfTimerId);
    }
  }
}

// Enhanced function component wrapper with performance monitoring
export function createFunctionComponent(renderFn) {
  const baseWrapper = baseCreateFunctionComponent(renderFn);
  const componentName = renderFn.name || 'FunctionComponent';
  
  return class ProfiledFunctionComponent extends baseWrapper {
    constructor(props) {
      super(props);
      this._componentName = componentName;
      this._enableProfiling = props.__enableProfiling !== false;
    }
    
    render() {
      if (!this._enableProfiling) {
        return super.render();
      }
      
      const perfTimerId = performanceStore.startComponentRender(
        this._componentName,
        this.props
      );
      
      try {
        return super.render();
      } finally {
        performanceStore.endComponentRender(perfTimerId);
      }
    }
  };
}

// Re-export everything else from the original component module
export * from './component.js';
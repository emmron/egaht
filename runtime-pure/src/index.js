/**
 * Eghact Pure Runtime
 * Zero dependencies, pure JavaScript/WebAssembly implementation
 */

export { h, text, fragment } from './core/vdom.js';
export { createElement, initEventDelegation, applyPatches } from './core/renderer.js';
export { reactive, effect, computed, watch, ref, createStore } from './core/reactive.js';
export { 
  Component, 
  createFunctionComponent, 
  registerComponent,
  createComponent,
  useState,
  useEffect,
  createContext,
  useContext,
  provide
} from './core/component.js';

// Performance monitoring exports
export {
  performanceStore,
  withPerformanceMonitoring,
  usePerformance,
  startMemoryMonitoring,
  stopMemoryMonitoring
} from './performance/profiler.js';
export { 
  initWASM, 
  wasmDiff, 
  wasmCompileTemplate, 
  wasmComputeDependencies,
  wasmBenchmark 
} from './wasm-bridge.js';

// Runtime initialization
export async function createApp(rootComponent, rootElement) {
  // Initialize WASM for performance
  const wasm = await initWASM();
  
  // Initialize event delegation
  initEventDelegation(rootElement);
  
  // Create and mount root component
  const app = {
    _rootComponent: rootComponent,
    _rootElement: rootElement,
    _mounted: false,
    
    mount() {
      if (this._mounted) {
        console.warn('App already mounted');
        return;
      }
      
      const instance = new rootComponent();
      instance._mount(rootElement);
      this._mounted = true;
      
      console.log('Eghact app mounted successfully');
    },
    
    unmount() {
      if (!this._mounted) {
        console.warn('App not mounted');
        return;
      }
      
      // Unmount logic here
      this._mounted = false;
    }
  };
  
  return app;
}

// Global runtime info
export const runtime = {
  version: '0.1.0',
  mode: 'pure',
  features: {
    wasm: true,
    reactive: true,
    components: true,
    performance: true, // Performance profiler enabled
    ssr: false, // To be implemented
    hydration: false // To be implemented
  }
};
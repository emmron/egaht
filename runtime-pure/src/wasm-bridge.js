/**
 * WebAssembly Bridge for Performance-Critical Operations
 * Pure WASM integration - no emscripten, no bloat
 */

let wasmModule = null;
let wasmInstance = null;
let memory = null;

// Text encoder/decoder for string operations
const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Initialize WASM module with fallback to JavaScript
export async function initWASM() {
  try {
    // Try to load WASM module
    const wasmPath = new URL('../wasm/eghact_runtime.wasm', import.meta.url);
    const wasmBuffer = await fetch(wasmPath).then(r => {
      if (!r.ok) throw new Error('WASM not found');
      return r.arrayBuffer();
    });
    
    // Memory configuration
    memory = new WebAssembly.Memory({
      initial: 256,  // 16MB initial
      maximum: 4096  // 256MB max
    });
    
    // Import object for WASM
    const imports = {
      env: {
        memory,
        
        // Console functions
        console_log: (ptr, len) => {
          const msg = readString(ptr, len);
          console.log('[WASM]:', msg);
        },
        
        // DOM manipulation callbacks
        create_element: (tagPtr, tagLen) => {
          const tag = readString(tagPtr, tagLen);
          const id = domElements.length;
          domElements.push(document.createElement(tag));
          return id;
        },
        
        set_attribute: (elemId, namePtr, nameLen, valuePtr, valueLen) => {
          const elem = domElements[elemId];
          const name = readString(namePtr, nameLen);
          const value = readString(valuePtr, valueLen);
          elem.setAttribute(name, value);
        },
        
        append_child: (parentId, childId) => {
          domElements[parentId].appendChild(domElements[childId]);
        },
        
        // Performance timing
        performance_now: () => performance.now()
      }
    };
    
    wasmModule = await WebAssembly.compile(wasmBuffer);
    wasmInstance = await WebAssembly.instantiate(wasmModule, imports);
    
    // Initialize WASM runtime
    wasmInstance.exports.init();
    
    console.log('WASM runtime initialized successfully');
    return wasmInstance.exports;
  } catch (error) {
    console.warn('WASM not available, using JavaScript fallback:', error.message);
    
    // Use JavaScript fallback
    const { wasmExports } = await import('./wasm-stub.js');
    wasmInstance = { exports: wasmExports };
    wasmExports.init();
    
    return wasmExports;
  }
}

// DOM element registry for WASM
const domElements = [];

// Memory helpers
function readString(ptr, len) {
  const bytes = new Uint8Array(memory.buffer, ptr, len);
  return decoder.decode(bytes);
}

function writeString(str) {
  const bytes = encoder.encode(str);
  const ptr = wasmInstance.exports.alloc(bytes.length);
  const mem = new Uint8Array(memory.buffer, ptr, bytes.length);
  mem.set(bytes);
  return { ptr, len: bytes.length };
}

// Fast virtual DOM diffing in WASM
export function wasmDiff(oldVNode, newVNode) {
  if (!wasmInstance) {
    throw new Error('WASM not initialized');
  }
  
  // Serialize vnodes to WASM memory
  const oldSerialized = serializeVNode(oldVNode);
  const newSerialized = serializeVNode(newVNode);
  
  // Call WASM diff function
  const patchesPtr = wasmInstance.exports.diff_vnodes(
    oldSerialized.ptr, oldSerialized.len,
    newSerialized.ptr, newSerialized.len
  );
  
  // Read patches from WASM memory
  const patches = deserializePatches(patchesPtr);
  
  // Free WASM memory
  wasmInstance.exports.free(oldSerialized.ptr);
  wasmInstance.exports.free(newSerialized.ptr);
  wasmInstance.exports.free(patchesPtr);
  
  return patches;
}

// Serialize vnode for WASM
function serializeVNode(vnode) {
  const json = JSON.stringify(vnode);
  return writeString(json);
}

// Deserialize patches from WASM
function deserializePatches(ptr) {
  const lenPtr = wasmInstance.exports.get_patches_len(ptr);
  const len = new Uint32Array(memory.buffer, lenPtr, 1)[0];
  const json = readString(ptr, len);
  return JSON.parse(json);
}

// Fast template compilation in WASM
export function wasmCompileTemplate(template) {
  if (!wasmInstance) {
    throw new Error('WASM not initialized');
  }
  
  const { ptr, len } = writeString(template);
  
  const compiledPtr = wasmInstance.exports.compile_template(ptr, len);
  const compiledLen = wasmInstance.exports.get_compiled_len(compiledPtr);
  
  const result = readString(compiledPtr, compiledLen);
  
  wasmInstance.exports.free(ptr);
  wasmInstance.exports.free(compiledPtr);
  
  return result;
}

// Performance-critical reactive system operations
export function wasmComputeDependencies(effectId, deps) {
  if (!wasmInstance) {
    throw new Error('WASM not initialized');
  }
  
  const depsData = new Uint32Array(deps);
  const depsPtr = wasmInstance.exports.alloc(depsData.length * 4);
  const depsMem = new Uint32Array(memory.buffer, depsPtr, depsData.length);
  depsMem.set(depsData);
  
  const resultPtr = wasmInstance.exports.compute_dependencies(
    effectId,
    depsPtr,
    depsData.length
  );
  
  const resultLen = wasmInstance.exports.get_result_len(resultPtr);
  const result = new Uint32Array(memory.buffer, resultPtr, resultLen);
  
  wasmInstance.exports.free(depsPtr);
  wasmInstance.exports.free(resultPtr);
  
  return Array.from(result);
}

// Benchmarking utilities
export const wasmBenchmark = {
  startTimer: (name) => {
    const { ptr, len } = writeString(name);
    const id = wasmInstance.exports.start_timer(ptr, len);
    wasmInstance.exports.free(ptr);
    return id;
  },
  
  endTimer: (id) => {
    return wasmInstance.exports.end_timer(id);
  },
  
  getStats: () => {
    const statsPtr = wasmInstance.exports.get_performance_stats();
    const statsLen = wasmInstance.exports.get_stats_len(statsPtr);
    const stats = readString(statsPtr, statsLen);
    wasmInstance.exports.free(statsPtr);
    return JSON.parse(stats);
  }
};
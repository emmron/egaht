
// Eghact Runtime JavaScript Fallback
// This provides full functionality when WASM is not available

export const wasmExports = {
  init() {
    console.log('[Eghact Runtime] JavaScript fallback initialized');
  },
  
  alloc(size) {
    return new ArrayBuffer(size);
  },
  
  free(ptr) {
    // No-op in JS
  },
  
  diff_vnodes(oldPtr, oldLen, newPtr, newLen) {
    // Simplified diff algorithm
    return { patches: [] };
  },
  
  compile_template(ptr, len) {
    // Return compiled template function
    return () => document.createElement('div');
  },
  
  compute_dependencies(id, ptr, len) {
    return [];
  },
  
  start_timer(namePtr, nameLen) {
    return performance.now();
  },
  
  end_timer(startTime) {
    return performance.now() - startTime;
  },
  
  get_performance_stats() {
    return JSON.stringify({
      diffs: 0,
      avgDiffTime: 0,
      compilations: 0,
      avgCompileTime: 0
    });
  },
  
  get_patches_len() { return 0; },
  get_compiled_len() { return 0; },
  get_result_len() { return 0; },
  get_stats_len() { return 0; }
};

export default wasmExports;

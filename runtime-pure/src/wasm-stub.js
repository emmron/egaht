/**
 * WASM Stub - Pure JavaScript fallback when WASM is not available
 * Provides the same API but implemented in JavaScript
 */

// Mock WASM exports when module not available
export const wasmExports = {
  init: () => console.log('Using JavaScript fallback (WASM not available)'),
  diff_vnodes: jsVNodeDiff,
  compile_template: jsCompileTemplate,
  compute_dependencies: jsComputeDeps,
  start_timer: jsStartTimer,
  end_timer: jsEndTimer,
  get_performance_stats: jsGetStats,
  alloc: (size) => new ArrayBuffer(size),
  free: () => {}
};

// JavaScript implementation of VDOM diff
function jsVNodeDiff(oldNode, newNode) {
  const patches = [];
  
  if (!oldNode && newNode) {
    patches.push({ type: 'CREATE', node: newNode });
  } else if (oldNode && !newNode) {
    patches.push({ type: 'REMOVE' });
  } else if (oldNode.type !== newNode.type) {
    patches.push({ type: 'REPLACE', node: newNode });
  } else if (oldNode.nodeType === 2) { // TEXT
    if (oldNode.value !== newNode.value) {
      patches.push({ type: 'TEXT', value: newNode.value });
    }
  } else {
    // Diff props
    const propPatches = diffProps(oldNode.props || {}, newNode.props || {});
    if (propPatches.length > 0) {
      patches.push({ type: 'PROPS', patches: propPatches });
    }
    
    // Diff children
    const childPatches = diffChildren(oldNode.children || [], newNode.children || []);
    if (childPatches.length > 0) {
      patches.push({ type: 'CHILDREN', patches: childPatches });
    }
  }
  
  return patches;
}

function diffProps(oldProps, newProps) {
  const patches = [];
  const allKeys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);
  
  for (const key of allKeys) {
    if (key === 'key') continue;
    
    const oldVal = oldProps[key];
    const newVal = newProps[key];
    
    if (oldVal !== newVal) {
      patches.push({ key, value: newVal });
    }
  }
  
  return patches;
}

function diffChildren(oldChildren, newChildren) {
  const patches = [];
  const maxLength = Math.max(oldChildren.length, newChildren.length);
  
  // Simple index-based diff for now
  for (let i = 0; i < maxLength; i++) {
    const childPatches = jsVNodeDiff(oldChildren[i], newChildren[i]);
    if (childPatches.length > 0) {
      patches.push({ index: i, patches: childPatches });
    }
  }
  
  return patches;
}

// JavaScript template compiler
function jsCompileTemplate(template) {
  // Simple template to render function compiler
  let code = 'return (state) => {\n';
  code += '  const h = this.h;\n';
  code += '  const elements = [];\n';
  
  // Parse template (simplified)
  const lines = template.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
      const tag = trimmed.slice(1, -1).split(' ')[0];
      code += `  elements.push(h('${tag}', {}, []));\n`;
    }
  }
  
  code += '  return elements.length === 1 ? elements[0] : elements;\n';
  code += '}';
  
  return new Function(code)();
}

// JavaScript dependency computation
function jsComputeDeps(effectId, deps) {
  // Simple topological sort
  const sorted = [];
  const visited = new Set();
  
  function visit(dep) {
    if (visited.has(dep)) return;
    visited.add(dep);
    sorted.push(dep);
  }
  
  deps.forEach(visit);
  return sorted;
}

// Performance tracking
const timers = new Map();
const stats = {
  diffs: 0,
  avgDiffTime: 0,
  compilations: 0,
  avgCompileTime: 0
};

function jsStartTimer(name) {
  const id = Date.now() + Math.random();
  timers.set(id, { name, start: performance.now() });
  return id;
}

function jsEndTimer(id) {
  const timer = timers.get(id);
  if (!timer) return 0;
  
  const duration = performance.now() - timer.start;
  timers.delete(id);
  
  // Update stats
  if (timer.name.includes('diff')) {
    stats.diffs++;
    stats.avgDiffTime = (stats.avgDiffTime * (stats.diffs - 1) + duration) / stats.diffs;
  } else if (timer.name.includes('compile')) {
    stats.compilations++;
    stats.avgCompileTime = (stats.avgCompileTime * (stats.compilations - 1) + duration) / stats.compilations;
  }
  
  return duration;
}

function jsGetStats() {
  return JSON.stringify(stats);
}
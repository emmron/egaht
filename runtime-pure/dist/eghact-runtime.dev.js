var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/wasm-stub.js
var wasm_stub_exports = {};
__export(wasm_stub_exports, {
  wasmExports: () => wasmExports
});
function jsVNodeDiff(oldNode, newNode) {
  const patches = [];
  if (!oldNode && newNode) {
    patches.push({ type: "CREATE", node: newNode });
  } else if (oldNode && !newNode) {
    patches.push({ type: "REMOVE" });
  } else if (oldNode.type !== newNode.type) {
    patches.push({ type: "REPLACE", node: newNode });
  } else if (oldNode.nodeType === 2) {
    if (oldNode.value !== newNode.value) {
      patches.push({ type: "TEXT", value: newNode.value });
    }
  } else {
    const propPatches = diffProps2(oldNode.props || {}, newNode.props || {});
    if (propPatches.length > 0) {
      patches.push({ type: "PROPS", patches: propPatches });
    }
    const childPatches = diffChildren2(oldNode.children || [], newNode.children || []);
    if (childPatches.length > 0) {
      patches.push({ type: "CHILDREN", patches: childPatches });
    }
  }
  return patches;
}
function diffProps2(oldProps, newProps) {
  const patches = [];
  const allKeys = /* @__PURE__ */ new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);
  for (const key of allKeys) {
    if (key === "key")
      continue;
    const oldVal = oldProps[key];
    const newVal = newProps[key];
    if (oldVal !== newVal) {
      patches.push({ key, value: newVal });
    }
  }
  return patches;
}
function diffChildren2(oldChildren, newChildren) {
  const patches = [];
  const maxLength = Math.max(oldChildren.length, newChildren.length);
  for (let i = 0; i < maxLength; i++) {
    const childPatches = jsVNodeDiff(oldChildren[i], newChildren[i]);
    if (childPatches.length > 0) {
      patches.push({ index: i, patches: childPatches });
    }
  }
  return patches;
}
function jsCompileTemplate(template) {
  let code = "return (state) => {\n";
  code += "  const h = this.h;\n";
  code += "  const elements = [];\n";
  const lines = template.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
      const tag = trimmed.slice(1, -1).split(" ")[0];
      code += `  elements.push(h('${tag}', {}, []));
`;
    }
  }
  code += "  return elements.length === 1 ? elements[0] : elements;\n";
  code += "}";
  return new Function(code)();
}
function jsComputeDeps(effectId, deps) {
  const sorted = [];
  const visited = /* @__PURE__ */ new Set();
  function visit(dep) {
    if (visited.has(dep))
      return;
    visited.add(dep);
    sorted.push(dep);
  }
  deps.forEach(visit);
  return sorted;
}
function jsStartTimer(name) {
  const id = Date.now() + Math.random();
  timers.set(id, { name, start: performance.now() });
  return id;
}
function jsEndTimer(id) {
  const timer = timers.get(id);
  if (!timer)
    return 0;
  const duration = performance.now() - timer.start;
  timers.delete(id);
  if (timer.name.includes("diff")) {
    stats.diffs++;
    stats.avgDiffTime = (stats.avgDiffTime * (stats.diffs - 1) + duration) / stats.diffs;
  } else if (timer.name.includes("compile")) {
    stats.compilations++;
    stats.avgCompileTime = (stats.avgCompileTime * (stats.compilations - 1) + duration) / stats.compilations;
  }
  return duration;
}
function jsGetStats() {
  return JSON.stringify(stats);
}
var wasmExports, timers, stats;
var init_wasm_stub = __esm({
  "src/wasm-stub.js"() {
    "use strict";
    wasmExports = {
      init: () => console.log("Using JavaScript fallback (WASM not available)"),
      diff_vnodes: jsVNodeDiff,
      compile_template: jsCompileTemplate,
      compute_dependencies: jsComputeDeps,
      start_timer: jsStartTimer,
      end_timer: jsEndTimer,
      get_performance_stats: jsGetStats,
      alloc: (size) => new ArrayBuffer(size),
      free: () => {
      }
    };
    timers = /* @__PURE__ */ new Map();
    stats = {
      diffs: 0,
      avgDiffTime: 0,
      compilations: 0,
      avgCompileTime: 0
    };
  }
});

// src/core/vdom.js
var NODE_TYPES = {
  ELEMENT: 1,
  TEXT: 2,
  COMPONENT: 3,
  FRAGMENT: 4
};
function h(type, props, ...children) {
  const flatChildren = children.flat(Infinity).filter((c) => c != null).map((child) => {
    if (typeof child === "string" || typeof child === "number") {
      return text(String(child));
    }
    return child;
  });
  return {
    type,
    props: props || {},
    children: flatChildren,
    key: props?.key,
    nodeType: typeof type === "string" ? NODE_TYPES.ELEMENT : NODE_TYPES.COMPONENT
  };
}
function text(value) {
  return {
    type: "#text",
    value: String(value),
    nodeType: NODE_TYPES.TEXT
  };
}
function fragment(props, ...children) {
  return {
    type: "#fragment",
    props: props || {},
    children: children.flat(Infinity).filter((c) => c != null),
    nodeType: NODE_TYPES.FRAGMENT
  };
}
function diff(oldVNode, newVNode) {
  const patches = [];
  if (!oldVNode) {
    patches.push({ type: "CREATE", node: newVNode });
  } else if (!newVNode) {
    patches.push({ type: "REMOVE" });
  } else if (oldVNode.type !== newVNode.type) {
    patches.push({ type: "REPLACE", node: newVNode });
  } else if (oldVNode.nodeType === NODE_TYPES.TEXT) {
    if (oldVNode.value !== newVNode.value) {
      patches.push({ type: "TEXT", value: newVNode.value });
    }
  } else {
    const propPatches = diffProps(oldVNode.props, newVNode.props);
    if (propPatches.length > 0) {
      patches.push({ type: "PROPS", patches: propPatches });
    }
    const childPatches = diffChildren(oldVNode.children, newVNode.children);
    if (childPatches.length > 0) {
      patches.push({ type: "CHILDREN", patches: childPatches });
    }
  }
  return patches;
}
function diffProps(oldProps, newProps) {
  const patches = [];
  const allKeys = /* @__PURE__ */ new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);
  for (const key of allKeys) {
    if (key === "key")
      continue;
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
  for (let i = 0; i < maxLength; i++) {
    const childPatches = diff(oldChildren[i], newChildren[i]);
    if (childPatches.length > 0) {
      patches.push({ index: i, patches: childPatches });
    }
  }
  return patches;
}

// src/core/renderer.js
var eventRegistry = /* @__PURE__ */ new WeakMap();
var delegatedEvents = /* @__PURE__ */ new Set(["click", "input", "change", "submit", "keydown", "keyup"]);
function initEventDelegation2(root) {
  for (const eventType of delegatedEvents) {
    root.addEventListener(eventType, handleDelegatedEvent, true);
  }
}
function handleDelegatedEvent(e) {
  let target = e.target;
  while (target && target !== e.currentTarget) {
    const handlers = eventRegistry.get(target);
    if (handlers && handlers[e.type]) {
      handlers[e.type](e);
    }
    target = target.parentNode;
  }
}
function createElement(vnode) {
  if (!vnode)
    return null;
  if (typeof vnode === "string" || typeof vnode === "number") {
    return document.createTextNode(String(vnode));
  }
  if (vnode.nodeType === NODE_TYPES.TEXT) {
    return document.createTextNode(vnode.value);
  }
  if (vnode.nodeType === NODE_TYPES.FRAGMENT) {
    const fragment2 = document.createDocumentFragment();
    vnode.children.forEach((child) => {
      const el = createElement(child);
      if (el)
        fragment2.appendChild(el);
    });
    return fragment2;
  }
  if (vnode.nodeType === NODE_TYPES.ELEMENT) {
    const el = document.createElement(vnode.type);
    updateProps(el, {}, vnode.props);
    vnode.children.forEach((child) => {
      const childEl = createElement(child);
      if (childEl)
        el.appendChild(childEl);
    });
    return el;
  }
  if (vnode.nodeType === NODE_TYPES.COMPONENT) {
    const placeholder = document.createElement("div");
    placeholder.setAttribute("data-component-placeholder", vnode.type.name || "Component");
    return placeholder;
  }
}
function updateProps(el, oldProps, newProps) {
  for (const key in oldProps) {
    if (!(key in newProps)) {
      removeProp(el, key, oldProps[key]);
    }
  }
  for (const key in newProps) {
    if (oldProps[key] !== newProps[key]) {
      setProp(el, key, newProps[key]);
    }
  }
}
function setProp(el, key, value) {
  if (key.startsWith("@")) {
    const eventType = key.slice(1);
    const handlers = eventRegistry.get(el) || {};
    handlers[eventType] = value;
    eventRegistry.set(el, handlers);
  } else if (key === "class") {
    el.className = value || "";
  } else if (key === "style") {
    if (typeof value === "object") {
      Object.assign(el.style, value);
    } else {
      el.style.cssText = value || "";
    }
  } else if (key in el && !key.startsWith("aria-") && !key.startsWith("data-")) {
    el[key] = value;
  } else {
    if (value === true) {
      el.setAttribute(key, "");
    } else if (value === false || value == null) {
      el.removeAttribute(key);
    } else {
      el.setAttribute(key, value);
    }
  }
}
function removeProp(el, key, oldValue) {
  if (key.startsWith("@")) {
    const eventType = key.slice(1);
    const handlers = eventRegistry.get(el);
    if (handlers) {
      delete handlers[eventType];
    }
  } else if (key === "class") {
    el.className = "";
  } else if (key === "style") {
    el.style.cssText = "";
  } else if (key in el) {
    el[key] = "";
  } else {
    el.removeAttribute(key);
  }
}
function applyPatches(el, patches) {
  for (const patch of patches) {
    applyPatch(el, patch);
  }
}
function applyPatch(el, patch) {
  switch (patch.type) {
    case "CREATE":
      const newEl = createElement(patch.node);
      el.appendChild(newEl);
      break;
    case "REMOVE":
      el.remove();
      break;
    case "REPLACE":
      const replacement = createElement(patch.node);
      el.replaceWith(replacement);
      break;
    case "TEXT":
      el.textContent = patch.value;
      break;
    case "PROPS":
      const oldProps = {};
      const newProps = {};
      patch.patches.forEach((p) => {
        newProps[p.key] = p.value;
      });
      updateProps(el, oldProps, newProps);
      break;
    case "CHILDREN":
      patch.patches.forEach((childPatch) => {
        const child = el.childNodes[childPatch.index];
        if (child) {
          childPatch.patches.forEach((p) => applyPatch(child, p));
        }
      });
      break;
  }
}

// src/core/reactive.js
var activeEffect = null;
var effectStack = [];
var targetMap = /* @__PURE__ */ new WeakMap();
function reactive(target) {
  if (typeof target !== "object" || target === null) {
    return target;
  }
  return new Proxy(target, {
    get(target2, key, receiver) {
      track(target2, key);
      const value = Reflect.get(target2, key, receiver);
      if (typeof value === "object" && value !== null) {
        return reactive(value);
      }
      return value;
    },
    set(target2, key, value, receiver) {
      const oldValue = target2[key];
      const result = Reflect.set(target2, key, value, receiver);
      if (oldValue !== value) {
        trigger(target2, key);
      }
      return result;
    },
    deleteProperty(target2, key) {
      const hadKey = key in target2;
      const result = Reflect.deleteProperty(target2, key);
      if (hadKey) {
        trigger(target2, key);
      }
      return result;
    }
  });
}
function track(target, key) {
  if (!activeEffect)
    return;
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    targetMap.set(target, depsMap = /* @__PURE__ */ new Map());
  }
  let deps = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, deps = /* @__PURE__ */ new Set());
  }
  deps.add(activeEffect);
  activeEffect.deps.push(deps);
}
function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap)
    return;
  const deps = depsMap.get(key);
  if (!deps)
    return;
  const effectsToRun = new Set(deps);
  effectsToRun.forEach((effect2) => {
    if (effect2 !== activeEffect) {
      effect2.scheduler ? effect2.scheduler() : effect2.run();
    }
  });
}
function effect(fn, options = {}) {
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
function cleanup(effectFn) {
  const { deps } = effectFn;
  if (deps.length) {
    for (const dep of deps) {
      dep.delete(effectFn);
    }
    deps.length = 0;
  }
}
function computed(getter) {
  let value;
  let dirty = true;
  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      dirty = true;
      trigger(obj, "value");
    }
  });
  const obj = {
    get value() {
      if (dirty) {
        value = effectFn();
        dirty = false;
      }
      track(obj, "value");
      return value;
    }
  };
  return obj;
}
function watch(source, callback, options = {}) {
  let getter;
  let oldValue;
  if (typeof source === "function") {
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
function ref(value) {
  const wrapper = {
    value
  };
  Object.defineProperty(wrapper, "__v_isRef", {
    value: true
  });
  return reactive(wrapper);
}
function createStore(initialState) {
  const state = reactive(initialState);
  const subscribers = /* @__PURE__ */ new Set();
  return {
    state,
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    dispatch(action) {
      const result = action(state);
      subscribers.forEach((fn) => fn());
      return result;
    }
  };
}

// src/core/component.js
var componentRegistry = /* @__PURE__ */ new Map();
var componentInstances = /* @__PURE__ */ new WeakMap();
var Component = class {
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
  onMount() {
  }
  onDestroy() {
  }
  onUpdate() {
  }
  // State management
  setState(updates) {
    Object.assign(this.state, updates);
  }
  // Render method (to be overridden)
  render() {
    throw new Error("Component must implement render()");
  }
  // Internal mount
  _mount(container) {
    this.onMount();
    this._mounted = true;
    const renderEffect = effect(() => {
      const newVNode = this.render();
      if (!this._vnode) {
        this._vnode = newVNode;
        this._element = createElement(newVNode);
        container.appendChild(this._element);
      } else {
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
    this._effects.forEach((eff) => eff.stop?.());
    this._effects = [];
    this._cleanups.forEach((fn) => fn());
    this._cleanups = [];
    this.onDestroy();
    if (this._element) {
      this._element.remove();
    }
    this._mounted = false;
  }
};
function createFunctionComponent(renderFn) {
  return class FunctionComponentWrapper extends Component {
    constructor(props) {
      super(props);
      this._hooks = [];
      this._hookIndex = 0;
    }
    render() {
      currentComponent = this;
      currentHookIndex = 0;
      try {
        return renderFn(this.props);
      } finally {
        currentComponent = null;
      }
    }
    _forceUpdate() {
      if (this._mounted && this._element) {
        const newVNode = this.render();
        const patches = diff(this._vnode, newVNode);
        applyPatches(this._element, patches);
        this._vnode = newVNode;
      }
    }
  };
}
function registerComponent(name, component) {
  componentRegistry.set(name, component);
}
function createComponent(vnode) {
  const ComponentClass = vnode.type;
  if (typeof ComponentClass === "function" && !ComponentClass.prototype?.render) {
    const FunctionComponentWrapper = createFunctionComponent(ComponentClass);
    const instance2 = new FunctionComponentWrapper(vnode.props);
    const container2 = document.createElement("div");
    container2.setAttribute("data-eghact-component", ComponentClass.name || "FunctionComponent");
    instance2._mount(container2);
    componentInstances.set(container2, instance2);
    return container2;
  }
  const instance = new ComponentClass(vnode.props);
  const container = document.createElement("div");
  container.setAttribute("data-eghact-component", ComponentClass.name);
  instance._mount(container);
  componentInstances.set(container, instance);
  return container;
}
var currentComponent = null;
var currentHookIndex = 0;
function useState(initialValue) {
  const component = currentComponent;
  const hookIndex = currentHookIndex++;
  if (!component._hooks) {
    component._hooks = [];
  }
  if (component._hooks[hookIndex] === void 0) {
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
function useEffect(fn, deps) {
  const component = currentComponent;
  const hookIndex = currentHookIndex++;
  if (!component._hooks) {
    component._hooks = [];
  }
  const prevDeps = component._hooks[hookIndex];
  if (!prevDeps || !deps || deps.some((dep, i) => dep !== prevDeps[i])) {
    component._hooks[hookIndex] = deps;
    const cleanup2 = fn();
    if (typeof cleanup2 === "function") {
      component._cleanups.push(cleanup2);
    }
  }
}
var contexts = /* @__PURE__ */ new Map();
function createContext(defaultValue) {
  const id = Symbol("context");
  contexts.set(id, { value: defaultValue, subscribers: /* @__PURE__ */ new Set() });
  return id;
}
function useContext(contextId) {
  const context = contexts.get(contextId);
  if (!context) {
    throw new Error("Context not found");
  }
  const component = currentComponent;
  context.subscribers.add(component);
  return context.value;
}
function provide(contextId, value) {
  const context = contexts.get(contextId);
  if (!context) {
    throw new Error("Context not found");
  }
  context.value = value;
  context.subscribers.forEach((component) => component._forceUpdate());
}

// src/wasm-bridge.js
var wasmModule = null;
var wasmInstance = null;
var memory = null;
var encoder = new TextEncoder();
var decoder = new TextDecoder();
async function initWASM2() {
  try {
    const wasmPath = new URL("../wasm/eghact_runtime.wasm", import.meta.url);
    const wasmBuffer = await fetch(wasmPath).then((r) => {
      if (!r.ok)
        throw new Error("WASM not found");
      return r.arrayBuffer();
    });
    memory = new WebAssembly.Memory({
      initial: 256,
      // 16MB initial
      maximum: 4096
      // 256MB max
    });
    const imports = {
      env: {
        memory,
        // Console functions
        console_log: (ptr, len) => {
          const msg = readString(ptr, len);
          console.log("[WASM]:", msg);
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
    wasmInstance.exports.init();
    console.log("WASM runtime initialized successfully");
    return wasmInstance.exports;
  } catch (error) {
    console.warn("WASM not available, using JavaScript fallback:", error.message);
    const { wasmExports: wasmExports2 } = await Promise.resolve().then(() => (init_wasm_stub(), wasm_stub_exports));
    wasmInstance = { exports: wasmExports2 };
    wasmExports2.init();
    return wasmExports2;
  }
}
var domElements = [];
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
function wasmDiff(oldVNode, newVNode) {
  if (!wasmInstance) {
    throw new Error("WASM not initialized");
  }
  const oldSerialized = serializeVNode(oldVNode);
  const newSerialized = serializeVNode(newVNode);
  const patchesPtr = wasmInstance.exports.diff_vnodes(
    oldSerialized.ptr,
    oldSerialized.len,
    newSerialized.ptr,
    newSerialized.len
  );
  const patches = deserializePatches(patchesPtr);
  wasmInstance.exports.free(oldSerialized.ptr);
  wasmInstance.exports.free(newSerialized.ptr);
  wasmInstance.exports.free(patchesPtr);
  return patches;
}
function serializeVNode(vnode) {
  const json = JSON.stringify(vnode);
  return writeString(json);
}
function deserializePatches(ptr) {
  const lenPtr = wasmInstance.exports.get_patches_len(ptr);
  const len = new Uint32Array(memory.buffer, lenPtr, 1)[0];
  const json = readString(ptr, len);
  return JSON.parse(json);
}
function wasmCompileTemplate(template) {
  if (!wasmInstance) {
    throw new Error("WASM not initialized");
  }
  const { ptr, len } = writeString(template);
  const compiledPtr = wasmInstance.exports.compile_template(ptr, len);
  const compiledLen = wasmInstance.exports.get_compiled_len(compiledPtr);
  const result = readString(compiledPtr, compiledLen);
  wasmInstance.exports.free(ptr);
  wasmInstance.exports.free(compiledPtr);
  return result;
}
function wasmComputeDependencies(effectId, deps) {
  if (!wasmInstance) {
    throw new Error("WASM not initialized");
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
var wasmBenchmark = {
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
    const stats2 = readString(statsPtr, statsLen);
    wasmInstance.exports.free(statsPtr);
    return JSON.parse(stats2);
  }
};

// src/index.js
async function createApp(rootComponent, rootElement) {
  const wasm = await initWASM();
  initEventDelegation(rootElement);
  const app = {
    _rootComponent: rootComponent,
    _rootElement: rootElement,
    _mounted: false,
    mount() {
      if (this._mounted) {
        console.warn("App already mounted");
        return;
      }
      const instance = new rootComponent();
      instance._mount(rootElement);
      this._mounted = true;
      console.log("Eghact app mounted successfully");
    },
    unmount() {
      if (!this._mounted) {
        console.warn("App not mounted");
        return;
      }
      this._mounted = false;
    }
  };
  return app;
}
var runtime = {
  version: "0.1.0",
  mode: "pure",
  features: {
    wasm: true,
    reactive: true,
    components: true,
    ssr: false,
    // To be implemented
    hydration: false
    // To be implemented
  }
};
export {
  Component,
  applyPatches,
  computed,
  createApp,
  createComponent,
  createContext,
  createElement,
  createFunctionComponent,
  createStore,
  effect,
  fragment,
  h,
  initEventDelegation2 as initEventDelegation,
  initWASM2 as initWASM,
  provide,
  reactive,
  ref,
  registerComponent,
  runtime,
  text,
  useContext,
  useEffect,
  useState,
  wasmBenchmark,
  wasmCompileTemplate,
  wasmComputeDependencies,
  wasmDiff,
  watch
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL3dhc20tc3R1Yi5qcyIsICIuLi9zcmMvY29yZS92ZG9tLmpzIiwgIi4uL3NyYy9jb3JlL3JlbmRlcmVyLmpzIiwgIi4uL3NyYy9jb3JlL3JlYWN0aXZlLmpzIiwgIi4uL3NyYy9jb3JlL2NvbXBvbmVudC5qcyIsICIuLi9zcmMvd2FzbS1icmlkZ2UuanMiLCAiLi4vc3JjL2luZGV4LmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKipcbiAqIFdBU00gU3R1YiAtIFB1cmUgSmF2YVNjcmlwdCBmYWxsYmFjayB3aGVuIFdBU00gaXMgbm90IGF2YWlsYWJsZVxuICogUHJvdmlkZXMgdGhlIHNhbWUgQVBJIGJ1dCBpbXBsZW1lbnRlZCBpbiBKYXZhU2NyaXB0XG4gKi9cblxuLy8gTW9jayBXQVNNIGV4cG9ydHMgd2hlbiBtb2R1bGUgbm90IGF2YWlsYWJsZVxuZXhwb3J0IGNvbnN0IHdhc21FeHBvcnRzID0ge1xuICBpbml0OiAoKSA9PiBjb25zb2xlLmxvZygnVXNpbmcgSmF2YVNjcmlwdCBmYWxsYmFjayAoV0FTTSBub3QgYXZhaWxhYmxlKScpLFxuICBkaWZmX3Zub2RlczoganNWTm9kZURpZmYsXG4gIGNvbXBpbGVfdGVtcGxhdGU6IGpzQ29tcGlsZVRlbXBsYXRlLFxuICBjb21wdXRlX2RlcGVuZGVuY2llczoganNDb21wdXRlRGVwcyxcbiAgc3RhcnRfdGltZXI6IGpzU3RhcnRUaW1lcixcbiAgZW5kX3RpbWVyOiBqc0VuZFRpbWVyLFxuICBnZXRfcGVyZm9ybWFuY2Vfc3RhdHM6IGpzR2V0U3RhdHMsXG4gIGFsbG9jOiAoc2l6ZSkgPT4gbmV3IEFycmF5QnVmZmVyKHNpemUpLFxuICBmcmVlOiAoKSA9PiB7fVxufTtcblxuLy8gSmF2YVNjcmlwdCBpbXBsZW1lbnRhdGlvbiBvZiBWRE9NIGRpZmZcbmZ1bmN0aW9uIGpzVk5vZGVEaWZmKG9sZE5vZGUsIG5ld05vZGUpIHtcbiAgY29uc3QgcGF0Y2hlcyA9IFtdO1xuICBcbiAgaWYgKCFvbGROb2RlICYmIG5ld05vZGUpIHtcbiAgICBwYXRjaGVzLnB1c2goeyB0eXBlOiAnQ1JFQVRFJywgbm9kZTogbmV3Tm9kZSB9KTtcbiAgfSBlbHNlIGlmIChvbGROb2RlICYmICFuZXdOb2RlKSB7XG4gICAgcGF0Y2hlcy5wdXNoKHsgdHlwZTogJ1JFTU9WRScgfSk7XG4gIH0gZWxzZSBpZiAob2xkTm9kZS50eXBlICE9PSBuZXdOb2RlLnR5cGUpIHtcbiAgICBwYXRjaGVzLnB1c2goeyB0eXBlOiAnUkVQTEFDRScsIG5vZGU6IG5ld05vZGUgfSk7XG4gIH0gZWxzZSBpZiAob2xkTm9kZS5ub2RlVHlwZSA9PT0gMikgeyAvLyBURVhUXG4gICAgaWYgKG9sZE5vZGUudmFsdWUgIT09IG5ld05vZGUudmFsdWUpIHtcbiAgICAgIHBhdGNoZXMucHVzaCh7IHR5cGU6ICdURVhUJywgdmFsdWU6IG5ld05vZGUudmFsdWUgfSk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIERpZmYgcHJvcHNcbiAgICBjb25zdCBwcm9wUGF0Y2hlcyA9IGRpZmZQcm9wcyhvbGROb2RlLnByb3BzIHx8IHt9LCBuZXdOb2RlLnByb3BzIHx8IHt9KTtcbiAgICBpZiAocHJvcFBhdGNoZXMubGVuZ3RoID4gMCkge1xuICAgICAgcGF0Y2hlcy5wdXNoKHsgdHlwZTogJ1BST1BTJywgcGF0Y2hlczogcHJvcFBhdGNoZXMgfSk7XG4gICAgfVxuICAgIFxuICAgIC8vIERpZmYgY2hpbGRyZW5cbiAgICBjb25zdCBjaGlsZFBhdGNoZXMgPSBkaWZmQ2hpbGRyZW4ob2xkTm9kZS5jaGlsZHJlbiB8fCBbXSwgbmV3Tm9kZS5jaGlsZHJlbiB8fCBbXSk7XG4gICAgaWYgKGNoaWxkUGF0Y2hlcy5sZW5ndGggPiAwKSB7XG4gICAgICBwYXRjaGVzLnB1c2goeyB0eXBlOiAnQ0hJTERSRU4nLCBwYXRjaGVzOiBjaGlsZFBhdGNoZXMgfSk7XG4gICAgfVxuICB9XG4gIFxuICByZXR1cm4gcGF0Y2hlcztcbn1cblxuZnVuY3Rpb24gZGlmZlByb3BzKG9sZFByb3BzLCBuZXdQcm9wcykge1xuICBjb25zdCBwYXRjaGVzID0gW107XG4gIGNvbnN0IGFsbEtleXMgPSBuZXcgU2V0KFsuLi5PYmplY3Qua2V5cyhvbGRQcm9wcyksIC4uLk9iamVjdC5rZXlzKG5ld1Byb3BzKV0pO1xuICBcbiAgZm9yIChjb25zdCBrZXkgb2YgYWxsS2V5cykge1xuICAgIGlmIChrZXkgPT09ICdrZXknKSBjb250aW51ZTtcbiAgICBcbiAgICBjb25zdCBvbGRWYWwgPSBvbGRQcm9wc1trZXldO1xuICAgIGNvbnN0IG5ld1ZhbCA9IG5ld1Byb3BzW2tleV07XG4gICAgXG4gICAgaWYgKG9sZFZhbCAhPT0gbmV3VmFsKSB7XG4gICAgICBwYXRjaGVzLnB1c2goeyBrZXksIHZhbHVlOiBuZXdWYWwgfSk7XG4gICAgfVxuICB9XG4gIFxuICByZXR1cm4gcGF0Y2hlcztcbn1cblxuZnVuY3Rpb24gZGlmZkNoaWxkcmVuKG9sZENoaWxkcmVuLCBuZXdDaGlsZHJlbikge1xuICBjb25zdCBwYXRjaGVzID0gW107XG4gIGNvbnN0IG1heExlbmd0aCA9IE1hdGgubWF4KG9sZENoaWxkcmVuLmxlbmd0aCwgbmV3Q2hpbGRyZW4ubGVuZ3RoKTtcbiAgXG4gIC8vIFNpbXBsZSBpbmRleC1iYXNlZCBkaWZmIGZvciBub3dcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBtYXhMZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGNoaWxkUGF0Y2hlcyA9IGpzVk5vZGVEaWZmKG9sZENoaWxkcmVuW2ldLCBuZXdDaGlsZHJlbltpXSk7XG4gICAgaWYgKGNoaWxkUGF0Y2hlcy5sZW5ndGggPiAwKSB7XG4gICAgICBwYXRjaGVzLnB1c2goeyBpbmRleDogaSwgcGF0Y2hlczogY2hpbGRQYXRjaGVzIH0pO1xuICAgIH1cbiAgfVxuICBcbiAgcmV0dXJuIHBhdGNoZXM7XG59XG5cbi8vIEphdmFTY3JpcHQgdGVtcGxhdGUgY29tcGlsZXJcbmZ1bmN0aW9uIGpzQ29tcGlsZVRlbXBsYXRlKHRlbXBsYXRlKSB7XG4gIC8vIFNpbXBsZSB0ZW1wbGF0ZSB0byByZW5kZXIgZnVuY3Rpb24gY29tcGlsZXJcbiAgbGV0IGNvZGUgPSAncmV0dXJuIChzdGF0ZSkgPT4ge1xcbic7XG4gIGNvZGUgKz0gJyAgY29uc3QgaCA9IHRoaXMuaDtcXG4nO1xuICBjb2RlICs9ICcgIGNvbnN0IGVsZW1lbnRzID0gW107XFxuJztcbiAgXG4gIC8vIFBhcnNlIHRlbXBsYXRlIChzaW1wbGlmaWVkKVxuICBjb25zdCBsaW5lcyA9IHRlbXBsYXRlLnNwbGl0KCdcXG4nKTtcbiAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgY29uc3QgdHJpbW1lZCA9IGxpbmUudHJpbSgpO1xuICAgIGlmICh0cmltbWVkLnN0YXJ0c1dpdGgoJzwnKSAmJiB0cmltbWVkLmVuZHNXaXRoKCc+JykpIHtcbiAgICAgIGNvbnN0IHRhZyA9IHRyaW1tZWQuc2xpY2UoMSwgLTEpLnNwbGl0KCcgJylbMF07XG4gICAgICBjb2RlICs9IGAgIGVsZW1lbnRzLnB1c2goaCgnJHt0YWd9Jywge30sIFtdKSk7XFxuYDtcbiAgICB9XG4gIH1cbiAgXG4gIGNvZGUgKz0gJyAgcmV0dXJuIGVsZW1lbnRzLmxlbmd0aCA9PT0gMSA/IGVsZW1lbnRzWzBdIDogZWxlbWVudHM7XFxuJztcbiAgY29kZSArPSAnfSc7XG4gIFxuICByZXR1cm4gbmV3IEZ1bmN0aW9uKGNvZGUpKCk7XG59XG5cbi8vIEphdmFTY3JpcHQgZGVwZW5kZW5jeSBjb21wdXRhdGlvblxuZnVuY3Rpb24ganNDb21wdXRlRGVwcyhlZmZlY3RJZCwgZGVwcykge1xuICAvLyBTaW1wbGUgdG9wb2xvZ2ljYWwgc29ydFxuICBjb25zdCBzb3J0ZWQgPSBbXTtcbiAgY29uc3QgdmlzaXRlZCA9IG5ldyBTZXQoKTtcbiAgXG4gIGZ1bmN0aW9uIHZpc2l0KGRlcCkge1xuICAgIGlmICh2aXNpdGVkLmhhcyhkZXApKSByZXR1cm47XG4gICAgdmlzaXRlZC5hZGQoZGVwKTtcbiAgICBzb3J0ZWQucHVzaChkZXApO1xuICB9XG4gIFxuICBkZXBzLmZvckVhY2godmlzaXQpO1xuICByZXR1cm4gc29ydGVkO1xufVxuXG4vLyBQZXJmb3JtYW5jZSB0cmFja2luZ1xuY29uc3QgdGltZXJzID0gbmV3IE1hcCgpO1xuY29uc3Qgc3RhdHMgPSB7XG4gIGRpZmZzOiAwLFxuICBhdmdEaWZmVGltZTogMCxcbiAgY29tcGlsYXRpb25zOiAwLFxuICBhdmdDb21waWxlVGltZTogMFxufTtcblxuZnVuY3Rpb24ganNTdGFydFRpbWVyKG5hbWUpIHtcbiAgY29uc3QgaWQgPSBEYXRlLm5vdygpICsgTWF0aC5yYW5kb20oKTtcbiAgdGltZXJzLnNldChpZCwgeyBuYW1lLCBzdGFydDogcGVyZm9ybWFuY2Uubm93KCkgfSk7XG4gIHJldHVybiBpZDtcbn1cblxuZnVuY3Rpb24ganNFbmRUaW1lcihpZCkge1xuICBjb25zdCB0aW1lciA9IHRpbWVycy5nZXQoaWQpO1xuICBpZiAoIXRpbWVyKSByZXR1cm4gMDtcbiAgXG4gIGNvbnN0IGR1cmF0aW9uID0gcGVyZm9ybWFuY2Uubm93KCkgLSB0aW1lci5zdGFydDtcbiAgdGltZXJzLmRlbGV0ZShpZCk7XG4gIFxuICAvLyBVcGRhdGUgc3RhdHNcbiAgaWYgKHRpbWVyLm5hbWUuaW5jbHVkZXMoJ2RpZmYnKSkge1xuICAgIHN0YXRzLmRpZmZzKys7XG4gICAgc3RhdHMuYXZnRGlmZlRpbWUgPSAoc3RhdHMuYXZnRGlmZlRpbWUgKiAoc3RhdHMuZGlmZnMgLSAxKSArIGR1cmF0aW9uKSAvIHN0YXRzLmRpZmZzO1xuICB9IGVsc2UgaWYgKHRpbWVyLm5hbWUuaW5jbHVkZXMoJ2NvbXBpbGUnKSkge1xuICAgIHN0YXRzLmNvbXBpbGF0aW9ucysrO1xuICAgIHN0YXRzLmF2Z0NvbXBpbGVUaW1lID0gKHN0YXRzLmF2Z0NvbXBpbGVUaW1lICogKHN0YXRzLmNvbXBpbGF0aW9ucyAtIDEpICsgZHVyYXRpb24pIC8gc3RhdHMuY29tcGlsYXRpb25zO1xuICB9XG4gIFxuICByZXR1cm4gZHVyYXRpb247XG59XG5cbmZ1bmN0aW9uIGpzR2V0U3RhdHMoKSB7XG4gIHJldHVybiBKU09OLnN0cmluZ2lmeShzdGF0cyk7XG59IiwgIi8qKlxuICogUHVyZSBFZ2hhY3QgVmlydHVhbCBET00gaW1wbGVtZW50YXRpb25cbiAqIE5vIFJlYWN0LCBubyBkZXBlbmRlbmNpZXMsIGp1c3QgcHVyZSBKUy9XQVNNXG4gKi9cblxuLy8gVmlydHVhbCBET00gbm9kZSB0eXBlc1xuZXhwb3J0IGNvbnN0IE5PREVfVFlQRVMgPSB7XG4gIEVMRU1FTlQ6IDEsXG4gIFRFWFQ6IDIsXG4gIENPTVBPTkVOVDogMyxcbiAgRlJBR01FTlQ6IDRcbn07XG5cbi8vIENyZWF0ZSB2aXJ0dWFsIG5vZGVcbmV4cG9ydCBmdW5jdGlvbiBoKHR5cGUsIHByb3BzLCAuLi5jaGlsZHJlbikge1xuICAvLyBGbGF0dGVuIGNoaWxkcmVuIGFuZCBmaWx0ZXIgbnVsbHNcbiAgY29uc3QgZmxhdENoaWxkcmVuID0gY2hpbGRyZW5cbiAgICAuZmxhdChJbmZpbml0eSlcbiAgICAuZmlsdGVyKGMgPT4gYyAhPSBudWxsKVxuICAgIC5tYXAoY2hpbGQgPT4ge1xuICAgICAgLy8gQ29udmVydCBwcmltaXRpdmVzIHRvIHRleHQgbm9kZXNcbiAgICAgIGlmICh0eXBlb2YgY2hpbGQgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBjaGlsZCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgcmV0dXJuIHRleHQoU3RyaW5nKGNoaWxkKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gY2hpbGQ7XG4gICAgfSk7XG4gIFxuICByZXR1cm4ge1xuICAgIHR5cGUsXG4gICAgcHJvcHM6IHByb3BzIHx8IHt9LFxuICAgIGNoaWxkcmVuOiBmbGF0Q2hpbGRyZW4sXG4gICAga2V5OiBwcm9wcz8ua2V5LFxuICAgIG5vZGVUeXBlOiB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyBOT0RFX1RZUEVTLkVMRU1FTlQgOiBOT0RFX1RZUEVTLkNPTVBPTkVOVFxuICB9O1xufVxuXG4vLyBUZXh0IG5vZGUgaGVscGVyXG5leHBvcnQgZnVuY3Rpb24gdGV4dCh2YWx1ZSkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICcjdGV4dCcsXG4gICAgdmFsdWU6IFN0cmluZyh2YWx1ZSksXG4gICAgbm9kZVR5cGU6IE5PREVfVFlQRVMuVEVYVFxuICB9O1xufVxuXG4vLyBGcmFnbWVudCBoZWxwZXJcbmV4cG9ydCBmdW5jdGlvbiBmcmFnbWVudChwcm9wcywgLi4uY2hpbGRyZW4pIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnI2ZyYWdtZW50JyxcbiAgICBwcm9wczogcHJvcHMgfHwge30sXG4gICAgY2hpbGRyZW46IGNoaWxkcmVuLmZsYXQoSW5maW5pdHkpLmZpbHRlcihjID0+IGMgIT0gbnVsbCksXG4gICAgbm9kZVR5cGU6IE5PREVfVFlQRVMuRlJBR01FTlRcbiAgfTtcbn1cblxuLy8gRGlmZiBhbGdvcml0aG0gLSBwdXJlIEpTIGltcGxlbWVudGF0aW9uXG5leHBvcnQgZnVuY3Rpb24gZGlmZihvbGRWTm9kZSwgbmV3Vk5vZGUpIHtcbiAgY29uc3QgcGF0Y2hlcyA9IFtdO1xuICBcbiAgaWYgKCFvbGRWTm9kZSkge1xuICAgIHBhdGNoZXMucHVzaCh7IHR5cGU6ICdDUkVBVEUnLCBub2RlOiBuZXdWTm9kZSB9KTtcbiAgfSBlbHNlIGlmICghbmV3Vk5vZGUpIHtcbiAgICBwYXRjaGVzLnB1c2goeyB0eXBlOiAnUkVNT1ZFJyB9KTtcbiAgfSBlbHNlIGlmIChvbGRWTm9kZS50eXBlICE9PSBuZXdWTm9kZS50eXBlKSB7XG4gICAgcGF0Y2hlcy5wdXNoKHsgdHlwZTogJ1JFUExBQ0UnLCBub2RlOiBuZXdWTm9kZSB9KTtcbiAgfSBlbHNlIGlmIChvbGRWTm9kZS5ub2RlVHlwZSA9PT0gTk9ERV9UWVBFUy5URVhUKSB7XG4gICAgaWYgKG9sZFZOb2RlLnZhbHVlICE9PSBuZXdWTm9kZS52YWx1ZSkge1xuICAgICAgcGF0Y2hlcy5wdXNoKHsgdHlwZTogJ1RFWFQnLCB2YWx1ZTogbmV3Vk5vZGUudmFsdWUgfSk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIERpZmYgcHJvcHNcbiAgICBjb25zdCBwcm9wUGF0Y2hlcyA9IGRpZmZQcm9wcyhvbGRWTm9kZS5wcm9wcywgbmV3Vk5vZGUucHJvcHMpO1xuICAgIGlmIChwcm9wUGF0Y2hlcy5sZW5ndGggPiAwKSB7XG4gICAgICBwYXRjaGVzLnB1c2goeyB0eXBlOiAnUFJPUFMnLCBwYXRjaGVzOiBwcm9wUGF0Y2hlcyB9KTtcbiAgICB9XG4gICAgXG4gICAgLy8gRGlmZiBjaGlsZHJlblxuICAgIGNvbnN0IGNoaWxkUGF0Y2hlcyA9IGRpZmZDaGlsZHJlbihvbGRWTm9kZS5jaGlsZHJlbiwgbmV3Vk5vZGUuY2hpbGRyZW4pO1xuICAgIGlmIChjaGlsZFBhdGNoZXMubGVuZ3RoID4gMCkge1xuICAgICAgcGF0Y2hlcy5wdXNoKHsgdHlwZTogJ0NISUxEUkVOJywgcGF0Y2hlczogY2hpbGRQYXRjaGVzIH0pO1xuICAgIH1cbiAgfVxuICBcbiAgcmV0dXJuIHBhdGNoZXM7XG59XG5cbmZ1bmN0aW9uIGRpZmZQcm9wcyhvbGRQcm9wcywgbmV3UHJvcHMpIHtcbiAgY29uc3QgcGF0Y2hlcyA9IFtdO1xuICBjb25zdCBhbGxLZXlzID0gbmV3IFNldChbLi4uT2JqZWN0LmtleXMob2xkUHJvcHMpLCAuLi5PYmplY3Qua2V5cyhuZXdQcm9wcyldKTtcbiAgXG4gIGZvciAoY29uc3Qga2V5IG9mIGFsbEtleXMpIHtcbiAgICBpZiAoa2V5ID09PSAna2V5JykgY29udGludWU7XG4gICAgXG4gICAgY29uc3Qgb2xkVmFsID0gb2xkUHJvcHNba2V5XTtcbiAgICBjb25zdCBuZXdWYWwgPSBuZXdQcm9wc1trZXldO1xuICAgIFxuICAgIGlmIChvbGRWYWwgIT09IG5ld1ZhbCkge1xuICAgICAgcGF0Y2hlcy5wdXNoKHsga2V5LCB2YWx1ZTogbmV3VmFsIH0pO1xuICAgIH1cbiAgfVxuICBcbiAgcmV0dXJuIHBhdGNoZXM7XG59XG5cbmZ1bmN0aW9uIGRpZmZDaGlsZHJlbihvbGRDaGlsZHJlbiwgbmV3Q2hpbGRyZW4pIHtcbiAgY29uc3QgcGF0Y2hlcyA9IFtdO1xuICBjb25zdCBtYXhMZW5ndGggPSBNYXRoLm1heChvbGRDaGlsZHJlbi5sZW5ndGgsIG5ld0NoaWxkcmVuLmxlbmd0aCk7XG4gIFxuICBmb3IgKGxldCBpID0gMDsgaSA8IG1heExlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY2hpbGRQYXRjaGVzID0gZGlmZihvbGRDaGlsZHJlbltpXSwgbmV3Q2hpbGRyZW5baV0pO1xuICAgIGlmIChjaGlsZFBhdGNoZXMubGVuZ3RoID4gMCkge1xuICAgICAgcGF0Y2hlcy5wdXNoKHsgaW5kZXg6IGksIHBhdGNoZXM6IGNoaWxkUGF0Y2hlcyB9KTtcbiAgICB9XG4gIH1cbiAgXG4gIHJldHVybiBwYXRjaGVzO1xufSIsICIvKipcbiAqIFB1cmUgRE9NIHJlbmRlcmVyIC0gbm8gUmVhY3QsIG5vIHN5bnRoZXRpYyBldmVudHNcbiAqIERpcmVjdCBET00gbWFuaXB1bGF0aW9uIHdpdGggb3VyIG93biBldmVudCBzeXN0ZW1cbiAqL1xuXG5pbXBvcnQgeyBOT0RFX1RZUEVTIH0gZnJvbSAnLi92ZG9tLmpzJztcblxuLy8gQ3VzdG9tIGV2ZW50IHN5c3RlbVxuY29uc3QgZXZlbnRSZWdpc3RyeSA9IG5ldyBXZWFrTWFwKCk7XG5jb25zdCBkZWxlZ2F0ZWRFdmVudHMgPSBuZXcgU2V0KFsnY2xpY2snLCAnaW5wdXQnLCAnY2hhbmdlJywgJ3N1Ym1pdCcsICdrZXlkb3duJywgJ2tleXVwJ10pO1xuXG4vLyBJbml0aWFsaXplIGV2ZW50IGRlbGVnYXRpb25cbmV4cG9ydCBmdW5jdGlvbiBpbml0RXZlbnREZWxlZ2F0aW9uKHJvb3QpIHtcbiAgZm9yIChjb25zdCBldmVudFR5cGUgb2YgZGVsZWdhdGVkRXZlbnRzKSB7XG4gICAgcm9vdC5hZGRFdmVudExpc3RlbmVyKGV2ZW50VHlwZSwgaGFuZGxlRGVsZWdhdGVkRXZlbnQsIHRydWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGhhbmRsZURlbGVnYXRlZEV2ZW50KGUpIHtcbiAgbGV0IHRhcmdldCA9IGUudGFyZ2V0O1xuICBcbiAgd2hpbGUgKHRhcmdldCAmJiB0YXJnZXQgIT09IGUuY3VycmVudFRhcmdldCkge1xuICAgIGNvbnN0IGhhbmRsZXJzID0gZXZlbnRSZWdpc3RyeS5nZXQodGFyZ2V0KTtcbiAgICBpZiAoaGFuZGxlcnMgJiYgaGFuZGxlcnNbZS50eXBlXSkge1xuICAgICAgaGFuZGxlcnNbZS50eXBlXShlKTtcbiAgICB9XG4gICAgdGFyZ2V0ID0gdGFyZ2V0LnBhcmVudE5vZGU7XG4gIH1cbn1cblxuLy8gQ3JlYXRlIHJlYWwgRE9NIGZyb20gdmlydHVhbCBET01cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVFbGVtZW50KHZub2RlKSB7XG4gIGlmICghdm5vZGUpIHJldHVybiBudWxsO1xuICBcbiAgaWYgKHR5cGVvZiB2bm9kZSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIHZub2RlID09PSAnbnVtYmVyJykge1xuICAgIHJldHVybiBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShTdHJpbmcodm5vZGUpKTtcbiAgfVxuICBcbiAgaWYgKHZub2RlLm5vZGVUeXBlID09PSBOT0RFX1RZUEVTLlRFWFQpIHtcbiAgICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodm5vZGUudmFsdWUpO1xuICB9XG4gIFxuICBpZiAodm5vZGUubm9kZVR5cGUgPT09IE5PREVfVFlQRVMuRlJBR01FTlQpIHtcbiAgICBjb25zdCBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICB2bm9kZS5jaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IHtcbiAgICAgIGNvbnN0IGVsID0gY3JlYXRlRWxlbWVudChjaGlsZCk7XG4gICAgICBpZiAoZWwpIGZyYWdtZW50LmFwcGVuZENoaWxkKGVsKTtcbiAgICB9KTtcbiAgICByZXR1cm4gZnJhZ21lbnQ7XG4gIH1cbiAgXG4gIGlmICh2bm9kZS5ub2RlVHlwZSA9PT0gTk9ERV9UWVBFUy5FTEVNRU5UKSB7XG4gICAgY29uc3QgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHZub2RlLnR5cGUpO1xuICAgIFxuICAgIC8vIEFwcGx5IHByb3BzXG4gICAgdXBkYXRlUHJvcHMoZWwsIHt9LCB2bm9kZS5wcm9wcyk7XG4gICAgXG4gICAgLy8gQ3JlYXRlIGNoaWxkcmVuXG4gICAgdm5vZGUuY2hpbGRyZW4uZm9yRWFjaChjaGlsZCA9PiB7XG4gICAgICBjb25zdCBjaGlsZEVsID0gY3JlYXRlRWxlbWVudChjaGlsZCk7XG4gICAgICBpZiAoY2hpbGRFbCkgZWwuYXBwZW5kQ2hpbGQoY2hpbGRFbCk7XG4gICAgfSk7XG4gICAgXG4gICAgcmV0dXJuIGVsO1xuICB9XG4gIFxuICBpZiAodm5vZGUubm9kZVR5cGUgPT09IE5PREVfVFlQRVMuQ09NUE9ORU5UKSB7XG4gICAgLy8gQ29tcG9uZW50IGluc3RhbnRpYXRpb24gLSBpbXBvcnQgZHluYW1pY2FsbHkgdG8gYXZvaWQgY2lyY3VsYXIgZGVwZW5kZW5jeVxuICAgIC8vIEZvciBub3csIHJldHVybiBhIHBsYWNlaG9sZGVyIHRoYXQgd2lsbCBiZSBoYW5kbGVkIGJ5IHRoZSBjb21wb25lbnQgc3lzdGVtXG4gICAgY29uc3QgcGxhY2Vob2xkZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBwbGFjZWhvbGRlci5zZXRBdHRyaWJ1dGUoJ2RhdGEtY29tcG9uZW50LXBsYWNlaG9sZGVyJywgdm5vZGUudHlwZS5uYW1lIHx8ICdDb21wb25lbnQnKTtcbiAgICByZXR1cm4gcGxhY2Vob2xkZXI7XG4gIH1cbn1cblxuLy8gVXBkYXRlIGVsZW1lbnQgcHJvcGVydGllc1xuZnVuY3Rpb24gdXBkYXRlUHJvcHMoZWwsIG9sZFByb3BzLCBuZXdQcm9wcykge1xuICAvLyBSZW1vdmUgb2xkIHByb3BzXG4gIGZvciAoY29uc3Qga2V5IGluIG9sZFByb3BzKSB7XG4gICAgaWYgKCEoa2V5IGluIG5ld1Byb3BzKSkge1xuICAgICAgcmVtb3ZlUHJvcChlbCwga2V5LCBvbGRQcm9wc1trZXldKTtcbiAgICB9XG4gIH1cbiAgXG4gIC8vIFNldCBuZXcgcHJvcHNcbiAgZm9yIChjb25zdCBrZXkgaW4gbmV3UHJvcHMpIHtcbiAgICBpZiAob2xkUHJvcHNba2V5XSAhPT0gbmV3UHJvcHNba2V5XSkge1xuICAgICAgc2V0UHJvcChlbCwga2V5LCBuZXdQcm9wc1trZXldKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gc2V0UHJvcChlbCwga2V5LCB2YWx1ZSkge1xuICBpZiAoa2V5LnN0YXJ0c1dpdGgoJ0AnKSkge1xuICAgIC8vIEVnaGFjdCBldmVudCBzeW50YXg6IEBjbGlja1xuICAgIGNvbnN0IGV2ZW50VHlwZSA9IGtleS5zbGljZSgxKTtcbiAgICBjb25zdCBoYW5kbGVycyA9IGV2ZW50UmVnaXN0cnkuZ2V0KGVsKSB8fCB7fTtcbiAgICBoYW5kbGVyc1tldmVudFR5cGVdID0gdmFsdWU7XG4gICAgZXZlbnRSZWdpc3RyeS5zZXQoZWwsIGhhbmRsZXJzKTtcbiAgfSBlbHNlIGlmIChrZXkgPT09ICdjbGFzcycpIHtcbiAgICBlbC5jbGFzc05hbWUgPSB2YWx1ZSB8fCAnJztcbiAgfSBlbHNlIGlmIChrZXkgPT09ICdzdHlsZScpIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgT2JqZWN0LmFzc2lnbihlbC5zdHlsZSwgdmFsdWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBlbC5zdHlsZS5jc3NUZXh0ID0gdmFsdWUgfHwgJyc7XG4gICAgfVxuICB9IGVsc2UgaWYgKGtleSBpbiBlbCAmJiAha2V5LnN0YXJ0c1dpdGgoJ2FyaWEtJykgJiYgIWtleS5zdGFydHNXaXRoKCdkYXRhLScpKSB7XG4gICAgLy8gRE9NIHByb3BlcnR5XG4gICAgZWxba2V5XSA9IHZhbHVlO1xuICB9IGVsc2Uge1xuICAgIC8vIEhUTUwgYXR0cmlidXRlXG4gICAgaWYgKHZhbHVlID09PSB0cnVlKSB7XG4gICAgICBlbC5zZXRBdHRyaWJ1dGUoa2V5LCAnJyk7XG4gICAgfSBlbHNlIGlmICh2YWx1ZSA9PT0gZmFsc2UgfHwgdmFsdWUgPT0gbnVsbCkge1xuICAgICAgZWwucmVtb3ZlQXR0cmlidXRlKGtleSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVsLnNldEF0dHJpYnV0ZShrZXksIHZhbHVlKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVtb3ZlUHJvcChlbCwga2V5LCBvbGRWYWx1ZSkge1xuICBpZiAoa2V5LnN0YXJ0c1dpdGgoJ0AnKSkge1xuICAgIGNvbnN0IGV2ZW50VHlwZSA9IGtleS5zbGljZSgxKTtcbiAgICBjb25zdCBoYW5kbGVycyA9IGV2ZW50UmVnaXN0cnkuZ2V0KGVsKTtcbiAgICBpZiAoaGFuZGxlcnMpIHtcbiAgICAgIGRlbGV0ZSBoYW5kbGVyc1tldmVudFR5cGVdO1xuICAgIH1cbiAgfSBlbHNlIGlmIChrZXkgPT09ICdjbGFzcycpIHtcbiAgICBlbC5jbGFzc05hbWUgPSAnJztcbiAgfSBlbHNlIGlmIChrZXkgPT09ICdzdHlsZScpIHtcbiAgICBlbC5zdHlsZS5jc3NUZXh0ID0gJyc7XG4gIH0gZWxzZSBpZiAoa2V5IGluIGVsKSB7XG4gICAgZWxba2V5XSA9ICcnO1xuICB9IGVsc2Uge1xuICAgIGVsLnJlbW92ZUF0dHJpYnV0ZShrZXkpO1xuICB9XG59XG5cbi8vIEFwcGx5IHBhdGNoZXMgdG8gRE9NXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlQYXRjaGVzKGVsLCBwYXRjaGVzKSB7XG4gIGZvciAoY29uc3QgcGF0Y2ggb2YgcGF0Y2hlcykge1xuICAgIGFwcGx5UGF0Y2goZWwsIHBhdGNoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhcHBseVBhdGNoKGVsLCBwYXRjaCkge1xuICBzd2l0Y2ggKHBhdGNoLnR5cGUpIHtcbiAgICBjYXNlICdDUkVBVEUnOlxuICAgICAgY29uc3QgbmV3RWwgPSBjcmVhdGVFbGVtZW50KHBhdGNoLm5vZGUpO1xuICAgICAgZWwuYXBwZW5kQ2hpbGQobmV3RWwpO1xuICAgICAgYnJlYWs7XG4gICAgICBcbiAgICBjYXNlICdSRU1PVkUnOlxuICAgICAgZWwucmVtb3ZlKCk7XG4gICAgICBicmVhaztcbiAgICAgIFxuICAgIGNhc2UgJ1JFUExBQ0UnOlxuICAgICAgY29uc3QgcmVwbGFjZW1lbnQgPSBjcmVhdGVFbGVtZW50KHBhdGNoLm5vZGUpO1xuICAgICAgZWwucmVwbGFjZVdpdGgocmVwbGFjZW1lbnQpO1xuICAgICAgYnJlYWs7XG4gICAgICBcbiAgICBjYXNlICdURVhUJzpcbiAgICAgIGVsLnRleHRDb250ZW50ID0gcGF0Y2gudmFsdWU7XG4gICAgICBicmVhaztcbiAgICAgIFxuICAgIGNhc2UgJ1BST1BTJzpcbiAgICAgIGNvbnN0IG9sZFByb3BzID0ge307XG4gICAgICBjb25zdCBuZXdQcm9wcyA9IHt9O1xuICAgICAgcGF0Y2gucGF0Y2hlcy5mb3JFYWNoKHAgPT4ge1xuICAgICAgICBuZXdQcm9wc1twLmtleV0gPSBwLnZhbHVlO1xuICAgICAgfSk7XG4gICAgICB1cGRhdGVQcm9wcyhlbCwgb2xkUHJvcHMsIG5ld1Byb3BzKTtcbiAgICAgIGJyZWFrO1xuICAgICAgXG4gICAgY2FzZSAnQ0hJTERSRU4nOlxuICAgICAgcGF0Y2gucGF0Y2hlcy5mb3JFYWNoKGNoaWxkUGF0Y2ggPT4ge1xuICAgICAgICBjb25zdCBjaGlsZCA9IGVsLmNoaWxkTm9kZXNbY2hpbGRQYXRjaC5pbmRleF07XG4gICAgICAgIGlmIChjaGlsZCkge1xuICAgICAgICAgIGNoaWxkUGF0Y2gucGF0Y2hlcy5mb3JFYWNoKHAgPT4gYXBwbHlQYXRjaChjaGlsZCwgcCkpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGJyZWFrO1xuICB9XG59IiwgIi8qKlxuICogUHVyZSBFZ2hhY3QgUmVhY3RpdmUgU3lzdGVtXG4gKiBObyBNb2JYLCBubyBleHRlcm5hbCBkZXBzIC0ganVzdCBwdXJlIHJlYWN0aXZlIG1hZ2ljXG4gKi9cblxuLy8gQWN0aXZlIGVmZmVjdCBiZWluZyBleGVjdXRlZFxubGV0IGFjdGl2ZUVmZmVjdCA9IG51bGw7XG5jb25zdCBlZmZlY3RTdGFjayA9IFtdO1xuXG4vLyBEZXBlbmRlbmN5IHRyYWNraW5nXG5jb25zdCB0YXJnZXRNYXAgPSBuZXcgV2Vha01hcCgpO1xuXG4vLyBSZWFjdGl2ZSBvYmplY3QgY3JlYXRpb25cbmV4cG9ydCBmdW5jdGlvbiByZWFjdGl2ZSh0YXJnZXQpIHtcbiAgaWYgKHR5cGVvZiB0YXJnZXQgIT09ICdvYmplY3QnIHx8IHRhcmdldCA9PT0gbnVsbCkge1xuICAgIHJldHVybiB0YXJnZXQ7XG4gIH1cbiAgXG4gIHJldHVybiBuZXcgUHJveHkodGFyZ2V0LCB7XG4gICAgZ2V0KHRhcmdldCwga2V5LCByZWNlaXZlcikge1xuICAgICAgLy8gVHJhY2sgZGVwZW5kZW5jeVxuICAgICAgdHJhY2sodGFyZ2V0LCBrZXkpO1xuICAgICAgXG4gICAgICBjb25zdCB2YWx1ZSA9IFJlZmxlY3QuZ2V0KHRhcmdldCwga2V5LCByZWNlaXZlcik7XG4gICAgICBcbiAgICAgIC8vIERlZXAgcmVhY3Rpdml0eVxuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHJlYWN0aXZlKHZhbHVlKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH0sXG4gICAgXG4gICAgc2V0KHRhcmdldCwga2V5LCB2YWx1ZSwgcmVjZWl2ZXIpIHtcbiAgICAgIGNvbnN0IG9sZFZhbHVlID0gdGFyZ2V0W2tleV07XG4gICAgICBjb25zdCByZXN1bHQgPSBSZWZsZWN0LnNldCh0YXJnZXQsIGtleSwgdmFsdWUsIHJlY2VpdmVyKTtcbiAgICAgIFxuICAgICAgLy8gVHJpZ2dlciBlZmZlY3RzIGlmIHZhbHVlIGNoYW5nZWRcbiAgICAgIGlmIChvbGRWYWx1ZSAhPT0gdmFsdWUpIHtcbiAgICAgICAgdHJpZ2dlcih0YXJnZXQsIGtleSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcbiAgICBcbiAgICBkZWxldGVQcm9wZXJ0eSh0YXJnZXQsIGtleSkge1xuICAgICAgY29uc3QgaGFkS2V5ID0ga2V5IGluIHRhcmdldDtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IFJlZmxlY3QuZGVsZXRlUHJvcGVydHkodGFyZ2V0LCBrZXkpO1xuICAgICAgXG4gICAgICBpZiAoaGFkS2V5KSB7XG4gICAgICAgIHRyaWdnZXIodGFyZ2V0LCBrZXkpO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgfSk7XG59XG5cbi8vIFRyYWNrIGRlcGVuZGVuY2llc1xuZnVuY3Rpb24gdHJhY2sodGFyZ2V0LCBrZXkpIHtcbiAgaWYgKCFhY3RpdmVFZmZlY3QpIHJldHVybjtcbiAgXG4gIGxldCBkZXBzTWFwID0gdGFyZ2V0TWFwLmdldCh0YXJnZXQpO1xuICBpZiAoIWRlcHNNYXApIHtcbiAgICB0YXJnZXRNYXAuc2V0KHRhcmdldCwgKGRlcHNNYXAgPSBuZXcgTWFwKCkpKTtcbiAgfVxuICBcbiAgbGV0IGRlcHMgPSBkZXBzTWFwLmdldChrZXkpO1xuICBpZiAoIWRlcHMpIHtcbiAgICBkZXBzTWFwLnNldChrZXksIChkZXBzID0gbmV3IFNldCgpKSk7XG4gIH1cbiAgXG4gIGRlcHMuYWRkKGFjdGl2ZUVmZmVjdCk7XG4gIGFjdGl2ZUVmZmVjdC5kZXBzLnB1c2goZGVwcyk7XG59XG5cbi8vIFRyaWdnZXIgZWZmZWN0c1xuZnVuY3Rpb24gdHJpZ2dlcih0YXJnZXQsIGtleSkge1xuICBjb25zdCBkZXBzTWFwID0gdGFyZ2V0TWFwLmdldCh0YXJnZXQpO1xuICBpZiAoIWRlcHNNYXApIHJldHVybjtcbiAgXG4gIGNvbnN0IGRlcHMgPSBkZXBzTWFwLmdldChrZXkpO1xuICBpZiAoIWRlcHMpIHJldHVybjtcbiAgXG4gIC8vIENyZWF0ZSBhIGNvcHkgdG8gYXZvaWQgaW5maW5pdGUgbG9vcHNcbiAgY29uc3QgZWZmZWN0c1RvUnVuID0gbmV3IFNldChkZXBzKTtcbiAgXG4gIGVmZmVjdHNUb1J1bi5mb3JFYWNoKGVmZmVjdCA9PiB7XG4gICAgLy8gRG9uJ3QgdHJpZ2dlciB0aGUgY3VycmVudGx5IHJ1bm5pbmcgZWZmZWN0XG4gICAgaWYgKGVmZmVjdCAhPT0gYWN0aXZlRWZmZWN0KSB7XG4gICAgICBlZmZlY3Quc2NoZWR1bGVyID8gZWZmZWN0LnNjaGVkdWxlcigpIDogZWZmZWN0LnJ1bigpO1xuICAgIH1cbiAgfSk7XG59XG5cbi8vIENyZWF0ZSByZWFjdGl2ZSBlZmZlY3RcbmV4cG9ydCBmdW5jdGlvbiBlZmZlY3QoZm4sIG9wdGlvbnMgPSB7fSkge1xuICBjb25zdCBlZmZlY3RGbiA9ICgpID0+IHtcbiAgICBjbGVhbnVwKGVmZmVjdEZuKTtcbiAgICBcbiAgICBhY3RpdmVFZmZlY3QgPSBlZmZlY3RGbjtcbiAgICBlZmZlY3RTdGFjay5wdXNoKGVmZmVjdEZuKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGZuKCk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIGVmZmVjdFN0YWNrLnBvcCgpO1xuICAgICAgYWN0aXZlRWZmZWN0ID0gZWZmZWN0U3RhY2tbZWZmZWN0U3RhY2subGVuZ3RoIC0gMV07XG4gICAgfVxuICB9O1xuICBcbiAgZWZmZWN0Rm4uZGVwcyA9IFtdO1xuICBlZmZlY3RGbi5zY2hlZHVsZXIgPSBvcHRpb25zLnNjaGVkdWxlcjtcbiAgZWZmZWN0Rm4ucnVuID0gKCkgPT4gZWZmZWN0Rm4oKTtcbiAgXG4gIGlmICghb3B0aW9ucy5sYXp5KSB7XG4gICAgZWZmZWN0Rm4oKTtcbiAgfVxuICBcbiAgcmV0dXJuIGVmZmVjdEZuO1xufVxuXG4vLyBDbGVhbnVwIGVmZmVjdCBkZXBlbmRlbmNpZXNcbmZ1bmN0aW9uIGNsZWFudXAoZWZmZWN0Rm4pIHtcbiAgY29uc3QgeyBkZXBzIH0gPSBlZmZlY3RGbjtcbiAgXG4gIGlmIChkZXBzLmxlbmd0aCkge1xuICAgIGZvciAoY29uc3QgZGVwIG9mIGRlcHMpIHtcbiAgICAgIGRlcC5kZWxldGUoZWZmZWN0Rm4pO1xuICAgIH1cbiAgICBkZXBzLmxlbmd0aCA9IDA7XG4gIH1cbn1cblxuLy8gQ29tcHV0ZWQgdmFsdWVzXG5leHBvcnQgZnVuY3Rpb24gY29tcHV0ZWQoZ2V0dGVyKSB7XG4gIGxldCB2YWx1ZTtcbiAgbGV0IGRpcnR5ID0gdHJ1ZTtcbiAgXG4gIGNvbnN0IGVmZmVjdEZuID0gZWZmZWN0KGdldHRlciwge1xuICAgIGxhenk6IHRydWUsXG4gICAgc2NoZWR1bGVyKCkge1xuICAgICAgZGlydHkgPSB0cnVlO1xuICAgICAgdHJpZ2dlcihvYmosICd2YWx1ZScpO1xuICAgIH1cbiAgfSk7XG4gIFxuICBjb25zdCBvYmogPSB7XG4gICAgZ2V0IHZhbHVlKCkge1xuICAgICAgaWYgKGRpcnR5KSB7XG4gICAgICAgIHZhbHVlID0gZWZmZWN0Rm4oKTtcbiAgICAgICAgZGlydHkgPSBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHRyYWNrKG9iaiwgJ3ZhbHVlJyk7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICB9O1xuICBcbiAgcmV0dXJuIG9iajtcbn1cblxuLy8gV2F0Y2ggQVBJXG5leHBvcnQgZnVuY3Rpb24gd2F0Y2goc291cmNlLCBjYWxsYmFjaywgb3B0aW9ucyA9IHt9KSB7XG4gIGxldCBnZXR0ZXI7XG4gIGxldCBvbGRWYWx1ZTtcbiAgXG4gIGlmICh0eXBlb2Ygc291cmNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgZ2V0dGVyID0gc291cmNlO1xuICB9IGVsc2Uge1xuICAgIGdldHRlciA9ICgpID0+IHNvdXJjZTtcbiAgfVxuICBcbiAgY29uc3Qgam9iID0gKCkgPT4ge1xuICAgIGNvbnN0IG5ld1ZhbHVlID0gZWZmZWN0Rm4oKTtcbiAgICBpZiAob2xkVmFsdWUgIT09IG5ld1ZhbHVlKSB7XG4gICAgICBjYWxsYmFjayhuZXdWYWx1ZSwgb2xkVmFsdWUpO1xuICAgICAgb2xkVmFsdWUgPSBuZXdWYWx1ZTtcbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBlZmZlY3RGbiA9IGVmZmVjdChnZXR0ZXIsIHtcbiAgICBsYXp5OiB0cnVlLFxuICAgIHNjaGVkdWxlcjogam9iXG4gIH0pO1xuICBcbiAgaWYgKG9wdGlvbnMuaW1tZWRpYXRlKSB7XG4gICAgam9iKCk7XG4gIH0gZWxzZSB7XG4gICAgb2xkVmFsdWUgPSBlZmZlY3RGbigpO1xuICB9XG59XG5cbi8vIENyZWF0ZSByZWFjdGl2ZSByZWZcbmV4cG9ydCBmdW5jdGlvbiByZWYodmFsdWUpIHtcbiAgY29uc3Qgd3JhcHBlciA9IHtcbiAgICB2YWx1ZVxuICB9O1xuICBcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHdyYXBwZXIsICdfX3ZfaXNSZWYnLCB7XG4gICAgdmFsdWU6IHRydWVcbiAgfSk7XG4gIFxuICByZXR1cm4gcmVhY3RpdmUod3JhcHBlcik7XG59XG5cbi8vIFN0b3JlIGltcGxlbWVudGF0aW9uXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU3RvcmUoaW5pdGlhbFN0YXRlKSB7XG4gIGNvbnN0IHN0YXRlID0gcmVhY3RpdmUoaW5pdGlhbFN0YXRlKTtcbiAgY29uc3Qgc3Vic2NyaWJlcnMgPSBuZXcgU2V0KCk7XG4gIFxuICByZXR1cm4ge1xuICAgIHN0YXRlLFxuICAgIFxuICAgIHN1YnNjcmliZShmbikge1xuICAgICAgc3Vic2NyaWJlcnMuYWRkKGZuKTtcbiAgICAgIHJldHVybiAoKSA9PiBzdWJzY3JpYmVycy5kZWxldGUoZm4pO1xuICAgIH0sXG4gICAgXG4gICAgZGlzcGF0Y2goYWN0aW9uKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhY3Rpb24oc3RhdGUpO1xuICAgICAgc3Vic2NyaWJlcnMuZm9yRWFjaChmbiA9PiBmbigpKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICB9O1xufSIsICIvKipcbiAqIFB1cmUgRWdoYWN0IENvbXBvbmVudCBTeXN0ZW1cbiAqIE5vIFJlYWN0IGNvbXBvbmVudHMgLSBvdXIgb3duIGNvbXBvbmVudCBtb2RlbFxuICovXG5cbmltcG9ydCB7IHJlYWN0aXZlLCBlZmZlY3QgfSBmcm9tICcuL3JlYWN0aXZlLmpzJztcbmltcG9ydCB7IGgsIGRpZmYgfSBmcm9tICcuL3Zkb20uanMnO1xuaW1wb3J0IHsgY3JlYXRlRWxlbWVudCwgYXBwbHlQYXRjaGVzIH0gZnJvbSAnLi9yZW5kZXJlci5qcyc7XG5cbi8vIENvbXBvbmVudCByZWdpc3RyeVxuY29uc3QgY29tcG9uZW50UmVnaXN0cnkgPSBuZXcgTWFwKCk7XG5cbi8vIENvbXBvbmVudCBpbnN0YW5jZSB0cmFja2luZ1xuY29uc3QgY29tcG9uZW50SW5zdGFuY2VzID0gbmV3IFdlYWtNYXAoKTtcblxuLy8gQ29tcG9uZW50IGNsYXNzXG5leHBvcnQgY2xhc3MgQ29tcG9uZW50IHtcbiAgY29uc3RydWN0b3IocHJvcHMgPSB7fSkge1xuICAgIHRoaXMucHJvcHMgPSBwcm9wcztcbiAgICB0aGlzLnN0YXRlID0gcmVhY3RpdmUoe30pO1xuICAgIHRoaXMucmVmcyA9IHt9O1xuICAgIHRoaXMuX3Zub2RlID0gbnVsbDtcbiAgICB0aGlzLl9lbGVtZW50ID0gbnVsbDtcbiAgICB0aGlzLl9tb3VudGVkID0gZmFsc2U7XG4gICAgdGhpcy5fZWZmZWN0cyA9IFtdO1xuICAgIHRoaXMuX2NsZWFudXBzID0gW107XG4gIH1cbiAgXG4gIC8vIExpZmVjeWNsZSBob29rc1xuICBvbk1vdW50KCkge31cbiAgb25EZXN0cm95KCkge31cbiAgb25VcGRhdGUoKSB7fVxuICBcbiAgLy8gU3RhdGUgbWFuYWdlbWVudFxuICBzZXRTdGF0ZSh1cGRhdGVzKSB7XG4gICAgT2JqZWN0LmFzc2lnbih0aGlzLnN0YXRlLCB1cGRhdGVzKTtcbiAgfVxuICBcbiAgLy8gUmVuZGVyIG1ldGhvZCAodG8gYmUgb3ZlcnJpZGRlbilcbiAgcmVuZGVyKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignQ29tcG9uZW50IG11c3QgaW1wbGVtZW50IHJlbmRlcigpJyk7XG4gIH1cbiAgXG4gIC8vIEludGVybmFsIG1vdW50XG4gIF9tb3VudChjb250YWluZXIpIHtcbiAgICAvLyBSdW4gb25Nb3VudCBsaWZlY3ljbGVcbiAgICB0aGlzLm9uTW91bnQoKTtcbiAgICB0aGlzLl9tb3VudGVkID0gdHJ1ZTtcbiAgICBcbiAgICAvLyBDcmVhdGUgcmVuZGVyIGVmZmVjdFxuICAgIGNvbnN0IHJlbmRlckVmZmVjdCA9IGVmZmVjdCgoKSA9PiB7XG4gICAgICBjb25zdCBuZXdWTm9kZSA9IHRoaXMucmVuZGVyKCk7XG4gICAgICBcbiAgICAgIGlmICghdGhpcy5fdm5vZGUpIHtcbiAgICAgICAgLy8gSW5pdGlhbCByZW5kZXJcbiAgICAgICAgdGhpcy5fdm5vZGUgPSBuZXdWTm9kZTtcbiAgICAgICAgdGhpcy5fZWxlbWVudCA9IGNyZWF0ZUVsZW1lbnQobmV3Vk5vZGUpO1xuICAgICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5fZWxlbWVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBVcGRhdGVcbiAgICAgICAgY29uc3QgcGF0Y2hlcyA9IGRpZmYodGhpcy5fdm5vZGUsIG5ld1ZOb2RlKTtcbiAgICAgICAgYXBwbHlQYXRjaGVzKHRoaXMuX2VsZW1lbnQsIHBhdGNoZXMpO1xuICAgICAgICB0aGlzLl92bm9kZSA9IG5ld1ZOb2RlO1xuICAgICAgICB0aGlzLm9uVXBkYXRlKCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgXG4gICAgdGhpcy5fZWZmZWN0cy5wdXNoKHJlbmRlckVmZmVjdCk7XG4gIH1cbiAgXG4gIC8vIEludGVybmFsIHVubW91bnRcbiAgX3VubW91bnQoKSB7XG4gICAgLy8gQ2xlYW51cCBlZmZlY3RzXG4gICAgdGhpcy5fZWZmZWN0cy5mb3JFYWNoKGVmZiA9PiBlZmYuc3RvcD8uKCkpO1xuICAgIHRoaXMuX2VmZmVjdHMgPSBbXTtcbiAgICBcbiAgICAvLyBSdW4gY2xlYW51cCBmdW5jdGlvbnNcbiAgICB0aGlzLl9jbGVhbnVwcy5mb3JFYWNoKGZuID0+IGZuKCkpO1xuICAgIHRoaXMuX2NsZWFudXBzID0gW107XG4gICAgXG4gICAgLy8gUnVuIG9uRGVzdHJveSBsaWZlY3ljbGVcbiAgICB0aGlzLm9uRGVzdHJveSgpO1xuICAgIFxuICAgIC8vIFJlbW92ZSBmcm9tIERPTVxuICAgIGlmICh0aGlzLl9lbGVtZW50KSB7XG4gICAgICB0aGlzLl9lbGVtZW50LnJlbW92ZSgpO1xuICAgIH1cbiAgICBcbiAgICB0aGlzLl9tb3VudGVkID0gZmFsc2U7XG4gIH1cbn1cblxuLy8gRnVuY3Rpb24gY29tcG9uZW50IHdyYXBwZXJcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVGdW5jdGlvbkNvbXBvbmVudChyZW5kZXJGbikge1xuICByZXR1cm4gY2xhc3MgRnVuY3Rpb25Db21wb25lbnRXcmFwcGVyIGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICBjb25zdHJ1Y3Rvcihwcm9wcykge1xuICAgICAgc3VwZXIocHJvcHMpO1xuICAgICAgdGhpcy5faG9va3MgPSBbXTtcbiAgICAgIHRoaXMuX2hvb2tJbmRleCA9IDA7XG4gICAgfVxuICAgIFxuICAgIHJlbmRlcigpIHtcbiAgICAgIC8vIFNldCBjdXJyZW50IGNvbXBvbmVudCBmb3IgaG9va3NcbiAgICAgIGN1cnJlbnRDb21wb25lbnQgPSB0aGlzO1xuICAgICAgY3VycmVudEhvb2tJbmRleCA9IDA7XG4gICAgICBcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiByZW5kZXJGbih0aGlzLnByb3BzKTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIGN1cnJlbnRDb21wb25lbnQgPSBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBfZm9yY2VVcGRhdGUoKSB7XG4gICAgICAvLyBSZS1yZW5kZXIgdGhlIGNvbXBvbmVudFxuICAgICAgaWYgKHRoaXMuX21vdW50ZWQgJiYgdGhpcy5fZWxlbWVudCkge1xuICAgICAgICBjb25zdCBuZXdWTm9kZSA9IHRoaXMucmVuZGVyKCk7XG4gICAgICAgIGNvbnN0IHBhdGNoZXMgPSBkaWZmKHRoaXMuX3Zub2RlLCBuZXdWTm9kZSk7XG4gICAgICAgIGFwcGx5UGF0Y2hlcyh0aGlzLl9lbGVtZW50LCBwYXRjaGVzKTtcbiAgICAgICAgdGhpcy5fdm5vZGUgPSBuZXdWTm9kZTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG59XG5cbi8vIFJlZ2lzdGVyIGNvbXBvbmVudFxuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyQ29tcG9uZW50KG5hbWUsIGNvbXBvbmVudCkge1xuICBjb21wb25lbnRSZWdpc3RyeS5zZXQobmFtZSwgY29tcG9uZW50KTtcbn1cblxuLy8gQ3JlYXRlIGNvbXBvbmVudCBpbnN0YW5jZVxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXBvbmVudCh2bm9kZSkge1xuICBjb25zdCBDb21wb25lbnRDbGFzcyA9IHZub2RlLnR5cGU7XG4gIFxuICBpZiAodHlwZW9mIENvbXBvbmVudENsYXNzID09PSAnZnVuY3Rpb24nICYmICFDb21wb25lbnRDbGFzcy5wcm90b3R5cGU/LnJlbmRlcikge1xuICAgIC8vIEZ1bmN0aW9uIGNvbXBvbmVudCAtIGNyZWF0ZSBhIHdyYXBwZXIgY2xhc3NcbiAgICBjb25zdCBGdW5jdGlvbkNvbXBvbmVudFdyYXBwZXIgPSBjcmVhdGVGdW5jdGlvbkNvbXBvbmVudChDb21wb25lbnRDbGFzcyk7XG4gICAgY29uc3QgaW5zdGFuY2UgPSBuZXcgRnVuY3Rpb25Db21wb25lbnRXcmFwcGVyKHZub2RlLnByb3BzKTtcbiAgICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBjb250YWluZXIuc2V0QXR0cmlidXRlKCdkYXRhLWVnaGFjdC1jb21wb25lbnQnLCBDb21wb25lbnRDbGFzcy5uYW1lIHx8ICdGdW5jdGlvbkNvbXBvbmVudCcpO1xuICAgIFxuICAgIGluc3RhbmNlLl9tb3VudChjb250YWluZXIpO1xuICAgIGNvbXBvbmVudEluc3RhbmNlcy5zZXQoY29udGFpbmVyLCBpbnN0YW5jZSk7XG4gICAgXG4gICAgcmV0dXJuIGNvbnRhaW5lcjtcbiAgfVxuICBcbiAgY29uc3QgaW5zdGFuY2UgPSBuZXcgQ29tcG9uZW50Q2xhc3Modm5vZGUucHJvcHMpO1xuICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgY29udGFpbmVyLnNldEF0dHJpYnV0ZSgnZGF0YS1lZ2hhY3QtY29tcG9uZW50JywgQ29tcG9uZW50Q2xhc3MubmFtZSk7XG4gIFxuICBpbnN0YW5jZS5fbW91bnQoY29udGFpbmVyKTtcbiAgY29tcG9uZW50SW5zdGFuY2VzLnNldChjb250YWluZXIsIGluc3RhbmNlKTtcbiAgXG4gIHJldHVybiBjb250YWluZXI7XG59XG5cbi8vIEhvb2tzIGZvciBmdW5jdGlvbiBjb21wb25lbnRzXG5sZXQgY3VycmVudENvbXBvbmVudCA9IG51bGw7XG5sZXQgY3VycmVudEhvb2tJbmRleCA9IDA7XG5cbmV4cG9ydCBmdW5jdGlvbiB1c2VTdGF0ZShpbml0aWFsVmFsdWUpIHtcbiAgY29uc3QgY29tcG9uZW50ID0gY3VycmVudENvbXBvbmVudDtcbiAgY29uc3QgaG9va0luZGV4ID0gY3VycmVudEhvb2tJbmRleCsrO1xuICBcbiAgaWYgKCFjb21wb25lbnQuX2hvb2tzKSB7XG4gICAgY29tcG9uZW50Ll9ob29rcyA9IFtdO1xuICB9XG4gIFxuICBpZiAoY29tcG9uZW50Ll9ob29rc1tob29rSW5kZXhdID09PSB1bmRlZmluZWQpIHtcbiAgICBjb21wb25lbnQuX2hvb2tzW2hvb2tJbmRleF0gPSByZWFjdGl2ZSh7IHZhbHVlOiBpbml0aWFsVmFsdWUgfSk7XG4gIH1cbiAgXG4gIGNvbnN0IHN0YXRlID0gY29tcG9uZW50Ll9ob29rc1tob29rSW5kZXhdO1xuICBcbiAgcmV0dXJuIFtcbiAgICBzdGF0ZS52YWx1ZSxcbiAgICAobmV3VmFsdWUpID0+IHtcbiAgICAgIHN0YXRlLnZhbHVlID0gbmV3VmFsdWU7XG4gICAgfVxuICBdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdXNlRWZmZWN0KGZuLCBkZXBzKSB7XG4gIGNvbnN0IGNvbXBvbmVudCA9IGN1cnJlbnRDb21wb25lbnQ7XG4gIGNvbnN0IGhvb2tJbmRleCA9IGN1cnJlbnRIb29rSW5kZXgrKztcbiAgXG4gIGlmICghY29tcG9uZW50Ll9ob29rcykge1xuICAgIGNvbXBvbmVudC5faG9va3MgPSBbXTtcbiAgfVxuICBcbiAgY29uc3QgcHJldkRlcHMgPSBjb21wb25lbnQuX2hvb2tzW2hvb2tJbmRleF07XG4gIFxuICBpZiAoIXByZXZEZXBzIHx8ICFkZXBzIHx8IGRlcHMuc29tZSgoZGVwLCBpKSA9PiBkZXAgIT09IHByZXZEZXBzW2ldKSkge1xuICAgIC8vIERlcGVuZGVuY2llcyBjaGFuZ2VkLCBydW4gZWZmZWN0XG4gICAgY29tcG9uZW50Ll9ob29rc1tob29rSW5kZXhdID0gZGVwcztcbiAgICBcbiAgICBjb25zdCBjbGVhbnVwID0gZm4oKTtcbiAgICBpZiAodHlwZW9mIGNsZWFudXAgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNvbXBvbmVudC5fY2xlYW51cHMucHVzaChjbGVhbnVwKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gQ29udGV4dCBBUElcbmNvbnN0IGNvbnRleHRzID0gbmV3IE1hcCgpO1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29udGV4dChkZWZhdWx0VmFsdWUpIHtcbiAgY29uc3QgaWQgPSBTeW1ib2woJ2NvbnRleHQnKTtcbiAgY29udGV4dHMuc2V0KGlkLCB7IHZhbHVlOiBkZWZhdWx0VmFsdWUsIHN1YnNjcmliZXJzOiBuZXcgU2V0KCkgfSk7XG4gIHJldHVybiBpZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVzZUNvbnRleHQoY29udGV4dElkKSB7XG4gIGNvbnN0IGNvbnRleHQgPSBjb250ZXh0cy5nZXQoY29udGV4dElkKTtcbiAgaWYgKCFjb250ZXh0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDb250ZXh0IG5vdCBmb3VuZCcpO1xuICB9XG4gIFxuICBjb25zdCBjb21wb25lbnQgPSBjdXJyZW50Q29tcG9uZW50O1xuICBjb250ZXh0LnN1YnNjcmliZXJzLmFkZChjb21wb25lbnQpO1xuICBcbiAgcmV0dXJuIGNvbnRleHQudmFsdWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm92aWRlKGNvbnRleHRJZCwgdmFsdWUpIHtcbiAgY29uc3QgY29udGV4dCA9IGNvbnRleHRzLmdldChjb250ZXh0SWQpO1xuICBpZiAoIWNvbnRleHQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvbnRleHQgbm90IGZvdW5kJyk7XG4gIH1cbiAgXG4gIGNvbnRleHQudmFsdWUgPSB2YWx1ZTtcbiAgY29udGV4dC5zdWJzY3JpYmVycy5mb3JFYWNoKGNvbXBvbmVudCA9PiBjb21wb25lbnQuX2ZvcmNlVXBkYXRlKCkpO1xufSIsICIvKipcbiAqIFdlYkFzc2VtYmx5IEJyaWRnZSBmb3IgUGVyZm9ybWFuY2UtQ3JpdGljYWwgT3BlcmF0aW9uc1xuICogUHVyZSBXQVNNIGludGVncmF0aW9uIC0gbm8gZW1zY3JpcHRlbiwgbm8gYmxvYXRcbiAqL1xuXG5sZXQgd2FzbU1vZHVsZSA9IG51bGw7XG5sZXQgd2FzbUluc3RhbmNlID0gbnVsbDtcbmxldCBtZW1vcnkgPSBudWxsO1xuXG4vLyBUZXh0IGVuY29kZXIvZGVjb2RlciBmb3Igc3RyaW5nIG9wZXJhdGlvbnNcbmNvbnN0IGVuY29kZXIgPSBuZXcgVGV4dEVuY29kZXIoKTtcbmNvbnN0IGRlY29kZXIgPSBuZXcgVGV4dERlY29kZXIoKTtcblxuLy8gSW5pdGlhbGl6ZSBXQVNNIG1vZHVsZSB3aXRoIGZhbGxiYWNrIHRvIEphdmFTY3JpcHRcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBpbml0V0FTTSgpIHtcbiAgdHJ5IHtcbiAgICAvLyBUcnkgdG8gbG9hZCBXQVNNIG1vZHVsZVxuICAgIGNvbnN0IHdhc21QYXRoID0gbmV3IFVSTCgnLi4vd2FzbS9lZ2hhY3RfcnVudGltZS53YXNtJywgaW1wb3J0Lm1ldGEudXJsKTtcbiAgICBjb25zdCB3YXNtQnVmZmVyID0gYXdhaXQgZmV0Y2god2FzbVBhdGgpLnRoZW4ociA9PiB7XG4gICAgICBpZiAoIXIub2spIHRocm93IG5ldyBFcnJvcignV0FTTSBub3QgZm91bmQnKTtcbiAgICAgIHJldHVybiByLmFycmF5QnVmZmVyKCk7XG4gICAgfSk7XG4gICAgXG4gICAgLy8gTWVtb3J5IGNvbmZpZ3VyYXRpb25cbiAgICBtZW1vcnkgPSBuZXcgV2ViQXNzZW1ibHkuTWVtb3J5KHtcbiAgICAgIGluaXRpYWw6IDI1NiwgIC8vIDE2TUIgaW5pdGlhbFxuICAgICAgbWF4aW11bTogNDA5NiAgLy8gMjU2TUIgbWF4XG4gICAgfSk7XG4gICAgXG4gICAgLy8gSW1wb3J0IG9iamVjdCBmb3IgV0FTTVxuICAgIGNvbnN0IGltcG9ydHMgPSB7XG4gICAgICBlbnY6IHtcbiAgICAgICAgbWVtb3J5LFxuICAgICAgICBcbiAgICAgICAgLy8gQ29uc29sZSBmdW5jdGlvbnNcbiAgICAgICAgY29uc29sZV9sb2c6IChwdHIsIGxlbikgPT4ge1xuICAgICAgICAgIGNvbnN0IG1zZyA9IHJlYWRTdHJpbmcocHRyLCBsZW4pO1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbV0FTTV06JywgbXNnKTtcbiAgICAgICAgfSxcbiAgICAgICAgXG4gICAgICAgIC8vIERPTSBtYW5pcHVsYXRpb24gY2FsbGJhY2tzXG4gICAgICAgIGNyZWF0ZV9lbGVtZW50OiAodGFnUHRyLCB0YWdMZW4pID0+IHtcbiAgICAgICAgICBjb25zdCB0YWcgPSByZWFkU3RyaW5nKHRhZ1B0ciwgdGFnTGVuKTtcbiAgICAgICAgICBjb25zdCBpZCA9IGRvbUVsZW1lbnRzLmxlbmd0aDtcbiAgICAgICAgICBkb21FbGVtZW50cy5wdXNoKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnKSk7XG4gICAgICAgICAgcmV0dXJuIGlkO1xuICAgICAgICB9LFxuICAgICAgICBcbiAgICAgICAgc2V0X2F0dHJpYnV0ZTogKGVsZW1JZCwgbmFtZVB0ciwgbmFtZUxlbiwgdmFsdWVQdHIsIHZhbHVlTGVuKSA9PiB7XG4gICAgICAgICAgY29uc3QgZWxlbSA9IGRvbUVsZW1lbnRzW2VsZW1JZF07XG4gICAgICAgICAgY29uc3QgbmFtZSA9IHJlYWRTdHJpbmcobmFtZVB0ciwgbmFtZUxlbik7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSByZWFkU3RyaW5nKHZhbHVlUHRyLCB2YWx1ZUxlbik7XG4gICAgICAgICAgZWxlbS5zZXRBdHRyaWJ1dGUobmFtZSwgdmFsdWUpO1xuICAgICAgICB9LFxuICAgICAgICBcbiAgICAgICAgYXBwZW5kX2NoaWxkOiAocGFyZW50SWQsIGNoaWxkSWQpID0+IHtcbiAgICAgICAgICBkb21FbGVtZW50c1twYXJlbnRJZF0uYXBwZW5kQ2hpbGQoZG9tRWxlbWVudHNbY2hpbGRJZF0pO1xuICAgICAgICB9LFxuICAgICAgICBcbiAgICAgICAgLy8gUGVyZm9ybWFuY2UgdGltaW5nXG4gICAgICAgIHBlcmZvcm1hbmNlX25vdzogKCkgPT4gcGVyZm9ybWFuY2Uubm93KClcbiAgICAgIH1cbiAgICB9O1xuICAgIFxuICAgIHdhc21Nb2R1bGUgPSBhd2FpdCBXZWJBc3NlbWJseS5jb21waWxlKHdhc21CdWZmZXIpO1xuICAgIHdhc21JbnN0YW5jZSA9IGF3YWl0IFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlKHdhc21Nb2R1bGUsIGltcG9ydHMpO1xuICAgIFxuICAgIC8vIEluaXRpYWxpemUgV0FTTSBydW50aW1lXG4gICAgd2FzbUluc3RhbmNlLmV4cG9ydHMuaW5pdCgpO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKCdXQVNNIHJ1bnRpbWUgaW5pdGlhbGl6ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgcmV0dXJuIHdhc21JbnN0YW5jZS5leHBvcnRzO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUud2FybignV0FTTSBub3QgYXZhaWxhYmxlLCB1c2luZyBKYXZhU2NyaXB0IGZhbGxiYWNrOicsIGVycm9yLm1lc3NhZ2UpO1xuICAgIFxuICAgIC8vIFVzZSBKYXZhU2NyaXB0IGZhbGxiYWNrXG4gICAgY29uc3QgeyB3YXNtRXhwb3J0cyB9ID0gYXdhaXQgaW1wb3J0KCcuL3dhc20tc3R1Yi5qcycpO1xuICAgIHdhc21JbnN0YW5jZSA9IHsgZXhwb3J0czogd2FzbUV4cG9ydHMgfTtcbiAgICB3YXNtRXhwb3J0cy5pbml0KCk7XG4gICAgXG4gICAgcmV0dXJuIHdhc21FeHBvcnRzO1xuICB9XG59XG5cbi8vIERPTSBlbGVtZW50IHJlZ2lzdHJ5IGZvciBXQVNNXG5jb25zdCBkb21FbGVtZW50cyA9IFtdO1xuXG4vLyBNZW1vcnkgaGVscGVyc1xuZnVuY3Rpb24gcmVhZFN0cmluZyhwdHIsIGxlbikge1xuICBjb25zdCBieXRlcyA9IG5ldyBVaW50OEFycmF5KG1lbW9yeS5idWZmZXIsIHB0ciwgbGVuKTtcbiAgcmV0dXJuIGRlY29kZXIuZGVjb2RlKGJ5dGVzKTtcbn1cblxuZnVuY3Rpb24gd3JpdGVTdHJpbmcoc3RyKSB7XG4gIGNvbnN0IGJ5dGVzID0gZW5jb2Rlci5lbmNvZGUoc3RyKTtcbiAgY29uc3QgcHRyID0gd2FzbUluc3RhbmNlLmV4cG9ydHMuYWxsb2MoYnl0ZXMubGVuZ3RoKTtcbiAgY29uc3QgbWVtID0gbmV3IFVpbnQ4QXJyYXkobWVtb3J5LmJ1ZmZlciwgcHRyLCBieXRlcy5sZW5ndGgpO1xuICBtZW0uc2V0KGJ5dGVzKTtcbiAgcmV0dXJuIHsgcHRyLCBsZW46IGJ5dGVzLmxlbmd0aCB9O1xufVxuXG4vLyBGYXN0IHZpcnR1YWwgRE9NIGRpZmZpbmcgaW4gV0FTTVxuZXhwb3J0IGZ1bmN0aW9uIHdhc21EaWZmKG9sZFZOb2RlLCBuZXdWTm9kZSkge1xuICBpZiAoIXdhc21JbnN0YW5jZSkge1xuICAgIHRocm93IG5ldyBFcnJvcignV0FTTSBub3QgaW5pdGlhbGl6ZWQnKTtcbiAgfVxuICBcbiAgLy8gU2VyaWFsaXplIHZub2RlcyB0byBXQVNNIG1lbW9yeVxuICBjb25zdCBvbGRTZXJpYWxpemVkID0gc2VyaWFsaXplVk5vZGUob2xkVk5vZGUpO1xuICBjb25zdCBuZXdTZXJpYWxpemVkID0gc2VyaWFsaXplVk5vZGUobmV3Vk5vZGUpO1xuICBcbiAgLy8gQ2FsbCBXQVNNIGRpZmYgZnVuY3Rpb25cbiAgY29uc3QgcGF0Y2hlc1B0ciA9IHdhc21JbnN0YW5jZS5leHBvcnRzLmRpZmZfdm5vZGVzKFxuICAgIG9sZFNlcmlhbGl6ZWQucHRyLCBvbGRTZXJpYWxpemVkLmxlbixcbiAgICBuZXdTZXJpYWxpemVkLnB0ciwgbmV3U2VyaWFsaXplZC5sZW5cbiAgKTtcbiAgXG4gIC8vIFJlYWQgcGF0Y2hlcyBmcm9tIFdBU00gbWVtb3J5XG4gIGNvbnN0IHBhdGNoZXMgPSBkZXNlcmlhbGl6ZVBhdGNoZXMocGF0Y2hlc1B0cik7XG4gIFxuICAvLyBGcmVlIFdBU00gbWVtb3J5XG4gIHdhc21JbnN0YW5jZS5leHBvcnRzLmZyZWUob2xkU2VyaWFsaXplZC5wdHIpO1xuICB3YXNtSW5zdGFuY2UuZXhwb3J0cy5mcmVlKG5ld1NlcmlhbGl6ZWQucHRyKTtcbiAgd2FzbUluc3RhbmNlLmV4cG9ydHMuZnJlZShwYXRjaGVzUHRyKTtcbiAgXG4gIHJldHVybiBwYXRjaGVzO1xufVxuXG4vLyBTZXJpYWxpemUgdm5vZGUgZm9yIFdBU01cbmZ1bmN0aW9uIHNlcmlhbGl6ZVZOb2RlKHZub2RlKSB7XG4gIGNvbnN0IGpzb24gPSBKU09OLnN0cmluZ2lmeSh2bm9kZSk7XG4gIHJldHVybiB3cml0ZVN0cmluZyhqc29uKTtcbn1cblxuLy8gRGVzZXJpYWxpemUgcGF0Y2hlcyBmcm9tIFdBU01cbmZ1bmN0aW9uIGRlc2VyaWFsaXplUGF0Y2hlcyhwdHIpIHtcbiAgY29uc3QgbGVuUHRyID0gd2FzbUluc3RhbmNlLmV4cG9ydHMuZ2V0X3BhdGNoZXNfbGVuKHB0cik7XG4gIGNvbnN0IGxlbiA9IG5ldyBVaW50MzJBcnJheShtZW1vcnkuYnVmZmVyLCBsZW5QdHIsIDEpWzBdO1xuICBjb25zdCBqc29uID0gcmVhZFN0cmluZyhwdHIsIGxlbik7XG4gIHJldHVybiBKU09OLnBhcnNlKGpzb24pO1xufVxuXG4vLyBGYXN0IHRlbXBsYXRlIGNvbXBpbGF0aW9uIGluIFdBU01cbmV4cG9ydCBmdW5jdGlvbiB3YXNtQ29tcGlsZVRlbXBsYXRlKHRlbXBsYXRlKSB7XG4gIGlmICghd2FzbUluc3RhbmNlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdXQVNNIG5vdCBpbml0aWFsaXplZCcpO1xuICB9XG4gIFxuICBjb25zdCB7IHB0ciwgbGVuIH0gPSB3cml0ZVN0cmluZyh0ZW1wbGF0ZSk7XG4gIFxuICBjb25zdCBjb21waWxlZFB0ciA9IHdhc21JbnN0YW5jZS5leHBvcnRzLmNvbXBpbGVfdGVtcGxhdGUocHRyLCBsZW4pO1xuICBjb25zdCBjb21waWxlZExlbiA9IHdhc21JbnN0YW5jZS5leHBvcnRzLmdldF9jb21waWxlZF9sZW4oY29tcGlsZWRQdHIpO1xuICBcbiAgY29uc3QgcmVzdWx0ID0gcmVhZFN0cmluZyhjb21waWxlZFB0ciwgY29tcGlsZWRMZW4pO1xuICBcbiAgd2FzbUluc3RhbmNlLmV4cG9ydHMuZnJlZShwdHIpO1xuICB3YXNtSW5zdGFuY2UuZXhwb3J0cy5mcmVlKGNvbXBpbGVkUHRyKTtcbiAgXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8vIFBlcmZvcm1hbmNlLWNyaXRpY2FsIHJlYWN0aXZlIHN5c3RlbSBvcGVyYXRpb25zXG5leHBvcnQgZnVuY3Rpb24gd2FzbUNvbXB1dGVEZXBlbmRlbmNpZXMoZWZmZWN0SWQsIGRlcHMpIHtcbiAgaWYgKCF3YXNtSW5zdGFuY2UpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1dBU00gbm90IGluaXRpYWxpemVkJyk7XG4gIH1cbiAgXG4gIGNvbnN0IGRlcHNEYXRhID0gbmV3IFVpbnQzMkFycmF5KGRlcHMpO1xuICBjb25zdCBkZXBzUHRyID0gd2FzbUluc3RhbmNlLmV4cG9ydHMuYWxsb2MoZGVwc0RhdGEubGVuZ3RoICogNCk7XG4gIGNvbnN0IGRlcHNNZW0gPSBuZXcgVWludDMyQXJyYXkobWVtb3J5LmJ1ZmZlciwgZGVwc1B0ciwgZGVwc0RhdGEubGVuZ3RoKTtcbiAgZGVwc01lbS5zZXQoZGVwc0RhdGEpO1xuICBcbiAgY29uc3QgcmVzdWx0UHRyID0gd2FzbUluc3RhbmNlLmV4cG9ydHMuY29tcHV0ZV9kZXBlbmRlbmNpZXMoXG4gICAgZWZmZWN0SWQsXG4gICAgZGVwc1B0cixcbiAgICBkZXBzRGF0YS5sZW5ndGhcbiAgKTtcbiAgXG4gIGNvbnN0IHJlc3VsdExlbiA9IHdhc21JbnN0YW5jZS5leHBvcnRzLmdldF9yZXN1bHRfbGVuKHJlc3VsdFB0cik7XG4gIGNvbnN0IHJlc3VsdCA9IG5ldyBVaW50MzJBcnJheShtZW1vcnkuYnVmZmVyLCByZXN1bHRQdHIsIHJlc3VsdExlbik7XG4gIFxuICB3YXNtSW5zdGFuY2UuZXhwb3J0cy5mcmVlKGRlcHNQdHIpO1xuICB3YXNtSW5zdGFuY2UuZXhwb3J0cy5mcmVlKHJlc3VsdFB0cik7XG4gIFxuICByZXR1cm4gQXJyYXkuZnJvbShyZXN1bHQpO1xufVxuXG4vLyBCZW5jaG1hcmtpbmcgdXRpbGl0aWVzXG5leHBvcnQgY29uc3Qgd2FzbUJlbmNobWFyayA9IHtcbiAgc3RhcnRUaW1lcjogKG5hbWUpID0+IHtcbiAgICBjb25zdCB7IHB0ciwgbGVuIH0gPSB3cml0ZVN0cmluZyhuYW1lKTtcbiAgICBjb25zdCBpZCA9IHdhc21JbnN0YW5jZS5leHBvcnRzLnN0YXJ0X3RpbWVyKHB0ciwgbGVuKTtcbiAgICB3YXNtSW5zdGFuY2UuZXhwb3J0cy5mcmVlKHB0cik7XG4gICAgcmV0dXJuIGlkO1xuICB9LFxuICBcbiAgZW5kVGltZXI6IChpZCkgPT4ge1xuICAgIHJldHVybiB3YXNtSW5zdGFuY2UuZXhwb3J0cy5lbmRfdGltZXIoaWQpO1xuICB9LFxuICBcbiAgZ2V0U3RhdHM6ICgpID0+IHtcbiAgICBjb25zdCBzdGF0c1B0ciA9IHdhc21JbnN0YW5jZS5leHBvcnRzLmdldF9wZXJmb3JtYW5jZV9zdGF0cygpO1xuICAgIGNvbnN0IHN0YXRzTGVuID0gd2FzbUluc3RhbmNlLmV4cG9ydHMuZ2V0X3N0YXRzX2xlbihzdGF0c1B0cik7XG4gICAgY29uc3Qgc3RhdHMgPSByZWFkU3RyaW5nKHN0YXRzUHRyLCBzdGF0c0xlbik7XG4gICAgd2FzbUluc3RhbmNlLmV4cG9ydHMuZnJlZShzdGF0c1B0cik7XG4gICAgcmV0dXJuIEpTT04ucGFyc2Uoc3RhdHMpO1xuICB9XG59OyIsICIvKipcbiAqIEVnaGFjdCBQdXJlIFJ1bnRpbWVcbiAqIFplcm8gZGVwZW5kZW5jaWVzLCBwdXJlIEphdmFTY3JpcHQvV2ViQXNzZW1ibHkgaW1wbGVtZW50YXRpb25cbiAqL1xuXG5leHBvcnQgeyBoLCB0ZXh0LCBmcmFnbWVudCB9IGZyb20gJy4vY29yZS92ZG9tLmpzJztcbmV4cG9ydCB7IGNyZWF0ZUVsZW1lbnQsIGluaXRFdmVudERlbGVnYXRpb24sIGFwcGx5UGF0Y2hlcyB9IGZyb20gJy4vY29yZS9yZW5kZXJlci5qcyc7XG5leHBvcnQgeyByZWFjdGl2ZSwgZWZmZWN0LCBjb21wdXRlZCwgd2F0Y2gsIHJlZiwgY3JlYXRlU3RvcmUgfSBmcm9tICcuL2NvcmUvcmVhY3RpdmUuanMnO1xuZXhwb3J0IHsgXG4gIENvbXBvbmVudCwgXG4gIGNyZWF0ZUZ1bmN0aW9uQ29tcG9uZW50LCBcbiAgcmVnaXN0ZXJDb21wb25lbnQsXG4gIGNyZWF0ZUNvbXBvbmVudCxcbiAgdXNlU3RhdGUsXG4gIHVzZUVmZmVjdCxcbiAgY3JlYXRlQ29udGV4dCxcbiAgdXNlQ29udGV4dCxcbiAgcHJvdmlkZVxufSBmcm9tICcuL2NvcmUvY29tcG9uZW50LmpzJztcbmV4cG9ydCB7IFxuICBpbml0V0FTTSwgXG4gIHdhc21EaWZmLCBcbiAgd2FzbUNvbXBpbGVUZW1wbGF0ZSwgXG4gIHdhc21Db21wdXRlRGVwZW5kZW5jaWVzLFxuICB3YXNtQmVuY2htYXJrIFxufSBmcm9tICcuL3dhc20tYnJpZGdlLmpzJztcblxuLy8gUnVudGltZSBpbml0aWFsaXphdGlvblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZUFwcChyb290Q29tcG9uZW50LCByb290RWxlbWVudCkge1xuICAvLyBJbml0aWFsaXplIFdBU00gZm9yIHBlcmZvcm1hbmNlXG4gIGNvbnN0IHdhc20gPSBhd2FpdCBpbml0V0FTTSgpO1xuICBcbiAgLy8gSW5pdGlhbGl6ZSBldmVudCBkZWxlZ2F0aW9uXG4gIGluaXRFdmVudERlbGVnYXRpb24ocm9vdEVsZW1lbnQpO1xuICBcbiAgLy8gQ3JlYXRlIGFuZCBtb3VudCByb290IGNvbXBvbmVudFxuICBjb25zdCBhcHAgPSB7XG4gICAgX3Jvb3RDb21wb25lbnQ6IHJvb3RDb21wb25lbnQsXG4gICAgX3Jvb3RFbGVtZW50OiByb290RWxlbWVudCxcbiAgICBfbW91bnRlZDogZmFsc2UsXG4gICAgXG4gICAgbW91bnQoKSB7XG4gICAgICBpZiAodGhpcy5fbW91bnRlZCkge1xuICAgICAgICBjb25zb2xlLndhcm4oJ0FwcCBhbHJlYWR5IG1vdW50ZWQnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBpbnN0YW5jZSA9IG5ldyByb290Q29tcG9uZW50KCk7XG4gICAgICBpbnN0YW5jZS5fbW91bnQocm9vdEVsZW1lbnQpO1xuICAgICAgdGhpcy5fbW91bnRlZCA9IHRydWU7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKCdFZ2hhY3QgYXBwIG1vdW50ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgfSxcbiAgICBcbiAgICB1bm1vdW50KCkge1xuICAgICAgaWYgKCF0aGlzLl9tb3VudGVkKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignQXBwIG5vdCBtb3VudGVkJyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gVW5tb3VudCBsb2dpYyBoZXJlXG4gICAgICB0aGlzLl9tb3VudGVkID0gZmFsc2U7XG4gICAgfVxuICB9O1xuICBcbiAgcmV0dXJuIGFwcDtcbn1cblxuLy8gR2xvYmFsIHJ1bnRpbWUgaW5mb1xuZXhwb3J0IGNvbnN0IHJ1bnRpbWUgPSB7XG4gIHZlcnNpb246ICcwLjEuMCcsXG4gIG1vZGU6ICdwdXJlJyxcbiAgZmVhdHVyZXM6IHtcbiAgICB3YXNtOiB0cnVlLFxuICAgIHJlYWN0aXZlOiB0cnVlLFxuICAgIGNvbXBvbmVudHM6IHRydWUsXG4gICAgc3NyOiBmYWxzZSwgLy8gVG8gYmUgaW1wbGVtZW50ZWRcbiAgICBoeWRyYXRpb246IGZhbHNlIC8vIFRvIGJlIGltcGxlbWVudGVkXG4gIH1cbn07Il0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQW1CQSxTQUFTLFlBQVksU0FBUyxTQUFTO0FBQ3JDLFFBQU0sVUFBVSxDQUFDO0FBRWpCLE1BQUksQ0FBQyxXQUFXLFNBQVM7QUFDdkIsWUFBUSxLQUFLLEVBQUUsTUFBTSxVQUFVLE1BQU0sUUFBUSxDQUFDO0FBQUEsRUFDaEQsV0FBVyxXQUFXLENBQUMsU0FBUztBQUM5QixZQUFRLEtBQUssRUFBRSxNQUFNLFNBQVMsQ0FBQztBQUFBLEVBQ2pDLFdBQVcsUUFBUSxTQUFTLFFBQVEsTUFBTTtBQUN4QyxZQUFRLEtBQUssRUFBRSxNQUFNLFdBQVcsTUFBTSxRQUFRLENBQUM7QUFBQSxFQUNqRCxXQUFXLFFBQVEsYUFBYSxHQUFHO0FBQ2pDLFFBQUksUUFBUSxVQUFVLFFBQVEsT0FBTztBQUNuQyxjQUFRLEtBQUssRUFBRSxNQUFNLFFBQVEsT0FBTyxRQUFRLE1BQU0sQ0FBQztBQUFBLElBQ3JEO0FBQUEsRUFDRixPQUFPO0FBRUwsVUFBTSxjQUFjQSxXQUFVLFFBQVEsU0FBUyxDQUFDLEdBQUcsUUFBUSxTQUFTLENBQUMsQ0FBQztBQUN0RSxRQUFJLFlBQVksU0FBUyxHQUFHO0FBQzFCLGNBQVEsS0FBSyxFQUFFLE1BQU0sU0FBUyxTQUFTLFlBQVksQ0FBQztBQUFBLElBQ3RE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LFVBQVUsZUFBZSxhQUFhO0FBRTFELFFBQU0sT0FBTyxNQUFNLFNBQVM7QUFHNUIsc0JBQW9CLFdBQVc7QUFHL0IsUUFBTSxNQUFNO0FBQUEsSUFDVixnQkFBZ0I7QUFBQSxJQUNoQixjQUFjO0FBQUEsSUFDZCxVQUFVO0FBQUEsSUFFVixRQUFRO0FBQ04sVUFBSSxLQUFLLFVBQVU7QUFDakIsZ0JBQVEsS0FBSyxxQkFBcUI7QUFDbEM7QUFBQSxNQUNGO0FBRUEsWUFBTSxXQUFXLElBQUksY0FBYztBQUNuQyxlQUFTLE9BQU8sV0FBVztBQUMzQixXQUFLLFdBQVc7QUFFaEIsY0FBUSxJQUFJLGlDQUFpQztBQUFBLElBQy9DO0FBQUEsSUFFQSxVQUFVO0FBQ1IsVUFBSSxDQUFDLEtBQUssVUFBVTtBQUNsQixnQkFBUSxLQUFLLGlCQUFpQjtBQUM5QjtBQUFBLE1BQ0Y7QUFHQSxXQUFLLFdBQVc7QUFBQSxJQUNsQjtBQUFBLEVBQ0Y7QUFFQSxTQUFPO0FBQ1Q7QUFHTyxJQUFNLFVBQVU7QUFBQSxFQUNyQixTQUFTO0FBQUEsRUFDVCxNQUFNO0FBQUEsRUFDTixVQUFVO0FBQUEsSUFDUixNQUFNO0FBQUEsSUFDTixVQUFVO0FBQUEsSUFDVixZQUFZO0FBQUEsSUFDWixLQUFLO0FBQUE7QUFBQSxJQUNMLFdBQVc7QUFBQTtBQUFBLEVBQ2I7QUFDRjsiLAogICJuYW1lcyI6IFsiZGlmZlByb3BzIiwgImRpZmZDaGlsZHJlbiIsICJpbml0RXZlbnREZWxlZ2F0aW9uIiwgImZyYWdtZW50IiwgInRhcmdldCIsICJlZmZlY3QiLCAiaW5zdGFuY2UiLCAiY29udGFpbmVyIiwgImNsZWFudXAiLCAiaW5pdFdBU00iLCAid2FzbUV4cG9ydHMiLCAic3RhdHMiXQp9Cg==

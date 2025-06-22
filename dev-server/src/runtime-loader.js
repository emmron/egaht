/**
 * Runtime loader for Eghact runtime (WASM + JS fallback)
 */

export function serveRuntime(request, reply) {
  const url = request.url;
  
  if (url.includes('runtime.js')) {
    // Serve JavaScript runtime
    const runtimeJS = `
// Eghact Runtime (JavaScript fallback)
class EghactRuntime {
  constructor() {
    this.initialized = false;
  }
  
  async init() {
    if (this.initialized) return;
    this.initialized = true;
    console.log('[Eghact] Runtime initialized (JS fallback)');
  }
  
  createElement(tagName) {
    return document.createElement(tagName);
  }
  
  createTextNode(text) {
    return document.createTextNode(text);
  }
  
  appendChild(parent, child) {
    parent.appendChild(child);
  }
  
  removeChild(parent, child) {
    parent.removeChild(child);
  }
  
  insertBefore(parent, newNode, referenceNode) {
    parent.insertBefore(newNode, referenceNode);
  }
  
  setAttribute(element, name, value) {
    element.setAttribute(name, value);
  }
  
  removeAttribute(element, name) {
    element.removeAttribute(name);
  }
  
  setText(element, text) {
    element.textContent = text;
  }
  
  setProperty(element, name, value) {
    element[name] = value;
  }
  
  addEventListener(element, type, listener) {
    element.addEventListener(type, listener);
  }
  
  removeEventListener(element, type, listener) {
    element.removeEventListener(type, listener);
  }
  
  getElementById(id) {
    return document.getElementById(id);
  }
  
  querySelector(selector) {
    return document.querySelector(selector);
  }
}

// Global runtime instance
export const runtime = new EghactRuntime();

// Auto-initialize
runtime.init();
`;
    
    reply.type('application/javascript').send(runtimeJS);
  } else if (url.includes('runtime.wasm')) {
    // For now, serve empty response - WASM will be added later
    reply.code(404).send('WASM runtime not available yet');
  }
}
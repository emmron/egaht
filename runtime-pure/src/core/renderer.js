/**
 * Pure DOM renderer - no React, no synthetic events
 * Direct DOM manipulation with our own event system
 */

import { NODE_TYPES } from './vdom.js';

// Custom event system
const eventRegistry = new WeakMap();
const delegatedEvents = new Set(['click', 'input', 'change', 'submit', 'keydown', 'keyup']);

// Initialize event delegation
export function initEventDelegation(root) {
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

// Create real DOM from virtual DOM
export function createElement(vnode) {
  if (!vnode) return null;
  
  if (typeof vnode === 'string' || typeof vnode === 'number') {
    return document.createTextNode(String(vnode));
  }
  
  if (vnode.nodeType === NODE_TYPES.TEXT) {
    return document.createTextNode(vnode.value);
  }
  
  if (vnode.nodeType === NODE_TYPES.FRAGMENT) {
    const fragment = document.createDocumentFragment();
    vnode.children.forEach(child => {
      const el = createElement(child);
      if (el) fragment.appendChild(el);
    });
    return fragment;
  }
  
  if (vnode.nodeType === NODE_TYPES.ELEMENT) {
    const el = document.createElement(vnode.type);
    
    // Apply props
    updateProps(el, {}, vnode.props);
    
    // Create children
    vnode.children.forEach(child => {
      const childEl = createElement(child);
      if (childEl) el.appendChild(childEl);
    });
    
    return el;
  }
  
  if (vnode.nodeType === NODE_TYPES.COMPONENT) {
    // Component instantiation - import dynamically to avoid circular dependency
    // For now, return a placeholder that will be handled by the component system
    const placeholder = document.createElement('div');
    placeholder.setAttribute('data-component-placeholder', vnode.type.name || 'Component');
    return placeholder;
  }
}

// Update element properties
function updateProps(el, oldProps, newProps) {
  // Remove old props
  for (const key in oldProps) {
    if (!(key in newProps)) {
      removeProp(el, key, oldProps[key]);
    }
  }
  
  // Set new props
  for (const key in newProps) {
    if (oldProps[key] !== newProps[key]) {
      setProp(el, key, newProps[key]);
    }
  }
}

function setProp(el, key, value) {
  if (key.startsWith('@')) {
    // Eghact event syntax: @click
    const eventType = key.slice(1);
    const handlers = eventRegistry.get(el) || {};
    handlers[eventType] = value;
    eventRegistry.set(el, handlers);
  } else if (key === 'class') {
    el.className = value || '';
  } else if (key === 'style') {
    if (typeof value === 'object') {
      Object.assign(el.style, value);
    } else {
      el.style.cssText = value || '';
    }
  } else if (key in el && !key.startsWith('aria-') && !key.startsWith('data-')) {
    // DOM property
    el[key] = value;
  } else {
    // HTML attribute
    if (value === true) {
      el.setAttribute(key, '');
    } else if (value === false || value == null) {
      el.removeAttribute(key);
    } else {
      el.setAttribute(key, value);
    }
  }
}

function removeProp(el, key, oldValue) {
  if (key.startsWith('@')) {
    const eventType = key.slice(1);
    const handlers = eventRegistry.get(el);
    if (handlers) {
      delete handlers[eventType];
    }
  } else if (key === 'class') {
    el.className = '';
  } else if (key === 'style') {
    el.style.cssText = '';
  } else if (key in el) {
    el[key] = '';
  } else {
    el.removeAttribute(key);
  }
}

// Apply patches to DOM
export function applyPatches(el, patches) {
  for (const patch of patches) {
    applyPatch(el, patch);
  }
}

function applyPatch(el, patch) {
  switch (patch.type) {
    case 'CREATE':
      const newEl = createElement(patch.node);
      el.appendChild(newEl);
      break;
      
    case 'REMOVE':
      el.remove();
      break;
      
    case 'REPLACE':
      const replacement = createElement(patch.node);
      el.replaceWith(replacement);
      break;
      
    case 'TEXT':
      el.textContent = patch.value;
      break;
      
    case 'PROPS':
      const oldProps = {};
      const newProps = {};
      patch.patches.forEach(p => {
        newProps[p.key] = p.value;
      });
      updateProps(el, oldProps, newProps);
      break;
      
    case 'CHILDREN':
      patch.patches.forEach(childPatch => {
        const child = el.childNodes[childPatch.index];
        if (child) {
          childPatch.patches.forEach(p => applyPatch(child, p));
        }
      });
      break;
  }
}
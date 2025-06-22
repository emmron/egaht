/**
 * Pure Eghact Virtual DOM implementation
 * No React, no dependencies, just pure JS/WASM
 */

// Virtual DOM node types
export const NODE_TYPES = {
  ELEMENT: 1,
  TEXT: 2,
  COMPONENT: 3,
  FRAGMENT: 4
};

// Create virtual node
export function h(type, props, ...children) {
  // Flatten children and filter nulls
  const flatChildren = children
    .flat(Infinity)
    .filter(c => c != null)
    .map(child => {
      // Convert primitives to text nodes
      if (typeof child === 'string' || typeof child === 'number') {
        return text(String(child));
      }
      return child;
    });
  
  return {
    type,
    props: props || {},
    children: flatChildren,
    key: props?.key,
    nodeType: typeof type === 'string' ? NODE_TYPES.ELEMENT : NODE_TYPES.COMPONENT
  };
}

// Text node helper
export function text(value) {
  return {
    type: '#text',
    value: String(value),
    nodeType: NODE_TYPES.TEXT
  };
}

// Fragment helper
export function fragment(props, ...children) {
  return {
    type: '#fragment',
    props: props || {},
    children: children.flat(Infinity).filter(c => c != null),
    nodeType: NODE_TYPES.FRAGMENT
  };
}

// Diff algorithm - pure JS implementation
export function diff(oldVNode, newVNode) {
  const patches = [];
  
  if (!oldVNode) {
    patches.push({ type: 'CREATE', node: newVNode });
  } else if (!newVNode) {
    patches.push({ type: 'REMOVE' });
  } else if (oldVNode.type !== newVNode.type) {
    patches.push({ type: 'REPLACE', node: newVNode });
  } else if (oldVNode.nodeType === NODE_TYPES.TEXT) {
    if (oldVNode.value !== newVNode.value) {
      patches.push({ type: 'TEXT', value: newVNode.value });
    }
  } else {
    // Diff props
    const propPatches = diffProps(oldVNode.props, newVNode.props);
    if (propPatches.length > 0) {
      patches.push({ type: 'PROPS', patches: propPatches });
    }
    
    // Diff children
    const childPatches = diffChildren(oldVNode.children, newVNode.children);
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
  
  for (let i = 0; i < maxLength; i++) {
    const childPatches = diff(oldChildren[i], newChildren[i]);
    if (childPatches.length > 0) {
      patches.push({ index: i, patches: childPatches });
    }
  }
  
  return patches;
}
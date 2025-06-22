// Jest transformer for .egh files
const fs = require('fs');
const path = require('path');

module.exports = {
  process(src, filename, config, options) {
    // Basic .egh to JavaScript transformation for testing
    const componentName = path.basename(filename, '.egh');
    
    // Parse the .egh file
    const sections = parseEghFile(src);
    
    // Generate test-friendly JavaScript
    const jsCode = `
// Transformed ${filename} for testing
const { runtime } = require('@eghact/core');

${sections.script || ''}

function createComponent() {
  let state = {};
  let signals = {};
  
  // Mock reactive state
  function createReactiveState(initialState) {
    const proxy = new Proxy(initialState, {
      set(target, key, value) {
        if (target[key] !== value) {
          target[key] = value;
          // Trigger re-render in tests
          if (typeof window !== 'undefined' && window.__EGHACT_TEST__) {
            window.__EGHACT_TEST__.triggerUpdate?.();
          }
        }
        return true;
      }
    });
    return proxy;
  }
  
  // Component instance
  const component = {
    name: '${componentName}',
    props: {},
    state: createReactiveState(state),
    signals,
    
    render(props = {}) {
      this.props = props;
      
      // Merge props into state
      Object.assign(this.state, props);
      
      // Create DOM element
      const container = document.createElement('div');
      container.className = '${componentName.toLowerCase()}-component';
      container.dataset.component = '${componentName}';
      
      // Render template
      const template = \`${escapeTemplate(sections.template)}\`;
      container.innerHTML = template;
      
      // Process template interpolations
      this.processInterpolations(container, props);
      
      // Add event listeners
      this.attachEventListeners(container);
      
      // Add styles
      if (${JSON.stringify(sections.style)}) {
        this.addStyles('${componentName}', ${JSON.stringify(sections.style)});
      }
      
      return container;
    },
    
    processInterpolations(container, props) {
      // Simple template interpolation for testing
      const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      const textNodes = [];
      let node;
      while (node = walker.nextNode()) {
        textNodes.push(node);
      }
      
      textNodes.forEach(textNode => {
        let text = textNode.textContent;
        
        // Replace {prop} with actual values
        text = text.replace(/\\{\\s*([^}]+)\\s*\\}/g, (match, expr) => {
          try {
            // Simple expression evaluation for testing
            const value = this.evaluateExpression(expr, props);
            return value != null ? String(value) : '';
          } catch (e) {
            return match;
          }
        });
        
        textNode.textContent = text;
      });
    },
    
    evaluateExpression(expr, props) {
      // Simple expression evaluator for tests
      const context = { ...this.state, ...props };
      
      // Handle simple property access
      if (expr in context) {
        return context[expr];
      }
      
      // Handle nested properties (e.g., user.name)
      const parts = expr.split('.');
      let value = context;
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          return undefined;
        }
      }
      
      return value;
    },
    
    attachEventListeners(container) {
      // Find elements with event handlers
      const elements = container.querySelectorAll('[data-on], [onclick], [onchange]');
      
      elements.forEach(element => {
        // Handle @click syntax
        const onClick = element.dataset.onClick || element.getAttribute('onclick');
        if (onClick) {
          element.addEventListener('click', (event) => {
            this.handleEvent('click', onClick, event);
          });
        }
        
        // Handle @change syntax
        const onChange = element.dataset.onChange || element.getAttribute('onchange');
        if (onChange) {
          element.addEventListener('change', (event) => {
            this.handleEvent('change', onChange, event);
          });
        }
      });
    },
    
    handleEvent(type, handler, event) {
      // Simple event handler for testing
      if (typeof handler === 'function') {
        handler.call(this, event);
      } else if (typeof handler === 'string') {
        // Try to evaluate as function call
        try {
          const func = this[handler] || window[handler];
          if (func) {
            func.call(this, event);
          }
        } catch (e) {
          console.warn('Event handler error:', e);
        }
      }
    },
    
    addStyles(componentName, css) {
      const styleId = \`\${componentName}-styles\`;
      
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = css;
        document.head.appendChild(style);
      }
    },
    
    // Lifecycle methods for testing
    mount() {
      this._isMounted = true;
      if (this.onMount) {
        this.onMount();
      }
    },
    
    unmount() {
      this._isMounted = false;
      if (this.onUnmount) {
        this.onUnmount();
      }
    },
    
    update(newProps) {
      Object.assign(this.props, newProps);
      if (this.onUpdate) {
        this.onUpdate(newProps);
      }
    }
  };
  
  return component;
}

// Component factory
const ${componentName} = {
  name: '${componentName}',
  createComponent,
  
  // For testing compatibility
  render(props) {
    const component = createComponent();
    return component.render(props);
  }
};

module.exports = ${componentName};
module.exports.default = ${componentName};
module.exports.createComponent = createComponent;
`;

    return jsCode;
  }
};

function parseEghFile(content) {
  const sections = { template: '', script: '', style: '' };
  
  // Extract template section
  const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/);
  if (templateMatch) {
    sections.template = templateMatch[1].trim();
  }
  
  // Extract script section
  const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);
  if (scriptMatch) {
    sections.script = scriptMatch[1].trim();
  }
  
  // Extract style section
  const styleMatch = content.match(/<style>([\s\S]*?)<\/style>/);
  if (styleMatch) {
    sections.style = styleMatch[1].trim();
  }
  
  return sections;
}

function escapeTemplate(template) {
  return template
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\${/g, '\\${');
}
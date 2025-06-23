/**
 * STANDALONE CORE - Zero Node.js dependencies
 * Pure JavaScript that can run in any environment
 */

// Pure HTTP client - no dependencies
class StandaloneHTTP {
  static async post(url, data, headers = {}) {
    if (typeof fetch !== 'undefined') {
      // Browser/Deno/Bun environment
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(data)
      });
      return response.json();
    } else if (typeof XMLHttpRequest !== 'undefined') {
      // Legacy browser
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        Object.entries(headers).forEach(([key, value]) => {
          xhr.setRequestHeader(key, value);
        });
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(JSON.stringify(data));
      });
    } else {
      throw new Error('No HTTP client available');
    }
  }
}

// Standalone AI client
class StandaloneAI {
  constructor(apiKey = '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') {
    this.apiKey = apiKey;
    this.baseURL = 'https://openrouter.ai/api/v1';
  }

  async complete(messages, model = 'openai/gpt-4-turbo-preview', maxTokens = 2000) {
    const response = await StandaloneHTTP.post(
      `${this.baseURL}/chat/completions`,
      {
        model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7
      },
      {
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://eghact.dev',
        'X-Title': 'Eghact Standalone Generator'
      }
    );
    
    return response.choices[0].message.content;
  }
}

// Pure component generator - no external dependencies
class StandaloneComponentGenerator {
  constructor() {
    this.ai = new StandaloneAI();
    this.patterns = {
      counter: {
        state: 'let count = 0;',
        reactive: '$: doubled = count * 2;',
        handlers: ['const increment = () => count++;', 'const decrement = () => count--;']
      },
      list: {
        state: 'let items = [];\nlet newItem = "";',
        reactive: '$: isEmpty = items.length === 0;',
        handlers: [
          'const addItem = () => { if (newItem) { items = [...items, newItem]; newItem = ""; } }',
          'const removeItem = (index) => { items = items.filter((_, i) => i !== index); }'
        ]
      },
      form: {
        state: 'let formData = {};\nlet errors = {};',
        reactive: '$: isValid = Object.keys(errors).length === 0;',
        handlers: ['const handleSubmit = () => { if (isValid) { /* submit */ } }']
      }
    };
  }

  parsePrompt(prompt) {
    const lower = prompt.toLowerCase();
    const features = {
      type: 'component',
      patterns: [],
      props: {},
      interactions: []
    };

    // Detect patterns
    if (lower.includes('counter')) features.patterns.push('counter');
    if (lower.includes('list') || lower.includes('todo')) features.patterns.push('list');
    if (lower.includes('form')) features.patterns.push('form');

    // Detect component type
    if (lower.includes('button')) features.type = 'button';
    else if (lower.includes('card')) features.type = 'card';
    else if (lower.includes('header')) features.type = 'header';

    // Extract props
    const labelMatch = prompt.match(/(?:labeled?|with label)\s+["']([^"']+)["']/i);
    if (labelMatch) features.props.label = labelMatch[1];

    const placeholderMatch = prompt.match(/placeholder\s+["']([^"']+)["']/i);
    if (placeholderMatch) features.props.placeholder = placeholderMatch[1];

    // Detect interactions
    if (lower.includes('click')) features.interactions.push('click');
    if (lower.includes('submit')) features.interactions.push('submit');
    if (lower.includes('input')) features.interactions.push('input');

    return features;
  }

  generateComponent(features) {
    const { type, patterns, props, interactions } = features;
    
    let component = '<component>\n';
    
    // Props
    Object.entries(props).forEach(([name, defaultValue]) => {
      component += `  <prop name="${name}" type="string" default="${defaultValue}" />\n`;
    });
    
    // State
    if (patterns.length > 0) {
      component += '\n  <state>\n';
      patterns.forEach(pattern => {
        if (this.patterns[pattern]) {
          component += `    ${this.patterns[pattern].state}\n`;
        }
      });
      component += '  </state>\n';
    }
    
    // Reactive
    patterns.forEach(pattern => {
      if (this.patterns[pattern]?.reactive) {
        component += `\n  ${this.patterns[pattern].reactive}\n`;
      }
    });
    
    // Handlers
    patterns.forEach(pattern => {
      if (this.patterns[pattern]?.handlers) {
        this.patterns[pattern].handlers.forEach(handler => {
          component += `\n  ${handler}\n`;
        });
      }
    });
    
    // Template
    component += '\n  <template>\n';
    component += this.generateTemplate(type, patterns, props, interactions);
    component += '\n  </template>\n';
    
    // Style
    component += '\n  <style>\n';
    component += this.generateStyles(type);
    component += '\n  </style>\n';
    
    component += '</component>';
    
    return component;
  }

  generateTemplate(type, patterns, props, interactions) {
    let template = '';
    
    if (type === 'button') {
      template = `    <button @click="handleClick">\n      {${props.label ? 'label' : '"Click me"'}}\n    </button>`;
    } else if (patterns.includes('counter')) {
      template = `    <div class="counter">
      <h2>Count: {count}</h2>
      <p>Doubled: {doubled}</p>
      <button @click="decrement">-</button>
      <button @click="increment">+</button>
    </div>`;
    } else if (patterns.includes('list')) {
      template = `    <div class="list-container">
      <input 
        value={newItem}
        @input="(e) => newItem = e.target.value"
        placeholder="${props.placeholder || 'Add item'}"
      />
      <button @click="addItem">Add</button>
      
      #if (isEmpty)
        <p>No items yet</p>
      #else
        <ul>
          #each (items as item, index)
            <li>
              {item}
              <button @click="() => removeItem(index)">×</button>
            </li>
          #/each
        </ul>
      #/if
    </div>`;
    } else {
      template = `    <div class="${type}">\n      <p>Generated ${type}</p>\n    </div>`;
    }
    
    return template;
  }

  generateStyles(type) {
    const styles = {
      button: `.button { padding: 10px 20px; cursor: pointer; }`,
      counter: `.counter { text-align: center; padding: 20px; }\n    button { margin: 0 5px; }`,
      list: `.list-container { max-width: 400px; }\n    ul { list-style: none; padding: 0; }\n    li { display: flex; justify-content: space-between; padding: 5px; }`,
      default: `.${type} { padding: 20px; border: 1px solid #ddd; }`
    };
    
    return `    ${styles[type] || styles.default}`;
  }

  async generate(prompt) {
    // Try local generation first
    const features = this.parsePrompt(prompt);
    
    if (features.patterns.length > 0 || features.type !== 'component') {
      // We can handle this locally
      return this.generateComponent(features);
    }
    
    // Fall back to AI for complex requests
    const systemPrompt = `Generate a Turing-complete Eghact component. Use .egh syntax only:
- <component> wrapper
- <prop> for props
- <state> for state variables
- $: for reactive computations
- @ for events (@click, @input)
- #if, #each for control flow
- NO JSX! Use class= not className=`;
    
    const content = await this.ai.complete([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Generate an Eghact component for: ${prompt}` }
    ]);
    
    return content.replace(/```[\w]*\n?/g, '').trim();
  }
}

// Export for any environment
if (typeof module !== 'undefined' && module.exports) {
  // Node.js
  module.exports = { StandaloneComponentGenerator, StandaloneAI, StandaloneHTTP };
} else if (typeof window !== 'undefined') {
  // Browser
  window.EghactGenerator = { StandaloneComponentGenerator, StandaloneAI, StandaloneHTTP };
} else if (typeof self !== 'undefined') {
  // Web Worker
  self.EghactGenerator = { StandaloneComponentGenerator, StandaloneAI, StandaloneHTTP };
} else if (typeof global !== 'undefined') {
  // Other environments
  global.EghactGenerator = { StandaloneComponentGenerator, StandaloneAI, StandaloneHTTP };
}
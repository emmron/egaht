/**
 * EGH Loader - Compile .egh files during build/dev
 */

import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';

// Simple EGH to JS transformer (temporary until full compiler is integrated)
export class EGHLoader {
  constructor(options = {}) {
    this.cache = new Map();
    this.options = {
      sourceMap: true,
      optimize: false,
      runtime: '@eghact/runtime-pure',
      ...options
    };
  }

  async load(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const hash = createHash('md5').update(content).digest('hex');
    
    // Check cache
    const cached = this.cache.get(filePath);
    if (cached && cached.hash === hash) {
      return cached.result;
    }
    
    // Transform EGH to JS
    const result = await this.transform(content, filePath);
    
    // Cache result
    this.cache.set(filePath, { hash, result });
    
    return result;
  }

  async transform(content, filePath) {
    try {
      // Parse EGH content
      const parsed = this.parseEGH(content);
      
      // Generate JavaScript
      const js = this.generateJS(parsed, filePath);
      
      // Generate source map if needed
      const sourceMap = this.options.sourceMap ? this.generateSourceMap(content, js, filePath) : null;
      
      return {
        code: js,
        map: sourceMap
      };
    } catch (error) {
      throw new Error(`Failed to transform ${filePath}: ${error.message}`);
    }
  }

  parseEGH(content) {
    const lines = content.split('\n');
    const component = {
      imports: [],
      name: null,
      props: [],
      state: [],
      computed: [],
      effects: [],
      methods: [],
      template: null,
      styles: null
    };
    
    let currentSection = null;
    let templateDepth = 0;
    let templateLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('//')) continue;
      
      // Import statements
      if (trimmed.startsWith('import ')) {
        component.imports.push(line);
        continue;
      }
      
      // Component declaration
      if (trimmed.startsWith('component ')) {
        const match = trimmed.match(/component\s+(\w+)(?:\s*\((.*?)\))?\s*{/);
        if (match) {
          component.name = match[1];
          if (match[2]) {
            component.props = match[2].split(',').map(p => p.trim());
          }
          currentSection = 'body';
        }
        continue;
      }
      
      // Template section
      if (trimmed === '<[') {
        currentSection = 'template';
        templateDepth = 1;
        templateLines = [];
        continue;
      }
      
      if (currentSection === 'template') {
        if (trimmed === ']>') {
          templateDepth--;
          if (templateDepth === 0) {
            component.template = templateLines.join('\n');
            currentSection = 'body';
          }
        } else {
          templateLines.push(line);
          if (trimmed.includes('<[')) templateDepth++;
          if (trimmed.includes(']>')) templateDepth--;
        }
        continue;
      }
      
      // Parse component body
      if (currentSection === 'body') {
        // Reactive state (~)
        if (trimmed.startsWith('~')) {
          const match = trimmed.match(/~(\w+)\s*=\s*(.+)/);
          if (match) {
            component.state.push({
              name: match[1],
              initial: match[2]
            });
          }
        }
        // Computed (=>)
        else if (trimmed.includes('=>') && !trimmed.includes('=>>')) {
          const match = trimmed.match(/(\w+)\s*=>\s*(.+)/);
          if (match) {
            component.computed.push({
              name: match[1],
              expression: match[2]
            });
          }
        }
        // Effects (::)
        else if (trimmed.includes('::')) {
          const match = trimmed.match(/(\w+)\s*::\s*{/);
          if (match) {
            // Find effect body
            let effectBody = [];
            let depth = 1;
            i++;
            while (i < lines.length && depth > 0) {
              const effectLine = lines[i];
              effectBody.push(effectLine);
              if (effectLine.includes('{')) depth++;
              if (effectLine.includes('}')) depth--;
              i++;
            }
            i--; // Back up one line
            
            component.effects.push({
              dependency: match[1],
              body: effectBody.join('\n')
            });
          }
        }
        // Methods
        else if (trimmed.match(/(\w+)\s*\(\)\s*=>\s*{/) || trimmed.match(/(\w+)\s*\(.*?\)\s*=>\s*{/)) {
          const match = trimmed.match(/(\w+)\s*\((.*?)\)\s*=>\s*{/);
          if (match) {
            let methodBody = [];
            let depth = 1;
            i++;
            while (i < lines.length && depth > 0) {
              const methodLine = lines[i];
              methodBody.push(methodLine);
              if (methodLine.includes('{')) depth++;
              if (methodLine.includes('}')) depth--;
              i++;
            }
            i--; // Back up one line
            
            component.methods.push({
              name: match[1],
              params: match[2],
              body: methodBody.join('\n')
            });
          }
        }
      }
    }
    
    return component;
  }

  generateJS(component, filePath) {
    const runtime = this.options.runtime;
    let js = '';
    
    // Add imports
    js += `import { h, Component, reactive, effect, computed } from '${runtime}';\n`;
    if (component.imports.length > 0) {
      js += component.imports.join('\n') + '\n';
    }
    js += '\n';
    
    // Generate component class
    js += `export class ${component.name} extends Component {\n`;
    
    // Constructor
    if (component.state.length > 0 || component.props.length > 0) {
      js += `  constructor(props) {\n`;
      js += `    super(props);\n`;
      
      // Initialize state
      if (component.state.length > 0) {
        js += `    this.state = reactive({\n`;
        for (const state of component.state) {
          js += `      ${state.name}: ${state.initial},\n`;
        }
        js += `    });\n`;
      }
      
      // Initialize computed
      for (const comp of component.computed) {
        js += `    this.${comp.name} = computed(() => ${comp.expression});\n`;
      }
      
      js += `  }\n\n`;
    }
    
    // Add methods
    for (const method of component.methods) {
      js += `  ${method.name}(${method.params}) {${method.body}}\n\n`;
    }
    
    // onMount for effects
    if (component.effects.length > 0) {
      js += `  onMount() {\n`;
      for (const eff of component.effects) {
        js += `    this._effects.push(effect(() => {\n`;
        js += `      // Track: this.state.${eff.dependency}\n`;
        js += eff.body;
        js += `    }));\n`;
      }
      js += `  }\n\n`;
    }
    
    // Render method
    js += `  render() {\n`;
    if (component.template) {
      js += `    return ${this.transformTemplate(component.template)};\n`;
    } else {
      js += `    return null;\n`;
    }
    js += `  }\n`;
    
    js += `}\n`;
    
    // Default export
    js += `\nexport default ${component.name};\n`;
    
    return js;
  }

  transformTemplate(template) {
    // Simple template to h() calls transformation
    // This is a simplified version - real implementation would use proper AST
    
    template = template.trim();
    
    // Handle text nodes
    if (!template.startsWith('<') && !template.includes('{')) {
      return `"${template.replace(/"/g, '\\"')}"`;
    }
    
    // Transform element syntax to h() calls
    // This is very simplified - production would need proper parsing
    let transformed = template;
    
    // Replace element syntax with h() calls
    transformed = transformed.replace(/<(\w+)([^>]*)>/g, (match, tag, attrs) => {
      return `h("${tag}", {${attrs}}, [`;
    });
    
    transformed = transformed.replace(/<\/\w+>/g, '])');
    
    // Handle curly braces for expressions
    transformed = transformed.replace(/\{([^}]+)\}/g, (match, expr) => {
      return '${' + expr + '}';
    });
    
    // Wrap in template literal if needed
    if (transformed.includes('${')) {
      transformed = '`' + transformed + '`';
    }
    
    return transformed;
  }

  generateSourceMap(original, generated, filePath) {
    // Simple source map generation
    return {
      version: 3,
      file: path.basename(filePath) + '.js',
      sources: [path.basename(filePath)],
      sourcesContent: [original],
      names: [],
      mappings: '' // Simplified - real implementation would generate proper mappings
    };
  }
}

// Export singleton instance
export const eghLoader = new EGHLoader();
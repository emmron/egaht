/**
 * EGH Transformer - Converts AST to JavaScript
 */

import { ASTNodeType } from './parser.js';

export class Transformer {
  constructor(options = {}) {
    this.options = {
      runtime: '@eghact/runtime-pure',
      optimize: true,
      sourceMap: true,
      ...options
    };
    this.imports = new Set();
    this.helpers = new Set();
  }
  
  transform(ast) {
    this.imports.clear();
    this.helpers.clear();
    
    const code = this.transformProgram(ast);
    
    // Generate imports
    const importStatements = this.generateImports();
    
    return {
      code: importStatements + '\n\n' + code,
      sourceMap: null // TODO: Implement source maps
    };
  }
  
  transformProgram(node) {
    return node.body.map(decl => this.transformDeclaration(decl)).join('\n\n');
  }
  
  transformDeclaration(node) {
    switch (node.type) {
      case ASTNodeType.COMPONENT:
        return this.transformComponent(node);
      case ASTNodeType.TYPE_DEF:
        return this.transformType(node);
      case ASTNodeType.STYLES:
        return this.transformStyles(node);
      default:
        throw new Error(`Unknown declaration type: ${node.type}`);
    }
  }
  
  transformComponent(node) {
    this.imports.add('Component');
    this.imports.add('h');
    this.imports.add('reactive');
    
    const { name, params, body } = node;
    
    // Separate different parts of component
    const states = [];
    const computeds = [];
    const effects = [];
    let template = null;
    
    for (const item of body) {
      switch (item.type) {
        case ASTNodeType.REACTIVE_STATE:
          states.push(item);
          break;
        case ASTNodeType.COMPUTED:
          computeds.push(item);
          break;
        case ASTNodeType.EFFECT:
          effects.push(item);
          break;
        case ASTNodeType.TEMPLATE:
          template = item;
          break;
      }
    }
    
    // Generate component class
    let code = `export class ${name} extends Component {\n`;
    
    // Constructor
    if (params.length > 0 || states.length > 0) {
      code += `  constructor(props) {\n`;
      code += `    super(props);\n`;
      
      // Initialize reactive state
      if (states.length > 0) {
        code += `    this.state = reactive({\n`;
        for (const state of states) {
          code += `      ${state.name}: ${this.transformExpression(state.initialValue)},\n`;
        }
        code += `    });\n`;
      }
      
      // Initialize computed values
      for (const computed of computeds) {
        this.imports.add('computed');
        code += `    this.${computed.name} = computed(() => ${this.transformExpression(computed.expression)});\n`;
      }
      
      code += `  }\n\n`;
    }
    
    // Mount lifecycle for effects
    if (effects.length > 0) {
      this.imports.add('effect');
      code += `  onMount() {\n`;
      for (const eff of effects) {
        code += `    this._effects.push(effect(() => {\n`;
        
        // Track dependencies
        const deps = eff.dependencies.map(d => `this.state.${d}`).join(', ');
        code += `      // Track: ${deps}\n`;
        
        // Effect body
        code += eff.body.map(stmt => `      ${this.transformStatement(stmt)}`).join('\n');
        code += `\n    }));\n`;
      }
      code += `  }\n\n`;
    }
    
    // Render method
    code += `  render() {\n`;
    if (template) {
      code += `    return ${this.transformTemplate(template)};\n`;
    } else {
      code += `    return null;\n`;
    }
    code += `  }\n`;
    
    code += `}`;
    
    return code;
  }
  
  transformTemplate(node) {
    if (node.children.length === 0) {
      return 'null';
    }
    
    if (node.children.length === 1) {
      return this.transformTemplateElement(node.children[0]);
    }
    
    this.imports.add('fragment');
    return `fragment({}, ${node.children.map(child => this.transformTemplateElement(child)).join(', ')})`;
  }
  
  transformTemplateElement(node) {
    switch (node.type) {
      case ASTNodeType.ELEMENT:
        return this.transformElement(node);
      case ASTNodeType.TEXT:
        return this.transformText(node);
      case ASTNodeType.EXPRESSION:
        return this.transformExpression(node);
      case ASTNodeType.ROW:
        return this.transformRow(node);
      case ASTNodeType.COLUMN:
        return this.transformColumn(node);
      case ASTNodeType.CONDITIONAL:
        return this.transformConditional(node);
      case ASTNodeType.REACTIVE_LOOP:
        return this.transformReactiveLoop(node);
      default:
        throw new Error(`Unknown template element type: ${node.type}`);
    }
  }
  
  transformElement(node) {
    const { tag, attributes, events, styles, children } = node;
    
    // Build props object
    const props = {};
    
    // Add attributes
    for (const [key, value] of Object.entries(attributes)) {
      props[key] = this.transformExpression(value);
    }
    
    // Add events (with @ prefix)
    for (const [event, handler] of Object.entries(events)) {
      props[`@${event}`] = this.transformExpression(handler);
    }
    
    // Add styles
    if (Object.keys(styles).length > 0) {
      const styleObj = {};
      for (const [key, value] of Object.entries(styles)) {
        styleObj[key] = this.transformExpression(value);
      }
      props.style = styleObj;
    }
    
    // Generate h() call
    const propsStr = Object.keys(props).length > 0 
      ? `{${Object.entries(props).map(([k, v]) => `"${k}": ${v}`).join(', ')}}` 
      : '{}';
    
    if (children.length === 0) {
      return `h("${tag}", ${propsStr})`;
    }
    
    const childrenStr = children.map(child => this.transformTemplateElement(child)).join(', ');
    return `h("${tag}", ${propsStr}, ${childrenStr})`;
  }
  
  transformRow(node) {
    // Row layout becomes a flex container
    const props = {
      style: {
        display: 'flex',
        flexDirection: 'row',
        gap: '1rem'
      }
    };
    
    const childrenStr = node.children.map(child => this.transformTemplateElement(child)).join(', ');
    return `h("div", ${JSON.stringify(props)}, ${childrenStr})`;
  }
  
  transformColumn(node) {
    // Column layout becomes a flex container
    const props = {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }
    };
    
    const childrenStr = node.children.map(child => this.transformTemplateElement(child)).join(', ');
    return `h("div", ${JSON.stringify(props)}, ${childrenStr})`;
  }
  
  transformConditional(node) {
    const condition = this.transformExpression(node.condition);
    const consequent = node.consequent.map(el => this.transformTemplateElement(el)).join(', ');
    
    if (node.alternate) {
      const alternate = node.alternate.map(el => this.transformTemplateElement(el)).join(', ');
      return `(${condition} ? ${consequent} : ${alternate})`;
    }
    
    return `(${condition} ? ${consequent} : null)`;
  }
  
  transformReactiveLoop(node) {
    const collection = this.transformExpression(node.collection);
    const itemName = node.itemName;
    const indexName = node.indexName;
    
    const params = indexName ? `${itemName}, ${indexName}` : itemName;
    const body = node.body.map(el => this.transformTemplateElement(el)).join(', ');
    
    return `${collection}.map((${params}) => ${body})`;
  }
  
  transformExpression(node) {
    if (!node) return 'null';
    
    switch (node.type) {
      case ASTNodeType.LITERAL:
        return typeof node.value === 'string' ? `"${node.value}"` : String(node.value);
        
      case ASTNodeType.IDENTIFIER:
        // Check if it's a state reference
        if (this.isStateReference(node.name)) {
          return `this.state.${node.name}`;
        }
        return node.name;
        
      case ASTNodeType.BINARY_OP:
        const left = this.transformExpression(node.left);
        const right = this.transformExpression(node.right);
        return `(${left} ${node.operator} ${right})`;
        
      case ASTNodeType.UNARY_OP:
        const operand = this.transformExpression(node.operand);
        return node.postfix ? `${operand}${node.operator}` : `${node.operator}${operand}`;
        
      case ASTNodeType.CALL:
        const callee = this.transformExpression(node.callee);
        const args = node.arguments.map(arg => this.transformExpression(arg)).join(', ');
        return `${callee}(${args})`;
        
      case ASTNodeType.MEMBER:
        const object = this.transformExpression(node.object);
        if (node.computed) {
          const prop = this.transformExpression(node.property);
          return `${object}[${prop}]`;
        }
        return `${object}.${node.property}`;
        
      case ASTNodeType.PIPELINE:
        // Transform pipeline to function calls
        const pipelineLeft = this.transformExpression(node.left);
        const pipelineRight = this.transformExpression(node.right);
        return `${pipelineRight}(${pipelineLeft})`;
        
      default:
        throw new Error(`Unknown expression type: ${node.type}`);
    }
  }
  
  transformStatement(stmt) {
    // For now, treat statements as expressions
    return this.transformExpression(stmt) + ';';
  }
  
  transformText(node) {
    return `"${node.value}"`;
  }
  
  isStateReference(name) {
    // In a real implementation, we'd track state declarations
    // For now, assume common patterns
    return true; // Conservative approach
  }
  
  generateImports() {
    if (this.imports.size === 0) return '';
    
    const importList = Array.from(this.imports).sort();
    return `import { ${importList.join(', ')} } from '${this.options.runtime}';`;
  }
  
  // Helper generation
  generateHelper(name) {
    const helpers = {
      _egh_two_way_binding: `
function _egh_two_way_binding(element, value, onChange) {
  element.value = value;
  element.addEventListener('input', (e) => onChange(e.target.value));
}`,
      
      _egh_lazy_load: `
function _egh_lazy_load(loader, options = {}) {
  return {
    type: 'lazy',
    loader,
    loading: options.loading || (() => h('div', {}, 'Loading...')),
    error: options.error || ((err) => h('div', {}, 'Error: ' + err.message))
  };
}`,
      
      _egh_animate: `
function _egh_animate(element, animation, duration) {
  element.style.animation = \`\${animation} \${duration}\`;
  element.addEventListener('animationend', () => {
    element.style.animation = '';
  }, { once: true });
}`
    };
    
    return helpers[name] || '';
  }
}
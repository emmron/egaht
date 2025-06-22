/**
 * EGH Code Generator
 * Transforms EGH AST to optimized JavaScript
 */

import {
  ASTNode,
  ComponentNode,
  StateNode,
  ComputedNode,
  EffectNode,
  ElementNode,
  ExpressionNode,
  TemplateNode
} from './ast-types';

export interface CodegenOptions {
  target: 'es2020' | 'es2022' | 'esnext';
  mode: 'development' | 'production';
  sourceMaps: boolean;
  minify: boolean;
  treeshake: boolean;
  componentId?: string;
}

export class EGHCodeGenerator {
  private options: CodegenOptions;
  private indentLevel: number = 0;
  private code: string[] = [];
  private imports: Set<string> = new Set();
  private helpers: Set<string> = new Set();

  constructor(options: CodegenOptions) {
    this.options = options;
  }

  generate(ast: ComponentNode): string {
    this.code = [];
    this.imports.clear();
    this.helpers.clear();

    // Add runtime imports
    this.imports.add(`import { createReactive, computed, effect, h, render } from '@eghact/runtime';`);

    // Generate component class
    this.generateComponent(ast);

    // Combine imports and code
    const output = [
      ...Array.from(this.imports),
      '',
      ...this.generateHelpers(),
      '',
      ...this.code
    ].join('\n');

    return this.options.minify ? this.minify(output) : output;
  }

  private generateComponent(component: ComponentNode): void {
    const className = component.name;
    
    this.line(`export class ${className} {`);
    this.indent();

    // Constructor
    this.line('constructor(props = {}) {');
    this.indent();
    
    // Initialize props
    this.line('this._props = props;');
    
    // Initialize reactive state
    this.generateReactiveState(component.states);
    
    // Initialize computed properties
    this.generateComputedProperties(component.computed);
    
    // Initialize effects
    this.generateEffects(component.effects);
    
    // Bind methods
    this.line('this._bindMethods();');
    
    this.dedent();
    this.line('}');
    this.line('');

    // Generate computed getters
    this.generateComputedGetters(component.computed);

    // Generate render method
    this.generateRenderMethod(component.template);

    // Generate lifecycle methods
    this.generateLifecycleMethods();

    // Helper methods
    this.generateHelperMethods();

    this.dedent();
    this.line('}');
    
    // Export default
    this.line('');
    this.line(`export default ${className};`);
  }

  private generateReactiveState(states: StateNode[]): void {
    if (states.length === 0) return;

    this.line('// Initialize reactive state');
    this.line('this._state = createReactive({');
    this.indent();

    for (const state of states) {
      const value = this.generateExpression(state.initialValue);
      this.line(`${state.name}: ${value},`);
    }

    this.dedent();
    this.line('});');
    this.line('');

    // Create state getters/setters
    for (const state of states) {
      this.line(`Object.defineProperty(this, '${state.name}', {`);
      this.indent();
      this.line(`get() { return this._state.${state.name}; },`);
      this.line(`set(value) { this._state.${state.name} = value; }`);
      this.dedent();
      this.line('});');
    }
    this.line('');
  }

  private generateComputedProperties(computed: ComputedNode[]): void {
    if (computed.length === 0) return;

    this.line('// Initialize computed properties');
    for (const comp of computed) {
      const deps = comp.dependencies.map(d => `() => this.${d}`).join(', ');
      const expr = this.generateExpression(comp.expression);
      
      this.line(`this._computed_${comp.name} = computed(`);
      this.indent();
      this.line(`() => ${expr},`);
      this.line(`[${deps}]`);
      this.dedent();
      this.line(');');
    }
    this.line('');
  }

  private generateComputedGetters(computed: ComputedNode[]): void {
    for (const comp of computed) {
      this.line(`get ${comp.name}() {`);
      this.indent();
      this.line(`return this._computed_${comp.name}.value;`);
      this.dedent();
      this.line('}');
      this.line('');
    }
  }

  private generateEffects(effects: EffectNode[]): void {
    if (effects.length === 0) return;

    this.line('// Initialize effects');
    for (const eff of effects) {
      const deps = Array.isArray(eff.trigger) 
        ? eff.trigger.map(t => `() => this.${t}`)
        : [`() => this.${eff.trigger}`];
      
      this.line('effect(() => {');
      this.indent();
      
      for (const stmt of eff.body) {
        this.line(this.generateStatement(stmt));
      }
      
      this.dedent();
      this.line(`}, [${deps.join(', ')}]);`);
    }
    this.line('');
  }

  private generateRenderMethod(template: TemplateNode | null): void {
    this.line('render() {');
    this.indent();
    
    if (template) {
      const elements = template.children.map(child => 
        this.generateElement(child)
      ).join(',\n' + this.getIndent());
      
      this.line(`return [`);
      this.indent();
      this.lines(elements);
      this.dedent();
      this.line('];');
    } else {
      this.line('return null;');
    }
    
    this.dedent();
    this.line('}');
    this.line('');
  }

  private generateElement(element: ElementNode): string {
    const { tag, attributes, events, children, directives } = element;
    
    // Handle special elements
    if (tag === 'conditional') {
      return this.generateConditional(element);
    }
    
    if (tag === 'loop') {
      return this.generateLoop(element);
    }
    
    if (tag === 'animate') {
      return this.generateAnimation(element);
    }
    
    // Handle layout primitives
    if (['row', 'column', 'grid', 'layer'].includes(tag)) {
      return this.generateLayout(element);
    }
    
    // Regular element
    const attrs = this.generateAttributes(attributes, events);
    const childrenCode = this.generateChildren(children);
    
    return `h('${tag}', ${attrs}, ${childrenCode})`;
  }

  private generateConditional(element: ElementNode): string {
    const condition = this.generateExpression(element.attributes.condition as ExpressionNode);
    const thenBranch = element.children.map(child => 
      this.generateElement(child as ElementNode)
    ).join(', ');
    
    const elseBranch = element.directives.else 
      ? (element.directives.else as ElementNode[]).map(child => 
          this.generateElement(child)
        ).join(', ')
      : 'null';
    
    return `(${condition} ? [${thenBranch}] : [${elseBranch}])`;
  }

  private generateLoop(element: ElementNode): string {
    const collection = this.generateExpression(element.attributes.collection as ExpressionNode);
    const itemName = element.attributes.item as string;
    const indexName = element.attributes.index as string;
    
    const body = element.children.map(child => 
      this.generateElement(child as ElementNode)
    ).join(', ');
    
    if (indexName) {
      return `${collection}.map((${itemName}, ${indexName}) => [${body}])`;
    } else {
      return `${collection}.map(${itemName} => [${body}])`;
    }
  }

  private generateAnimation(element: ElementNode): string {
    const type = element.attributes.type;
    const duration = element.attributes.duration;
    
    this.helpers.add('animate');
    
    const children = element.children.map(child => 
      this.generateElement(child as ElementNode)
    ).join(', ');
    
    return `animate('${type}', ${duration}, [${children}])`;
  }

  private generateLayout(element: ElementNode): string {
    const layoutClass = `egh-${element.tag}`;
    const attrs = { ...element.attributes, class: layoutClass };
    
    const childrenCode = element.children.map(child => 
      this.generateElement(child as ElementNode)
    ).join(', ');
    
    return `h('div', ${this.generateAttributes(attrs, {})}, [${childrenCode}])`;
  }

  private generateAttributes(
    attributes: Record<string, any>, 
    events: Record<string, ExpressionNode>
  ): string {
    const attrs: string[] = [];
    
    // Regular attributes
    for (const [key, value] of Object.entries(attributes)) {
      if (typeof value === 'string') {
        attrs.push(`${key}: '${value}'`);
      } else {
        attrs.push(`${key}: ${this.generateExpression(value)}`);
      }
    }
    
    // Event handlers
    for (const [event, handler] of Object.entries(events)) {
      const handlerCode = this.generateExpression(handler);
      attrs.push(`on${capitalize(event)}: ${handlerCode}`);
    }
    
    return attrs.length > 0 ? `{ ${attrs.join(', ')} }` : 'null';
  }

  private generateChildren(children: any[]): string {
    if (children.length === 0) return 'null';
    
    const childrenCode = children.map(child => {
      if (child.type === 'Element') {
        return this.generateElement(child);
      } else if (child.type === 'Text') {
        return `'${child.value}'`;
      } else {
        return this.generateExpression(child);
      }
    }).join(', ');
    
    return `[${childrenCode}]`;
  }

  private generateExpression(expr: ExpressionNode): string {
    switch (expr.type) {
      case 'Literal':
        return JSON.stringify(expr.value);
      
      case 'Identifier':
        return expr.name;
      
      case 'BinaryExpression':
        return `(${this.generateExpression(expr.left)} ${expr.operator} ${this.generateExpression(expr.right)})`;
      
      case 'UnaryExpression':
        return `${expr.operator}${this.generateExpression(expr.argument)}`;
      
      case 'CallExpression':
        const callee = this.generateExpression(expr.callee);
        const args = expr.arguments.map(arg => this.generateExpression(arg)).join(', ');
        return `${callee}(${args})`;
      
      case 'MemberExpression':
        const object = this.generateExpression(expr.object);
        const property = expr.computed 
          ? `[${this.generateExpression(expr.property)}]`
          : `.${expr.property}`;
        return `${object}${property}`;
      
      case 'ConditionalExpression':
        return `(${this.generateExpression(expr.test)} ? ${this.generateExpression(expr.consequent)} : ${this.generateExpression(expr.alternate)})`;
      
      case 'ArrayExpression':
        const elements = expr.elements.map(el => 
          el ? this.generateExpression(el) : 'null'
        ).join(', ');
        return `[${elements}]`;
      
      case 'ObjectExpression':
        const props = expr.properties.map(prop => {
          const key = prop.computed 
            ? `[${this.generateExpression(prop.key)}]`
            : prop.key;
          const value = this.generateExpression(prop.value);
          return prop.shorthand ? key : `${key}: ${value}`;
        }).join(', ');
        return `{ ${props} }`;
      
      case 'FunctionExpression':
        const params = expr.params.map(p => p.name).join(', ');
        const body = Array.isArray(expr.body)
          ? `{ ${expr.body.map(stmt => this.generateStatement(stmt)).join('; ')} }`
          : this.generateExpression(expr.body);
        return `${expr.async ? 'async ' : ''}(${params}) => ${body}`;
      
      case 'PipeExpression':
        // Transform pipe to function call
        const left = this.generateExpression(expr.left);
        const right = this.generateExpression(expr.right);
        return `${right}(${left})`;
      
      default:
        return '/* TODO: ' + expr.type + ' */';
    }
  }

  private generateStatement(stmt: any): string {
    // Simplified statement generation
    if (stmt.type === 'ExpressionStatement') {
      return this.generateExpression(stmt.expression) + ';';
    }
    return '/* statement */';
  }

  private generateLifecycleMethods(): void {
    this.line('mount(container) {');
    this.indent();
    this.line('this._container = container;');
    this.line('this._render();');
    this.dedent();
    this.line('}');
    this.line('');
    
    this.line('unmount() {');
    this.indent();
    this.line('// Cleanup effects');
    this.line('this._cleanup();');
    this.dedent();
    this.line('}');
    this.line('');
  }

  private generateHelperMethods(): void {
    this.line('_bindMethods() {');
    this.indent();
    this.line('// Bind event handlers to this');
    this.dedent();
    this.line('}');
    this.line('');
    
    this.line('_render() {');
    this.indent();
    this.line('const vdom = this.render();');
    this.line('render(vdom, this._container);');
    this.dedent();
    this.line('}');
    this.line('');
    
    this.line('_cleanup() {');
    this.indent();
    this.line('// Cleanup logic');
    this.dedent();
    this.line('}');
  }

  private generateHelpers(): string[] {
    const helpers: string[] = [];
    
    if (this.helpers.has('animate')) {
      helpers.push(`
function animate(type, duration, children) {
  // Animation helper
  return h('div', { 
    class: \`animate-\${type}\`,
    style: \`animation-duration: \${duration}\`
  }, children);
}`);
    }
    
    return helpers;
  }

  // Utility methods
  private line(text: string): void {
    this.code.push(this.getIndent() + text);
  }

  private lines(text: string): void {
    this.code.push(text.split('\n').map(line => 
      this.getIndent() + line
    ).join('\n'));
  }

  private indent(): void {
    this.indentLevel++;
  }

  private dedent(): void {
    this.indentLevel--;
  }

  private getIndent(): string {
    return '  '.repeat(this.indentLevel);
  }

  private minify(code: string): string {
    // Simple minification - in production use a proper minifier
    return code
      .replace(/\s+/g, ' ')
      .replace(/\s*([{}();,:])\s*/g, '$1')
      .trim();
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
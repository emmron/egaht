/**
 * EGH (Eghact Hyperlanguage) Parser
 * Parses the revolutionary new syntax into AST
 */

import { Lexer, Token } from './lexer';
import { 
  ASTNode, 
  ComponentNode, 
  StateNode, 
  ComputedNode, 
  EffectNode,
  TemplateNode,
  ElementNode,
  ExpressionNode 
} from './ast-types';

export class EGHParser {
  private lexer: Lexer;
  private current: Token;
  private peek: Token | null;

  constructor(source: string) {
    this.lexer = new Lexer(source);
    this.current = this.lexer.nextToken();
    this.peek = this.lexer.peekToken();
  }

  parse(): ComponentNode {
    return this.parseComponent();
  }

  private parseComponent(): ComponentNode {
    this.expect('component');
    const name = this.expectIdentifier();
    
    // Parse props if present
    let props = [];
    if (this.match('(')) {
      props = this.parseProps();
      this.expect(')');
    }

    this.expect('{');

    const states: StateNode[] = [];
    const computed: ComputedNode[] = [];
    const effects: EffectNode[] = [];
    let template: TemplateNode | null = null;

    while (!this.match('}')) {
      // State declaration with ~
      if (this.match('~')) {
        states.push(this.parseState());
      }
      // Computed value with =>
      else if (this.peek?.type === '=>') {
        computed.push(this.parseComputed());
      }
      // Effect with ::
      else if (this.peek?.type === '::') {
        effects.push(this.parseEffect());
      }
      // Template with <[
      else if (this.match('<[')) {
        template = this.parseTemplate();
        this.expect(']>');
      }
      else {
        this.error(`Unexpected token: ${this.current.value}`);
      }
    }

    return {
      type: 'Component',
      name,
      props,
      states,
      computed,
      effects,
      template
    };
  }

  private parseState(): StateNode {
    const name = this.expectIdentifier();
    this.expect('=');
    const value = this.parseExpression();
    
    return {
      type: 'State',
      name,
      reactive: true,
      initialValue: value
    };
  }

  private parseComputed(): ComputedNode {
    const name = this.expectIdentifier();
    this.expect('=>');
    const expression = this.parseExpression();
    
    return {
      type: 'Computed',
      name,
      expression,
      dependencies: this.extractDependencies(expression)
    };
  }

  private parseEffect(): EffectNode {
    const trigger = this.expectIdentifier();
    this.expect('::');
    this.expect('{');
    
    const body: ASTNode[] = [];
    while (!this.match('}')) {
      body.push(this.parseStatement());
    }
    
    return {
      type: 'Effect',
      trigger,
      body,
      dependencies: [trigger]
    };
  }

  private parseTemplate(): TemplateNode {
    const elements: ElementNode[] = [];
    
    while (!this.check(']>')) {
      elements.push(this.parseElement());
    }
    
    return {
      type: 'Template',
      children: elements
    };
  }

  private parseElement(): ElementNode {
    // Handle conditionals with ?
    if (this.match('?')) {
      return this.parseConditional();
    }
    
    // Handle loops with *~
    if (this.match('*~')) {
      return this.parseLoop();
    }
    
    // Handle animations with @animate
    if (this.match('@animate')) {
      return this.parseAnimation();
    }
    
    // Handle layout primitives (row, column, grid)
    if (this.checkLayoutPrimitive()) {
      return this.parseLayout();
    }
    
    // Regular element
    const tag = this.expectIdentifier();
    
    // Parse attributes and events
    const attributes: Record<string, any> = {};
    const events: Record<string, ExpressionNode> = {};
    
    if (this.match('(')) {
      while (!this.match(')')) {
        if (this.match('@')) {
          // Event handler
          const eventName = this.expectIdentifier();
          this.expect(':');
          events[eventName] = this.parseExpression();
        } else {
          // Attribute
          const attrName = this.expectIdentifier();
          this.expect(':');
          attributes[attrName] = this.parseExpression();
        }
        
        if (!this.check(')')) {
          this.expect(',');
        }
      }
    }
    
    // Parse children
    const children: (ElementNode | ExpressionNode)[] = [];
    if (this.match('{')) {
      while (!this.match('}')) {
        if (this.checkElement()) {
          children.push(this.parseElement());
        } else {
          children.push(this.parseExpression());
        }
      }
    }
    
    return {
      type: 'Element',
      tag,
      attributes,
      events,
      children,
      directives: {}
    };
  }

  private parseConditional(): ElementNode {
    const condition = this.parseExpression();
    this.expect('{');
    
    const thenBranch: ElementNode[] = [];
    while (!this.match('}')) {
      thenBranch.push(this.parseElement());
    }
    
    let elseBranch: ElementNode[] | null = null;
    if (this.match(':')) {
      this.expect('{');
      elseBranch = [];
      while (!this.match('}')) {
        elseBranch.push(this.parseElement());
      }
    }
    
    return {
      type: 'Element',
      tag: 'conditional',
      attributes: { condition },
      events: {},
      children: thenBranch,
      directives: { else: elseBranch }
    };
  }

  private parseLoop(): ElementNode {
    const collection = this.parseExpression();
    this.expect('as');
    const itemName = this.expectIdentifier();
    
    let indexName: string | null = null;
    if (this.match(',')) {
      indexName = this.expectIdentifier();
    }
    
    this.expect('{');
    const body: ElementNode[] = [];
    while (!this.match('}')) {
      body.push(this.parseElement());
    }
    
    return {
      type: 'Element',
      tag: 'loop',
      attributes: { 
        collection,
        item: itemName,
        index: indexName 
      },
      events: {},
      children: body,
      directives: {}
    };
  }

  private parseAnimation(): ElementNode {
    this.expect('(');
    const animationType = this.expectIdentifier();
    this.expect(',');
    const duration = this.parseExpression();
    this.expect(')');
    
    this.expect('{');
    const children: ElementNode[] = [];
    while (!this.match('}')) {
      children.push(this.parseElement());
    }
    
    return {
      type: 'Element',
      tag: 'animate',
      attributes: {
        type: animationType,
        duration
      },
      events: {},
      children,
      directives: {}
    };
  }

  private parseLayout(): ElementNode {
    const layoutType = this.expectIdentifier(); // row, column, grid, layer
    
    const attributes: Record<string, any> = {};
    
    // Parse grid dimensions
    if (layoutType === 'grid' && this.match('(')) {
      const dimensions = this.parseExpression();
      attributes.dimensions = dimensions;
      this.expect(')');
    }
    
    this.expect('{');
    
    const children: ElementNode[] = [];
    
    if (layoutType === 'row') {
      // Parse pipe-separated flex items
      while (!this.match('}')) {
        children.push(this.parseElement());
        if (!this.check('}')) {
          this.expect('|');
        }
      }
    } else if (layoutType === 'layer') {
      // Parse positioned items
      while (!this.match('}')) {
        if (this.match('@')) {
          const position = this.expectIdentifier();
          this.expect('{');
          const element = this.parseElement();
          element.attributes.position = position;
          children.push(element);
          this.expect('}');
        }
      }
    } else {
      // Regular children
      while (!this.match('}')) {
        children.push(this.parseElement());
      }
    }
    
    return {
      type: 'Element',
      tag: layoutType,
      attributes,
      events: {},
      children,
      directives: { layout: true }
    };
  }

  private parseExpression(): ExpressionNode {
    // Parse expressions including:
    // - Literals
    // - Variables
    // - Binary operations
    // - Function calls
    // - Member access
    // - Pipe operators |>
    // - Two-way binding <~>
    
    // Simplified for now
    let expr = this.parsePrimary();
    
    // Handle pipe operator
    while (this.match('|>')) {
      const right = this.parsePrimary();
      expr = {
        type: 'PipeExpression',
        left: expr,
        right
      };
    }
    
    return expr;
  }

  private parsePrimary(): ExpressionNode {
    if (this.current.type === 'NUMBER') {
      const value = parseFloat(this.current.value);
      this.advance();
      return { type: 'Literal', value };
    }
    
    if (this.current.type === 'STRING') {
      const value = this.current.value;
      this.advance();
      return { type: 'Literal', value };
    }
    
    if (this.current.type === 'IDENTIFIER') {
      const name = this.current.value;
      this.advance();
      return { type: 'Identifier', name };
    }
    
    if (this.match('(')) {
      const expr = this.parseExpression();
      this.expect(')');
      return expr;
    }
    
    throw new Error(`Unexpected token: ${this.current.value}`);
  }

  private parseStatement(): ASTNode {
    // Parse statements in effect bodies
    return this.parseExpression();
  }

  private parseProps(): any[] {
    const props = [];
    
    while (!this.check(')')) {
      const name = this.expectIdentifier();
      let type = 'any';
      let defaultValue = null;
      let optional = false;
      
      if (this.match('?')) {
        optional = true;
      }
      
      if (this.match(':')) {
        type = this.parseType();
      }
      
      if (this.match('=')) {
        defaultValue = this.parseExpression();
      }
      
      props.push({ name, type, optional, defaultValue });
      
      if (!this.check(')')) {
        this.expect(',');
      }
    }
    
    return props;
  }

  private parseType(): string {
    // Simplified type parsing
    return this.expectIdentifier();
  }

  // Helper methods
  private match(expected: string): boolean {
    if (this.current.value === expected) {
      this.advance();
      return true;
    }
    return false;
  }

  private check(expected: string): boolean {
    return this.current.value === expected;
  }

  private expect(expected: string): void {
    if (!this.match(expected)) {
      this.error(`Expected '${expected}' but got '${this.current.value}'`);
    }
  }

  private expectIdentifier(): string {
    if (this.current.type !== 'IDENTIFIER') {
      this.error(`Expected identifier but got '${this.current.value}'`);
    }
    const value = this.current.value;
    this.advance();
    return value;
  }

  private advance(): void {
    this.current = this.lexer.nextToken();
    this.peek = this.lexer.peekToken();
  }

  private checkElement(): boolean {
    return this.current.type === 'IDENTIFIER' || 
           this.match('?') || 
           this.match('*~') ||
           this.match('@');
  }

  private checkLayoutPrimitive(): boolean {
    return ['row', 'column', 'grid', 'layer'].includes(this.current.value);
  }

  private extractDependencies(expr: ExpressionNode): string[] {
    // Extract variable dependencies from expression
    const deps: string[] = [];
    
    const walk = (node: any) => {
      if (node.type === 'Identifier') {
        deps.push(node.name);
      } else if (node.left) {
        walk(node.left);
      }
      if (node.right) {
        walk(node.right);
      }
    };
    
    walk(expr);
    return [...new Set(deps)];
  }

  private error(message: string): never {
    throw new Error(`Parse error at line ${this.lexer.line}: ${message}`);
  }
}
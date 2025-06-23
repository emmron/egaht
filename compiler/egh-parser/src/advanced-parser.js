/**
 * Advanced EGH Parser - Full support for Eghact Hyperlanguage
 * Handles all EGH features including reactive state, computed values, effects,
 * templates, two-way binding, conditionals, loops, and more.
 */

import { Lexer, TokenType } from './lexer.ts';

export const NodeType = {
  // Top level
  PROGRAM: 'Program',
  COMPONENT: 'ComponentDeclaration',
  IMPORT: 'ImportDeclaration',
  EXPORT: 'ExportDeclaration',
  
  // Component parts
  REACTIVE_STATE: 'ReactiveState',
  COMPUTED_VALUE: 'ComputedValue',
  EFFECT: 'Effect',
  METHOD: 'MethodDefinition',
  LIFECYCLE: 'LifecycleHook',
  
  // Template nodes
  TEMPLATE: 'Template',
  ELEMENT: 'Element',
  TEXT: 'TextNode',
  INTERPOLATION: 'Interpolation',
  
  // Layout nodes
  ROW: 'RowLayout',
  COLUMN: 'ColumnLayout',
  GRID: 'GridLayout',
  LAYER: 'LayerLayout',
  
  // Control flow
  CONDITIONAL: 'ConditionalExpression',
  FOR_LOOP: 'ForLoop',
  REACTIVE_LOOP: 'ReactiveLoop',
  MATCH_EXPRESSION: 'MatchExpression',
  MATCH_CASE: 'MatchCase',
  
  // Bindings
  ATTRIBUTE: 'Attribute',
  EVENT_HANDLER: 'EventHandler',
  TWO_WAY_BINDING: 'TwoWayBinding',
  DIRECTIVE: 'Directive',
  STYLE_BINDING: 'StyleBinding',
  CLASS_BINDING: 'ClassBinding',
  
  // Expressions
  IDENTIFIER: 'Identifier',
  LITERAL: 'Literal',
  BINARY_EXPRESSION: 'BinaryExpression',
  UNARY_EXPRESSION: 'UnaryExpression',
  CALL_EXPRESSION: 'CallExpression',
  MEMBER_EXPRESSION: 'MemberExpression',
  ARRAY_EXPRESSION: 'ArrayExpression',
  OBJECT_EXPRESSION: 'ObjectExpression',
  ARROW_FUNCTION: 'ArrowFunction',
  PIPELINE: 'PipelineExpression',
  SPREAD: 'SpreadElement',
  
  // Special
  SLOT: 'SlotOutlet',
  FRAGMENT: 'Fragment',
  DYNAMIC_COMPONENT: 'DynamicComponent',
  LAZY_COMPONENT: 'LazyComponent',
  PORTAL: 'Portal',
  TRANSITION: 'Transition',
  ANIMATION: 'Animation',
  
  // Type system
  TYPE_ANNOTATION: 'TypeAnnotation',
  TYPE_DEFINITION: 'TypeDefinition',
  INTERFACE: 'InterfaceDeclaration',
  
  // Modifiers
  MEMOIZED: 'MemoizedExpression',
  STATIC: 'StaticExpression',
  ASYNC: 'AsyncExpression',
  WORKER: 'WorkerExpression',
  AI_COMPONENT: 'AIComponent'
};

export class AdvancedEGHParser {
  constructor(source) {
    this.lexer = new Lexer(source);
    this.current = null;
    this.previous = null;
    this.advance();
  }
  
  parse() {
    const program = {
      type: NodeType.PROGRAM,
      body: [],
      imports: [],
      exports: []
    };
    
    while (!this.isAtEnd()) {
      const declaration = this.topLevelDeclaration();
      
      if (declaration.type === NodeType.IMPORT) {
        program.imports.push(declaration);
      } else if (declaration.type === NodeType.EXPORT) {
        program.exports.push(declaration);
      } else {
        program.body.push(declaration);
      }
    }
    
    return program;
  }
  
  topLevelDeclaration() {
    // Import statements
    if (this.match(TokenType.IMPORT)) {
      return this.importDeclaration();
    }
    
    // Export statements
    if (this.match(TokenType.EXPORT)) {
      return this.exportDeclaration();
    }
    
    // Component declaration
    if (this.match(TokenType.COMPONENT)) {
      return this.componentDeclaration();
    }
    
    // Type definitions
    if (this.match(TokenType.TYPE)) {
      return this.typeDefinition();
    }
    
    throw this.error('Expected top-level declaration');
  }
  
  componentDeclaration() {
    const name = this.consume(TokenType.IDENTIFIER, 'Expected component name');
    
    // Parse parameters
    let params = [];
    if (this.match(TokenType.LEFT_PAREN)) {
      params = this.parameterList();
      this.consume(TokenType.RIGHT_PAREN, 'Expected ) after parameters');
    }
    
    this.consume(TokenType.LEFT_BRACE, 'Expected { to begin component body');
    
    const component = {
      type: NodeType.COMPONENT,
      name: name.value,
      params,
      state: [],
      computed: [],
      effects: [],
      methods: [],
      lifecycle: [],
      template: null
    };
    
    // Parse component body
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      // Reactive state
      if (this.match(TokenType.REACTIVE)) {
        component.state.push(this.reactiveStateDeclaration());
      }
      // Computed values
      else if (this.checkComputed()) {
        component.computed.push(this.computedDeclaration());
      }
      // Effects
      else if (this.checkEffect()) {
        component.effects.push(this.effectDeclaration());
      }
      // Template
      else if (this.check(TokenType.TEMPLATE_START)) {
        component.template = this.template();
      }
      // Methods
      else if (this.checkMethod()) {
        component.methods.push(this.methodDeclaration());
      }
      // Lifecycle hooks
      else if (this.checkLifecycle()) {
        component.lifecycle.push(this.lifecycleHook());
      }
      else {
        throw this.error('Unexpected token in component body');
      }
    }
    
    this.consume(TokenType.RIGHT_BRACE, 'Expected } to close component');
    
    return component;
  }
  
  reactiveStateDeclaration() {
    const name = this.consume(TokenType.IDENTIFIER, 'Expected state variable name');
    this.consume(TokenType.EQUALS, 'Expected = after state name');
    const initialValue = this.expression();
    
    return {
      type: NodeType.REACTIVE_STATE,
      name: name.value,
      initialValue
    };
  }
  
  computedDeclaration() {
    const name = this.consume(TokenType.IDENTIFIER, 'Expected computed property name');
    this.consume(TokenType.ARROW, 'Expected => for computed value');
    const expression = this.expression();
    
    return {
      type: NodeType.COMPUTED_VALUE,
      name: name.value,
      expression
    };
  }
  
  effectDeclaration() {
    const dependencies = [];
    
    // Parse dependencies
    do {
      dependencies.push(this.consume(TokenType.IDENTIFIER, 'Expected dependency name').value);
    } while (this.match(TokenType.COMMA));
    
    this.consume(TokenType.EFFECT, 'Expected :: for effect');
    this.consume(TokenType.LEFT_BRACE, 'Expected { for effect body');
    
    const body = [];
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      body.push(this.statement());
    }
    
    this.consume(TokenType.RIGHT_BRACE, 'Expected } to close effect');
    
    return {
      type: NodeType.EFFECT,
      dependencies,
      body
    };
  }
  
  template() {
    this.consume(TokenType.TEMPLATE_START, 'Expected <[');
    
    const children = [];
    while (!this.check(TokenType.TEMPLATE_END) && !this.isAtEnd()) {
      children.push(this.templateNode());
    }
    
    this.consume(TokenType.TEMPLATE_END, 'Expected ]>');
    
    return {
      type: NodeType.TEMPLATE,
      children
    };
  }
  
  templateNode() {
    // Layout elements
    if (this.match(TokenType.ROW)) {
      return this.rowLayout();
    }
    if (this.match(TokenType.COLUMN)) {
      return this.columnLayout();
    }
    if (this.match(TokenType.GRID)) {
      return this.gridLayout();
    }
    if (this.match(TokenType.LAYER)) {
      return this.layerLayout();
    }
    
    // Conditionals
    if (this.match(TokenType.CONDITIONAL)) {
      return this.conditional();
    }
    
    // Reactive loops
    if (this.match(TokenType.REACTIVE_LOOP)) {
      return this.reactiveLoop();
    }
    
    // Lazy loading
    if (this.match(TokenType.LAZY_LOAD)) {
      return this.lazyComponent();
    }
    
    // Directives
    if (this.match(TokenType.AT)) {
      return this.directive();
    }
    
    // Memoization
    if (this.match(TokenType.HASH)) {
      return this.memoizedBlock();
    }
    
    // Static optimization
    if (this.match(TokenType.EXCLAMATION)) {
      if (this.match(TokenType.IDENTIFIER) && this.previous.value === 'static') {
        return this.staticBlock();
      }
      this.back();
    }
    
    // Regular elements
    if (this.check(TokenType.IDENTIFIER)) {
      return this.element();
    }
    
    // Text interpolation
    if (this.check(TokenType.LEFT_BRACE)) {
      return this.interpolation();
    }
    
    // String literals become text nodes
    if (this.match(TokenType.STRING)) {
      return {
        type: NodeType.TEXT,
        value: this.previous.value
      };
    }
    
    throw this.error('Expected template node');
  }
  
  element() {
    const tagName = this.consume(TokenType.IDENTIFIER, 'Expected element name');
    
    const element = {
      type: NodeType.ELEMENT,
      tag: tagName.value,
      attributes: [],
      directives: [],
      events: [],
      children: [],
      twoWayBindings: [],
      styles: [],
      classes: []
    };
    
    // Two-way binding shorthand
    if (this.match(TokenType.TWO_WAY)) {
      const binding = this.consume(TokenType.IDENTIFIER, 'Expected binding target');
      element.twoWayBindings.push({
        type: NodeType.TWO_WAY_BINDING,
        target: binding.value
      });
    }
    
    // Parse attributes in parentheses
    if (this.match(TokenType.LEFT_PAREN)) {
      this.parseElementAttributes(element);
      this.consume(TokenType.RIGHT_PAREN, 'Expected )');
    }
    
    // Parse content in braces
    if (this.match(TokenType.LEFT_BRACE)) {
      this.parseElementContent(element);
      this.consume(TokenType.RIGHT_BRACE, 'Expected }');
    }
    
    return element;
  }
  
  parseElementAttributes(element) {
    while (!this.check(TokenType.RIGHT_PAREN) && !this.isAtEnd()) {
      // Event handlers (@event)
      if (this.match(TokenType.AT)) {
        const eventName = this.parseEventName();
        this.consume(TokenType.COLON, 'Expected : after event name');
        const handler = this.expression();
        
        element.events.push({
          type: NodeType.EVENT_HANDLER,
          name: eventName,
          handler
        });
      }
      // Style bindings ($style)
      else if (this.match(TokenType.DOLLAR)) {
        const styleName = this.consume(TokenType.IDENTIFIER, 'Expected style property');
        this.consume(TokenType.COLON, 'Expected : after style name');
        const value = this.expression();
        
        element.styles.push({
          type: NodeType.STYLE_BINDING,
          property: styleName.value,
          value
        });
      }
      // Class bindings (.class)
      else if (this.match(TokenType.DOT)) {
        const className = this.consume(TokenType.IDENTIFIER, 'Expected class name');
        this.consume(TokenType.COLON, 'Expected : after class name');
        const condition = this.expression();
        
        element.classes.push({
          type: NodeType.CLASS_BINDING,
          name: className.value,
          condition
        });
      }
      // Regular attributes
      else {
        const name = this.consume(TokenType.IDENTIFIER, 'Expected attribute name');
        this.consume(TokenType.COLON, 'Expected : after attribute');
        const value = this.expression();
        
        element.attributes.push({
          type: NodeType.ATTRIBUTE,
          name: name.value,
          value
        });
      }
      
      if (!this.match(TokenType.COMMA)) break;
    }
  }
  
  parseElementContent(element) {
    // Check if it's a single expression (text content)
    if (!this.checkTemplateNode()) {
      const expr = this.expression();
      element.children.push({
        type: NodeType.INTERPOLATION,
        expression: expr
      });
      return;
    }
    
    // Parse child nodes
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      element.children.push(this.templateNode());
    }
  }
  
  parseEventName() {
    let name = this.consume(TokenType.IDENTIFIER, 'Expected event name').value;
    
    // Handle event modifiers
    const modifiers = [];
    while (this.match(TokenType.DOT)) {
      const modifier = this.consume(TokenType.IDENTIFIER, 'Expected modifier').value;
      modifiers.push(modifier);
    }
    
    if (modifiers.length > 0) {
      return { name, modifiers };
    }
    
    return name;
  }
  
  rowLayout() {
    this.consume(TokenType.LEFT_BRACE, 'Expected {');
    
    const children = [];
    const flexItems = [];
    
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      // Check for pipe separator
      if (this.match(TokenType.PIPE_CHAR)) {
        flexItems.push(children.length);
        continue;
      }
      
      children.push(this.templateNode());
    }
    
    this.consume(TokenType.RIGHT_BRACE, 'Expected }');
    
    return {
      type: NodeType.ROW,
      children,
      flexItems
    };
  }
  
  columnLayout() {
    this.consume(TokenType.LEFT_BRACE, 'Expected {');
    
    const children = [];
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      children.push(this.templateNode());
    }
    
    this.consume(TokenType.RIGHT_BRACE, 'Expected }');
    
    return {
      type: NodeType.COLUMN,
      children
    };
  }
  
  gridLayout() {
    let rows = null;
    let cols = null;
    
    // Parse grid dimensions
    if (this.match(TokenType.LEFT_PAREN)) {
      const dimension = this.consume(TokenType.IDENTIFIER, 'Expected grid dimension');
      if (dimension.value.includes('x')) {
        const [r, c] = dimension.value.split('x');
        rows = parseInt(r);
        cols = parseInt(c);
      }
      this.consume(TokenType.RIGHT_PAREN, 'Expected )');
    }
    
    this.consume(TokenType.LEFT_BRACE, 'Expected {');
    
    const children = [];
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      children.push(this.templateNode());
    }
    
    this.consume(TokenType.RIGHT_BRACE, 'Expected }');
    
    return {
      type: NodeType.GRID,
      rows,
      cols,
      children
    };
  }
  
  layerLayout() {
    this.consume(TokenType.LEFT_BRACE, 'Expected {');
    
    const children = [];
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      // Positioned elements
      if (this.match(TokenType.AT)) {
        const position = this.parsePosition();
        this.consume(TokenType.LEFT_BRACE, 'Expected {');
        const child = this.templateNode();
        this.consume(TokenType.RIGHT_BRACE, 'Expected }');
        
        children.push({
          type: 'PositionedElement',
          position,
          child
        });
      } else {
        children.push(this.templateNode());
      }
    }
    
    this.consume(TokenType.RIGHT_BRACE, 'Expected }');
    
    return {
      type: NodeType.LAYER,
      children
    };
  }
  
  conditional() {
    const test = this.expression();
    this.consume(TokenType.LEFT_BRACE, 'Expected {');
    
    const consequent = [];
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      consequent.push(this.templateNode());
    }
    
    this.consume(TokenType.RIGHT_BRACE, 'Expected }');
    
    let alternate = null;
    if (this.match(TokenType.COLON)) {
      this.consume(TokenType.LEFT_BRACE, 'Expected {');
      alternate = [];
      while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
        alternate.push(this.templateNode());
      }
      this.consume(TokenType.RIGHT_BRACE, 'Expected }');
    }
    
    return {
      type: NodeType.CONDITIONAL,
      test,
      consequent,
      alternate
    };
  }
  
  reactiveLoop() {
    const collection = this.expression();
    this.consume(TokenType.AS, 'Expected as');
    
    const itemName = this.consume(TokenType.IDENTIFIER, 'Expected item name').value;
    let indexName = null;
    
    if (this.match(TokenType.COMMA)) {
      indexName = this.consume(TokenType.IDENTIFIER, 'Expected index name').value;
    }
    
    this.consume(TokenType.LEFT_BRACE, 'Expected {');
    
    const body = [];
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      body.push(this.templateNode());
    }
    
    this.consume(TokenType.RIGHT_BRACE, 'Expected }');
    
    return {
      type: NodeType.REACTIVE_LOOP,
      collection,
      itemName,
      indexName,
      body
    };
  }
  
  interpolation() {
    this.consume(TokenType.LEFT_BRACE, 'Expected {');
    const expression = this.expression();
    this.consume(TokenType.RIGHT_BRACE, 'Expected }');
    
    return {
      type: NodeType.INTERPOLATION,
      expression
    };
  }
  
  // Expression parsing
  expression() {
    return this.pipeline();
  }
  
  pipeline() {
    let expr = this.ternary();
    
    while (this.match(TokenType.PIPE)) {
      const transforms = [];
      do {
        transforms.push(this.ternary());
      } while (this.match(TokenType.PIPE));
      
      expr = {
        type: NodeType.PIPELINE,
        expression: expr,
        transforms
      };
    }
    
    return expr;
  }
  
  ternary() {
    let expr = this.nullishCoalescing();
    
    if (this.match(TokenType.CONDITIONAL)) {
      const consequent = this.expression();
      this.consume(TokenType.COLON, 'Expected : in ternary');
      const alternate = this.ternary();
      
      return {
        type: NodeType.CONDITIONAL,
        test: expr,
        consequent,
        alternate
      };
    }
    
    return expr;
  }
  
  nullishCoalescing() {
    let expr = this.logicalOr();
    
    while (this.match(TokenType.NULLISH_COALESCE)) {
      const operator = this.previous.value;
      const right = this.logicalOr();
      expr = {
        type: NodeType.BINARY_EXPRESSION,
        operator,
        left: expr,
        right
      };
    }
    
    return expr;
  }
  
  logicalOr() {
    let expr = this.logicalAnd();
    
    while (this.match(TokenType.OR)) {
      const operator = this.previous.value;
      const right = this.logicalAnd();
      expr = {
        type: NodeType.BINARY_EXPRESSION,
        operator,
        left: expr,
        right
      };
    }
    
    return expr;
  }
  
  logicalAnd() {
    let expr = this.equality();
    
    while (this.match(TokenType.AND)) {
      const operator = this.previous.value;
      const right = this.equality();
      expr = {
        type: NodeType.BINARY_EXPRESSION,
        operator,
        left: expr,
        right
      };
    }
    
    return expr;
  }
  
  equality() {
    let expr = this.relational();
    
    while (this.match(TokenType.EQUAL, TokenType.NOT_EQUAL,
                      TokenType.STRICT_EQUAL, TokenType.STRICT_NOT_EQUAL)) {
      const operator = this.previous.value;
      const right = this.relational();
      expr = {
        type: NodeType.BINARY_EXPRESSION,
        operator,
        left: expr,
        right
      };
    }
    
    return expr;
  }
  
  relational() {
    let expr = this.additive();
    
    while (this.match(TokenType.LESS_THAN, TokenType.GREATER_THAN,
                      TokenType.LESS_EQUAL, TokenType.GREATER_EQUAL)) {
      const operator = this.previous.value;
      const right = this.additive();
      expr = {
        type: NodeType.BINARY_EXPRESSION,
        operator,
        left: expr,
        right
      };
    }
    
    return expr;
  }
  
  additive() {
    let expr = this.multiplicative();
    
    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const operator = this.previous.value;
      const right = this.multiplicative();
      expr = {
        type: NodeType.BINARY_EXPRESSION,
        operator,
        left: expr,
        right
      };
    }
    
    return expr;
  }
  
  multiplicative() {
    let expr = this.unary();
    
    while (this.match(TokenType.MULTIPLY, TokenType.DIVIDE, TokenType.MODULO)) {
      const operator = this.previous.value;
      const right = this.unary();
      expr = {
        type: NodeType.BINARY_EXPRESSION,
        operator,
        left: expr,
        right
      };
    }
    
    return expr;
  }
  
  unary() {
    if (this.match(TokenType.NOT, TokenType.MINUS, TokenType.PLUS)) {
      const operator = this.previous.value;
      const operand = this.unary();
      return {
        type: NodeType.UNARY_EXPRESSION,
        operator,
        operand
      };
    }
    
    return this.postfix();
  }
  
  postfix() {
    let expr = this.call();
    
    // Handle optional chaining
    while (true) {
      if (this.match(TokenType.OPTIONAL_CHAIN)) {
        const property = this.consume(TokenType.IDENTIFIER, 'Expected property');
        expr = {
          type: NodeType.MEMBER_EXPRESSION,
          object: expr,
          property: property.value,
          computed: false,
          optional: true
        };
      } else {
        break;
      }
    }
    
    return expr;
  }
  
  call() {
    let expr = this.member();
    
    while (true) {
      if (this.match(TokenType.LEFT_PAREN)) {
        expr = this.finishCall(expr);
      } else {
        break;
      }
    }
    
    return expr;
  }
  
  finishCall(callee) {
    const args = [];
    
    if (!this.check(TokenType.RIGHT_PAREN)) {
      do {
        if (this.match(TokenType.SPREAD)) {
          args.push({
            type: NodeType.SPREAD,
            argument: this.expression()
          });
        } else {
          args.push(this.expression());
        }
      } while (this.match(TokenType.COMMA));
    }
    
    this.consume(TokenType.RIGHT_PAREN, 'Expected )');
    
    return {
      type: NodeType.CALL_EXPRESSION,
      callee,
      arguments: args
    };
  }
  
  member() {
    let expr = this.primary();
    
    while (true) {
      if (this.match(TokenType.DOT)) {
        const property = this.consume(TokenType.IDENTIFIER, 'Expected property');
        expr = {
          type: NodeType.MEMBER_EXPRESSION,
          object: expr,
          property: property.value,
          computed: false,
          optional: false
        };
      } else if (this.match(TokenType.LEFT_BRACKET)) {
        const property = this.expression();
        this.consume(TokenType.RIGHT_BRACKET, 'Expected ]');
        expr = {
          type: NodeType.MEMBER_EXPRESSION,
          object: expr,
          property,
          computed: true,
          optional: false
        };
      } else {
        break;
      }
    }
    
    return expr;
  }
  
  primary() {
    // Literals
    if (this.match(TokenType.TRUE)) {
      return { type: NodeType.LITERAL, value: true };
    }
    if (this.match(TokenType.FALSE)) {
      return { type: NodeType.LITERAL, value: false };
    }
    if (this.match(TokenType.NULL)) {
      return { type: NodeType.LITERAL, value: null };
    }
    if (this.match(TokenType.UNDEFINED)) {
      return { type: NodeType.LITERAL, value: undefined };
    }
    if (this.match(TokenType.NUMBER, TokenType.STRING)) {
      return { type: NodeType.LITERAL, value: this.previous.value };
    }
    
    // Identifiers
    if (this.match(TokenType.IDENTIFIER)) {
      return { type: NodeType.IDENTIFIER, name: this.previous.value };
    }
    
    // Array literals
    if (this.match(TokenType.LEFT_BRACKET)) {
      const elements = [];
      
      if (!this.check(TokenType.RIGHT_BRACKET)) {
        do {
          if (this.match(TokenType.SPREAD)) {
            elements.push({
              type: NodeType.SPREAD,
              argument: this.expression()
            });
          } else {
            elements.push(this.expression());
          }
        } while (this.match(TokenType.COMMA));
      }
      
      this.consume(TokenType.RIGHT_BRACKET, 'Expected ]');
      
      return {
        type: NodeType.ARRAY_EXPRESSION,
        elements
      };
    }
    
    // Object literals
    if (this.match(TokenType.LEFT_BRACE)) {
      const properties = [];
      
      if (!this.check(TokenType.RIGHT_BRACE)) {
        do {
          if (this.match(TokenType.SPREAD)) {
            properties.push({
              type: NodeType.SPREAD,
              argument: this.expression()
            });
          } else {
            const key = this.consume(TokenType.IDENTIFIER, 'Expected property key');
            this.consume(TokenType.COLON, 'Expected :');
            const value = this.expression();
            
            properties.push({
              type: 'Property',
              key: key.value,
              value
            });
          }
        } while (this.match(TokenType.COMMA));
      }
      
      this.consume(TokenType.RIGHT_BRACE, 'Expected }');
      
      return {
        type: NodeType.OBJECT_EXPRESSION,
        properties
      };
    }
    
    // Arrow functions
    if (this.match(TokenType.LEFT_PAREN)) {
      // Could be grouped expression or arrow function
      const params = [];
      
      if (!this.check(TokenType.RIGHT_PAREN)) {
        do {
          params.push(this.consume(TokenType.IDENTIFIER, 'Expected parameter').value);
        } while (this.match(TokenType.COMMA));
      }
      
      this.consume(TokenType.RIGHT_PAREN, 'Expected )');
      
      if (this.match(TokenType.ARROW)) {
        // Arrow function
        let body;
        if (this.match(TokenType.LEFT_BRACE)) {
          // Block body
          const statements = [];
          while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
            statements.push(this.statement());
          }
          this.consume(TokenType.RIGHT_BRACE, 'Expected }');
          body = { type: 'BlockStatement', body: statements };
        } else {
          // Expression body
          body = this.expression();
        }
        
        return {
          type: NodeType.ARROW_FUNCTION,
          params,
          body
        };
      } else if (params.length === 1) {
        // Grouped expression
        return { type: NodeType.IDENTIFIER, name: params[0] };
      } else {
        throw this.error('Expected arrow after parameters');
      }
    }
    
    // Template strings
    if (this.match(TokenType.TEMPLATE_STRING)) {
      return { type: NodeType.LITERAL, value: this.previous.value, template: true };
    }
    
    throw this.error('Expected expression');
  }
  
  // Statement parsing (for effects and methods)
  statement() {
    // Simple expression statement for now
    const expr = this.expression();
    return {
      type: 'ExpressionStatement',
      expression: expr
    };
  }
  
  // Helper methods
  methodDeclaration() {
    const name = this.consume(TokenType.IDENTIFIER, 'Expected method name');
    
    // Arrow function method
    if (this.match(TokenType.ARROW)) {
      const value = this.arrowFunction();
      return {
        type: NodeType.METHOD,
        name: name.value,
        value
      };
    }
    
    throw this.error('Expected => for method');
  }
  
  arrowFunction() {
    let params = [];
    
    if (this.match(TokenType.LEFT_PAREN)) {
      if (!this.check(TokenType.RIGHT_PAREN)) {
        do {
          params.push(this.consume(TokenType.IDENTIFIER, 'Expected parameter').value);
        } while (this.match(TokenType.COMMA));
      }
      this.consume(TokenType.RIGHT_PAREN, 'Expected )');
    }
    
    this.consume(TokenType.ARROW, 'Expected =>');
    
    let body;
    if (this.match(TokenType.LEFT_BRACE)) {
      const statements = [];
      while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
        statements.push(this.statement());
      }
      this.consume(TokenType.RIGHT_BRACE, 'Expected }');
      body = { type: 'BlockStatement', body: statements };
    } else {
      body = this.expression();
    }
    
    return {
      type: NodeType.ARROW_FUNCTION,
      params,
      body
    };
  }
  
  parameterList() {
    const params = [];
    
    if (!this.check(TokenType.RIGHT_PAREN)) {
      do {
        const name = this.consume(TokenType.IDENTIFIER, 'Expected parameter name');
        let type = null;
        let defaultValue = null;
        let optional = false;
        
        // Type annotation
        if (this.match(TokenType.COLON)) {
          type = this.typeAnnotation();
        }
        
        // Optional parameter
        if (this.match(TokenType.CONDITIONAL)) {
          optional = true;
        }
        
        // Default value
        if (this.match(TokenType.EQUALS)) {
          defaultValue = this.expression();
        }
        
        params.push({
          name: name.value,
          type,
          defaultValue,
          optional
        });
      } while (this.match(TokenType.COMMA));
    }
    
    return params;
  }
  
  typeAnnotation() {
    // Simple type annotation for now
    const type = this.consume(TokenType.IDENTIFIER, 'Expected type');
    return {
      type: NodeType.TYPE_ANNOTATION,
      name: type.value
    };
  }
  
  parsePosition() {
    const parts = [];
    parts.push(this.consume(TokenType.IDENTIFIER, 'Expected position').value);
    
    while (this.match(TokenType.MINUS)) {
      parts.push(this.consume(TokenType.IDENTIFIER, 'Expected position part').value);
    }
    
    return parts.join('-');
  }
  
  // Utility methods
  checkComputed() {
    if (this.check(TokenType.IDENTIFIER)) {
      const next = this.lexer.peekToken();
      return next && next.type === TokenType.ARROW;
    }
    return false;
  }
  
  checkEffect() {
    if (this.check(TokenType.IDENTIFIER)) {
      const next = this.lexer.peekToken();
      return next && next.type === TokenType.EFFECT;
    }
    return false;
  }
  
  checkMethod() {
    if (this.check(TokenType.IDENTIFIER)) {
      const next = this.lexer.peekToken();
      return next && (next.type === TokenType.ARROW || next.type === TokenType.LEFT_PAREN);
    }
    return false;
  }
  
  checkLifecycle() {
    if (this.check(TokenType.IDENTIFIER)) {
      const name = this.current.value;
      return ['onMount', 'onUpdate', 'onDestroy', 'beforeUpdate', 'afterUpdate'].includes(name);
    }
    return false;
  }
  
  checkTemplateNode() {
    return this.check(TokenType.ROW) ||
           this.check(TokenType.COLUMN) ||
           this.check(TokenType.GRID) ||
           this.check(TokenType.LAYER) ||
           this.check(TokenType.CONDITIONAL) ||
           this.check(TokenType.REACTIVE_LOOP) ||
           this.check(TokenType.AT) ||
           this.check(TokenType.IDENTIFIER) ||
           this.check(TokenType.STRING) ||
           this.check(TokenType.LEFT_BRACE) ||
           this.check(TokenType.HASH) ||
           this.check(TokenType.EXCLAMATION);
  }
  
  lifecycleHook() {
    const name = this.consume(TokenType.IDENTIFIER, 'Expected lifecycle hook name');
    this.consume(TokenType.LEFT_PAREN, 'Expected (');
    this.consume(TokenType.RIGHT_PAREN, 'Expected )');
    this.consume(TokenType.LEFT_BRACE, 'Expected {');
    
    const body = [];
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      body.push(this.statement());
    }
    
    this.consume(TokenType.RIGHT_BRACE, 'Expected }');
    
    return {
      type: NodeType.LIFECYCLE,
      name: name.value,
      body
    };
  }
  
  importDeclaration() {
    const specifiers = [];
    let source;
    
    // Default import
    if (this.check(TokenType.IDENTIFIER)) {
      const name = this.advance();
      specifiers.push({
        type: 'ImportDefaultSpecifier',
        local: name.value
      });
      
      if (this.match(TokenType.COMMA)) {
        // Named imports after default
        this.consume(TokenType.LEFT_BRACE, 'Expected {');
        this.parseNamedImports(specifiers);
        this.consume(TokenType.RIGHT_BRACE, 'Expected }');
      }
    }
    // Named imports
    else if (this.match(TokenType.LEFT_BRACE)) {
      this.parseNamedImports(specifiers);
      this.consume(TokenType.RIGHT_BRACE, 'Expected }');
    }
    // Namespace import
    else if (this.match(TokenType.MULTIPLY)) {
      this.consume(TokenType.AS, 'Expected as');
      const name = this.consume(TokenType.IDENTIFIER, 'Expected name');
      specifiers.push({
        type: 'ImportNamespaceSpecifier',
        local: name.value
      });
    }
    
    this.consume(TokenType.FROM, 'Expected from');
    source = this.consume(TokenType.STRING, 'Expected import source');
    
    return {
      type: NodeType.IMPORT,
      specifiers,
      source: source.value
    };
  }
  
  parseNamedImports(specifiers) {
    do {
      const imported = this.consume(TokenType.IDENTIFIER, 'Expected import name');
      let local = imported.value;
      
      if (this.match(TokenType.AS)) {
        const alias = this.consume(TokenType.IDENTIFIER, 'Expected alias');
        local = alias.value;
      }
      
      specifiers.push({
        type: 'ImportSpecifier',
        imported: imported.value,
        local
      });
    } while (this.match(TokenType.COMMA));
  }
  
  exportDeclaration() {
    let declaration;
    
    // export default
    if (this.match(TokenType.IDENTIFIER) && this.previous.value === 'default') {
      declaration = this.expression();
      return {
        type: NodeType.EXPORT,
        declaration,
        default: true
      };
    }
    
    // export component/type/const
    if (this.check(TokenType.COMPONENT) || this.check(TokenType.TYPE)) {
      declaration = this.topLevelDeclaration();
      return {
        type: NodeType.EXPORT,
        declaration,
        default: false
      };
    }
    
    throw this.error('Invalid export');
  }
  
  typeDefinition() {
    const name = this.consume(TokenType.IDENTIFIER, 'Expected type name');
    
    if (this.match(TokenType.EQUALS)) {
      // Type alias
      const type = this.typeExpression();
      return {
        type: NodeType.TYPE_DEFINITION,
        name: name.value,
        value: type
      };
    }
    
    this.consume(TokenType.LEFT_BRACE, 'Expected {');
    
    const properties = [];
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      const propName = this.consume(TokenType.IDENTIFIER, 'Expected property name');
      this.consume(TokenType.COLON, 'Expected :');
      const propType = this.typeExpression();
      
      properties.push({
        name: propName.value,
        type: propType,
        optional: false // TODO: handle optional properties
      });
      
      if (!this.match(TokenType.COMMA)) break;
    }
    
    this.consume(TokenType.RIGHT_BRACE, 'Expected }');
    
    return {
      type: NodeType.TYPE_DEFINITION,
      name: name.value,
      properties
    };
  }
  
  typeExpression() {
    // Simple type expressions for now
    if (this.match(TokenType.IDENTIFIER)) {
      const name = this.previous.value;
      
      // Array type
      if (this.match(TokenType.LEFT_BRACKET)) {
        this.consume(TokenType.RIGHT_BRACKET, 'Expected ]');
        return {
          type: 'ArrayType',
          elementType: { type: 'TypeReference', name }
        };
      }
      
      return { type: 'TypeReference', name };
    }
    
    // Literal types
    if (this.match(TokenType.STRING, TokenType.NUMBER, TokenType.TRUE, TokenType.FALSE)) {
      return {
        type: 'LiteralType',
        value: this.previous.value
      };
    }
    
    throw this.error('Expected type');
  }
  
  memoizedBlock() {
    const id = this.consume(TokenType.IDENTIFIER, 'Expected memoization id').value;
    this.consume(TokenType.LEFT_BRACE, 'Expected {');
    
    const children = [];
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      children.push(this.templateNode());
    }
    
    this.consume(TokenType.RIGHT_BRACE, 'Expected }');
    
    return {
      type: NodeType.MEMOIZED,
      id,
      children
    };
  }
  
  staticBlock() {
    this.consume(TokenType.LEFT_BRACE, 'Expected {');
    
    const children = [];
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      children.push(this.templateNode());
    }
    
    this.consume(TokenType.RIGHT_BRACE, 'Expected }');
    
    return {
      type: NodeType.STATIC,
      children
    };
  }
  
  lazyComponent() {
    const component = this.consume(TokenType.IDENTIFIER, 'Expected component name');
    
    let props = null;
    if (this.match(TokenType.LEFT_PAREN)) {
      props = {};
      while (!this.check(TokenType.RIGHT_PAREN) && !this.isAtEnd()) {
        const key = this.consume(TokenType.IDENTIFIER, 'Expected prop name');
        this.consume(TokenType.COLON, 'Expected :');
        const value = this.expression();
        props[key.value] = value;
        
        if (!this.match(TokenType.COMMA)) break;
      }
      this.consume(TokenType.RIGHT_PAREN, 'Expected )');
    }
    
    return {
      type: NodeType.LAZY_COMPONENT,
      component: component.value,
      props
    };
  }
  
  directive() {
    const name = this.consume(TokenType.IDENTIFIER, 'Expected directive name').value;
    
    // Handle different directive types
    switch (name) {
      case 'platform':
        return this.platformDirective();
      case 'worker':
        return this.workerDirective();
      case 'animate':
        return this.animateDirective();
      case 'transition':
        return this.transitionDirective();
      case 'virtual':
        return this.virtualDirective();
      case 'ai':
        return this.aiDirective();
      case 'flex':
        return this.flexDirective();
      case 'top':
      case 'bottom':
      case 'left':
      case 'right':
      case 'center':
        return this.positionDirective(name);
      default:
        // Generic directive
        return this.genericDirective(name);
    }
  }
  
  platformDirective() {
    this.consume(TokenType.LEFT_PAREN, 'Expected (');
    const platform = this.consume(TokenType.STRING, 'Expected platform name');
    this.consume(TokenType.RIGHT_PAREN, 'Expected )');
    this.consume(TokenType.LEFT_BRACE, 'Expected {');
    
    const children = [];
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      children.push(this.templateNode());
    }
    
    this.consume(TokenType.RIGHT_BRACE, 'Expected }');
    
    return {
      type: NodeType.DIRECTIVE,
      name: 'platform',
      value: platform.value,
      children
    };
  }
  
  workerDirective() {
    this.consume(TokenType.LEFT_BRACE, 'Expected {');
    
    const children = [];
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      children.push(this.templateNode());
    }
    
    this.consume(TokenType.RIGHT_BRACE, 'Expected }');
    
    return {
      type: NodeType.WORKER,
      children
    };
  }
  
  animateDirective() {
    this.consume(TokenType.LEFT_PAREN, 'Expected (');
    const animation = this.consume(TokenType.IDENTIFIER, 'Expected animation name');
    let duration = '300ms';
    
    if (this.match(TokenType.COMMA)) {
      duration = this.consume(TokenType.IDENTIFIER, 'Expected duration').value;
    }
    
    this.consume(TokenType.RIGHT_PAREN, 'Expected )');
    this.consume(TokenType.LEFT_BRACE, 'Expected {');
    
    const children = [];
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      children.push(this.templateNode());
    }
    
    this.consume(TokenType.RIGHT_BRACE, 'Expected }');
    
    return {
      type: NodeType.ANIMATION,
      animation: animation.value,
      duration,
      children
    };
  }
  
  transitionDirective() {
    this.consume(TokenType.LEFT_PAREN, 'Expected (');
    const trigger = this.consume(TokenType.IDENTIFIER, 'Expected trigger');
    this.consume(TokenType.COMMA, 'Expected ,');
    const type = this.consume(TokenType.IDENTIFIER, 'Expected transition type');
    this.consume(TokenType.RIGHT_PAREN, 'Expected )');
    this.consume(TokenType.LEFT_BRACE, 'Expected {');
    
    const states = [];
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      const state = this.consume(TokenType.STRING, 'Expected state name');
      this.consume(TokenType.ARROW_THIN, 'Expected ->');
      const element = this.templateNode();
      
      states.push({
        name: state.value,
        element
      });
    }
    
    this.consume(TokenType.RIGHT_BRACE, 'Expected }');
    
    return {
      type: NodeType.TRANSITION,
      trigger: trigger.value,
      transitionType: type.value,
      states
    };
  }
  
  virtualDirective() {
    this.consume(TokenType.LEFT_PAREN, 'Expected (');
    
    const options = {};
    if (this.check(TokenType.IDENTIFIER)) {
      do {
        const key = this.consume(TokenType.IDENTIFIER, 'Expected option name');
        this.consume(TokenType.COLON, 'Expected :');
        const value = this.primary();
        options[key.value] = value;
      } while (this.match(TokenType.COMMA));
    }
    
    this.consume(TokenType.RIGHT_PAREN, 'Expected )');
    this.consume(TokenType.LEFT_BRACE, 'Expected {');
    
    const children = [];
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      children.push(this.templateNode());
    }
    
    this.consume(TokenType.RIGHT_BRACE, 'Expected }');
    
    return {
      type: NodeType.DIRECTIVE,
      name: 'virtual',
      options,
      children
    };
  }
  
  aiDirective() {
    this.consume(TokenType.COMPONENT, 'Expected component');
    const name = this.consume(TokenType.IDENTIFIER, 'Expected component name');
    this.consume(TokenType.LEFT_BRACE, 'Expected {');
    
    const config = {};
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      const key = this.consume(TokenType.IDENTIFIER, 'Expected config key');
      this.consume(TokenType.COLON, 'Expected :');
      const value = this.primary();
      config[key.value] = value;
      
      if (!this.match(TokenType.COMMA)) break;
    }
    
    this.consume(TokenType.RIGHT_BRACE, 'Expected }');
    
    return {
      type: NodeType.AI_COMPONENT,
      name: name.value,
      config
    };
  }
  
  flexDirective() {
    this.consume(TokenType.LEFT_PAREN, 'Expected (');
    const value = this.consume(TokenType.NUMBER, 'Expected flex value');
    this.consume(TokenType.RIGHT_PAREN, 'Expected )');
    this.consume(TokenType.LEFT_BRACE, 'Expected {');
    
    const children = [];
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      children.push(this.templateNode());
    }
    
    this.consume(TokenType.RIGHT_BRACE, 'Expected }');
    
    return {
      type: NodeType.DIRECTIVE,
      name: 'flex',
      value: value.value,
      children
    };
  }
  
  positionDirective(position) {
    const fullPosition = [position];
    
    if (this.match(TokenType.MINUS)) {
      fullPosition.push(this.consume(TokenType.IDENTIFIER, 'Expected position modifier').value);
    }
    
    this.consume(TokenType.LEFT_BRACE, 'Expected {');
    
    const children = [];
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      children.push(this.templateNode());
    }
    
    this.consume(TokenType.RIGHT_BRACE, 'Expected }');
    
    return {
      type: NodeType.DIRECTIVE,
      name: 'position',
      value: fullPosition.join('-'),
      children
    };
  }
  
  genericDirective(name) {
    let value = null;
    let children = null;
    
    if (this.match(TokenType.LEFT_PAREN)) {
      // Directive with parameters
      const args = [];
      if (!this.check(TokenType.RIGHT_PAREN)) {
        do {
          args.push(this.expression());
        } while (this.match(TokenType.COMMA));
      }
      this.consume(TokenType.RIGHT_PAREN, 'Expected )');
      value = args.length === 1 ? args[0] : args;
    }
    
    if (this.match(TokenType.LEFT_BRACE)) {
      // Directive with children
      children = [];
      while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
        children.push(this.templateNode());
      }
      this.consume(TokenType.RIGHT_BRACE, 'Expected }');
    }
    
    return {
      type: NodeType.DIRECTIVE,
      name,
      value,
      children
    };
  }
  
  // Token management
  advance() {
    this.previous = this.current;
    this.current = this.lexer.nextToken();
    return this.previous;
  }
  
  check(type) {
    if (this.isAtEnd()) return false;
    return this.current.type === type;
  }
  
  match(...types) {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }
  
  consume(type, message) {
    if (this.check(type)) return this.advance();
    throw this.error(message);
  }
  
  isAtEnd() {
    return this.current.type === TokenType.EOF;
  }
  
  back() {
    // Simple back implementation - swap current and previous
    const temp = this.current;
    this.current = this.previous;
    this.previous = temp;
  }
  
  error(message) {
    const token = this.current;
    return new SyntaxError(
      `${message} at line ${token.line}, column ${token.column}`
    );
  }
}

// Export parser factory
export function parseEGH(source) {
  const parser = new AdvancedEGHParser(source);
  return parser.parse();
}
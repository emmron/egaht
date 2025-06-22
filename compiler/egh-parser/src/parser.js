/**
 * EGH Parser - Converts tokens to AST
 */

import { TokenType } from './tokenizer.js';

export const ASTNodeType = {
  PROGRAM: 'Program',
  COMPONENT: 'Component',
  TYPE_DEF: 'TypeDefinition',
  STYLES: 'Styles',
  
  // State & Logic
  REACTIVE_STATE: 'ReactiveState',
  COMPUTED: 'Computed',
  EFFECT: 'Effect',
  
  // Template
  TEMPLATE: 'Template',
  ELEMENT: 'Element',
  TEXT: 'Text',
  EXPRESSION: 'Expression',
  
  // Layout
  ROW: 'Row',
  COLUMN: 'Column',
  GRID: 'Grid',
  LAYER: 'Layer',
  
  // Control Flow
  CONDITIONAL: 'Conditional',
  REACTIVE_LOOP: 'ReactiveLoop',
  MATCH: 'Match',
  LAZY_LOAD: 'LazyLoad',
  
  // Bindings
  TWO_WAY_BINDING: 'TwoWayBinding',
  EVENT_HANDLER: 'EventHandler',
  
  // Advanced
  SLOT: 'Slot',
  ANIMATION: 'Animation',
  TRANSITION: 'Transition',
  WORKER: 'Worker',
  AI_COMPONENT: 'AIComponent',
  
  // Expressions
  IDENTIFIER: 'Identifier',
  LITERAL: 'Literal',
  BINARY_OP: 'BinaryOperation',
  UNARY_OP: 'UnaryOperation',
  CALL: 'CallExpression',
  MEMBER: 'MemberExpression',
  PIPELINE: 'Pipeline'
};

export class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.current = 0;
  }
  
  parse() {
    const program = {
      type: ASTNodeType.PROGRAM,
      body: []
    };
    
    while (!this.isAtEnd()) {
      program.body.push(this.declaration());
    }
    
    return program;
  }
  
  declaration() {
    if (this.match(TokenType.COMPONENT)) {
      return this.componentDeclaration();
    }
    
    if (this.match(TokenType.TYPE)) {
      return this.typeDeclaration();
    }
    
    if (this.match(TokenType.STYLES)) {
      return this.stylesDeclaration();
    }
    
    throw this.error('Expected declaration');
  }
  
  componentDeclaration() {
    const name = this.consume(TokenType.IDENTIFIER, 'Expected component name').value;
    
    let params = [];
    if (this.match(TokenType.PAREN_OPEN)) {
      params = this.parameterList();
      this.consume(TokenType.PAREN_CLOSE, 'Expected ) after parameters');
    }
    
    this.consume(TokenType.BRACE_OPEN, 'Expected { after component name');
    
    const body = [];
    
    // Parse component body
    while (!this.check(TokenType.BRACE_CLOSE) && !this.isAtEnd()) {
      if (this.match(TokenType.REACTIVE)) {
        body.push(this.reactiveState());
      } else if (this.checkComputed()) {
        body.push(this.computed());
      } else if (this.checkEffect()) {
        body.push(this.effect());
      } else if (this.check(TokenType.TEMPLATE_START)) {
        body.push(this.template());
      } else {
        // Regular statements
        body.push(this.statement());
      }
    }
    
    this.consume(TokenType.BRACE_CLOSE, 'Expected } after component body');
    
    return {
      type: ASTNodeType.COMPONENT,
      name,
      params,
      body
    };
  }
  
  reactiveState() {
    const name = this.consume(TokenType.IDENTIFIER, 'Expected state name').value;
    this.consume(TokenType.OPERATOR, 'Expected =');
    const initialValue = this.expression();
    
    return {
      type: ASTNodeType.REACTIVE_STATE,
      name,
      initialValue
    };
  }
  
  computed() {
    const name = this.consume(TokenType.IDENTIFIER, 'Expected computed name').value;
    this.consume(TokenType.COMPUTED, 'Expected =>');
    const expression = this.expression();
    
    return {
      type: ASTNodeType.COMPUTED,
      name,
      expression
    };
  }
  
  effect() {
    const dependencies = [];
    
    // Parse dependency
    const dep = this.consume(TokenType.IDENTIFIER, 'Expected dependency').value;
    dependencies.push(dep);
    
    this.consume(TokenType.EFFECT, 'Expected ::');
    this.consume(TokenType.BRACE_OPEN, 'Expected {');
    
    const body = [];
    while (!this.check(TokenType.BRACE_CLOSE) && !this.isAtEnd()) {
      body.push(this.statement());
    }
    
    this.consume(TokenType.BRACE_CLOSE, 'Expected }');
    
    return {
      type: ASTNodeType.EFFECT,
      dependencies,
      body
    };
  }
  
  template() {
    this.consume(TokenType.TEMPLATE_START, 'Expected <[');
    
    const elements = [];
    while (!this.check(TokenType.TEMPLATE_END) && !this.isAtEnd()) {
      elements.push(this.templateElement());
    }
    
    this.consume(TokenType.TEMPLATE_END, 'Expected ]>');
    
    return {
      type: ASTNodeType.TEMPLATE,
      children: elements
    };
  }
  
  templateElement() {
    // Handle special layout elements
    if (this.match(TokenType.ROW)) {
      return this.rowElement();
    }
    
    if (this.match(TokenType.COLUMN)) {
      return this.columnElement();
    }
    
    if (this.match(TokenType.GRID)) {
      return this.gridElement();
    }
    
    // Handle directives
    if (this.match(TokenType.AT)) {
      return this.directive();
    }
    
    // Handle conditionals
    if (this.match(TokenType.OPTIONAL)) {
      return this.conditional();
    }
    
    // Handle loops
    if (this.match(TokenType.REACTIVE_LOOP)) {
      return this.reactiveLoop();
    }
    
    // Regular element
    if (this.check(TokenType.IDENTIFIER)) {
      return this.element();
    }
    
    // Text content
    if (this.check(TokenType.STRING)) {
      return this.textElement();
    }
    
    throw this.error('Unexpected template element');
  }
  
  element() {
    const tag = this.consume(TokenType.IDENTIFIER, 'Expected element name').value;
    
    const attributes = {};
    const events = {};
    const styles = {};
    const children = [];
    
    // Parse attributes and content
    if (this.match(TokenType.PAREN_OPEN)) {
      // Parse props
      while (!this.check(TokenType.PAREN_CLOSE) && !this.isAtEnd()) {
        const key = this.consume(TokenType.IDENTIFIER, 'Expected attribute name').value;
        this.consume(TokenType.COLON, 'Expected :');
        const value = this.expression();
        attributes[key] = value;
        
        if (!this.match(TokenType.COMMA)) break;
      }
      this.consume(TokenType.PAREN_CLOSE, 'Expected )');
    }
    
    if (this.match(TokenType.BRACE_OPEN)) {
      // Parse content
      while (!this.check(TokenType.BRACE_CLOSE) && !this.isAtEnd()) {
        // Handle events
        if (this.match(TokenType.AT)) {
          const eventName = this.consume(TokenType.IDENTIFIER, 'Expected event name').value;
          this.consume(TokenType.COLON, 'Expected :');
          const handler = this.expression();
          events[eventName] = handler;
        }
        // Handle styles
        else if (this.match(TokenType.DOLLAR)) {
          const styleName = this.consume(TokenType.IDENTIFIER, 'Expected style name').value;
          this.consume(TokenType.COLON, 'Expected :');
          const value = this.expression();
          styles[styleName] = value;
        }
        // Handle children
        else {
          children.push(this.templateElement());
        }
      }
      this.consume(TokenType.BRACE_CLOSE, 'Expected }');
    }
    
    return {
      type: ASTNodeType.ELEMENT,
      tag,
      attributes,
      events,
      styles,
      children
    };
  }
  
  rowElement() {
    this.consume(TokenType.BRACE_OPEN, 'Expected {');
    
    const children = [];
    while (!this.check(TokenType.BRACE_CLOSE) && !this.isAtEnd()) {
      children.push(this.templateElement());
      
      // Handle pipe separator for flex items
      if (this.match(TokenType.PIPE_SEPARATOR)) {
        // Mark as flex separator
      }
    }
    
    this.consume(TokenType.BRACE_CLOSE, 'Expected }');
    
    return {
      type: ASTNodeType.ROW,
      children
    };
  }
  
  conditional() {
    const condition = this.expression();
    this.consume(TokenType.BRACE_OPEN, 'Expected {');
    
    const consequent = [];
    while (!this.check(TokenType.BRACE_CLOSE) && !this.isAtEnd()) {
      consequent.push(this.templateElement());
    }
    
    this.consume(TokenType.BRACE_CLOSE, 'Expected }');
    
    let alternate = null;
    if (this.match(TokenType.COLON)) {
      this.consume(TokenType.BRACE_OPEN, 'Expected {');
      alternate = [];
      while (!this.check(TokenType.BRACE_CLOSE) && !this.isAtEnd()) {
        alternate.push(this.templateElement());
      }
      this.consume(TokenType.BRACE_CLOSE, 'Expected }');
    }
    
    return {
      type: ASTNodeType.CONDITIONAL,
      condition,
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
    
    this.consume(TokenType.BRACE_OPEN, 'Expected {');
    
    const body = [];
    while (!this.check(TokenType.BRACE_CLOSE) && !this.isAtEnd()) {
      body.push(this.templateElement());
    }
    
    this.consume(TokenType.BRACE_CLOSE, 'Expected }');
    
    return {
      type: ASTNodeType.REACTIVE_LOOP,
      collection,
      itemName,
      indexName,
      body
    };
  }
  
  expression() {
    return this.pipeline();
  }
  
  pipeline() {
    let expr = this.assignment();
    
    while (this.match(TokenType.PIPE)) {
      const operator = this.previous();
      const right = this.assignment();
      expr = {
        type: ASTNodeType.PIPELINE,
        left: expr,
        operator: operator.value,
        right
      };
    }
    
    return expr;
  }
  
  assignment() {
    let expr = this.ternary();
    
    if (this.match(TokenType.OPERATOR) && this.previous().value === '=') {
      const value = this.assignment();
      return {
        type: ASTNodeType.BINARY_OP,
        operator: '=',
        left: expr,
        right: value
      };
    }
    
    return expr;
  }
  
  ternary() {
    let expr = this.logicalOr();
    
    if (this.match(TokenType.OPTIONAL)) {
      const consequent = this.expression();
      this.consume(TokenType.COLON, 'Expected :');
      const alternate = this.ternary();
      return {
        type: ASTNodeType.BINARY_OP,
        operator: '?:',
        condition: expr,
        consequent,
        alternate
      };
    }
    
    return expr;
  }
  
  logicalOr() {
    let expr = this.logicalAnd();
    
    while (this.match(TokenType.OPERATOR) && this.previous().value === '||') {
      const operator = this.previous();
      const right = this.logicalAnd();
      expr = {
        type: ASTNodeType.BINARY_OP,
        operator: operator.value,
        left: expr,
        right
      };
    }
    
    return expr;
  }
  
  logicalAnd() {
    let expr = this.equality();
    
    while (this.match(TokenType.OPERATOR) && this.previous().value === '&&') {
      const operator = this.previous();
      const right = this.equality();
      expr = {
        type: ASTNodeType.BINARY_OP,
        operator: operator.value,
        left: expr,
        right
      };
    }
    
    return expr;
  }
  
  equality() {
    let expr = this.comparison();
    
    while (this.match(TokenType.OPERATOR) && 
           (this.previous().value === '===' || this.previous().value === '!==')) {
      const operator = this.previous();
      const right = this.comparison();
      expr = {
        type: ASTNodeType.BINARY_OP,
        operator: operator.value,
        left: expr,
        right
      };
    }
    
    return expr;
  }
  
  comparison() {
    let expr = this.addition();
    
    while (this.match(TokenType.OPERATOR) && 
           ['>', '>=', '<', '<='].includes(this.previous().value)) {
      const operator = this.previous();
      const right = this.addition();
      expr = {
        type: ASTNodeType.BINARY_OP,
        operator: operator.value,
        left: expr,
        right
      };
    }
    
    return expr;
  }
  
  addition() {
    let expr = this.multiplication();
    
    while (this.match(TokenType.OPERATOR) && 
           ['+', '-'].includes(this.previous().value)) {
      const operator = this.previous();
      const right = this.multiplication();
      expr = {
        type: ASTNodeType.BINARY_OP,
        operator: operator.value,
        left: expr,
        right
      };
    }
    
    return expr;
  }
  
  multiplication() {
    let expr = this.unary();
    
    while (this.match(TokenType.OPERATOR) && 
           ['*', '/', '%'].includes(this.previous().value)) {
      const operator = this.previous();
      const right = this.unary();
      expr = {
        type: ASTNodeType.BINARY_OP,
        operator: operator.value,
        left: expr,
        right
      };
    }
    
    return expr;
  }
  
  unary() {
    if (this.match(TokenType.OPERATOR) && 
        ['!', '-', '+'].includes(this.previous().value)) {
      const operator = this.previous();
      const right = this.unary();
      return {
        type: ASTNodeType.UNARY_OP,
        operator: operator.value,
        operand: right
      };
    }
    
    return this.postfix();
  }
  
  postfix() {
    let expr = this.call();
    
    while (this.match(TokenType.OPERATOR) && 
           ['++', '--'].includes(this.previous().value)) {
      const operator = this.previous();
      expr = {
        type: ASTNodeType.UNARY_OP,
        operator: operator.value,
        operand: expr,
        postfix: true
      };
    }
    
    return expr;
  }
  
  call() {
    let expr = this.primary();
    
    while (true) {
      if (this.match(TokenType.PAREN_OPEN)) {
        expr = this.finishCall(expr);
      } else if (this.match(TokenType.DOT)) {
        const property = this.consume(TokenType.IDENTIFIER, 'Expected property name');
        expr = {
          type: ASTNodeType.MEMBER,
          object: expr,
          property: property.value,
          computed: false
        };
      } else if (this.match(TokenType.BRACKET_OPEN)) {
        const property = this.expression();
        this.consume(TokenType.BRACKET_CLOSE, 'Expected ]');
        expr = {
          type: ASTNodeType.MEMBER,
          object: expr,
          property,
          computed: true
        };
      } else {
        break;
      }
    }
    
    return expr;
  }
  
  finishCall(callee) {
    const args = [];
    
    if (!this.check(TokenType.PAREN_CLOSE)) {
      do {
        args.push(this.expression());
      } while (this.match(TokenType.COMMA));
    }
    
    this.consume(TokenType.PAREN_CLOSE, 'Expected ) after arguments');
    
    return {
      type: ASTNodeType.CALL,
      callee,
      arguments: args
    };
  }
  
  primary() {
    if (this.match(TokenType.BOOLEAN, TokenType.NUMBER, TokenType.STRING)) {
      return {
        type: ASTNodeType.LITERAL,
        value: this.previous().value
      };
    }
    
    if (this.match(TokenType.IDENTIFIER)) {
      return {
        type: ASTNodeType.IDENTIFIER,
        name: this.previous().value
      };
    }
    
    if (this.match(TokenType.PAREN_OPEN)) {
      const expr = this.expression();
      this.consume(TokenType.PAREN_CLOSE, 'Expected ) after expression');
      return expr;
    }
    
    throw this.error('Expected expression');
  }
  
  // Helper methods
  match(...types) {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }
  
  check(type) {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }
  
  checkComputed() {
    if (this.check(TokenType.IDENTIFIER)) {
      const next = this.tokens[this.current + 1];
      return next && next.type === TokenType.COMPUTED;
    }
    return false;
  }
  
  checkEffect() {
    if (this.check(TokenType.IDENTIFIER)) {
      const next = this.tokens[this.current + 1];
      return next && next.type === TokenType.EFFECT;
    }
    return false;
  }
  
  advance() {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }
  
  isAtEnd() {
    return this.peek().type === TokenType.EOF;
  }
  
  peek() {
    return this.tokens[this.current];
  }
  
  previous() {
    return this.tokens[this.current - 1];
  }
  
  consume(type, message) {
    if (this.check(type)) return this.advance();
    throw this.error(message);
  }
  
  error(message) {
    const token = this.peek();
    return new Error(`${message} at line ${token.line}, column ${token.column}`);
  }
}
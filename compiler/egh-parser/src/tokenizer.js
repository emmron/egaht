/**
 * EGH Tokenizer - Lexical analysis for Eghact Hyperlanguage
 */

export const TokenType = {
  // Literals
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN',
  IDENTIFIER: 'IDENTIFIER',
  
  // Keywords
  COMPONENT: 'COMPONENT',
  TYPE: 'TYPE',
  STYLES: 'STYLES',
  MATCH: 'MATCH',
  AS: 'AS',
  SLOT: 'SLOT',
  IMPORT: 'IMPORT',
  FROM: 'FROM',
  
  // Operators
  REACTIVE: '~',              // Reactive state
  COMPUTED: '=>',             // Computed value
  EFFECT: '::',               // Side effect
  BINDING: '<~>',             // Two-way binding
  PIPE: '|>',                 // Pipeline
  SPREAD: '...',              // Spread
  OPTIONAL: '?',              // Optional
  REQUIRED: '!',              // Required/Static
  MEMOIZE: '#',               // Memoization
  LAZY: '?~',                 // Lazy loading
  REACTIVE_LOOP: '*~',        // Reactive iteration
  
  // Delimiters
  TEMPLATE_START: '<[',
  TEMPLATE_END: ']>',
  BRACE_OPEN: '{',
  BRACE_CLOSE: '}',
  PAREN_OPEN: '(',
  PAREN_CLOSE: ')',
  BRACKET_OPEN: '[',
  BRACKET_CLOSE: ']',
  
  // Layout
  ROW: 'row',
  COLUMN: 'column',
  GRID: 'grid',
  LAYER: 'layer',
  
  // Special
  AT: '@',                    // Directive/Event/Position
  DOLLAR: '$',                // Style
  ARROW: '->',                // Pattern match
  COLON: ':',
  SEMICOLON: ';',
  COMMA: ',',
  DOT: '.',
  PIPE_SEPARATOR: '|',        // Layout separator
  
  // Comments
  COMMENT: 'COMMENT',
  
  // End of file
  EOF: 'EOF'
};

export class Token {
  constructor(type, value, line, column) {
    this.type = type;
    this.value = value;
    this.line = line;
    this.column = column;
  }
}

export class Tokenizer {
  constructor(input) {
    this.input = input;
    this.position = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];
  }
  
  tokenize() {
    while (!this.isAtEnd()) {
      this.skipWhitespace();
      if (this.isAtEnd()) break;
      
      const token = this.nextToken();
      if (token && token.type !== TokenType.COMMENT) {
        this.tokens.push(token);
      }
    }
    
    this.tokens.push(new Token(TokenType.EOF, null, this.line, this.column));
    return this.tokens;
  }
  
  nextToken() {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    const char = this.advance();
    
    // Comments
    if (char === '/' && this.peek() === '/') {
      return this.skipLineComment();
    }
    
    if (char === '/' && this.peek() === '*') {
      return this.skipBlockComment();
    }
    
    // Multi-character operators
    if (char === '<') {
      if (this.peek() === '[') {
        this.advance();
        return new Token(TokenType.TEMPLATE_START, '<[', startLine, startColumn);
      }
      if (this.peek() === '~' && this.peekNext() === '>') {
        this.advance();
        this.advance();
        return new Token(TokenType.BINDING, '<~>', startLine, startColumn);
      }
    }
    
    if (char === ']' && this.peek() === '>') {
      this.advance();
      return new Token(TokenType.TEMPLATE_END, ']>', startLine, startColumn);
    }
    
    if (char === '=' && this.peek() === '>') {
      this.advance();
      return new Token(TokenType.COMPUTED, '=>', startLine, startColumn);
    }
    
    if (char === ':' && this.peek() === ':') {
      this.advance();
      return new Token(TokenType.EFFECT, '::', startLine, startColumn);
    }
    
    if (char === '|' && this.peek() === '>') {
      this.advance();
      return new Token(TokenType.PIPE, '|>', startLine, startColumn);
    }
    
    if (char === '-' && this.peek() === '>') {
      this.advance();
      return new Token(TokenType.ARROW, '->', startLine, startColumn);
    }
    
    if (char === '.' && this.peek() === '.' && this.peekNext() === '.') {
      this.advance();
      this.advance();
      return new Token(TokenType.SPREAD, '...', startLine, startColumn);
    }
    
    if (char === '*' && this.peek() === '~') {
      this.advance();
      return new Token(TokenType.REACTIVE_LOOP, '*~', startLine, startColumn);
    }
    
    if (char === '?' && this.peek() === '~') {
      this.advance();
      return new Token(TokenType.LAZY, '?~', startLine, startColumn);
    }
    
    // Single character tokens
    const singleCharTokens = {
      '~': TokenType.REACTIVE,
      '?': TokenType.OPTIONAL,
      '!': TokenType.REQUIRED,
      '#': TokenType.MEMOIZE,
      '@': TokenType.AT,
      '$': TokenType.DOLLAR,
      '{': TokenType.BRACE_OPEN,
      '}': TokenType.BRACE_CLOSE,
      '(': TokenType.PAREN_OPEN,
      ')': TokenType.PAREN_CLOSE,
      '[': TokenType.BRACKET_OPEN,
      ']': TokenType.BRACKET_CLOSE,
      ':': TokenType.COLON,
      ';': TokenType.SEMICOLON,
      ',': TokenType.COMMA,
      '.': TokenType.DOT,
      '|': TokenType.PIPE_SEPARATOR
    };
    
    if (singleCharTokens[char]) {
      return new Token(singleCharTokens[char], char, startLine, startColumn);
    }
    
    // String literals
    if (char === '"' || char === "'") {
      return this.string(char);
    }
    
    // Numbers
    if (this.isDigit(char)) {
      return this.number();
    }
    
    // Identifiers and keywords
    if (this.isAlpha(char)) {
      return this.identifier();
    }
    
    throw new Error(`Unexpected character '${char}' at ${startLine}:${startColumn}`);
  }
  
  string(quote) {
    const startLine = this.line;
    const startColumn = this.column - 1;
    let value = '';
    
    while (!this.isAtEnd() && this.peek() !== quote) {
      if (this.peek() === '\\') {
        this.advance();
        const escaped = this.advance();
        value += this.parseEscape(escaped);
      } else {
        if (this.peek() === '\n') {
          this.line++;
          this.column = 0;
        }
        value += this.advance();
      }
    }
    
    if (this.isAtEnd()) {
      throw new Error(`Unterminated string at ${startLine}:${startColumn}`);
    }
    
    this.advance(); // Closing quote
    return new Token(TokenType.STRING, value, startLine, startColumn);
  }
  
  number() {
    const startLine = this.line;
    const startColumn = this.column - 1;
    let value = this.previous();
    
    while (this.isDigit(this.peek())) {
      value += this.advance();
    }
    
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      value += this.advance(); // .
      while (this.isDigit(this.peek())) {
        value += this.advance();
      }
    }
    
    return new Token(TokenType.NUMBER, parseFloat(value), startLine, startColumn);
  }
  
  identifier() {
    const startLine = this.line;
    const startColumn = this.column - 1;
    let value = this.previous();
    
    while (this.isAlphaNumeric(this.peek()) || this.peek() === '-') {
      value += this.advance();
    }
    
    // Check for keywords
    const keywords = {
      'component': TokenType.COMPONENT,
      'type': TokenType.TYPE,
      'styles': TokenType.STYLES,
      'match': TokenType.MATCH,
      'as': TokenType.AS,
      'slot': TokenType.SLOT,
      'import': TokenType.IMPORT,
      'from': TokenType.FROM,
      'row': TokenType.ROW,
      'column': TokenType.COLUMN,
      'grid': TokenType.GRID,
      'layer': TokenType.LAYER,
      'true': TokenType.BOOLEAN,
      'false': TokenType.BOOLEAN
    };
    
    const type = keywords[value] || TokenType.IDENTIFIER;
    const tokenValue = type === TokenType.BOOLEAN ? value === 'true' : value;
    
    return new Token(type, tokenValue, startLine, startColumn);
  }
  
  skipWhitespace() {
    while (!this.isAtEnd()) {
      const char = this.peek();
      if (char === ' ' || char === '\r' || char === '\t') {
        this.advance();
      } else if (char === '\n') {
        this.line++;
        this.column = 0;
        this.advance();
      } else {
        break;
      }
    }
  }
  
  skipLineComment() {
    const startLine = this.line;
    const startColumn = this.column - 1;
    
    while (this.peek() !== '\n' && !this.isAtEnd()) {
      this.advance();
    }
    
    return new Token(TokenType.COMMENT, null, startLine, startColumn);
  }
  
  skipBlockComment() {
    const startLine = this.line;
    const startColumn = this.column - 1;
    
    this.advance(); // Skip *
    while (!this.isAtEnd()) {
      if (this.peek() === '*' && this.peekNext() === '/') {
        this.advance();
        this.advance();
        break;
      }
      if (this.peek() === '\n') {
        this.line++;
        this.column = 0;
      }
      this.advance();
    }
    
    return new Token(TokenType.COMMENT, null, startLine, startColumn);
  }
  
  parseEscape(char) {
    const escapes = {
      'n': '\n',
      'r': '\r',
      't': '\t',
      '\\': '\\',
      '"': '"',
      "'": "'"
    };
    return escapes[char] || char;
  }
  
  // Helper methods
  advance() {
    const char = this.input[this.position];
    this.position++;
    this.column++;
    return char;
  }
  
  peek() {
    if (this.isAtEnd()) return '\0';
    return this.input[this.position];
  }
  
  peekNext() {
    if (this.position + 1 >= this.input.length) return '\0';
    return this.input[this.position + 1];
  }
  
  previous() {
    return this.input[this.position - 1];
  }
  
  isAtEnd() {
    return this.position >= this.input.length;
  }
  
  isDigit(char) {
    return char >= '0' && char <= '9';
  }
  
  isAlpha(char) {
    return (char >= 'a' && char <= 'z') ||
           (char >= 'A' && char <= 'Z') ||
           char === '_';
  }
  
  isAlphaNumeric(char) {
    return this.isAlpha(char) || this.isDigit(char);
  }
}
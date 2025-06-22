/**
 * EGH Lexer - Tokenizes Eghact Hyperlanguage syntax
 */

export enum TokenType {
  // Literals
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  IDENTIFIER = 'IDENTIFIER',
  BOOLEAN = 'BOOLEAN',
  NULL = 'NULL',
  UNDEFINED = 'UNDEFINED',
  
  // Keywords
  COMPONENT = 'component',
  MATCH = 'match',
  TYPE = 'type',
  IMPORT = 'import',
  EXPORT = 'export',
  FROM = 'from',
  AS = 'as',
  LET = 'let',
  CONST = 'const',
  IF = 'if',
  ELSE = 'else',
  FOR = 'for',
  WHILE = 'while',
  FUNCTION = 'function',
  RETURN = 'return',
  TRUE = 'true',
  FALSE = 'false',
  ROW = 'row',
  COLUMN = 'column',
  GRID = 'grid',
  LAYER = 'layer',
  SLOT = 'slot',
  
  // Operators
  REACTIVE = '~',              // Reactive state
  TWO_WAY = '<~>',            // Two-way binding
  ARROW = '=>',               // Computed values
  ARROW_THIN = '->',          // Pattern matching arrow
  EFFECT = '::',              // Effects
  PIPE = '|>',                // Pipe operator
  REACTIVE_LOOP = '*~',       // Reactive loop
  CONDITIONAL = '?',          // Conditional
  LAZY_LOAD = '?~',          // Lazy loading
  
  // Arithmetic Operators
  PLUS = '+',
  MINUS = '-',
  MULTIPLY = '*',
  DIVIDE = '/',
  MODULO = '%',
  
  // Comparison Operators
  LESS_THAN = '<',
  GREATER_THAN = '>',
  LESS_EQUAL = '<=',
  GREATER_EQUAL = '>=',
  EQUAL = '==',
  NOT_EQUAL = '!=',
  STRICT_EQUAL = '===',
  STRICT_NOT_EQUAL = '!==',
  
  // Logical Operators
  AND = '&&',
  OR = '||',
  NOT = '!',
  
  // Assignment Operators
  PLUS_ASSIGN = '+=',
  MINUS_ASSIGN = '-=',
  MULTIPLY_ASSIGN = '*=',
  DIVIDE_ASSIGN = '/=',
  
  // Other Operators
  SPREAD = '...',
  OPTIONAL_CHAIN = '?.',
  NULLISH_COALESCE = '??',
  
  // Layout
  TEMPLATE_START = '<[',
  TEMPLATE_END = ']>',
  
  // Delimiters
  LEFT_PAREN = '(',
  RIGHT_PAREN = ')',
  LEFT_BRACE = '{',
  RIGHT_BRACE = '}',
  LEFT_BRACKET = '[',
  RIGHT_BRACKET = ']',
  
  // Punctuation
  DOT = '.',
  COMMA = ',',
  COLON = ':',
  SEMICOLON = ';',
  EQUALS = '=',
  PIPE_CHAR = '|',
  AT = '@',
  DOLLAR = '$',
  HASH = '#',
  EXCLAMATION = '!',
  QUESTION = '?',
  
  // Special
  EOF = 'EOF',
  NEWLINE = 'NEWLINE',
  WHITESPACE = 'WHITESPACE',
  COMMENT = 'COMMENT',
  TEMPLATE_STRING = 'TEMPLATE_STRING',
  INTERPOLATION_START = '${',
  INTERPOLATION_END = '}'
}

export interface Token {
  type: TokenType | string;
  value: string;
  line: number;
  column: number;
}

export class Lexer {
  private source: string;
  private position: number = 0;
  public line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];
  
  constructor(source: string) {
    this.source = source;
    this.tokenize();
  }
  
  private tokenize(): void {
    while (this.position < this.source.length) {
      this.skipWhitespace();
      
      if (this.position >= this.source.length) break;
      
      const token = this.scanToken();
      if (token && token.type !== TokenType.WHITESPACE) {
        this.tokens.push(token);
      }
    }
    
    this.tokens.push({
      type: TokenType.EOF,
      value: '',
      line: this.line,
      column: this.column
    });
  }
  
  private scanToken(): Token | null {
    const start = this.position;
    const startColumn = this.column;
    const char = this.current();
    
    // Multi-character operators
    if (char === '<') {
      if (this.peek() === '~' && this.peekNext() === '>') {
        this.advance(3);
        return this.makeToken(TokenType.TWO_WAY, '<~>', startColumn);
      }
      if (this.peek() === '[') {
        this.advance(2);
        return this.makeToken(TokenType.TEMPLATE_START, '<[', startColumn);
      }
      if (this.peek() === '=') {
        this.advance(2);
        return this.makeToken(TokenType.LESS_EQUAL, '<=', startColumn);
      }
      this.advance();
      return this.makeToken(TokenType.LESS_THAN, '<', startColumn);
    }
    
    if (char === '>') {
      if (this.peek() === '=') {
        this.advance(2);
        return this.makeToken(TokenType.GREATER_EQUAL, '>=', startColumn);
      }
      this.advance();
      return this.makeToken(TokenType.GREATER_THAN, '>', startColumn);
    }
    
    if (char === ']' && this.peek() === '>') {
      this.advance(2);
      return this.makeToken(TokenType.TEMPLATE_END, ']>', startColumn);
    }
    
    if (char === '=') {
      if (this.peek() === '>') {
        this.advance(2);
        return this.makeToken(TokenType.ARROW, '=>', startColumn);
      }
      if (this.peek() === '=') {
        if (this.peekNext() === '=') {
          this.advance(3);
          return this.makeToken(TokenType.STRICT_EQUAL, '===', startColumn);
        }
        this.advance(2);
        return this.makeToken(TokenType.EQUAL, '==', startColumn);
      }
      this.advance();
      return this.makeToken(TokenType.EQUALS, '=', startColumn);
    }
    
    if (char === '!') {
      if (this.peek() === '=') {
        if (this.peekNext() === '=') {
          this.advance(3);
          return this.makeToken(TokenType.STRICT_NOT_EQUAL, '!==', startColumn);
        }
        this.advance(2);
        return this.makeToken(TokenType.NOT_EQUAL, '!=', startColumn);
      }
      this.advance();
      return this.makeToken(TokenType.NOT, '!', startColumn);
    }
    
    if (char === '&' && this.peek() === '&') {
      this.advance(2);
      return this.makeToken(TokenType.AND, '&&', startColumn);
    }
    
    if (char === '|' && this.peek() === '|') {
      this.advance(2);
      return this.makeToken(TokenType.OR, '||', startColumn);
    }
    
    if (char === '-' && this.peek() === '>') {
      this.advance(2);
      return this.makeToken(TokenType.ARROW_THIN, '->', startColumn);
    }
    
    if (char === '.' && this.peek() === '.' && this.peekNext() === '.') {
      this.advance(3);
      return this.makeToken(TokenType.SPREAD, '...', startColumn);
    }
    
    if (char === '?' && this.peek() === '.') {
      this.advance(2);
      return this.makeToken(TokenType.OPTIONAL_CHAIN, '?.', startColumn);
    }
    
    if (char === '?' && this.peek() === '?') {
      this.advance(2);
      return this.makeToken(TokenType.NULLISH_COALESCE, '??', startColumn);
    }
    
    // Assignment operators
    if (char === '+' && this.peek() === '=') {
      this.advance(2);
      return this.makeToken(TokenType.PLUS_ASSIGN, '+=', startColumn);
    }
    if (char === '-' && this.peek() === '=') {
      this.advance(2);
      return this.makeToken(TokenType.MINUS_ASSIGN, '-=', startColumn);
    }
    if (char === '*' && this.peek() === '=') {
      this.advance(2);
      return this.makeToken(TokenType.MULTIPLY_ASSIGN, '*=', startColumn);
    }
    if (char === '/' && this.peek() === '=') {
      this.advance(2);
      return this.makeToken(TokenType.DIVIDE_ASSIGN, '/=', startColumn);
    }
    
    if (char === ':' && this.peek() === ':') {
      this.advance(2);
      return this.makeToken(TokenType.EFFECT, '::', startColumn);
    }
    
    if (char === '|' && this.peek() === '>') {
      this.advance(2);
      return this.makeToken(TokenType.PIPE, '|>', startColumn);
    }
    
    if (char === '*' && this.peek() === '~') {
      this.advance(2);
      return this.makeToken(TokenType.REACTIVE_LOOP, '*~', startColumn);
    }
    
    if (char === '?' && this.peek() === '~') {
      this.advance(2);
      return this.makeToken(TokenType.LAZY_LOAD, '?~', startColumn);
    }
    
    // Single character tokens
    switch (char) {
      case '~': this.advance(); return this.makeToken(TokenType.REACTIVE, '~', startColumn);
      case '?': this.advance(); return this.makeToken(TokenType.CONDITIONAL, '?', startColumn);
      case '(': this.advance(); return this.makeToken(TokenType.LEFT_PAREN, '(', startColumn);
      case ')': this.advance(); return this.makeToken(TokenType.RIGHT_PAREN, ')', startColumn);
      case '{': this.advance(); return this.makeToken(TokenType.LEFT_BRACE, '{', startColumn);
      case '}': this.advance(); return this.makeToken(TokenType.RIGHT_BRACE, '}', startColumn);
      case '[': this.advance(); return this.makeToken(TokenType.LEFT_BRACKET, '[', startColumn);
      case ']': this.advance(); return this.makeToken(TokenType.RIGHT_BRACKET, ']', startColumn);
      case '.': this.advance(); return this.makeToken(TokenType.DOT, '.', startColumn);
      case ',': this.advance(); return this.makeToken(TokenType.COMMA, ',', startColumn);
      case ':': this.advance(); return this.makeToken(TokenType.COLON, ':', startColumn);
      case ';': this.advance(); return this.makeToken(TokenType.SEMICOLON, ';', startColumn);
      case '|': this.advance(); return this.makeToken(TokenType.PIPE_CHAR, '|', startColumn);
      case '@': this.advance(); return this.makeToken(TokenType.AT, '@', startColumn);
      case '$': this.advance(); return this.makeToken(TokenType.DOLLAR, '$', startColumn);
      case '#': this.advance(); return this.makeToken(TokenType.HASH, '#', startColumn);
      case '+': this.advance(); return this.makeToken(TokenType.PLUS, '+', startColumn);
      case '-': this.advance(); return this.makeToken(TokenType.MINUS, '-', startColumn);
      case '*': this.advance(); return this.makeToken(TokenType.MULTIPLY, '*', startColumn);
      case '/': this.advance(); return this.makeToken(TokenType.DIVIDE, '/', startColumn);
      case '%': this.advance(); return this.makeToken(TokenType.MODULO, '%', startColumn);
      
      // String literals
      case '"':
      case "'":
        return this.scanString(char);
      
      // Template literals
      case '`':
        return this.scanTemplateString();
      
      // Comments
      case '/':
        if (this.peek() === '/') {
          this.skipLineComment();
          return null;
        }
        if (this.peek() === '*') {
          this.skipBlockComment();
          return null;
        }
        break;
    }
    
    // Numbers
    if (this.isDigit(char)) {
      return this.scanNumber();
    }
    
    // Identifiers and keywords
    if (this.isAlpha(char)) {
      return this.scanIdentifier();
    }
    
    // Unknown character
    this.advance();
    return null;
  }
  
  private scanString(quote: string): Token {
    const startColumn = this.column;
    this.advance(); // Skip opening quote
    
    let value = '';
    while (this.current() !== quote && !this.isAtEnd()) {
      if (this.current() === '\\') {
        this.advance();
        // Handle escape sequences
        switch (this.current()) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case 'r': value += '\r'; break;
          case '\\': value += '\\'; break;
          case quote: value += quote; break;
          default: value += this.current();
        }
      } else {
        value += this.current();
      }
      this.advance();
    }
    
    if (this.isAtEnd()) {
      throw new Error(`Unterminated string at line ${this.line}`);
    }
    
    this.advance(); // Skip closing quote
    return this.makeToken(TokenType.STRING, value, startColumn);
  }
  
  private scanNumber(): Token {
    const startColumn = this.column;
    let value = '';
    
    while (this.isDigit(this.current())) {
      value += this.current();
      this.advance();
    }
    
    if (this.current() === '.' && this.isDigit(this.peek())) {
      value += '.';
      this.advance();
      
      while (this.isDigit(this.current())) {
        value += this.current();
        this.advance();
      }
    }
    
    return this.makeToken(TokenType.NUMBER, value, startColumn);
  }
  
  private scanIdentifier(): Token {
    const startColumn = this.column;
    let value = '';
    
    while (this.isAlphaNumeric(this.current())) {
      value += this.current();
      this.advance();
    }
    
    // Check for keywords
    const type = this.getKeywordType(value) || TokenType.IDENTIFIER;
    
    return this.makeToken(type, value, startColumn);
  }
  
  private getKeywordType(value: string): TokenType | null {
    switch (value) {
      case 'component': return TokenType.COMPONENT;
      case 'match': return TokenType.MATCH;
      case 'type': return TokenType.TYPE;
      case 'import': return TokenType.IMPORT;
      case 'export': return TokenType.EXPORT;
      case 'from': return TokenType.FROM;
      case 'as': return TokenType.AS;
      case 'let': return TokenType.LET;
      case 'const': return TokenType.CONST;
      case 'if': return TokenType.IF;
      case 'else': return TokenType.ELSE;
      case 'for': return TokenType.FOR;
      case 'while': return TokenType.WHILE;
      case 'function': return TokenType.FUNCTION;
      case 'return': return TokenType.RETURN;
      case 'true': return TokenType.TRUE;
      case 'false': return TokenType.FALSE;
      case 'null': return TokenType.NULL;
      case 'undefined': return TokenType.UNDEFINED;
      case 'row': return TokenType.ROW;
      case 'column': return TokenType.COLUMN;
      case 'grid': return TokenType.GRID;
      case 'layer': return TokenType.LAYER;
      case 'slot': return TokenType.SLOT;
      default: return null;
    }
  }
  
  private skipWhitespace(): void {
    while (true) {
      const char = this.current();
      
      switch (char) {
        case ' ':
        case '\r':
        case '\t':
          this.advance();
          break;
        case '\n':
          this.line++;
          this.column = 0;
          this.advance();
          break;
        default:
          return;
      }
    }
  }
  
  private skipLineComment(): void {
    while (this.current() !== '\n' && !this.isAtEnd()) {
      this.advance();
    }
  }
  
  private skipBlockComment(): void {
    this.advance(); // Skip /
    this.advance(); // Skip *
    
    while (!this.isAtEnd()) {
      if (this.current() === '*' && this.peek() === '/') {
        this.advance();
        this.advance();
        return;
      }
      
      if (this.current() === '\n') {
        this.line++;
        this.column = 0;
      }
      
      this.advance();
    }
  }
  
  // Helper methods
  private current(): string {
    if (this.isAtEnd()) return '\0';
    return this.source[this.position];
  }
  
  private peek(): string {
    if (this.position + 1 >= this.source.length) return '\0';
    return this.source[this.position + 1];
  }
  
  private peekNext(): string {
    if (this.position + 2 >= this.source.length) return '\0';
    return this.source[this.position + 2];
  }
  
  private advance(count: number = 1): void {
    for (let i = 0; i < count; i++) {
      if (!this.isAtEnd()) {
        this.position++;
        this.column++;
      }
    }
  }
  
  private isAtEnd(): boolean {
    return this.position >= this.source.length;
  }
  
  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }
  
  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') ||
           (char >= 'A' && char <= 'Z') ||
           char === '_';
  }
  
  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }
  
  private makeToken(type: TokenType | string, value: string, column: number): Token {
    return {
      type,
      value,
      line: this.line,
      column
    };
  }
  
  // Public methods for parser
  public nextToken(): Token {
    if (this.tokens.length === 0) {
      return this.makeToken(TokenType.EOF, '', this.column);
    }
    return this.tokens.shift()!;
  }
  
  public peekToken(): Token | null {
    return this.tokens[0] || null;
  }
  
  private scanTemplateString(): Token {
    const startColumn = this.column;
    this.advance(); // Skip opening backtick
    
    let value = '';
    let parts: string[] = [];
    
    while (this.current() !== '`' && !this.isAtEnd()) {
      if (this.current() === '$' && this.peek() === '{') {
        // Handle interpolation
        if (value) {
          parts.push(value);
          value = '';
        }
        this.advance(2); // Skip ${
        
        // Scan until closing brace
        let braceCount = 1;
        let interpolation = '';
        while (braceCount > 0 && !this.isAtEnd()) {
          if (this.current() === '{') braceCount++;
          if (this.current() === '}') braceCount--;
          if (braceCount > 0) {
            interpolation += this.current();
          }
          this.advance();
        }
        parts.push('${' + interpolation + '}');
      } else {
        if (this.current() === '\\') {
          this.advance();
          // Handle escape sequences in template strings
          switch (this.current()) {
            case 'n': value += '\n'; break;
            case 't': value += '\t'; break;
            case 'r': value += '\r'; break;
            case '\\': value += '\\'; break;
            case '`': value += '`'; break;
            case '$': value += '$'; break;
            default: value += this.current();
          }
        } else {
          value += this.current();
        }
        this.advance();
      }
    }
    
    if (value) {
      parts.push(value);
    }
    
    if (this.isAtEnd()) {
      throw new Error(`Unterminated template string at line ${this.line}`);
    }
    
    this.advance(); // Skip closing backtick
    
    return this.makeToken(TokenType.TEMPLATE_STRING, parts.join(''), startColumn);
  }
}
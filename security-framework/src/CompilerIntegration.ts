import { TemplateCompilerXSS, EscapingContext, XSSProtection } from './XSSProtection';

export interface CompilerNode {
  type: string;
  value?: string;
  raw?: string;
  children?: CompilerNode[];
  attributes?: Record<string, string>;
  start?: number;
  end?: number;
}

export interface CompilerOptions {
  enableXSSProtection?: boolean;
  strictMode?: boolean;
  allowUnsafeHTML?: boolean;
  customEscaper?: (value: string, context: EscapingContext) => string;
}

/**
 * Eghact template compiler with integrated XSS protection
 */
export class SecureTemplateCompiler {
  private xssProtection: TemplateCompilerXSS;
  private options: Required<CompilerOptions>;

  constructor(options: CompilerOptions = {}) {
    this.options = {
      enableXSSProtection: options.enableXSSProtection ?? true,
      strictMode: options.strictMode ?? true,
      allowUnsafeHTML: options.allowUnsafeHTML ?? false,
      customEscaper: options.customEscaper || this.defaultEscaper
    };

    this.xssProtection = new TemplateCompilerXSS({
      allowHTML: this.options.allowUnsafeHTML,
      strictMode: this.options.strictMode
    });
  }

  /**
   * Transform template interpolations to include automatic XSS escaping
   */
  transformTemplate(template: string): string {
    if (!this.options.enableXSSProtection) {
      return template;
    }

    // Process template interpolations {expression}
    let transformed = template;
    const interpolationRegex = /\{([^}]+)\}/g;
    let match;
    let offset = 0;

    while ((match = interpolationRegex.exec(template)) !== null) {
      const [fullMatch, expression] = match;
      const position = match.index + offset;
      
      // Analyze the context where this interpolation appears
      const context = this.xssProtection.analyzeContext(transformed, position);
      
      // Generate escaped interpolation
      const escapedExpression = this.processInterpolation(expression.trim(), context);
      
      // Replace in transformed template
      const before = transformed.substring(0, position);
      const after = transformed.substring(position + fullMatch.length);
      transformed = before + `{${escapedExpression}}` + after;
      
      // Adjust offset for next iteration
      offset += escapedExpression.length - expression.length;
    }

    return transformed;
  }

  /**
   * Transform AST nodes to include XSS protection
   */
  transformAST(ast: CompilerNode[]): CompilerNode[] {
    if (!this.options.enableXSSProtection) {
      return ast;
    }

    return ast.map(node => this.transformNode(node));
  }

  private transformNode(node: CompilerNode, parentContext?: EscapingContext): CompilerNode {
    const transformed = { ...node };

    // Transform interpolations in text nodes
    if (node.type === 'text' && node.value) {
      transformed.value = this.transformTextContent(node.value);
    }

    // Transform interpolations in attributes
    if (node.type === 'element' && node.attributes) {
      transformed.attributes = this.transformAttributes(node.attributes);
    }

    // Transform interpolations in specific contexts
    if (node.type === 'interpolation' && node.value) {
      const context = this.determineNodeContext(node, parentContext);
      transformed.value = this.processInterpolation(node.value, context);
    }

    // Recursively transform children
    if (node.children) {
      const childContext = this.getChildContext(node);
      transformed.children = node.children.map(child => 
        this.transformNode(child, childContext)
      );
    }

    return transformed;
  }

  private transformTextContent(text: string): string {
    // Replace interpolations in text content
    return text.replace(/\{([^}]+)\}/g, (match, expression) => {
      const context: EscapingContext = { type: 'text' };
      const escaped = this.processInterpolation(expression.trim(), context);
      return `{${escaped}}`;
    });
  }

  private transformAttributes(attributes: Record<string, string>): Record<string, string> {
    const transformed: Record<string, string> = {};

    for (const [attrName, attrValue] of Object.entries(attributes)) {
      // Transform interpolations in attribute values
      const transformedValue = attrValue.replace(/\{([^}]+)\}/g, (match, expression) => {
        const context: EscapingContext = { 
          type: 'attribute', 
          attributeName: attrName 
        };
        const escaped = this.processInterpolation(expression.trim(), context);
        return `{${escaped}}`;
      });

      transformed[attrName] = transformedValue;
    }

    return transformed;
  }

  private processInterpolation(expression: string, context: EscapingContext): string {
    // Check if expression is explicitly marked as unsafe
    if (this.isUnsafeExpression(expression)) {
      if (!this.options.allowUnsafeHTML) {
        throw new Error(`Unsafe HTML expression not allowed: ${expression}`);
      }
      return this.extractUnsafeExpression(expression);
    }

    // Use XSS protection to generate escaped interpolation
    return this.xssProtection.processInterpolation(expression, context);
  }

  private isUnsafeExpression(expression: string): boolean {
    // Check if expression uses @html directive or unsafe() function
    return /^@html\s+/.test(expression) || 
           /\bunsafe\s*\(/.test(expression) ||
           /\bEghactUnsafeHTML\s*\(/.test(expression);
  }

  private extractUnsafeExpression(expression: string): string {
    // Remove @html directive
    if (expression.startsWith('@html ')) {
      return expression.substring(6).trim();
    }

    // For unsafe() function calls, return as-is (runtime will handle)
    return expression;
  }

  private determineNodeContext(node: CompilerNode, parentContext?: EscapingContext): EscapingContext {
    if (parentContext) {
      return parentContext;
    }

    // Default to text context
    return { type: 'text' };
  }

  private getChildContext(node: CompilerNode): EscapingContext | undefined {
    if (node.type === 'element') {
      const tagName = node.attributes?.tag || '';
      
      if (tagName === 'style') {
        return { type: 'style' };
      } else if (tagName === 'script') {
        return { type: 'script' };
      }
    }

    return undefined;
  }

  private defaultEscaper(value: string, context: EscapingContext): string {
    const xss = new XSSProtection();
    return xss.escapeForContext(value, context);
  }

  /**
   * Generate the runtime XSS protection code to inject into compiled output
   */
  generateRuntimeInjection(): string {
    if (!this.options.enableXSSProtection) {
      return '';
    }

    return this.xssProtection.generateRuntimeCode();
  }

  /**
   * Validate and sanitize template before compilation
   */
  validateTemplate(template: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for obviously dangerous patterns
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript\s*:/gi,
      /on\w+\s*=\s*["'][^"']*["']/gi,
      /<iframe\b/gi,
      /<object\b/gi,
      /<embed\b/gi
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(template)) {
        errors.push(`Potentially dangerous pattern detected: ${pattern.source}`);
      }
    }

    // Check for unescaped interpolations in dangerous contexts
    const scriptContextRegex = /<script[^>]*>[\s\S]*?\{[^}]+\}[\s\S]*?<\/script>/gi;
    if (scriptContextRegex.test(template)) {
      errors.push('Interpolations in script tags require explicit unsafe marking');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create development-mode warnings for potential security issues
   */
  createSecurityWarnings(template: string): string[] {
    const warnings: string[] = [];

    // Warn about @html usage
    if (/@html\s+/.test(template)) {
      warnings.push('Using @html directive - ensure content is trusted');
    }

    // Warn about unsafe() usage
    if (/\bunsafe\s*\(/.test(template)) {
      warnings.push('Using unsafe() function - ensure content is sanitized');
    }

    // Warn about href attributes with user content
    const hrefRegex = /href\s*=\s*["']\{[^}]+\}["']/gi;
    if (hrefRegex.test(template)) {
      warnings.push('Dynamic href attributes detected - ensure URLs are validated');
    }

    return warnings;
  }
}

/**
 * Utility functions for compile-time security analysis
 */
export class SecurityAnalyzer {
  /**
   * Analyze template for security vulnerabilities
   */
  static analyzeTemplate(template: string): {
    riskLevel: 'low' | 'medium' | 'high';
    vulnerabilities: string[];
    recommendations: string[];
  } {
    const vulnerabilities: string[] = [];
    const recommendations: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Check for high-risk patterns
    if (/<script/i.test(template) && /\{[^}]+\}/.test(template)) {
      vulnerabilities.push('Script tag contains interpolations');
      recommendations.push('Use @html directive only with trusted content');
      riskLevel = 'high';
    }

    // Check for medium-risk patterns
    if (/href\s*=\s*["']\{[^}]+\}["']/i.test(template)) {
      vulnerabilities.push('Dynamic URL in href attribute');
      recommendations.push('Validate URLs to prevent javascript: injection');
      if (riskLevel === 'low') riskLevel = 'medium';
    }

    if (/style\s*=\s*["']\{[^}]+\}["']/i.test(template)) {
      vulnerabilities.push('Dynamic CSS in style attribute');
      recommendations.push('Sanitize CSS to prevent expression() attacks');
      if (riskLevel === 'low') riskLevel = 'medium';
    }

    // Check for unsafe usage
    if (/@html\s+/.test(template) || /\bunsafe\s*\(/.test(template)) {
      vulnerabilities.push('Explicit unsafe content usage');
      recommendations.push('Ensure all unsafe content is properly sanitized');
      if (riskLevel === 'low') riskLevel = 'medium';
    }

    return { riskLevel, vulnerabilities, recommendations };
  }

  /**
   * Generate security report for a template
   */
  static generateSecurityReport(template: string): string {
    const analysis = this.analyzeTemplate(template);
    
    let report = `Security Analysis Report\n`;
    report += `========================\n\n`;
    report += `Risk Level: ${analysis.riskLevel.toUpperCase()}\n\n`;

    if (analysis.vulnerabilities.length > 0) {
      report += `Vulnerabilities Found:\n`;
      analysis.vulnerabilities.forEach((vuln, i) => {
        report += `${i + 1}. ${vuln}\n`;
      });
      report += `\n`;
    }

    if (analysis.recommendations.length > 0) {
      report += `Recommendations:\n`;
      analysis.recommendations.forEach((rec, i) => {
        report += `${i + 1}. ${rec}\n`;
      });
    }

    return report;
  }
}
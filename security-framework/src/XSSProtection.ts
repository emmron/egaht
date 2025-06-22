import * as he from 'he';
import validator from 'validator';

export interface XSSProtectionOptions {
  allowedTags?: string[];
  allowedAttributes?: string[];
  allowHTML?: boolean;
  strictMode?: boolean;
  customSanitizer?: (input: string) => string;
}

export interface EscapingContext {
  type: 'text' | 'attribute' | 'url' | 'style' | 'script';
  attributeName?: string;
  strict?: boolean;
}

/**
 * Comprehensive XSS protection system for Eghact templates
 * Provides automatic escaping with context-aware sanitization
 */
export class XSSProtection {
  private static readonly DEFAULT_ALLOWED_TAGS = [
    'p', 'br', 'strong', 'em', 'u', 'i', 'b', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
    'a', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th'
  ];

  private static readonly DEFAULT_ALLOWED_ATTRIBUTES = [
    'href', 'src', 'alt', 'title', 'class', 'id', 'style',
    'width', 'height', 'target', 'rel'
  ];

  private static readonly DANGEROUS_URL_PROTOCOLS = [
    'javascript:', 'data:', 'vbscript:', 'file:', 'ftp:'
  ];

  private options: Required<XSSProtectionOptions>;

  constructor(options: XSSProtectionOptions = {}) {
    this.options = {
      allowedTags: options.allowedTags || XSSProtection.DEFAULT_ALLOWED_TAGS,
      allowedAttributes: options.allowedAttributes || XSSProtection.DEFAULT_ALLOWED_ATTRIBUTES,
      allowHTML: options.allowHTML ?? false,
      strictMode: options.strictMode ?? true,
      customSanitizer: options.customSanitizer || this.defaultSanitizer
    };
  }

  /**
   * Main escape function for template interpolations
   */
  escapeForContext(input: any, context: EscapingContext): string {
    if (input == null) return '';
    
    const stringInput = String(input);
    
    switch (context.type) {
      case 'text':
        return this.escapeText(stringInput, context.strict);
      case 'attribute':
        return this.escapeAttribute(stringInput, context.attributeName);
      case 'url':
        return this.escapeURL(stringInput);
      case 'style':
        return this.escapeStyle(stringInput);
      case 'script':
        return this.escapeScript(stringInput);
      default:
        return this.escapeText(stringInput, true);
    }
  }

  /**
   * Escape text content (default for template interpolations)
   */
  escapeText(input: string, strict = true): string {
    if (!input) return '';

    // Basic HTML entity encoding
    let escaped = he.encode(input, {
      useNamedReferences: true,
      decimal: false,
      encodeEverything: strict
    });

    // Additional protection for dangerous patterns
    if (strict) {
      escaped = this.neutralizeDangerousPatterns(escaped);
    }

    return escaped;
  }

  /**
   * Escape attribute values
   */
  escapeAttribute(input: string, attributeName?: string): string {
    if (!input) return '';

    // Special handling for specific attributes
    if (attributeName) {
      switch (attributeName.toLowerCase()) {
        case 'href':
        case 'src':
          return this.escapeURL(input);
        case 'style':
          return this.escapeStyle(input);
        case 'onclick':
        case 'onload':
        case 'onerror':
          // Never allow event handlers in escaped content
          return '';
      }
    }

    // Standard attribute escaping
    return he.encode(input, {
      useNamedReferences: true,
      allowUnsafeSymbols: false,
      encodeEverything: true
    });
  }

  /**
   * Escape URL values
   */
  escapeURL(input: string): string {
    if (!input) return '';

    // Check for dangerous protocols
    const lowercaseInput = input.toLowerCase().trim();
    for (const protocol of XSSProtection.DANGEROUS_URL_PROTOCOLS) {
      if (lowercaseInput.startsWith(protocol)) {
        return '#'; // Replace with safe placeholder
      }
    }

    // Validate URL format
    if (!validator.isURL(input, { 
      protocols: ['http', 'https', 'mailto', 'tel'],
      require_protocol: false
    })) {
      // If it's not a valid URL but looks like a relative path, allow it
      if (input.startsWith('/') || input.startsWith('./') || input.startsWith('../')) {
        return encodeURI(input);
      }
      return '#'; // Replace invalid URLs
    }

    return encodeURI(input);
  }

  /**
   * Escape CSS style values
   */
  escapeStyle(input: string): string {
    if (!input) return '';

    // Remove dangerous CSS patterns
    let cleaned = input
      .replace(/expression\s*\(/gi, '') // IE expression()
      .replace(/javascript\s*:/gi, '') // javascript: URLs
      .replace//@import/gi, '') // @import rules
      .replace(/url\s*\(\s*['"]?javascript:/gi, ''); // javascript URLs in url()

    // Encode special characters
    return he.encode(cleaned, {
      useNamedReferences: false,
      decimal: true
    });
  }

  /**
   * Escape content for script contexts (should rarely be used)
   */
  escapeScript(input: string): string {
    if (!input) return '';

    // In script context, we need to escape quotes and backslashes
    return input
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/</g, '\\u003C')
      .replace(/>/g, '\\u003E');
  }

  /**
   * Sanitize HTML content (when allowHTML is enabled)
   */
  sanitizeHTML(input: string): string {
    if (!this.options.allowHTML) {
      return this.escapeText(input);
    }

    return this.options.customSanitizer(input);
  }

  /**
   * Create an "unsafe" wrapper for trusted content
   */
  static unsafe(content: string): UnsafeHTML {
    return new UnsafeHTML(content);
  }

  /**
   * Check if content is marked as unsafe/trusted
   */
  static isUnsafe(content: any): content is UnsafeHTML {
    return content instanceof UnsafeHTML;
  }

  private defaultSanitizer(input: string): string {
    // Basic HTML sanitization - remove script tags and dangerous attributes
    let sanitized = input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
      .replace(/javascript\s*:/gi, ''); // Remove javascript: URLs

    // Allow only whitelisted tags and attributes
    return this.filterAllowedTags(sanitized);
  }

  private filterAllowedTags(input: string): string {
    // Simple tag filtering (in production, use a proper HTML parser)
    const tagRegex = /<(\/?)([\w-]+)([^>]*)>/gi;
    
    return input.replace(tagRegex, (match, closing, tagName, attributes) => {
      const isClosing = closing === '/';
      const normalizedTag = tagName.toLowerCase();

      if (!this.options.allowedTags.includes(normalizedTag)) {
        return ''; // Remove disallowed tags
      }

      if (isClosing) {
        return `</${normalizedTag}>`;
      }

      // Filter attributes
      const filteredAttributes = this.filterAllowedAttributes(attributes);
      return `<${normalizedTag}${filteredAttributes}>`;
    });
  }

  private filterAllowedAttributes(attributes: string): string {
    if (!attributes) return '';

    const attrRegex = /\s+([\w-]+)\s*=\s*["']([^"']*)["']/gi;
    const allowed: string[] = [];

    let match;
    while ((match = attrRegex.exec(attributes)) !== null) {
      const [, attrName, attrValue] = match;
      const normalizedAttr = attrName.toLowerCase();

      if (this.options.allowedAttributes.includes(normalizedAttr)) {
        const escapedValue = this.escapeAttribute(attrValue, normalizedAttr);
        allowed.push(` ${normalizedAttr}="${escapedValue}"`);
      }
    }

    return allowed.join('');
  }

  private neutralizeDangerousPatterns(input: string): string {
    return input
      // Neutralize potential script injection patterns
      .replace(/&lt;script/gi, '&amp;lt;script')
      .replace(/&lt;\/script/gi, '&amp;lt;/script')
      .replace(/&lt;iframe/gi, '&amp;lt;iframe')
      .replace(/&lt;object/gi, '&amp;lt;object')
      .replace(/&lt;embed/gi, '&amp;lt;embed')
      // Neutralize event handler patterns
      .replace(/on\w+\s*=/gi, (match) => match.replace('=', '&#61;'));
  }
}

/**
 * Wrapper class for trusted HTML content
 */
export class UnsafeHTML {
  constructor(public readonly content: string) {}

  toString(): string {
    return this.content;
  }
}

/**
 * Template compiler integration functions
 */
export class TemplateCompilerXSS {
  private xss: XSSProtection;

  constructor(options?: XSSProtectionOptions) {
    this.xss = new XSSProtection(options);
  }

  /**
   * Process template interpolation with automatic escaping
   */
  processInterpolation(expression: string, context: EscapingContext = { type: 'text' }): string {
    // Generate code that will escape at runtime
    const contextJSON = JSON.stringify(context);
    
    // If it's marked as unsafe, use the content directly
    return `
      (function(value) {
        if (typeof value === 'object' && value && value.constructor.name === 'UnsafeHTML') {
          return value.content;
        }
        return __eghact_xss.escapeForContext(value, ${contextJSON});
      })(${expression})
    `;
  }

  /**
   * Analyze template to determine escaping context
   */
  analyzeContext(template: string, position: number): EscapingContext {
    // Look backwards from position to determine context
    const beforePosition = template.substring(0, position);
    
    // Check if we're inside an attribute
    const lastTagMatch = beforePosition.match(/<\w+[^>]*$/);
    if (lastTagMatch) {
      const tagContent = lastTagMatch[0];
      const attrMatch = tagContent.match(/\s+([\w-]+)\s*=\s*["']?[^"']*$/);
      
      if (attrMatch) {
        const attributeName = attrMatch[1].toLowerCase();
        
        if (['href', 'src', 'action'].includes(attributeName)) {
          return { type: 'url', attributeName };
        } else if (attributeName === 'style') {
          return { type: 'style', attributeName };
        } else {
          return { type: 'attribute', attributeName };
        }
      }
    }

    // Check if we're inside a style tag
    if (/<style[^>]*>[\s\S]*$/i.test(beforePosition) && 
        !/<\/style>/i.test(beforePosition.match(/<style[^>]*>[\s\S]*$/i)?.[0] || '')) {
      return { type: 'style' };
    }

    // Check if we're inside a script tag
    if (/<script[^>]*>[\s\S]*$/i.test(beforePosition) && 
        !/<\/script>/i.test(beforePosition.match(/<script[^>]*>[\s\S]*$/i)?.[0] || '')) {
      return { type: 'script' };
    }

    // Default to text context
    return { type: 'text' };
  }

  /**
   * Generate runtime XSS protection injection code
   */
  generateRuntimeCode(): string {
    return `
      // Eghact XSS Protection Runtime
      const __eghact_xss = new (${XSSProtection.toString()})({
        allowHTML: false,
        strictMode: true
      });
      
      // Make UnsafeHTML available globally
      window.EghactUnsafeHTML = ${UnsafeHTML.toString()};
      
      // Helper function for creating unsafe content
      window.eghactUnsafe = function(content) {
        return new window.EghactUnsafeHTML(content);
      };
    `;
  }
}
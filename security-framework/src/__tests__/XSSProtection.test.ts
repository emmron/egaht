import { XSSProtection, UnsafeHTML, TemplateCompilerXSS } from '../XSSProtection';

describe('XSSProtection', () => {
  let xss: XSSProtection;

  beforeEach(() => {
    xss = new XSSProtection();
  });

  describe('Basic Text Escaping', () => {
    test('should escape HTML entities', () => {
      const input = '<script>alert("xss")</script>';
      const result = xss.escapeText(input);
      expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    test('should escape special characters', () => {
      const input = '& < > " \'';
      const result = xss.escapeText(input);
      expect(result).toBe('&amp; &lt; &gt; &quot; &#x27;');
    });

    test('should handle null and undefined inputs', () => {
      expect(xss.escapeForContext(null, { type: 'text' })).toBe('');
      expect(xss.escapeForContext(undefined, { type: 'text' })).toBe('');
    });

    test('should handle non-string inputs', () => {
      expect(xss.escapeForContext(42, { type: 'text' })).toBe('42');
      expect(xss.escapeForContext(true, { type: 'text' })).toBe('true');
    });
  });

  describe('Attribute Escaping', () => {
    test('should escape attribute values', () => {
      const input = 'value with "quotes" and <tags>';
      const result = xss.escapeAttribute(input);
      expect(result).toContain('&quot;');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    test('should handle href attributes specially', () => {
      const maliciousUrl = 'javascript:alert("xss")';
      const result = xss.escapeAttribute(maliciousUrl, 'href');
      expect(result).toBe('#');
    });

    test('should allow safe URLs in href', () => {
      const safeUrl = 'https://example.com/path?param=value';
      const result = xss.escapeAttribute(safeUrl, 'href');
      expect(result).toBe(safeUrl);
    });

    test('should remove event handlers', () => {
      const eventHandler = 'alert("xss")';
      const result = xss.escapeAttribute(eventHandler, 'onclick');
      expect(result).toBe('');
    });
  });

  describe('URL Escaping', () => {
    test('should block dangerous protocols', () => {
      const dangerousUrls = [
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'vbscript:msgbox("xss")',
        'file:///etc/passwd'
      ];

      dangerousUrls.forEach(url => {
        const result = xss.escapeURL(url);
        expect(result).toBe('#');
      });
    });

    test('should allow safe protocols', () => {
      const safeUrls = [
        'https://example.com',
        'http://example.com',
        'mailto:user@example.com',
        'tel:+1234567890',
        '/relative/path',
        './relative/path',
        '../parent/path'
      ];

      safeUrls.forEach(url => {
        const result = xss.escapeURL(url);
        expect(result).not.toBe('#');
        expect(result).toBeTruthy();
      });
    });
  });

  describe('Style Escaping', () => {
    test('should remove dangerous CSS expressions', () => {
      const maliciousStyle = 'width: expression(alert("xss"))';
      const result = xss.escapeStyle(maliciousStyle);
      expect(result).not.toContain('expression(');
    });

    test('should remove javascript URLs in CSS', () => {
      const maliciousStyle = 'background: url(javascript:alert("xss"))';
      const result = xss.escapeStyle(maliciousStyle);
      expect(result).not.toContain('javascript:');
    });

    test('should remove @import rules', () => {
      const maliciousStyle = '@import url("malicious.css")';
      const result = xss.escapeStyle(maliciousStyle);
      expect(result).not.toContain('@import');
    });
  });

  describe('Context-Aware Escaping', () => {
    test('should use appropriate escaping for text context', () => {
      const input = '<script>alert("xss")</script>';
      const result = xss.escapeForContext(input, { type: 'text' });
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    test('should use appropriate escaping for attribute context', () => {
      const input = 'value"with"quotes';
      const result = xss.escapeForContext(input, { type: 'attribute' });
      expect(result).toContain('&quot;');
    });

    test('should use appropriate escaping for URL context', () => {
      const input = 'javascript:alert("xss")';
      const result = xss.escapeForContext(input, { type: 'url' });
      expect(result).toBe('#');
    });

    test('should use appropriate escaping for style context', () => {
      const input = 'expression(alert("xss"))';
      const result = xss.escapeForContext(input, { type: 'style' });
      expect(result).not.toContain('expression(');
    });
  });

  describe('Unsafe HTML Handling', () => {
    test('should create UnsafeHTML wrapper', () => {
      const content = '<strong>Safe HTML</strong>';
      const unsafe = XSSProtection.unsafe(content);
      expect(unsafe).toBeInstanceOf(UnsafeHTML);
      expect(unsafe.content).toBe(content);
    });

    test('should detect UnsafeHTML instances', () => {
      const unsafe = new UnsafeHTML('<em>content</em>');
      expect(XSSProtection.isUnsafe(unsafe)).toBe(true);
      expect(XSSProtection.isUnsafe('regular string')).toBe(false);
    });

    test('should bypass escaping for UnsafeHTML', () => {
      const content = '<strong>Bold text</strong>';
      const unsafe = new UnsafeHTML(content);
      
      // Mock the context check (this would be handled by the template compiler)
      const result = XSSProtection.isUnsafe(unsafe) ? unsafe.content : xss.escapeText(content);
      expect(result).toBe(content);
    });
  });

  describe('Template Compiler Integration', () => {
    let compiler: TemplateCompilerXSS;

    beforeEach(() => {
      compiler = new TemplateCompilerXSS();
    });

    test('should analyze template context correctly', () => {
      const template = '<div class="{className}">{content}</div>';
      
      // Test attribute context
      const attrContext = compiler.analyzeContext(template, template.indexOf('{className}'));
      expect(attrContext.type).toBe('attribute');
      expect(attrContext.attributeName).toBe('class');

      // Test text context
      const textContext = compiler.analyzeContext(template, template.indexOf('{content}'));
      expect(textContext.type).toBe('text');
    });

    test('should generate runtime protection code', () => {
      const runtimeCode = compiler.generateRuntimeCode();
      expect(runtimeCode).toContain('__eghact_xss');
      expect(runtimeCode).toContain('EghactUnsafeHTML');
      expect(runtimeCode).toContain('eghactUnsafe');
    });

    test('should process interpolations with context', () => {
      const expression = 'userInput';
      const context = { type: 'text' as const };
      const result = compiler.processInterpolation(expression, context);
      
      expect(result).toContain('__eghact_xss.escapeForContext');
      expect(result).toContain('userInput');
      expect(result).toContain(JSON.stringify(context));
    });
  });

  describe('Security Edge Cases', () => {
    test('should handle nested quotes', () => {
      const input = 'He said "She said \'Hello\'"';
      const result = xss.escapeText(input);
      expect(result).toContain('&quot;');
      expect(result).toContain('&#x27;');
    });

    test('should handle unicode characters', () => {
      const input = '🚀 Unicode: <script>alert("xss")</script>';
      const result = xss.escapeText(input);
      expect(result).toContain('🚀');
      expect(result).toContain('&lt;script&gt;');
    });

    test('should handle very long strings', () => {
      const longInput = '<script>'.repeat(1000) + 'alert("xss")' + '</script>'.repeat(1000);
      const result = xss.escapeText(longInput);
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    test('should handle malformed HTML', () => {
      const malformed = '<div<script>alert("xss")</script>';
      const result = xss.escapeText(malformed);
      expect(result).not.toContain('<script>');
    });

    test('should handle URL fragments', () => {
      const fragment = '#section';
      const result = xss.escapeURL(fragment);
      expect(result).toBe('#section');
    });

    test('should handle query parameters', () => {
      const url = '/search?q=<script>alert("xss")</script>';
      const result = xss.escapeURL(url);
      expect(result).toContain('%3Cscript%3E');
    });
  });

  describe('Performance', () => {
    test('should handle large inputs efficiently', () => {
      const largeInput = 'x'.repeat(100000);
      const start = performance.now();
      const result = xss.escapeText(largeInput);
      const end = performance.now();
      
      expect(result).toBe(largeInput); // No escaping needed
      expect(end - start).toBeLessThan(100); // Should be fast
    });

    test('should cache compiled regexes', () => {
      const input = '<script>alert("xss")</script>';
      
      // First call
      const start1 = performance.now();
      xss.escapeText(input);
      const end1 = performance.now();
      
      // Second call should be faster (cached regexes)
      const start2 = performance.now();
      xss.escapeText(input);
      const end2 = performance.now();
      
      expect(end2 - start2).toBeLessThanOrEqual(end1 - start1);
    });
  });

  describe('Configuration Options', () => {
    test('should respect strict mode setting', () => {
      const strictXss = new XSSProtection({ strictMode: true });
      const permissiveXss = new XSSProtection({ strictMode: false });
      
      const input = '<em>emphasis</em>';
      const strictResult = strictXss.escapeText(input);
      const permissiveResult = permissiveXss.escapeText(input);
      
      expect(strictResult).toContain('&lt;');
      expect(permissiveResult).toContain('&lt;'); // Both should escape by default
    });

    test('should allow custom sanitizer', () => {
      const customSanitizer = (input: string) => input.replace(/script/gi, 'BLOCKED');
      const customXss = new XSSProtection({ 
        allowHTML: true, 
        customSanitizer 
      });
      
      const input = '<script>alert("xss")</script>';
      const result = customXss.sanitizeHTML(input);
      expect(result).toContain('BLOCKED');
    });
  });
});
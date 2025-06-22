import { readFile, writeFile } from 'fs/promises';
import path from 'path';

export class CriticalCSSExtractor {
  constructor(config = {}) {
    this.config = {
      viewport: { width: 1300, height: 900 },
      minificationLevel: 'basic', // 'none', 'basic', 'aggressive'
      inlineThreshold: 14000, // 14KB recommendation
      timeout: 30000,
      ...config
    };
    this.cache = new Map();
  }

  async extractCritical(html, cssFiles, options = {}) {
    const config = { ...this.config, ...options };
    
    try {
      // Parse HTML to understand structure
      const dom = this.parseHTML(html);
      
      // Extract critical selectors from above-the-fold content
      const criticalSelectors = this.extractCriticalSelectors(dom, config.viewport);
      
      // Process each CSS file
      let criticalCSS = '';
      for (const cssFile of cssFiles) {
        const css = await this.loadCSS(cssFile);
        const critical = this.extractCriticalRules(css, criticalSelectors);
        criticalCSS += critical;
      }

      // Minify if requested
      if (config.minificationLevel !== 'none') {
        criticalCSS = this.minifyCSS(criticalCSS, config.minificationLevel);
      }

      // Check size threshold
      const size = new TextEncoder().encode(criticalCSS).length;
      if (size > config.inlineThreshold) {
        console.warn(`Critical CSS (${size} bytes) exceeds recommended threshold (${config.inlineThreshold} bytes)`);
      }

      return {
        css: criticalCSS,
        size,
        selectors: criticalSelectors.length,
        rules: this.countRules(criticalCSS)
      };
    } catch (error) {
      console.error('Critical CSS extraction failed:', error);
      return { css: '', size: 0, selectors: 0, rules: 0, error: error.message };
    }
  }

  parseHTML(html) {
    // Simple HTML parsing to extract elements and their positions
    const elements = [];
    const elementRegex = /<(\w+)([^>]*?)>/g;
    let match;

    while ((match = elementRegex.exec(html)) !== null) {
      const tagName = match[1].toLowerCase();
      const attributes = this.parseAttributes(match[2]);
      
      elements.push({
        tagName,
        attributes,
        position: match.index,
        className: attributes.class || '',
        id: attributes.id || ''
      });
    }

    return { elements };
  }

  parseAttributes(attrString) {
    const attributes = {};
    const attrRegex = /(\w+)=["']([^"']*?)["']/g;
    let match;

    while ((match = attrRegex.exec(attrString)) !== null) {
      attributes[match[1]] = match[2];
    }

    return attributes;
  }

  extractCriticalSelectors(dom, viewport) {
    const criticalSelectors = new Set();
    
    // Always include base elements
    const baseSelectors = [
      'html', 'body', '*', '::before', '::after',
      'h1', 'h2', 'h3', 'p', 'a', 'img', 'button'
    ];
    baseSelectors.forEach(selector => criticalSelectors.add(selector));

    // Extract from HTML elements (simplified - real implementation would use browser)
    dom.elements.forEach(element => {
      // Tag selectors
      criticalSelectors.add(element.tagName);
      
      // Class selectors
      if (element.className) {
        element.className.split(/\s+/).forEach(className => {
          if (className.trim()) {
            criticalSelectors.add(`.${className}`);
          }
        });
      }
      
      // ID selectors
      if (element.id) {
        criticalSelectors.add(`#${element.id}`);
      }
    });

    // Add common critical selectors
    const commonCritical = [
      '.container', '.wrapper', '.header', '.nav', '.main', '.hero',
      '.above-fold', '.fold', '.banner', '.logo', '.menu', '.navigation',
      '.content', '.sidebar', '.footer-above-fold'
    ];
    commonCritical.forEach(selector => criticalSelectors.add(selector));

    return Array.from(criticalSelectors);
  }

  extractCriticalRules(css, criticalSelectors) {
    let criticalCSS = '';
    const rules = this.parseCSS(css);
    
    for (const rule of rules) {
      if (this.isCriticalRule(rule, criticalSelectors)) {
        criticalCSS += rule.raw + '\n';
      }
    }

    return criticalCSS;
  }

  parseCSS(css) {
    const rules = [];
    let currentRule = '';
    let braceLevel = 0;
    let inRule = false;
    let ruleStart = 0;

    for (let i = 0; i < css.length; i++) {
      const char = css[i];
      currentRule += char;

      if (char === '{') {
        braceLevel++;
        if (braceLevel === 1) {
          inRule = true;
        }
      } else if (char === '}') {
        braceLevel--;
        if (braceLevel === 0 && inRule) {
          // End of rule
          const selector = currentRule.substring(0, currentRule.indexOf('{')).trim();
          rules.push({
            selector,
            raw: currentRule.trim(),
            start: ruleStart,
            end: i
          });
          currentRule = '';
          inRule = false;
          ruleStart = i + 1;
        }
      }
    }

    return rules;
  }

  isCriticalRule(rule, criticalSelectors) {
    const selector = rule.selector.toLowerCase();
    
    // Check for exact matches
    for (const criticalSelector of criticalSelectors) {
      if (selector.includes(criticalSelector.toLowerCase())) {
        return true;
      }
    }

    // Check for media queries (keep critical ones)
    if (selector.includes('@media')) {
      // Keep mobile-first media queries
      if (selector.includes('max-width') || selector.includes('min-width: 0')) {
        return true;
      }
    }

    // Check for keyframes used in critical animations
    if (selector.includes('@keyframes')) {
      const keyframeName = selector.match(/@keyframes\s+([^\s{]+)/);
      if (keyframeName && this.isCriticalAnimation(keyframeName[1])) {
        return true;
      }
    }

    // Check for font-face declarations
    if (selector.includes('@font-face')) {
      return true;
    }

    return false;
  }

  isCriticalAnimation(animationName) {
    const criticalAnimations = [
      'fadeIn', 'slideIn', 'loading', 'spinner', 'pulse', 'bounce'
    ];
    return criticalAnimations.some(name => 
      animationName.toLowerCase().includes(name.toLowerCase())
    );
  }

  minifyCSS(css, level = 'basic') {
    let minified = css;

    if (level === 'basic' || level === 'aggressive') {
      // Remove comments
      minified = minified.replace(/\/\*[\s\S]*?\*\//g, '');
      
      // Remove unnecessary whitespace
      minified = minified.replace(/\s+/g, ' ');
      minified = minified.replace(/\s*{\s*/g, '{');
      minified = minified.replace(/\s*}\s*/g, '}');
      minified = minified.replace(/\s*;\s*/g, ';');
      minified = minified.replace(/\s*:\s*/g, ':');
      minified = minified.replace(/\s*,\s*/g, ',');
      
      // Remove trailing semicolons
      minified = minified.replace(/;}/g, '}');
    }

    if (level === 'aggressive') {
      // Remove quotes around URLs when safe
      minified = minified.replace(/url\(["']([^"'()]+)["']\)/g, 'url($1)');
      
      // Compress colors
      minified = this.compressColors(minified);
      
      // Remove unnecessary units
      minified = minified.replace(/(\d)0px/g, '$1px');
      minified = minified.replace(/0px/g, '0');
    }

    return minified.trim();
  }

  compressColors(css) {
    // Compress hex colors
    css = css.replace(/#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3/gi, '#$1$2$3');
    
    // Convert named colors to shorter equivalents
    const colorMap = {
      'transparent': '0',
      'white': '#fff',
      'black': '#000'
    };
    
    Object.entries(colorMap).forEach(([name, short]) => {
      css = css.replace(new RegExp(`\\b${name}\\b`, 'gi'), short);
    });

    return css;
  }

  async loadCSS(cssFile) {
    // Check cache first
    if (this.cache.has(cssFile)) {
      return this.cache.get(cssFile);
    }

    try {
      let css;
      if (cssFile.startsWith('http')) {
        // External CSS
        const response = await fetch(cssFile);
        css = await response.text();
      } else {
        // Local CSS file
        css = await readFile(cssFile, 'utf8');
      }
      
      this.cache.set(cssFile, css);
      return css;
    } catch (error) {
      console.warn(`Could not load CSS file: ${cssFile}`, error.message);
      return '';
    }
  }

  countRules(css) {
    return (css.match(/}/g) || []).length;
  }

  async generateCriticalCSSFile(html, cssFiles, outputPath, options = {}) {
    const result = await this.extractCritical(html, cssFiles, options);
    
    if (result.css) {
      await writeFile(outputPath, result.css, 'utf8');
      console.log(`Critical CSS written to ${outputPath} (${result.size} bytes, ${result.rules} rules)`);
    }

    return result;
  }

  // Advanced: Extract critical CSS using headless browser (requires Puppeteer)
  async extractCriticalWithBrowser(url, cssFiles, options = {}) {
    // This would require Puppeteer for accurate above-the-fold detection
    // For now, return a placeholder that could be implemented
    console.warn('Browser-based critical CSS extraction not implemented. Use extractCritical() for static analysis.');
    
    return {
      css: '',
      size: 0,
      selectors: 0,
      rules: 0,
      method: 'browser',
      note: 'Requires Puppeteer implementation'
    };
  }

  // Utility: Analyze CSS usage
  async analyzeCSSUsage(html, cssFiles) {
    const analysis = {
      totalRules: 0,
      usedRules: 0,
      unusedRules: 0,
      criticalRules: 0,
      totalSize: 0,
      criticalSize: 0
    };

    for (const cssFile of cssFiles) {
      const css = await this.loadCSS(cssFile);
      const rules = this.parseCSS(css);
      const dom = this.parseHTML(html);
      const criticalSelectors = this.extractCriticalSelectors(dom, this.config.viewport);
      
      analysis.totalRules += rules.length;
      analysis.totalSize += new TextEncoder().encode(css).length;
      
      rules.forEach(rule => {
        if (this.isCriticalRule(rule, criticalSelectors)) {
          analysis.criticalRules++;
          analysis.criticalSize += new TextEncoder().encode(rule.raw).length;
        }
      });
    }

    analysis.criticalPercentage = (analysis.criticalRules / analysis.totalRules * 100).toFixed(1);
    analysis.sizePercentage = (analysis.criticalSize / analysis.totalSize * 100).toFixed(1);

    return analysis;
  }

  clearCache() {
    this.cache.clear();
  }
}
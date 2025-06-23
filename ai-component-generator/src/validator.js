/**
 * Validator for Eghact component code
 */
class EghactCodeValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Validate Eghact component code
   * @param {string} code - Component code to validate
   * @returns {Object} Validation result
   */
  validate(code) {
    this.errors = [];
    this.warnings = [];
    
    // Check for required tags
    this.validateStructure(code);
    
    // Check syntax basics
    this.validateSyntax(code);
    
    // Check component definition
    this.validateComponentTag(code);
    
    // Check template
    this.validateTemplate(code);
    
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  validateStructure(code) {
    if (!code.includes('<component>')) {
      this.errors.push('Missing <component> tag');
    }
    
    if (!code.includes('</component>')) {
      this.errors.push('Missing closing </component> tag');
    }
    
    if (!code.includes('<template>')) {
      this.errors.push('Missing <template> tag');
    }
  }

  validateSyntax(code) {
    // Check for balanced tags
    const openTags = (code.match(/<[^/][^>]*>/g) || []);
    const closeTags = (code.match(/<\/[^>]+>/g) || []);
    
    // Extract tag names
    const openTagNames = openTags.map(tag => {
      const match = tag.match(/<([^\s>]+)/);
      return match ? match[1] : null;
    }).filter(Boolean);
    
    const closeTagNames = closeTags.map(tag => {
      const match = tag.match(/<\/([^>]+)>/);
      return match ? match[1] : null;
    }).filter(Boolean);
    
    // Check for unclosed tags (basic check)
    const selfClosingTags = ['prop', 'state', 'br', 'hr', 'img', 'input'];
    openTagNames.forEach(tagName => {
      if (!selfClosingTags.includes(tagName) && !closeTagNames.includes(tagName)) {
        this.warnings.push(`Potentially unclosed tag: <${tagName}>`);
      }
    });
  }

  validateComponentTag(code) {
    // Extract component content
    const componentMatch = code.match(/<component>([\s\S]*)<\/component>/);
    if (!componentMatch) {
      return;
    }
    
    const componentContent = componentMatch[1];
    
    // Check for prop definitions
    const propMatches = componentContent.match(/<prop[^>]*>/g) || [];
    propMatches.forEach(prop => {
      if (!prop.includes('name=')) {
        this.errors.push('Prop tag missing name attribute');
      }
      if (!prop.includes('type=')) {
        this.warnings.push('Prop tag missing type attribute');
      }
    });
  }

  validateTemplate(code) {
    const templateMatch = code.match(/<template>([\s\S]*?)<\/template>/);
    if (!templateMatch) {
      return;
    }
    
    const templateContent = templateMatch[1];
    
    // Check for basic template structure
    if (templateContent.trim().length === 0) {
      this.errors.push('Template is empty');
    }
    
    // Check for Eghact event syntax
    const eventMatches = templateContent.match(/@\w+="/g) || [];
    eventMatches.forEach(event => {
      const eventName = event.match(/@(\w+)=/)[1];
      if (!['click', 'change', 'input', 'submit', 'focus', 'blur', 'keydown', 'keyup'].includes(eventName)) {
        this.warnings.push(`Unusual event handler: @${eventName}`);
      }
    });
    
    // Check for interpolation syntax
    const interpolations = templateContent.match(/{[^}]+}/g) || [];
    const hasEventHandlers = templateContent.match(/@\w+="/g) || [];
    
    // Only warn about static content if there are no interpolations AND no event handlers
    if (interpolations.length === 0 && hasEventHandlers.length === 0 && !templateContent.includes('static')) {
      this.warnings.push('No dynamic content found in template');
    }
  }
}

module.exports = {
  EghactCodeValidator
};
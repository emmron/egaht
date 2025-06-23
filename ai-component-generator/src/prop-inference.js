/**
 * Smart prop inference from natural language descriptions
 */

const PROP_MAPPINGS = {
  // Size mappings
  'small': { prop: 'size', value: 'sm' },
  'medium': { prop: 'size', value: 'md' },
  'large': { prop: 'size', value: 'lg' },
  'extra large': { prop: 'size', value: 'xl' },
  'xl': { prop: 'size', value: 'xl' },
  'tiny': { prop: 'size', value: 'xs' },
  
  // Color/variant mappings
  'primary': { prop: 'variant', value: 'primary' },
  'secondary': { prop: 'variant', value: 'secondary' },
  'success': { prop: 'variant', value: 'success' },
  'danger': { prop: 'variant', value: 'danger' },
  'warning': { prop: 'variant', value: 'warning' },
  'info': { prop: 'variant', value: 'info' },
  
  // Color mappings
  'red': { prop: 'color', value: 'red' },
  'blue': { prop: 'color', value: 'blue' },
  'green': { prop: 'color', value: 'green' },
  'yellow': { prop: 'color', value: 'yellow' },
  'purple': { prop: 'color', value: 'purple' },
  'orange': { prop: 'color', value: 'orange' },
  
  // State mappings
  'disabled': { prop: 'disabled', value: true, type: 'boolean' },
  'enabled': { prop: 'disabled', value: false, type: 'boolean' },
  'checked': { prop: 'checked', value: true, type: 'boolean' },
  'unchecked': { prop: 'checked', value: false, type: 'boolean' },
  'loading': { prop: 'loading', value: true, type: 'boolean' },
  'readonly': { prop: 'readOnly', value: true, type: 'boolean' },
  'required': { prop: 'required', value: true, type: 'boolean' },
  
  // Layout mappings
  'full width': { prop: 'fullWidth', value: true, type: 'boolean' },
  'centered': { prop: 'centered', value: true, type: 'boolean' },
  'rounded': { prop: 'rounded', value: true, type: 'boolean' },
  'circular': { prop: 'shape', value: 'circle' },
  'square': { prop: 'shape', value: 'square' }
};

const ATTRIBUTE_PATTERNS = [
  // Matches "with X" pattern
  { pattern: /with\s+(\w+)\s+(?:of\s+)?["']([^"']+)["']/gi, extractor: (match) => ({ prop: match[1], value: match[2] }) },
  
  // Matches "X: Y" pattern
  { pattern: /(\w+):\s*["']([^"']+)["']/gi, extractor: (match) => ({ prop: match[1], value: match[2] }) },
  
  // Matches "placeholder text"
  { pattern: /placeholder\s+(?:text\s+)?["']([^"']+)["']/gi, extractor: (match) => ({ prop: 'placeholder', value: match[1] }) },
  
  // Matches "labeled X" or "with label X"
  { pattern: /(?:labeled|with\s+label)\s+["']([^"']+)["']/gi, extractor: (match) => ({ prop: 'label', value: match[1] }) },
  
  // Matches "titled X" or "with title X"
  { pattern: /(?:titled|with\s+title)\s+["']([^"']+)["']/gi, extractor: (match) => ({ prop: 'title', value: match[1] }) },
  
  // Matches "named X"
  { pattern: /named\s+["']([^"']+)["']/gi, extractor: (match) => ({ prop: 'name', value: match[1] }) },
  
  // Matches numeric values
  { pattern: /(\w+)\s+of\s+(\d+)/gi, extractor: (match) => ({ prop: match[1], value: parseInt(match[2]) }) },
  
  // Matches "X items" or "X columns"
  { pattern: /(\d+)\s+(items?|columns?|rows?)/gi, extractor: (match) => ({ 
    prop: match[2].replace(/s$/, '') + 'Count', 
    value: parseInt(match[1]) 
  })}
];

/**
 * Infer props from a natural language description
 * @param {string} description - Natural language description
 * @returns {Object} Inferred props with their values and types
 */
function inferProps(description) {
  const props = {};
  const lowerDescription = description.toLowerCase();
  
  // Check for mapped keywords
  for (const [keyword, mapping] of Object.entries(PROP_MAPPINGS)) {
    if (lowerDescription.includes(keyword)) {
      const propName = mapping.prop;
      if (!props[propName]) {
        props[propName] = {
          value: mapping.value,
          type: mapping.type || (typeof mapping.value === 'boolean' ? 'boolean' : 'string')
        };
      }
    }
  }
  
  // Check for attribute patterns
  for (const { pattern, extractor } of ATTRIBUTE_PATTERNS) {
    let match;
    while ((match = pattern.exec(description)) !== null) {
      const extracted = extractor(match);
      if (extracted.prop && extracted.value !== undefined) {
        props[extracted.prop] = {
          value: extracted.value,
          type: typeof extracted.value === 'number' ? 'number' : 
                typeof extracted.value === 'boolean' ? 'boolean' : 'string'
        };
      }
    }
  }
  
  // Infer component-specific props
  inferComponentSpecificProps(description, props);
  
  return props;
}

/**
 * Infer props specific to certain component types
 */
function inferComponentSpecificProps(description, props) {
  const lower = description.toLowerCase();
  
  // Form-related props
  if (lower.includes('form') || lower.includes('input')) {
    if (lower.includes('email')) {
      props.type = { value: 'email', type: 'string' };
    } else if (lower.includes('password')) {
      props.type = { value: 'password', type: 'string' };
    } else if (lower.includes('number') || lower.includes('numeric')) {
      props.type = { value: 'number', type: 'string' };
    } else if (lower.includes('date')) {
      props.type = { value: 'date', type: 'string' };
    }
  }
  
  // Button-specific
  if (lower.includes('button')) {
    if (lower.includes('submit')) {
      props.type = { value: 'submit', type: 'string' };
    } else if (lower.includes('reset')) {
      props.type = { value: 'reset', type: 'string' };
    }
    
    if (lower.includes('icon')) {
      props.hasIcon = { value: true, type: 'boolean' };
    }
  }
  
  // Image-specific
  if (lower.includes('image') || lower.includes('img')) {
    if (lower.includes('alt text')) {
      const altMatch = description.match(/alt\s+text\s+["']([^"']+)["']/i);
      if (altMatch) {
        props.alt = { value: altMatch[1], type: 'string' };
      }
    }
  }
  
  // List-specific
  if (lower.includes('list')) {
    if (lower.includes('ordered')) {
      props.ordered = { value: true, type: 'boolean' };
    } else if (lower.includes('unordered')) {
      props.ordered = { value: false, type: 'boolean' };
    }
  }
}

/**
 * Generate prop definitions for Eghact components
 * @param {Object} props - Inferred props
 * @returns {string} Eghact prop definitions
 */
function generatePropDefinitions(props) {
  const propDefs = [];
  
  for (const [name, { value, type }] of Object.entries(props)) {
    let defaultValue = value;
    
    // Format default value based on type
    if (type === 'string') {
      defaultValue = `"${value}"`;
    } else if (type === 'boolean' || type === 'number') {
      defaultValue = value.toString();
    }
    
    propDefs.push(`  <prop name="${name}" type="${type}" default=${defaultValue} />`);
  }
  
  return propDefs.join('\n');
}

/**
 * Generate prop usage in template
 * @param {Object} props - Inferred props
 * @returns {Object} Prop attributes for template
 */
function generatePropUsage(props) {
  const attributes = {};
  
  for (const [name, { value, type }] of Object.entries(props)) {
    // Use prop name directly in template (will be bound to prop value)
    attributes[name] = `{${name}}`;
  }
  
  return attributes;
}

module.exports = {
  inferProps,
  generatePropDefinitions,
  generatePropUsage,
  PROP_MAPPINGS,
  ATTRIBUTE_PATTERNS
};
const { generateTemplateBasedComponent } = require('../src/component-generator');
const { EghactCodeValidator } = require('../src/validator');

describe('Component Generator', () => {
  let validator;
  
  beforeEach(() => {
    validator = new EghactCodeValidator();
  });

  describe('Turing-complete template generation', () => {
    test('generates a Turing-complete button with state', () => {
      const result = generateTemplateBasedComponent('a button');
      
      expect(result).toContain('<component>');
      expect(result).toContain('</component>');
      expect(result).toContain('<state>');
      expect(result).toContain('let clickCount = 0;');
      expect(result).toContain('$:'); // Reactive statements
      expect(result).toContain('@click="handleClick"');
      expect(result).toContain('class:even={isEven}');
      
      const validation = validator.validate(result);
      expect(validation.valid).toBe(true);
    });

    test('generates a Turing-complete counter with recursion', () => {
      const result = generateTemplateBasedComponent('a counter');
      
      expect(result).toContain('let count = initialValue');
      expect(result).toContain('$: factorial'); // Recursive factorial
      expect(result).toContain('#if (isPositive)');
      expect(result).toContain('#elseif (isNegative)');
      expect(result).toContain('#else');
      expect(result).toContain('@input=');
      
      const validation = validator.validate(result);
      expect(validation.valid).toBe(true);
    });

    test('generates a Turing-complete todo list', () => {
      const result = generateTemplateBasedComponent('a todo list');
      
      expect(result).toContain('let items = []');
      expect(result).toContain('$: filteredItems');
      expect(result).toContain('#each (filteredItems as item)');
      expect(result).toContain('#if (hasItems)');
      expect(result).toContain('filter === \'all\'');
      expect(result).toContain('@dblclick='); // Edit functionality
      
      const validation = validator.validate(result);
      expect(validation.valid).toBe(true);
    });

    test('generates components with proper .egh syntax', () => {
      const result = generateTemplateBasedComponent('a form');
      
      // Should NOT contain JSX syntax
      expect(result).not.toContain('className=');
      expect(result).not.toContain('onClick=');
      
      // Should contain .egh syntax
      expect(result).toContain('class=');
      expect(result).toContain('@');
      expect(result).toContain('<state>');
      expect(result).toContain('$:');
      
      const validation = validator.validate(result);
      expect(validation.valid).toBe(true);
    });

    test('generates components with control flow', () => {
      const result = generateTemplateBasedComponent('a list with items');
      
      expect(result).toContain('#if');
      expect(result).toContain('#each');
      expect(result).toContain('#/if');
      expect(result).toContain('#/each');
      
      const validation = validator.validate(result);
      expect(validation.valid).toBe(true);
    });
  });
});
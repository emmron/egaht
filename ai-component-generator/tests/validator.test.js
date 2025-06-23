const { EghactCodeValidator } = require('../src/validator');

describe('EghactCodeValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new EghactCodeValidator();
  });

  describe('validate', () => {
    test('validates a complete component', () => {
      const validComponent = `<component>
  <prop name="title" type="string" default="Hello" />
  
  <template>
    <div>{title}</div>
  </template>
</component>`;

      const result = validator.validate(validComponent);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('detects missing component tag', () => {
      const invalidComponent = `<template>
    <div>Hello</div>
  </template>`;

      const result = validator.validate(invalidComponent);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing <component> tag');
    });

    test('detects missing template tag', () => {
      const invalidComponent = `<component>
  <prop name="title" type="string" />
</component>`;

      const result = validator.validate(invalidComponent);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing <template> tag');
    });

    test('detects empty template', () => {
      const componentWithEmptyTemplate = `<component>
  <template>
  </template>
</component>`;

      const result = validator.validate(componentWithEmptyTemplate);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Template is empty');
    });

    test('validates prop definitions', () => {
      const componentWithBadProp = `<component>
  <prop type="string" />
  
  <template>
    <div>Test</div>
  </template>
</component>`;

      const result = validator.validate(componentWithBadProp);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Prop tag missing name attribute');
    });

    test('warns about missing prop type', () => {
      const componentWithUntypedProp = `<component>
  <prop name="value" />
  
  <template>
    <div>{value}</div>
  </template>
</component>`;

      const result = validator.validate(componentWithUntypedProp);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Prop tag missing type attribute');
    });

    test('validates event handlers', () => {
      const componentWithEvents = `<component>
  <template>
    <button @click="handleClick">Click me</button>
    <input @change="handleChange" />
  </template>
</component>`;

      const result = validator.validate(componentWithEvents);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    test('warns about unusual event handlers', () => {
      const componentWithUnusualEvent = `<component>
  <template>
    <div @customEvent="handle">Test</div>
  </template>
</component>`;

      const result = validator.validate(componentWithUnusualEvent);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Unusual event handler: @customEvent');
    });

    test('warns about static templates', () => {
      const staticComponent = `<component>
  <template>
    <div>Static content only</div>
  </template>
</component>`;

      const result = validator.validate(staticComponent);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('No dynamic content found in template');
    });
  });
});
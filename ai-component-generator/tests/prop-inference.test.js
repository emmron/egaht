const { inferProps, generatePropDefinitions } = require('../src/prop-inference');

describe('Prop Inference', () => {
  describe('inferProps', () => {
    test('infers size props from keywords', () => {
      const props = inferProps('a large button');
      expect(props.size).toEqual({ value: 'lg', type: 'string' });
    });

    test('infers color/variant props', () => {
      const props = inferProps('a primary blue button');
      expect(props.variant).toEqual({ value: 'primary', type: 'string' });
      expect(props.color).toEqual({ value: 'blue', type: 'string' });
    });

    test('infers boolean state props', () => {
      const props = inferProps('a disabled loading button');
      expect(props.disabled).toEqual({ value: true, type: 'boolean' });
      expect(props.loading).toEqual({ value: true, type: 'boolean' });
    });

    test('infers string props from quoted values', () => {
      const props = inferProps('a button with label "Submit Form"');
      expect(props.label).toEqual({ value: 'Submit Form', type: 'string' });
    });

    test('infers placeholder text', () => {
      const props = inferProps('input with placeholder "Enter your email"');
      expect(props.placeholder).toEqual({ value: 'Enter your email', type: 'string' });
    });

    test('infers multiple props from complex descriptions', () => {
      const props = inferProps('a large primary button labeled "Save" that is disabled');
      expect(props.size).toEqual({ value: 'lg', type: 'string' });
      expect(props.variant).toEqual({ value: 'primary', type: 'string' });
      expect(props.label).toEqual({ value: 'Save', type: 'string' });
      expect(props.disabled).toEqual({ value: true, type: 'boolean' });
    });

    test('infers numeric props', () => {
      const props = inferProps('a list with 5 items');
      expect(props.itemCount).toEqual({ value: 5, type: 'number' });
    });

    test('infers form field types', () => {
      const props = inferProps('an email input field');
      expect(props.type).toEqual({ value: 'email', type: 'string' });
    });

    test('infers image props', () => {
      const props = inferProps('an image with alt text "Company logo"');
      expect(props.alt).toEqual({ value: 'Company logo', type: 'string' });
    });

    test('handles layout props', () => {
      const props = inferProps('a full width centered rounded card');
      expect(props.fullWidth).toEqual({ value: true, type: 'boolean' });
      expect(props.centered).toEqual({ value: true, type: 'boolean' });
      expect(props.rounded).toEqual({ value: true, type: 'boolean' });
    });
  });

  describe('generatePropDefinitions', () => {
    test('generates prop definitions for string props', () => {
      const props = {
        label: { value: 'Click me', type: 'string' },
        variant: { value: 'primary', type: 'string' }
      };
      
      const defs = generatePropDefinitions(props);
      expect(defs).toContain('<prop name="label" type="string" default="Click me" />');
      expect(defs).toContain('<prop name="variant" type="string" default="primary" />');
    });

    test('generates prop definitions for boolean props', () => {
      const props = {
        disabled: { value: true, type: 'boolean' },
        loading: { value: false, type: 'boolean' }
      };
      
      const defs = generatePropDefinitions(props);
      expect(defs).toContain('<prop name="disabled" type="boolean" default=true />');
      expect(defs).toContain('<prop name="loading" type="boolean" default=false />');
    });

    test('generates prop definitions for number props', () => {
      const props = {
        count: { value: 5, type: 'number' },
        max: { value: 100, type: 'number' }
      };
      
      const defs = generatePropDefinitions(props);
      expect(defs).toContain('<prop name="count" type="number" default=5 />');
      expect(defs).toContain('<prop name="max" type="number" default=100 />');
    });
  });
});
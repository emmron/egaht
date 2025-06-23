const { 
  uiStructureToPrompt,
  generateComponentSpec
} = require('../src/vision-analyzer');

describe('Vision Analyzer', () => {
  describe('uiStructureToPrompt', () => {
    test('converts basic UI structure to prompt', () => {
      const uiStructure = {
        layout: { type: 'flex', direction: 'column' },
        components: [
          {
            type: 'header',
            properties: { text: 'Welcome', size: 'large' }
          },
          {
            type: 'button',
            properties: { text: 'Click me', variant: 'primary' },
            interactions: ['click']
          }
        ],
        styling: {
          colors: { primary: '#007bff' },
          rounded: true
        },
        semantics: { purpose: 'landing page' }
      };
      
      const prompt = uiStructureToPrompt(uiStructure);
      
      expect(prompt).toContain('landing page');
      expect(prompt).toContain('column flex layout');
      expect(prompt).toContain('header with text "Welcome"');
      expect(prompt).toContain('primary button with text "Click me"');
      expect(prompt).toContain('#007bff as primary color');
      expect(prompt).toContain('rounded');
      expect(prompt).toContain('click interactions');
    });

    test('handles form components', () => {
      const uiStructure = {
        layout: { type: 'flex', direction: 'column' },
        components: [
          {
            type: 'input',
            properties: { placeholder: 'Enter email', size: 'medium' }
          },
          {
            type: 'input',
            properties: { placeholder: 'Enter password', size: 'medium' }
          },
          {
            type: 'button',
            properties: { text: 'Submit', variant: 'primary' }
          }
        ],
        styling: { colors: {}, rounded: false },
        semantics: { purpose: 'login form' }
      };
      
      const prompt = uiStructureToPrompt(uiStructure);
      
      expect(prompt).toContain('login form');
      expect(prompt).toContain('input with placeholder "Enter email"');
      expect(prompt).toContain('input with placeholder "Enter password"');
    });
  });

  describe('generateComponentSpec', () => {
    test('generates spec with props from UI structure', () => {
      const uiStructure = {
        layout: { type: 'flex', direction: 'row' },
        components: [
          {
            type: 'button',
            properties: { text: 'Save', variant: 'primary' },
            interactions: ['click']
          }
        ],
        styling: {
          colors: { primary: '#28a745', background: '#f8f9fa' },
          spacing: 'normal',
          rounded: true
        },
        semantics: { purpose: 'form' }
      };
      
      const spec = generateComponentSpec(uiStructure);
      
      expect(spec.name).toBe('formComponent');
      expect(spec.props).toContainEqual(
        expect.objectContaining({ name: 'title', type: 'string' })
      );
      expect(spec.template.root).toBe('div');
      expect(spec.template.className).toContain('flex-layout');
      expect(spec.handlers).toContainEqual(
        expect.objectContaining({ name: 'handleClick' })
      );
      expect(spec.styles.primaryColor).toBe('#28a745');
      expect(spec.styles.rounded).toBe(true);
    });

    test('generates form state and handlers', () => {
      const uiStructure = {
        layout: { type: 'flex', direction: 'column' },
        components: [
          {
            type: 'form',
            properties: {}
          },
          {
            type: 'input',
            properties: { placeholder: 'Your name' }
          },
          {
            type: 'button',
            properties: { text: 'Submit' },
            interactions: ['click']
          }
        ],
        styling: { colors: {}, spacing: 'normal' },
        semantics: { purpose: 'contact' }
      };
      
      const spec = generateComponentSpec(uiStructure);
      
      expect(spec.state).toContainEqual(
        expect.objectContaining({ name: 'formData' })
      );
      expect(spec.state).toContainEqual(
        expect.objectContaining({ name: 'errors' })
      );
      expect(spec.state).toContainEqual(
        expect.objectContaining({ name: 'isSubmitting' })
      );
      expect(spec.handlers).toContainEqual(
        expect.objectContaining({ name: 'handleSubmit' })
      );
    });

    test('generates template children correctly', () => {
      const uiStructure = {
        layout: { type: 'grid' },
        components: [
          {
            type: 'card',
            properties: { variant: 'outlined' }
          },
          {
            type: 'button',
            properties: { text: 'Action' },
            interactions: ['click', 'hover']
          }
        ],
        styling: { colors: {} },
        semantics: {}
      };
      
      const spec = generateComponentSpec(uiStructure);
      
      expect(spec.template.children).toHaveLength(2);
      expect(spec.template.children[0].tag).toBe('div');
      expect(spec.template.children[0].className).toContain('card');
      expect(spec.template.children[1].tag).toBe('button');
      expect(spec.template.children[1].content).toBe('Action');
      expect(spec.template.children[1].events).toContainEqual(
        expect.objectContaining({ type: 'click', handler: 'handleClick' })
      );
    });
  });
});
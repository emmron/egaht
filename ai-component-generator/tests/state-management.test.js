const { 
  inferStateNeeds, 
  generateStateManagement,
  generateControlFlow 
} = require('../src/state-management');

describe('State Management', () => {
  describe('inferStateNeeds', () => {
    test('infers counter state pattern', () => {
      const needs = inferStateNeeds('a counter with increment and decrement');
      expect(needs.patterns).toContain('counter');
    });

    test('infers toggle state pattern', () => {
      const needs = inferStateNeeds('a toggle switch');
      expect(needs.patterns).toContain('toggle');
    });

    test('infers list state pattern', () => {
      const needs = inferStateNeeds('a todo list with items');
      expect(needs.patterns).toContain('list');
    });

    test('infers form state pattern', () => {
      const needs = inferStateNeeds('a contact form with submit');
      expect(needs.patterns).toContain('form');
    });

    test('infers calculator pattern', () => {
      const needs = inferStateNeeds('a calculator component');
      expect(needs.patterns).toContain('calculator');
    });

    test('infers custom timer state', () => {
      const needs = inferStateNeeds('a countdown timer');
      expect(needs.customState).toContainEqual(expect.stringContaining('timeLeft'));
      expect(needs.customHandlers).toContainEqual(expect.stringContaining('startTimer'));
    });

    test('infers multiple patterns', () => {
      const needs = inferStateNeeds('a form with counter and toggle');
      expect(needs.patterns).toContain('form');
      expect(needs.patterns).toContain('counter');
      expect(needs.patterns).toContain('toggle');
    });
  });

  describe('generateStateManagement', () => {
    test('generates counter state management', () => {
      const needs = { patterns: ['counter'], customState: [], customHandlers: [], customReactive: [] };
      const result = generateStateManagement(needs);
      
      expect(result.state).toContainEqual(expect.stringContaining('let count = 0'));
      expect(result.handlers).toContainEqual(expect.stringContaining('increment'));
      expect(result.handlers).toContainEqual(expect.stringContaining('decrement'));
      expect(result.reactive).toContainEqual(expect.stringContaining('isEven'));
    });

    test('generates list state management', () => {
      const needs = { patterns: ['list'], customState: [], customHandlers: [], customReactive: [] };
      const result = generateStateManagement(needs);
      
      expect(result.state).toContainEqual(expect.stringContaining('let items = []'));
      expect(result.handlers).toContainEqual(expect.stringContaining('addItem'));
      expect(result.handlers).toContainEqual(expect.stringContaining('removeItem'));
      expect(result.reactive).toContainEqual(expect.stringContaining('itemCount'));
    });

    test('combines pattern and custom state', () => {
      const needs = {
        patterns: ['counter'],
        customState: ['let customVar = true;'],
        customHandlers: ['const customHandler = () => {};'],
        customReactive: ['$: customComputed = customVar ? 1 : 0;']
      };
      const result = generateStateManagement(needs);
      
      expect(result.state).toContainEqual(expect.stringContaining('let count = 0'));
      expect(result.state).toContainEqual('let customVar = true;');
      expect(result.handlers).toContainEqual('const customHandler = () => {};');
      expect(result.reactive).toContainEqual('$: customComputed = customVar ? 1 : 0;');
    });
  });

  describe('generateControlFlow', () => {
    test('generates list control flow', () => {
      const needs = { patterns: ['list'] };
      const templates = generateControlFlow(needs);
      
      expect(templates[0]).toContain('#if (isEmpty)');
      expect(templates[0]).toContain('#each (items as item)');
      expect(templates[0]).toContain('#/each');
      expect(templates[0]).toContain('#/if');
    });

    test('generates form control flow', () => {
      const needs = { patterns: ['form'] };
      const templates = generateControlFlow(needs);
      
      expect(templates[0]).toContain('#if (errors.name)');
      expect(templates[0]).toContain('#if (isSubmitting)');
      expect(templates[0]).toContain(':disabled={!isValid}');
    });

    test('generates tabs control flow', () => {
      const needs = { patterns: ['tabs'] };
      const templates = generateControlFlow(needs);
      
      expect(templates[0]).toContain('#each (tabs as tab, index)');
      expect(templates[0]).toContain('class:active={activeTab === index}');
    });
  });
});
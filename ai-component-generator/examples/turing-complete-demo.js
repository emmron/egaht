const { generateTemplateBasedComponent } = require('../src/component-generator');

console.log('🚀 Turing-Complete .egh Component Generation Demo\n');

const examples = [
  'a counter',
  'a todo list',
  'a button',
  'a calculator',
  'a search component'
];

examples.forEach(prompt => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📝 Prompt: "${prompt}"`);
  console.log('='.repeat(60));
  
  const component = generateTemplateBasedComponent(prompt);
  
  // Extract key features
  const hasState = component.includes('<state>');
  const hasReactive = component.includes('$:');
  const hasControlFlow = component.includes('#if') || component.includes('#each');
  const hasEventHandlers = component.includes('@click') || component.includes('@input');
  const hasRecursion = component.includes('factorial') || component.includes('fibonacci');
  
  console.log('\n✅ Turing-Complete Features:');
  console.log(`  - State Management: ${hasState ? '✓' : '✗'}`);
  console.log(`  - Reactive Computations: ${hasReactive ? '✓' : '✗'}`);
  console.log(`  - Control Flow: ${hasControlFlow ? '✓' : '✗'}`);
  console.log(`  - Event Handlers: ${hasEventHandlers ? '✓' : '✗'}`);
  console.log(`  - Recursion/Loops: ${hasRecursion ? '✓' : '✗'}`);
  
  console.log('\n📄 Generated .egh Component:');
  console.log(component);
});
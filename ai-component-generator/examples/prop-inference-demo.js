const { inferProps, generatePropDefinitions } = require('../src/prop-inference');

console.log('🔍 Smart Prop Inference Demo\n');

const testPrompts = [
  'a large primary button with label "Save Changes" that is disabled',
  'a small red warning card with title "Error" and rounded corners',
  'an email input field with placeholder "Enter your email" that is required',
  'a full width loading spinner with 3 items',
  'a blue submit button with icon'
];

testPrompts.forEach(prompt => {
  console.log(`\n📝 Prompt: "${prompt}"`);
  console.log('─'.repeat(60));
  
  const inferredProps = inferProps(prompt);
  
  console.log('\n🎯 Inferred Props:');
  Object.entries(inferredProps).forEach(([name, { value, type }]) => {
    console.log(`  ${name}: ${JSON.stringify(value)} (${type})`);
  });
  
  if (Object.keys(inferredProps).length > 0) {
    console.log('\n📄 Generated Prop Definitions:');
    console.log(generatePropDefinitions(inferredProps));
  } else {
    console.log('\n⚠️  No props inferred');
  }
});
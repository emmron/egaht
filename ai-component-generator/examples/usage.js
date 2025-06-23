const { generateEghactComponent } = require('../src/index');

// Example usage of the AI Component Generator

async function demonstrateGeneration() {
  console.log('🚀 Eghact AI Component Generator Examples\n');

  const examples = [
    'a simple button',
    'a login form with email and password fields',
    'a product card with image, title, price, and add to cart button',
    'a navigation header with logo and menu items',
    'a todo list with add and delete functionality'
  ];

  for (const prompt of examples) {
    console.log(`\n📝 Prompt: "${prompt}"`);
    console.log('─'.repeat(50));
    
    try {
      const result = await generateEghactComponent(prompt, {
        model: 'openai/gpt-4-turbo-preview'
      });
      
      console.log('✅ Generated successfully!');
      console.log(`📏 Code length: ${result.code.length} characters`);
      console.log(`✓ Valid: ${result.metadata.validation.valid}`);
      
      if (result.metadata.validation.warnings.length > 0) {
        console.log(`⚠️  Warnings: ${result.metadata.validation.warnings.join(', ')}`);
      }
      
      // Show first few lines of generated code
      const preview = result.code.split('\n').slice(0, 5).join('\n');
      console.log('\n📄 Preview:');
      console.log(preview);
      console.log('...\n');
      
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
}

// Run the demonstration
if (require.main === module) {
  demonstrateGeneration().catch(console.error);
}

module.exports = { demonstrateGeneration };
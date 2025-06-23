// Quick test to verify OpenRouter integration
const { generateComponent } = require('./src/component-generator');

async function testOpenRouter() {
  console.log('Testing OpenRouter integration...\n');
  
  try {
    // Test with a simple prompt
    const result = await generateComponent('a simple button', {
      model: 'openai/gpt-3.5-turbo' // Using a cheaper model for testing
    });
    
    console.log('✅ OpenRouter API call successful!');
    console.log('\nGenerated code:');
    console.log(result);
    
  } catch (error) {
    console.error('❌ OpenRouter API call failed:');
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testOpenRouter();
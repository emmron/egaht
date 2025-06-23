const { generateComponent } = require('./component-generator');
const { EghactCodeValidator } = require('./validator');
const { inferProps, generatePropDefinitions } = require('./prop-inference');
const { 
  analyzeImage, 
  imageToEghactComponent,
  analyzeDesignSystem 
} = require('./vision-analyzer');

/**
 * Main entry point for the AI Component Generator
 * @param {string} prompt - Natural language description of the component
 * @param {Object} options - Generation options
 * @returns {Promise<{code: string, metadata: Object}>}
 */
async function generateEghactComponent(prompt, options = {}) {
  try {
    // Generate the component code
    const generatedCode = await generateComponent(prompt, options);
    
    // Validate the generated code
    const validator = new EghactCodeValidator();
    const validation = validator.validate(generatedCode);
    
    if (!validation.valid) {
      throw new Error(`Generated code validation failed: ${validation.errors.join(', ')}`);
    }
    
    return {
      code: generatedCode,
      metadata: {
        prompt,
        timestamp: new Date().toISOString(),
        validation
      }
    };
  } catch (error) {
    throw new Error(`Component generation failed: ${error.message}`);
  }
}

module.exports = {
  generateEghactComponent,
  generateComponent,
  EghactCodeValidator,
  inferProps,
  generatePropDefinitions,
  analyzeImage,
  imageToEghactComponent,
  analyzeDesignSystem
};
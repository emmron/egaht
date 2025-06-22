const { transformSync } = require('@babel/core');
const { compile } = require('../compiler');

module.exports = {
  process(sourceText, sourcePath) {
    // Skip if not an .egh file
    if (!sourcePath.endsWith('.egh')) {
      return sourceText;
    }
    
    try {
      // Compile .egh to JavaScript
      const compiled = compile(sourceText, {
        filename: sourcePath,
        generate: 'dom',
        dev: true,
        css: false, // Disable CSS for tests
      });
      
      // Transform with Babel for Jest compatibility
      const result = transformSync(compiled.js.code, {
        filename: sourcePath,
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
        ],
        plugins: [
          '@babel/plugin-transform-modules-commonjs',
        ],
      });
      
      return result.code;
    } catch (error) {
      throw new Error(`Failed to transform ${sourcePath}: ${error.message}`);
    }
  },
  
  getCacheKey(sourceText, sourcePath, transformOptions) {
    // Cache based on content and options
    const crypto = require('crypto');
    return crypto
      .createHash('md5')
      .update(sourceText)
      .update(sourcePath)
      .update(JSON.stringify(transformOptions))
      .digest('hex');
  },
};
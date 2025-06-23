#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs').promises;
const path = require('path');
const { generateEghactComponent, imageToEghactComponent, analyzeImage } = require('./index');

// CLI setup
program
  .name('eghact-ai-gen')
  .description('AI-powered component generator for Eghact')
  .version('1.0.0');

program
  .command('generate')
  .alias('gen')
  .description('Generate an Eghact component from natural language')
  .argument('<prompt>', 'Natural language description of the component')
  .option('-o, --output <path>', 'Output file path')
  .option('-n, --name <name>', 'Component name')
  .option('--dry-run', 'Show generated code without saving')
  .option('--model <model>', 'LLM model to use (e.g., openai/gpt-4-turbo-preview, anthropic/claude-3-opus)', 'openai/gpt-4-turbo-preview')
  .action(async (prompt, options) => {
    try {
      console.log('🤖 Generating Eghact component...');
      
      // Generate the component
      const result = await generateEghactComponent(prompt, {
        model: options.model
      });
      
      // Display the generated code
      console.log('\n✨ Generated component:\n');
      console.log(result.code);
      
      // Save to file if not dry run
      if (!options.dryRun && options.output) {
        const outputPath = path.resolve(options.output);
        await fs.writeFile(outputPath, result.code, 'utf8');
        console.log(`\n✅ Component saved to: ${outputPath}`);
      }
      
      // Show validation results
      console.log('\n📋 Validation:', result.metadata.validation.valid ? '✅ Valid' : '❌ Invalid');
      if (result.metadata.validation.warnings.length > 0) {
        console.log('⚠️  Warnings:', result.metadata.validation.warnings.join(', '));
      }
      
    } catch (error) {
      console.error('\n❌ Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate an Eghact component file')
  .argument('<file>', 'Path to .egh file')
  .action(async (file) => {
    try {
      const { EghactCodeValidator } = require('./validator');
      const content = await fs.readFile(path.resolve(file), 'utf8');
      
      const validator = new EghactCodeValidator();
      const result = validator.validate(content);
      
      console.log(`\n📋 Validation for ${file}:`);
      console.log(result.valid ? '✅ Valid' : '❌ Invalid');
      
      if (result.errors.length > 0) {
        console.log('\n❌ Errors:');
        result.errors.forEach(err => console.log(`  - ${err}`));
      }
      
      if (result.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        result.warnings.forEach(warn => console.log(`  - ${warn}`));
      }
      
    } catch (error) {
      console.error('\n❌ Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('from-image')
  .alias('img')
  .description('Generate an Eghact component from a wireframe or screenshot')
  .argument('<image>', 'Path to image file (PNG, JPG, etc)')
  .option('-o, --output <path>', 'Output file path')
  .option('--analyze-only', 'Only analyze the image without generating component')
  .option('--model <model>', 'Vision model to use', 'openai/gpt-4-vision-preview')
  .action(async (imagePath, options) => {
    try {
      console.log('🖼️  Analyzing image...');
      
      const resolvedPath = path.resolve(imagePath);
      
      // Check if file exists
      await fs.access(resolvedPath);
      
      if (options.analyzeOnly) {
        // Just analyze and show structure
        const analysis = await analyzeImage(resolvedPath);
        console.log('\n📊 Image Analysis:\n');
        console.log(JSON.stringify(analysis, null, 2));
      } else {
        // Full pipeline: image → component
        console.log('🤖 Generating Eghact component from image...\n');
        
        const result = await imageToEghactComponent(resolvedPath, {
          model: options.model
        });
        
        console.log('✨ Generated component:\n');
        console.log(result.code);
        
        // Save to file if requested
        if (options.output) {
          const outputPath = path.resolve(options.output);
          await fs.writeFile(outputPath, result.code, 'utf8');
          console.log(`\n✅ Component saved to: ${outputPath}`);
        }
        
        // Show analysis metadata
        console.log('\n📊 Vision Analysis Summary:');
        console.log(`- Components detected: ${result.metadata.uiStructure.components.length}`);
        console.log(`- Layout type: ${result.metadata.uiStructure.layout.type}`);
        console.log(`- Primary purpose: ${result.metadata.uiStructure.semantics.purpose}`);
      }
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.error(`\n❌ Error: Image file not found: ${imagePath}`);
      } else {
        console.error('\n❌ Error:', error.message);
      }
      process.exit(1);
    }
  });

program
  .command('design-system')
  .description('Analyze multiple images to generate a design system')
  .argument('<images...>', 'Paths to multiple image files')
  .action(async (imagePaths) => {
    try {
      console.log(`🎨 Analyzing ${imagePaths.length} images for design system...\n`);
      
      const { analyzeDesignSystem } = require('./index');
      const resolvedPaths = imagePaths.map(p => path.resolve(p));
      
      // Check all files exist
      await Promise.all(resolvedPaths.map(p => fs.access(p)));
      
      const designSystem = await analyzeDesignSystem(resolvedPaths);
      
      console.log('✨ Design System Analysis:\n');
      console.log('🎨 Common Colors:', designSystem.designTokens.colors);
      console.log('📦 Component Types:', designSystem.componentLibrary);
      console.log('📐 Layout Patterns:', designSystem.layoutPatterns);
      console.log(`\n📊 Analyzed ${designSystem.analyses.length} screens successfully`);
      
    } catch (error) {
      console.error('\n❌ Error:', error.message);
      process.exit(1);
    }
  });

// Parse CLI arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
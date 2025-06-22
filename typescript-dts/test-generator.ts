#!/usr/bin/env ts-node

import { DtsGenerator } from './src/DtsGenerator';
import fs from 'fs';
import path from 'path';

async function testGenerator() {
  const generator = new DtsGenerator();
  const testFiles = [
    '../examples/components/Button.egh',
    '../examples/components/UserCard.egh',
    '../examples/components/TodoList.egh'
  ];
  
  console.log('🧪 Testing .d.ts generation...\n');
  
  for (const file of testFiles) {
    const filePath = path.resolve(__dirname, file);
    console.log(`📄 Processing: ${path.basename(filePath)}`);
    
    try {
      await generator.generateForFile(filePath);
      
      // Check if .d.ts was created
      const dtsPath = filePath.replace('.egh', '.d.ts');
      if (fs.existsSync(dtsPath)) {
        console.log(`✅ Generated: ${path.basename(dtsPath)}`);
        
        // Read and display the generated content
        const content = fs.readFileSync(dtsPath, 'utf-8');
        console.log('📝 Content:');
        console.log('```typescript');
        console.log(content);
        console.log('```\n');
      } else {
        console.error(`❌ Failed to generate .d.ts file`);
      }
    } catch (error) {
      console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  console.log('✨ Test complete!');
}

// Run the test
testGenerator().catch(console.error);
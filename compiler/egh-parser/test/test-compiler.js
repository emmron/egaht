/**
 * Test suite for EGH Parser backbone
 */

import { AdvancedParser } from '../src/advanced-parser.js';
import { Lexer } from '../src/lexer.ts';

// Test basic parsing functionality
function testBasicParsing() {
  console.log('Testing basic parsing...');
  
  const parser = new AdvancedParser();
  const basicComponent = `
    component Counter {
      state count = 0;
      
      template {
        <div>
          <button @click={increment}>Count: {count}</button>
        </div>
      }
      
      function increment() {
        count += 1;
      }
    }
  `;
  
  try {
    const ast = parser.parse(basicComponent);
    console.log('✓ Basic component parsing successful');
    return true;
  } catch (error) {
    console.error('✗ Basic parsing failed:', error.message);
    return false;
  }
}

// Test lexer functionality
function testLexer() {
  console.log('Testing lexer...');
  
  try {
    const lexer = new Lexer();
    const tokens = lexer.tokenize('component Test { state x = 5; }');
    console.log('✓ Lexer tokenization successful');
    return true;
  } catch (error) {
    console.error('✗ Lexer failed:', error.message);
    return false;
  }
}

// Run all tests
function runTests() {
  console.log('Running EGH Parser Backbone Tests\n');
  
  const tests = [
    testLexer,
    testBasicParsing
  ];
  
  let passed = 0;
  let total = tests.length;
  
  for (const test of tests) {
    if (test()) {
      passed++;
    }
  }
  
  console.log(`\nResults: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('✓ All parser backbone tests passed!');
    process.exit(0);
  } else {
    console.log('✗ Some tests failed');
    process.exit(1);
  }
}

runTests();
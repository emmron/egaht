#!/usr/bin/env node

/**
 * CLI Startup Performance Benchmark
 * Target: <50ms startup time
 * 
 * Usage: node benchmarks/cli-startup.js
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function measureStartupTime(command, iterations = 10) {
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    
    try {
      await execAsync(command, { timeout: 5000 });
    } catch (error) {
      // Ignore errors from help command
    }
    
    const end = process.hrtime.bigint();
    const timeMs = Number(end - start) / 1_000_000;
    times.push(timeMs);
  }
  
  return {
    min: Math.min(...times),
    max: Math.max(...times),
    avg: times.reduce((a, b) => a + b, 0) / times.length,
    median: times.sort((a, b) => a - b)[Math.floor(times.length / 2)]
  };
}

async function runBenchmark() {
  console.log('🚀 Eghact CLI Startup Performance Benchmark\n');
  console.log('Target: <50ms startup time\n');
  
  const commands = [
    { name: 'Help command', cmd: 'node bin/eghact.js --help' },
    { name: 'Version check', cmd: 'node bin/eghact.js --version' },
    { name: 'Unknown command', cmd: 'node bin/eghact.js unknown 2>/dev/null' }
  ];
  
  for (const { name, cmd } of commands) {
    console.log(`📊 Testing: ${name}`);
    console.log(`   Command: ${cmd}`);
    
    const results = await measureStartupTime(cmd);
    
    console.log(`   Min: ${results.min.toFixed(2)}ms`);
    console.log(`   Max: ${results.max.toFixed(2)}ms`);
    console.log(`   Avg: ${results.avg.toFixed(2)}ms`);
    console.log(`   Median: ${results.median.toFixed(2)}ms`);
    
    const status = results.avg < 50 ? '✅ PASS' : '❌ FAIL';
    console.log(`   Status: ${status}\n`);
  }
  
  // Performance recommendations
  console.log('💡 Performance Optimization Tips:');
  console.log('   - Use lazy loading for heavy dependencies');
  console.log('   - Defer command registration until needed');
  console.log('   - Consider using worker threads for parallel tasks');
  console.log('   - Cache parsed configs between runs');
}

runBenchmark().catch(console.error);
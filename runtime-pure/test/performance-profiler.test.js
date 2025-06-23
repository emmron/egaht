/**
 * Performance Profiler Test Suite
 */

import { Component } from '../src/core/component-with-profiling.js';
import { h } from '../src/core/vdom.js';
import { performanceStore, usePerformance } from '../src/performance/profiler.js';

// Test component with heavy computation
class HeavyComponent extends Component {
  constructor(props) {
    super(props);
    this.state = { count: 0 };
  }
  
  heavyComputation() {
    // Simulate heavy work
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i);
    }
    return result;
  }
  
  render() {
    const result = this.heavyComputation();
    return h('div', { class: 'heavy-component' }, [
      h('h2', {}, `Heavy Component - ${this.props.title}`),
      h('p', {}, `Count: ${this.state.count}`),
      h('p', {}, `Computation result: ${result.toFixed(2)}`),
      h('button', { '@click': () => this.setState({ count: this.state.count + 1 }) }, 'Increment')
    ]);
  }
}

// Test component with children
class ParentComponent extends Component {
  render() {
    return h('div', { class: 'parent' }, [
      h('h1', {}, 'Parent Component'),
      h(HeavyComponent, { title: 'Child 1' }),
      h(HeavyComponent, { title: 'Child 2' })
    ]);
  }
}

// Function component for testing
function LightComponent(props) {
  const perf = usePerformance();
  
  const timerId = perf.startTimer('LightComponent-custom-operation');
  // Simulate some work
  const data = Array.from({ length: 100 }, (_, i) => i * 2);
  perf.endTimer(timerId);
  
  return h('div', { class: 'light' }, [
    h('h3', {}, props.title),
    h('ul', {}, data.slice(0, 5).map(n => h('li', {}, `Item ${n}`)))
  ]);
}

// Test runner
async function runPerformanceTests() {
  console.log('🧪 Running Performance Profiler Tests...\n');
  
  // Clear any previous metrics
  performanceStore.clearMetrics();
  
  // Test 1: Component mount performance
  console.log('Test 1: Component Mount Performance');
  const container1 = document.createElement('div');
  const parent = new ParentComponent();
  parent._mount(container1);
  
  // Test 2: Multiple renders
  console.log('\nTest 2: Multiple Render Performance');
  for (let i = 0; i < 5; i++) {
    parent.setState({ iteration: i });
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Test 3: Function component
  console.log('\nTest 3: Function Component Performance');
  const container2 = document.createElement('div');
  const FunctionComponentWrapper = createFunctionComponent(LightComponent);
  const funcComp = new FunctionComponentWrapper({ title: 'Test Function Component' });
  funcComp._mount(container2);
  
  // Test 4: Memory monitoring
  console.log('\nTest 4: Memory Monitoring');
  performanceStore.captureMemorySnapshot('before-heavy-operations');
  
  // Create many components to impact memory
  const components = [];
  for (let i = 0; i < 10; i++) {
    const comp = new HeavyComponent({ title: `Heavy ${i}` });
    const cont = document.createElement('div');
    comp._mount(cont);
    components.push(comp);
  }
  
  performanceStore.captureMemorySnapshot('after-heavy-operations');
  
  // Get and display metrics
  const metrics = performanceStore.getMetrics();
  
  console.log('\n📊 Performance Metrics Summary:');
  console.log('================================\n');
  
  // Render metrics
  console.log('Component Render Times:');
  Object.entries(metrics.renderMetrics).forEach(([name, data]) => {
    console.log(`\n  ${name}:`);
    console.log(`    Total renders: ${data.totalRenders}`);
    console.log(`    Average time: ${data.avgTime.toFixed(2)}ms`);
    console.log(`    Min time: ${data.minTime.toFixed(2)}ms`);
    console.log(`    Max time: ${data.maxTime.toFixed(2)}ms`);
    console.log(`    Memory impact: ${(data.memoryImpact / 1024).toFixed(2)}KB`);
  });
  
  // Memory snapshots
  console.log('\n\nMemory Snapshots:');
  metrics.memorySnapshots.forEach(snapshot => {
    console.log(`\n  ${snapshot.label}:`);
    console.log(`    Used heap: ${(snapshot.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`    Total heap: ${(snapshot.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
  });
  
  // WASM stats if available
  if (metrics.wasmStats) {
    console.log('\n\nWASM Performance Stats:');
    console.log(`  ${JSON.stringify(metrics.wasmStats, null, 2)}`);
  }
  
  console.log('\n✅ Performance tests completed!');
  
  return metrics;
}

// Export test runner
export { runPerformanceTests, HeavyComponent, ParentComponent, LightComponent };
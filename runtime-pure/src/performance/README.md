# Eghact Performance Profiler

A real-time performance monitoring system for Eghact components that visualizes render times, memory usage, and bundle impact.

## Features

- **Component Render Profiling**: Track render times for all components
- **Memory Usage Monitoring**: Capture and track memory snapshots
- **Bundle Impact Analysis**: Analyze component bundle sizes
- **WASM Integration**: Leverages WebAssembly for high-performance timing
- **Real-time Updates**: Subscribe to performance events as they happen
- **TypeScript Support**: Full type definitions included

## Usage

### Basic Component Profiling

```javascript
import { Component } from '@eghact/runtime-pure/component-profiled';
import { performanceStore } from '@eghact/runtime-pure/performance';

// Components are automatically profiled when using the profiled component class
class MyComponent extends Component {
  render() {
    return h('div', {}, 'Hello World');
  }
}

// Access metrics
const metrics = performanceStore.getMetrics();
console.log(metrics.renderMetrics);
```

### Manual Performance Timing

```javascript
import { usePerformance } from '@eghact/runtime-pure/performance';

function MyComponent() {
  const perf = usePerformance();
  
  const timerId = perf.startTimer('custom-operation');
  // Do some work...
  const metric = perf.endTimer(timerId);
  
  return h('div', {}, `Operation took ${metric.duration}ms`);
}
```

### Memory Monitoring

```javascript
import { startMemoryMonitoring, performanceStore } from '@eghact/runtime-pure/performance';

// Start automatic memory snapshots every second
startMemoryMonitoring(1000);

// Manual memory snapshot
performanceStore.captureMemorySnapshot('before-heavy-operation');
```

### Subscribe to Performance Events

```javascript
const unsubscribe = performanceStore.subscribe((event) => {
  switch (event.type) {
    case 'render':
      console.log(`Component ${event.componentName} rendered in ${event.metric.duration}ms`);
      break;
    case 'memory':
      console.log(`Memory: ${event.snapshot.usedJSHeapSize / 1024 / 1024}MB`);
      break;
    case 'bundle':
      console.log(`Bundle size for ${event.componentName}: ${event.bundleInfo.size}B`);
      break;
  }
});
```

### HOC for Performance Monitoring

```javascript
import { withPerformanceMonitoring } from '@eghact/runtime-pure/performance';

const ProfiledComponent = withPerformanceMonitoring(MyComponent);
```

## API Reference

### PerformanceStore

- `startComponentRender(componentName, props)`: Start timing a component render
- `endComponentRender(id)`: End timing and record metrics
- `captureMemorySnapshot(label)`: Capture current memory usage
- `analyzeBundleImpact(componentName, bundleInfo)`: Record bundle size info
- `getMetrics()`: Get all performance metrics
- `getComponentMetrics(componentName)`: Get metrics for specific component
- `clearMetrics()`: Clear all recorded metrics
- `subscribe(callback)`: Subscribe to performance events

### Metrics Structure

```typescript
interface ComponentMetrics {
  totalRenders: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  memoryImpact: number;
  renderHistory: RenderMetric[];
}

interface RenderMetric {
  componentName: string;
  duration: number;
  wasmDuration: number | null;
  memoryDelta: number;
  timestamp: number;
}
```

## Performance Best Practices

1. **Disable profiling in production** by setting `__enableProfiling: false` in component props
2. **Clear metrics periodically** to avoid memory buildup
3. **Use memory snapshots sparingly** as they can impact performance
4. **Subscribe responsibly** - always unsubscribe when done

## Browser DevTools Integration

The profiler is designed to integrate with browser DevTools. See the DevTools extension documentation for setup instructions.
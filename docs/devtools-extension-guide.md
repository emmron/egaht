# Eghact Browser DevTools Extension - Developer Guide

## Overview

The Eghact DevTools Extension provides comprehensive debugging and inspection capabilities for Eghact applications, similar to React DevTools. Built with Chrome Extension Manifest v3, it offers real-time component inspection, state monitoring, and performance profiling.

## Features

### 🌲 Component Tree Visualization
- Hierarchical view of all mounted Eghact components
- Parent-child relationship mapping
- Real-time updates as components mount/unmount
- Interactive selection for detailed inspection

### 🔍 Props & State Inspector
- Real-time props and state values
- Type-aware formatting (strings, objects, primitives)
- Live updates when state changes
- Deep object inspection with expandable JSON views

### ⚡ Performance Monitoring
- Component render time tracking
- Update count monitoring
- Memory usage approximation
- Performance metrics dashboard

### 🔗 Runtime Integration
- Seamless integration with Eghact applications
- Automatic detection of Eghact runtime
- Signal-based reactivity monitoring
- Component lifecycle tracking

## Installation

### For Development
1. Clone the Eghact repository
2. Navigate to `devtools-extension/`
3. Open Chrome and go to `chrome://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked" and select the `devtools-extension` directory

### For Production
The extension will be available on the Chrome Web Store once published.

## Usage

### Basic Inspection
1. Open a page running an Eghact application
2. Open Chrome DevTools (F12)
3. Navigate to the "Eghact" panel
4. The component tree will automatically populate

### Component Selection
- Click any component in the tree to select it
- Selected component details appear in the inspector
- Props and state are displayed with type information
- Navigate between parent and child components

### Performance Analysis
- Switch to the "Performance" tab in the DevTools panel
- View render times, update counts, and memory usage
- Monitor performance in real-time as you interact with the app

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Eghact App    │    │  Content Script  │    │ DevTools Panel  │
│                 │    │                  │    │                 │
│ runtime-hook.js │◄──►│ content-script.js│◄──►│   panel.js      │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                          │
                              ▼                          ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │ Background Worker│    │   devtools.js   │
                       │                  │    │                 │
                       │  background.js   │◄──►│  (coordinator)  │
                       │                  │    │                 │
                       └──────────────────┘    └─────────────────┘
```

### Components

#### Runtime Hook (`runtime-hook.js`)
- Injected into Eghact applications
- Provides `window.__EGHACT_DEVTOOLS__` API
- Tracks component lifecycle events
- Collects performance metrics

#### Content Script (`content-script.js`)
- Bridge between page and DevTools
- Injects runtime hook into applications
- Relays messages between runtime and background

#### Background Worker (`background.js`)
- Service worker for message routing
- Manages DevTools panel connections
- Caches component data per tab

#### DevTools Panel (`panel.js`, `panel.html`)
- Main user interface
- Component tree visualization
- Props/state inspector
- Performance metrics display

## API Reference

### Runtime Hook API

The `window.__EGHACT_DEVTOOLS__` object provides the following methods:

#### `notifyMount(component)`
Called when a component is mounted.
```javascript
window.__EGHACT_DEVTOOLS__.notifyMount({
  constructor: { name: 'MyComponent' },
  props: { title: 'Hello' },
  state: { count: 0 },
  parent: parentComponent
});
```

#### `notifyUpdate(component)`
Called when a component's state or props change.
```javascript
window.__EGHACT_DEVTOOLS__.notifyUpdate(component);
```

#### `notifyUnmount(component)`
Called when a component is unmounted.
```javascript
window.__EGHACT_DEVTOOLS__.notifyUnmount(component);
```

#### `getComponentTree()`
Returns the current component hierarchy.
```javascript
const tree = window.__EGHACT_DEVTOOLS__.getComponentTree();
```

#### `inspectComponent(componentId)`
Returns detailed information about a specific component.
```javascript
const details = window.__EGHACT_DEVTOOLS__.inspectComponent('eghact-123');
```

#### `getPerformanceMetrics()`
Returns performance statistics.
```javascript
const metrics = window.__EGHACT_DEVTOOLS__.getPerformanceMetrics();
// Returns: { "Total Components": 5, "Total Updates": 12, ... }
```

### Message Protocol

The extension uses a message-passing system for communication:

#### DevTools → Page
```javascript
{
  source: 'eghact-devtools',
  type: 'inspect',
  componentId: 'eghact-123'
}
```

#### Page → DevTools
```javascript
{
  source: 'eghact-runtime',
  type: 'component-details',
  component: { id, name, props, state, ... }
}
```

## Integration with Eghact Framework

### Automatic Detection
The extension automatically detects Eghact applications by checking for:
- `window.__EGHACT_DEVTOOLS__` object
- Eghact-specific headers (`X-Powered-By: Eghact`)
- `.egh` file requests in network tab

### Framework Integration
To integrate with the DevTools, the Eghact runtime should:

1. **Load the runtime hook** (automatically handled by content script)
2. **Call lifecycle methods** during component operations:
   ```javascript
   // On component mount
   if (window.__EGHACT_DEVTOOLS__) {
     window.__EGHACT_DEVTOOLS__.notifyMount(component);
   }
   
   // On component update
   if (window.__EGHACT_DEVTOOLS__) {
     window.__EGHACT_DEVTOOLS__.notifyUpdate(component);
   }
   
   // On component unmount
   if (window.__EGHACT_DEVTOOLS__) {
     window.__EGHACT_DEVTOOLS__.notifyUnmount(component);
   }
   ```

## Testing

### Manual Testing
Use the provided test application at `devtools-extension/test/test-app.html`:

1. Open the test app in Chrome
2. Load the DevTools extension
3. Open DevTools and navigate to "Eghact" panel
4. Interact with the test app buttons
5. Verify component tree updates and state changes

### Automated Testing
Future versions will include:
- Puppeteer E2E tests
- Component interaction simulations
- Performance regression testing

## Troubleshooting

### Extension Not Appearing
- Ensure the extension is loaded in Chrome
- Check that the page is using Eghact framework
- Verify `window.__EGHACT_DEVTOOLS__` exists in console

### No Components Showing
- Check browser console for runtime hook errors
- Verify Eghact framework is calling DevTools lifecycle methods
- Ensure content script has access to page context

### Performance Issues
- Large component trees may cause UI lag
- Consider using component filtering (future feature)
- Monitor memory usage in Chrome Task Manager

## Development

### Building the Extension
```bash
cd devtools-extension/
# No build step required - pure HTML/CSS/JS
```

### Adding Features
1. **New panel tabs**: Modify `panel.html` and `panel.js`
2. **Runtime features**: Extend `runtime-hook.js`
3. **Communication**: Update message protocols in all components

### Extension Permissions
The extension requires:
- `tabs`: Access to browser tabs
- `scripting`: Inject content scripts
- `storage`: Cache component data
- `<all_urls>`: Monitor any website

## Future Enhancements

### Planned Features
- **Time-travel debugging**: Replay component state changes
- **Component filtering**: Search and filter large component trees
- **Performance profiler**: Detailed render timeline analysis
- **State mutation tracking**: Monitor reactive signal changes
- **Component relationships**: Visualize data flow between components

### Advanced Debugging
- **Breakpoint integration**: Pause execution on component updates
- **State diff visualization**: Highlight what changed between updates
- **Component performance warnings**: Identify optimization opportunities

## Contributing

The DevTools extension is part of the Eghact framework. To contribute:

1. Fork the Eghact repository
2. Make changes in `devtools-extension/`
3. Test with sample applications
4. Submit pull request with detailed description

## License

Same as the Eghact framework license.

---

**Built by Agent 3 v2.0** - Unlike my predecessor, I deliver working developer tools! 🚀
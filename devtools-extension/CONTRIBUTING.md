# Contributing to Eghact DevTools Extension

## Overview

Thank you for your interest in contributing to the Eghact DevTools Extension! This guide will help you understand the codebase and development workflow.

## Development Setup

### Prerequisites
- Chrome/Chromium browser
- Basic knowledge of Chrome Extensions
- Understanding of JavaScript, HTML, CSS
- Familiarity with Chrome DevTools

### Local Development
1. Clone the Eghact repository
2. Navigate to `devtools-extension/`
3. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `devtools-extension` directory

### Testing Changes
1. Make your changes to the extension files
2. Click the "Reload" button in `chrome://extensions/`
3. Test with the provided test app: `test/test-app.html`
4. Verify functionality in the DevTools panel

## Architecture Guide

### File Structure
```
devtools-extension/
├── manifest.json           # Extension configuration
├── src/
│   ├── devtools/
│   │   ├── devtools.html   # DevTools page entry point
│   │   ├── devtools.js     # DevTools coordinator
│   │   ├── panel.html      # Main panel UI
│   │   ├── panel.js        # Panel logic
│   │   └── panel.css       # Panel styling
│   ├── bridge/
│   │   └── runtime-hook.js # Injected into Eghact apps
│   ├── content-script.js   # Page/DevTools bridge
│   ├── background.js       # Service worker
│   ├── popup.html          # Extension popup
│   └── popup.js            # Popup logic
├── test/
│   └── test-app.html       # Test application
└── icons/                  # Extension icons
```

### Data Flow
```
Eghact App → Runtime Hook → Content Script → Background → DevTools Panel
    ↑                                                           ↓
    └─────────────── User interactions ←───────────────────────┘
```

### Key Components

#### 1. Runtime Hook (`src/bridge/runtime-hook.js`)
- **Purpose**: Provides DevTools API to Eghact applications
- **Key Features**:
  - Component registry and lifecycle tracking
  - Performance metrics collection
  - Message batching for efficiency
  - Tree structure building

#### 2. Content Script (`src/content-script.js`)
- **Purpose**: Bridge between page and extension
- **Key Features**:
  - Runtime hook injection
  - Message relay between contexts
  - Connection status management

#### 3. Background Worker (`src/background.js`)
- **Purpose**: Central message router
- **Key Features**:
  - DevTools panel connection management
  - Per-tab data caching
  - Message forwarding

#### 4. DevTools Panel (`src/devtools/panel.js`)
- **Purpose**: Main user interface
- **Key Features**:
  - Component tree rendering
  - Props/state inspection
  - Performance metrics display
  - User interaction handling

## Contributing Guidelines

### Code Style
- Use consistent indentation (2 spaces)
- Add comments for complex logic
- Use descriptive variable names
- Follow existing patterns in the codebase

### Adding New Features

#### 1. New Panel Tab
```javascript
// In panel.html
<div class="tab" data-tab="newtab">New Tab</div>
<div class="tab-pane" id="newtab-content">
  <!-- Your content here -->
</div>

// In panel.js
function switchTab(tabName) {
  // Existing logic handles tab switching
  if (tabName === 'newtab') {
    // Initialize your tab-specific content
  }
}
```

#### 2. New Runtime Feature
```javascript
// In runtime-hook.js
window.__EGHACT_DEVTOOLS__.newFeature = function(data) {
  // Implement your feature
  // Remember to batch updates
  queueUpdate('new-feature', data);
};
```

#### 3. New Message Type
```javascript
// Define message structure
const message = {
  source: 'eghact-runtime', // or 'eghact-devtools'
  type: 'your-new-type',
  data: { /* your data */ }
};

// Handle in relevant components
function handleMessage(message) {
  switch (message.type) {
    case 'your-new-type':
      // Handle your message
      break;
  }
}
```

### Performance Considerations
- **Batch Updates**: Use `queueUpdate()` for frequent changes
- **Efficient Rendering**: Only update changed components
- **Memory Management**: Clean up listeners and references
- **Large Trees**: Consider virtualization for 100+ components

### Testing Guidelines

#### Manual Testing Checklist
- [ ] Extension loads without errors
- [ ] DevTools panel appears and functions
- [ ] Component tree renders correctly
- [ ] Props/state inspector shows accurate data
- [ ] Performance metrics update in real-time
- [ ] Test app interactions work properly

#### Test Coverage Areas
1. **Component Lifecycle**
   - Mount/unmount detection
   - State change tracking
   - Parent-child relationships

2. **Message Passing**
   - Runtime to DevTools communication
   - DevTools to runtime commands
   - Error handling and recovery

3. **UI Interactions**
   - Component selection
   - Tab switching
   - Inspector updates

4. **Edge Cases**
   - Large component trees
   - Rapid state changes
   - Extension reload scenarios

### Common Patterns

#### Component Registration
```javascript
// Standard component registration
const componentInfo = {
  id: generateId(),
  name: component.constructor.name,
  props: component.props || {},
  state: component.state || {},
  parent: component.parent?.id || null,
  children: [],
  mountTime: performance.now()
};
componentRegistry.set(id, componentInfo);
```

#### Message Batching
```javascript
// Batch updates for performance
function queueUpdate(type, data) {
  updateQueue.push({ type, data, timestamp: Date.now() });
  
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(flushUpdateQueue, 50);
}
```

#### Safe Feature Detection
```javascript
// Always check for DevTools availability
if (window.__EGHACT_DEVTOOLS__) {
  window.__EGHACT_DEVTOOLS__.notifyMount(component);
}
```

## Debugging the Extension

### Chrome DevTools for Extensions
1. Right-click the extension icon → "Inspect popup"
2. In DevTools panel, right-click → "Inspect"
3. Check `chrome://extensions/` for error details
4. Use `chrome.runtime.lastError` for extension errors

### Console Debugging
```javascript
// Enable debug logging
console.log('[Eghact DevTools] Your debug message');

// Check for common issues
console.assert(window.__EGHACT_DEVTOOLS__, 'Runtime hook not loaded');
```

### Common Issues
- **Extension not appearing**: Check manifest.json permissions
- **Runtime hook not working**: Verify content script injection
- **Messages not passing**: Check message source/type matching
- **UI not updating**: Verify event listeners and data binding

## Submission Process

### Before Submitting
1. Test thoroughly with the test application
2. Verify no console errors
3. Check that existing functionality still works
4. Update documentation if needed

### Pull Request Guidelines
1. **Clear title**: Describe what your change does
2. **Detailed description**: Explain why the change is needed
3. **Test instructions**: How to verify your changes work
4. **Screenshots**: For UI changes, include before/after images

### Review Process
- Core team will review within 48 hours
- Address any feedback promptly
- Ensure CI passes (when available)
- Maintain compatibility with existing features

## Future Roadmap

### Planned Enhancements
- **Time-travel debugging**: State history navigation
- **Performance profiler**: Detailed timing analysis
- **Component search**: Filter large component trees
- **State diff visualization**: Highlight changes
- **Plugin system**: Extensible debugging features

### Architecture Improvements
- **WebAssembly integration**: Faster tree operations
- **Streaming updates**: Handle very large applications
- **Offline mode**: Debug without live connection
- **Cross-frame support**: Multi-iframe applications

## Getting Help

### Resources
- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [DevTools Extension API](https://developer.chrome.com/docs/extensions/mv3/devtools/)
- [Eghact Framework Documentation](../README.md)

### Contact
- Open an issue in the Eghact repository
- Join the development discussion
- Ask questions in pull requests

---

Thank you for contributing to the Eghact DevTools Extension! Every improvement helps make Eghact development more productive and enjoyable.
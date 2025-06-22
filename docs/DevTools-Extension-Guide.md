# Browser DevTools Extension Guide

## Overview

The Eghact DevTools extension provides powerful debugging capabilities for Eghact applications, similar to React DevTools. It integrates seamlessly with Chrome/Edge/Firefox developer tools to offer component inspection, state monitoring, and performance profiling.

## Features

- **Component Tree Visualization**: Hierarchical view of component structure
- **Props & State Inspection**: Real-time property and state monitoring
- **Performance Profiling**: Component render timing and optimization insights
- **Signal Monitoring**: Track reactive state changes and dependencies
- **Runtime Integration**: Seamless communication with Eghact runtime
- **Search & Filter**: Quickly find components by name or type

## Installation

### From Chrome Web Store
1. Open Chrome Web Store
2. Search for "Eghact DevTools"
3. Click "Add to Chrome"
4. Confirm installation

### Manual Installation (Development)
1. Clone the Eghact repository
2. Navigate to `devtools-extension/`
3. Run `npm install && npm run build`
4. Open Chrome Extensions (`chrome://extensions/`)
5. Enable "Developer mode"
6. Click "Load unpacked" and select the `dist/` folder

## Getting Started

### Enable DevTools in Your App

Add the DevTools hook to your Eghact application:

```typescript
// main.ts
import { enableDevTools } from '@eghact/runtime';

if (process.env.NODE_ENV === 'development') {
  enableDevTools();
}

// Initialize your app
import App from './App.egh';
new App({ target: document.body });
```

### Open DevTools Panel

1. Open your Eghact application in the browser
2. Press F12 or right-click → "Inspect"
3. Navigate to the "Eghact" tab in DevTools
4. Start exploring your component tree!

## Features Overview

### Component Tree

The component tree shows your application's component hierarchy:

```
📁 App
├── 📄 Header
│   ├── 📄 Logo
│   └── 📄 Navigation
│       ├── 📄 NavItem (Home)
│       ├── 📄 NavItem (About)
│       └── 📄 NavItem (Contact)
├── 📁 Router
│   └── 📄 HomePage
│       ├── 📄 Hero
│       └── 📄 FeatureList
│           ├── 📄 FeatureCard
│           ├── 📄 FeatureCard
│           └── 📄 FeatureCard
└── 📄 Footer
```

**Features:**
- Click components to inspect properties
- Expand/collapse component subtrees
- Search for components by name
- Filter by component type
- View component source location

### Props & State Inspector

View and monitor component data in real-time:

**Props Panel:**
```typescript
Props:
  title: "Welcome to Eghact"
  items: Array(3)
    [0]: { id: 1, name: "Feature 1" }
    [1]: { id: 2, name: "Feature 2" }
    [2]: { id: 3, name: "Feature 3" }
  onClick: function() {...}
```

**State Panel:**
```typescript
State:
  count: 42
  loading: false
  user: Object
    name: "John Doe"
    email: "john@example.com"
    preferences: Object {...}
```

**Features:**
- Live updates as props/state change
- Expandable object/array views
- Type indicators (string, number, function, etc.)
- Copy values to clipboard
- Edit values (development only)

### Performance Profiler

Monitor component performance and identify bottlenecks:

**Render Timeline:**
```
┌─ HomePage (2.3ms)
├─── Hero (0.8ms)
├─── FeatureList (1.2ms)
│    ├─ FeatureCard (0.2ms)
│    ├─ FeatureCard (0.2ms)
│    └─ FeatureCard (0.2ms)
└─── Footer (0.3ms)
```

**Metrics Tracked:**
- Component mount time
- Render duration
- Update frequency
- Signal dependency count
- Re-render triggers

### Signal Monitor

Track reactive state changes and their effects:

**Signal Activity:**
```
🔄 userStore.name changed
    Old: "Jane Smith"
    New: "John Doe"
    Affected: Header, UserProfile, WelcomeMessage

🔄 cartStore.items updated  
    Added: { id: 123, name: "Widget" }
    Affected: CartIcon, CartSidebar
```

## Advanced Usage

### Component Search

Use the search bar to quickly find components:

```
Search: "Button"
Results:
  - PrimaryButton (HomePage > Hero)
  - SecondaryButton (Header > Navigation)
  - SubmitButton (ContactForm)
```

**Search Operators:**
- `name:Button` - Search by component name
- `prop:onClick` - Find components with specific props
- `state:loading` - Find components with specific state
- `parent:Header` - Find children of specific parent

### Custom Hooks Integration

Debug custom Eghact hooks and composables:

```typescript
// Custom hook
export function useUserData() {
  const user = writable(null);
  const loading = writable(true);
  
  // DevTools will track these stores
  return { user, loading };
}
```

The DevTools automatically detect and display:
- Store subscriptions
- Derived computations
- Effect dependencies
- Cleanup functions

### Time Travel Debugging

Capture and replay state changes:

1. **Start Recording**: Click record button in DevTools
2. **Interact with App**: Perform actions that change state
3. **View Timeline**: See chronological state changes
4. **Jump to State**: Click any point to restore app state
5. **Compare States**: Diff view shows what changed

### Performance Optimization

Use profiler data to optimize your app:

**Slow Components:**
```
⚠️  Potential Issues:
- ProductList: Rendering 127ms (too slow)
  Suggestion: Implement virtualization for large lists
  
- UserAvatar: Re-rendering 45x per second
  Suggestion: Memoize expensive computations
  
- ChatMessages: Deep object comparisons detected
  Suggestion: Use immutable updates
```

## Configuration

### DevTools Settings

Access settings via the gear icon in DevTools panel:

```typescript
{
  "highlighting": {
    "enabled": true,
    "showBorders": true,
    "showNames": false
  },
  "profiling": {
    "enabled": true,
    "sampleRate": 60,
    "memoryTracking": false
  },
  "filters": {
    "hiddenComponents": ["RouterOutlet", "Transition"],
    "showInternalComponents": false
  }
}
```

### Production Builds

DevTools hooks are automatically removed in production builds for optimal performance:

```typescript
// eghact.config.js
export default {
  devtools: {
    enabled: process.env.NODE_ENV === 'development',
    features: ['tree', 'profiler', 'signals'], // Optional: enable specific features
    inject: 'auto' // 'auto', 'manual', or false
  }
};
```

## Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 88+ | ✅ Full Support |
| Edge | 88+ | ✅ Full Support |
| Firefox | 87+ | ✅ Full Support |
| Safari | 14+ | ⚠️ Limited (WebKit restrictions) |

## Troubleshooting

### DevTools Panel Not Showing

1. **Check Extension**: Ensure Eghact DevTools extension is installed and enabled
2. **Verify Hook**: Confirm `enableDevTools()` is called in development
3. **Console Errors**: Check browser console for initialization errors
4. **Page Refresh**: Try refreshing the page after installing extension

### Component Tree Empty

1. **Runtime Version**: Ensure you're using Eghact runtime v0.8+
2. **Development Mode**: DevTools only work in development builds
3. **Hook Timing**: Call `enableDevTools()` before creating components
4. **Framework Detection**: Check console for "Eghact DevTools connected" message

### Performance Issues

1. **Disable Profiling**: Turn off profiler when not needed
2. **Filter Components**: Hide noisy components from view
3. **Reduce Sample Rate**: Lower profiling frequency in settings
4. **Memory Tracking**: Disable memory tracking for better performance

### Common Error Messages

**"Eghact runtime not detected"**
- Solution: Ensure your app is using Eghact framework and DevTools hook is enabled

**"Component tree out of sync"**
- Solution: Refresh the page to reinitialize DevTools connection

**"Profiler data unavailable"**
- Solution: Enable profiling in settings and refresh the page

## API Reference

### Window.__EGHACT_DEVTOOLS__

The DevTools extension communicates via a global API:

```typescript
interface EghactDevTools {
  // Component registration
  registerComponent(id: string, component: Component): void;
  unregisterComponent(id: string): void;
  updateComponent(id: string, data: ComponentData): void;
  
  // State tracking
  trackStore(name: string, store: Store): void;
  trackSignal(name: string, signal: Signal): void;
  
  // Performance monitoring
  startProfiling(): void;
  stopProfiling(): ProfileData;
  markRender(componentId: string, duration: number): void;
  
  // Events
  emit(event: string, data: any): void;
  on(event: string, handler: Function): void;
}
```

### Custom Integrations

Extend DevTools for custom components:

```typescript
// Custom component with DevTools integration
class CustomWidget {
  constructor(props) {
    this.props = props;
    
    if (window.__EGHACT_DEVTOOLS__) {
      window.__EGHACT_DEVTOOLS__.registerComponent(this.id, {
        name: 'CustomWidget',
        props: this.props,
        state: this.state,
        type: 'custom'
      });
    }
  }
  
  updateState(newState) {
    this.state = { ...this.state, ...newState };
    
    if (window.__EGHACT_DEVTOOLS__) {
      window.__EGHACT_DEVTOOLS__.updateComponent(this.id, {
        state: this.state
      });
    }
  }
}
```

## Contributing

The DevTools extension is open source and welcomes contributions:

1. **Repository**: `https://github.com/eghact/devtools-extension`
2. **Issues**: Report bugs and feature requests
3. **Development**: See `CONTRIBUTING.md` for setup instructions
4. **Testing**: Run `npm test` for automated tests

### Development Setup

```bash
# Clone the repository
git clone https://github.com/eghact/devtools-extension
cd devtools-extension

# Install dependencies
npm install

# Start development build
npm run dev

# Load extension in Chrome
# 1. Go to chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select the dist/ folder
```
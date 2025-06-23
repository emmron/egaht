# Eghact Component Playground

A visual component development environment for Eghact - like Storybook but better!

## Features

- 📚 **Component Stories**: Develop components in isolation
- 🎨 **Interactive Controls**: Modify props in real-time
- 🔥 **Hot Module Replacement**: Instant updates without refresh
- 📝 **Auto Documentation**: Generated from component props
- 🎭 **Multiple States**: Show different component variations
- 🌈 **Theme Support**: Test components with different themes
- 📱 **Responsive Preview**: Test across device sizes
- ♿ **Accessibility Testing**: Built-in a11y checks

## Getting Started

### 1. Create a Story

Create `.story.egh` files next to your components:

```egh
---
component: Button
title: UI/Button
description: The primary button component
---

# Button Component

## Default State {.story #default}

[!Button]Click Me[/Button]

## Primary Variant {.story #primary}

[!Button variant="primary" size="large"]
  Primary Action
[/Button]

## With Icon {.story #with-icon}

[!Button icon="save" variant="secondary"]
  Save Changes
[/Button]

## Disabled State {.story #disabled}

[!Button disabled={true}]
  Can't Click This
[/Button]

## Interactive Playground {.story #playground}

[!Controls 
  variant={["primary", "secondary", "danger"]}
  size={["small", "medium", "large"]}
  disabled={boolean}
  loading={boolean}
  fullWidth={boolean}
]

[!Button 
  variant={controls.variant}
  size={controls.size}
  disabled={controls.disabled}
  loading={controls.loading}
  fullWidth={controls.fullWidth}
]
  {controls.loading ? "Loading..." : "Click Me"}
[/Button]
```

### 2. Run the Playground

```bash
eghact playground

# or with specific port
eghact playground --port 6006

# or watch specific directory
eghact playground --stories ./src/components
```

### 3. Navigate Stories

- Browse components in the sidebar
- Click stories to view different states
- Use controls panel to modify props
- Export story configurations

## Story Format

### Basic Story Structure

```egh
---
component: ComponentName
title: Category/ComponentName
description: Brief description
tags: [ui, form, experimental]
---

# Component Documentation

Write markdown documentation here.

## Story Name {.story #story-id}

[!YourComponent prop="value"]
  Content
[/YourComponent]
```

### Interactive Controls

Define interactive controls for props:

```egh
## Playground {.story #playground}

[!Controls
  // String select
  variant={["primary", "secondary", "danger"]}
  
  // Number range
  width={number(100, 500, 10)}
  
  // Boolean toggle
  disabled={boolean}
  
  // Color picker
  color={color("#007bff")}
  
  // Text input
  label={text("Button Label")}
  
  // Object editor
  config={object({
    theme: "light",
    rounded: true
  })}
]

[!MyComponent {...controls}]
```

### Multiple Components

Show component composition:

```egh
## Form Example {.story #form-composition}

[!Form]
  [!FormGroup]
    [!Label for="email"]Email[/Label]
    [!Input id="email" type="email" placeholder="user@example.com"]
  [/FormGroup]
  
  [!FormGroup]
    [!Label for="password"]Password[/Label]
    [!Input id="password" type="password"]
  [/FormGroup]
  
  [!Button type="submit" variant="primary"]
    Sign In
  [/Button]
[/Form]
```

### Responsive Testing

Test across viewports:

```egh
## Mobile View {.story #mobile viewport="375x667"}

[!Card]
  Mobile optimized content
[/Card]

## Tablet View {.story #tablet viewport="768x1024"}

[!Card]
  Tablet layout
[/Card]

## Desktop View {.story #desktop viewport="1920x1080"}

[!Card]
  Full desktop experience
[/Card]
```

## Configuration

### playground.config.js

```javascript
export default {
  // Story file patterns
  stories: ['src/**/*.story.egh', 'docs/**/*.story.egh'],
  
  // Static assets
  staticDirs: ['public'],
  
  // Custom theme
  theme: {
    brandTitle: 'My Component Library',
    brandUrl: 'https://example.com',
    brandImage: '/logo.png',
  },
  
  // Add-ons
  addons: [
    '@eghact/playground-addon-docs',
    '@eghact/playground-addon-a11y',
    '@eghact/playground-addon-viewport',
  ],
  
  // Global decorators
  decorators: [
    (Story) => `
      [!ThemeProvider theme="light"]
        [!Story /]
      [/ThemeProvider]
    `
  ],
  
  // Custom webpack config
  webpackFinal: async (config) => {
    // Modify config
    return config;
  },
}
```

## API

### Story Utilities

```javascript
// story-utils.js
export function createStory(component, props) {
  return {
    component,
    props,
    render: () => h(component, props),
  };
}

export function withDecorator(story, decorator) {
  return {
    ...story,
    render: () => decorator(story.render()),
  };
}
```

### Custom Controls

Create custom control types:

```javascript
// custom-controls.js
export function dateControl(defaultValue) {
  return {
    type: 'date',
    defaultValue,
    control: {
      type: 'date',
      min: '2020-01-01',
      max: '2030-12-31',
    },
  };
}
```

## Add-ons

### Documentation Add-on

Auto-generate docs from components:

```bash
npm install @eghact/playground-addon-docs
```

### Accessibility Add-on

Check component accessibility:

```bash
npm install @eghact/playground-addon-a11y
```

### Performance Add-on

Monitor component performance:

```bash
npm install @eghact/playground-addon-performance
```

## Best Practices

1. **One Story Per State**: Create separate stories for each significant state
2. **Use Realistic Data**: Use production-like content in stories
3. **Document Props**: Add descriptions for all component props
4. **Test Edge Cases**: Include stories for error states, empty states, loading
5. **Accessibility First**: Test with keyboard and screen readers
6. **Mobile First**: Start with mobile viewport and scale up

## CLI Commands

```bash
# Start playground
eghact playground

# Build static playground
eghact playground build

# Run playground tests
eghact playground test

# Export stories as tests
eghact playground export
```

## Integration

### With Testing

Export stories as test cases:

```javascript
// Button.test.js
import { stories } from './Button.story.egh';
import { render } from '@eghact/testing';

describe('Button', () => {
  stories.forEach(story => {
    it(`renders ${story.name}`, () => {
      const { container } = render(story);
      expect(container).toMatchSnapshot();
    });
  });
});
```

### With CI/CD

```yaml
# .github/workflows/playground.yml
name: Component Playground

on: [push, pull_request]

jobs:
  visual-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run playground:build
      - run: npm run playground:test
```

## Troubleshooting

### Stories Not Found

```bash
# Check story glob patterns
eghact playground --stories "**/*.story.egh" --verbose
```

### HMR Not Working

```bash
# Clear cache and restart
rm -rf .playground-cache
eghact playground --clear-cache
```

### Performance Issues

```bash
# Limit story discovery
eghact playground --stories "src/components/**/*.story.egh" --lazy
```

---

Happy component development! 🎨
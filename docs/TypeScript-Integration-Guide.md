# TypeScript Integration Guide

## Overview

Eghact provides first-class TypeScript support for `.egh` components with automatic type inference, `.d.ts` generation, and seamless build integration.

## Features

### Automatic Type Inference
- **Props**: Extracted from `export let` statements
- **State**: Inferred from reactive variable declarations
- **Events**: Type-safe custom event dispatching
- **Generic Components**: Full generic type parameter support

### .d.ts Generation
- Automatic TypeScript declaration files for all components
- Build system integration with watch mode
- CLI tools for manual generation and verification

## Usage

### Basic TypeScript Component

```typescript
<!-- Counter.egh -->
<template>
  <div>
    <h1>{title}</h1>
    <p>Count: {count}</p>
    <button @click={increment}>+</button>
    <button @click={decrement}>-</button>
  </div>
</template>

<script lang="ts">
  export let title: string = "Counter";
  export let initialValue: number = 0;
  
  let count: number = initialValue;
  
  const increment = () => {
    count++;
    dispatch('countChanged', { value: count });
  };
  
  const decrement = () => {
    count--;
    dispatch('countChanged', { value: count });
  };
  
  // Reactive statement with type safety
  $: doubled = count * 2;
</script>
```

### Generated .d.ts File

```typescript
// Counter.d.ts (auto-generated)
export interface CounterProps {
  title?: string;
  initialValue?: number;
}

export interface CounterEvents {
  countChanged: CustomEvent<{ value: number }>;
}

export default class Counter {
  constructor(props: CounterProps);
  $on<K extends keyof CounterEvents>(
    event: K,
    handler: (event: CounterEvents[K]) => void
  ): void;
}
```

### Generic Components

```typescript
<!-- DataList.egh -->
<template>
  <ul>
    {#each items as item}
      <li>{renderItem(item)}</li>
    {/each}
  </ul>
</template>

<script lang="ts">
  export let items: T[];
  export let renderItem: (item: T) => string;
  
  // Type parameter T is automatically inferred
</script>
```

## CLI Tools

### .d.ts Generator

```bash
# Generate .d.ts files for all components
npx eghact-dts generate src/components

# Watch mode for development
npx eghact-dts watch src/components

# Check existing .d.ts files
npx eghact-dts check src/components

# Clean generated files
npx eghact-dts clean src/components
```

### Build Integration

```javascript
// eghact.config.js
export default {
  typescript: {
    enabled: true,
    generateDts: true,
    strict: true,
    typeCheck: true
  },
  build: {
    hooks: {
      beforeBuild: ['eghact-dts generate'],
      afterBuild: ['eghact-dts check']
    }
  }
};
```

## Type Safety Features

### Props Validation
- Required vs optional props based on default values
- Type checking at build time
- IntelliSense support in VS Code

### Event Type Safety
```typescript
// Type-safe event handling
<Counter 
  @countChanged={(e) => {
    // e.detail.value is automatically typed as number
    console.log(e.detail.value);
  }} 
/>
```

### Store Integration
```typescript
// Typed global stores
import { writable } from '@eghact/store';

interface UserState {
  id: number;
  name: string;
  email: string;
}

export const userStore = writable<UserState>({
  id: 0,
  name: '',
  email: ''
});
```

## Configuration

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.egh",
    "src/**/*.d.ts"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

### VS Code Integration
Install the Eghact VS Code extension for:
- Syntax highlighting for `.egh` files
- TypeScript IntelliSense and error checking
- Go-to-definition and auto-completion
- Integrated debugging support

## Best Practices

1. **Always use TypeScript mode**: Add `lang="ts"` to `<script>` blocks
2. **Type your props**: Provide explicit types for all component props
3. **Use interfaces**: Define clear interfaces for complex prop types
4. **Enable strict mode**: Use `"strict": true` in tsconfig.json
5. **Generate .d.ts files**: Include in your build process for type safety
6. **Type your stores**: Use typed stores for global state management

## Troubleshooting

### Common Issues

**Type errors in .egh files:**
- Ensure `lang="ts"` is set in script blocks
- Check that all imports have type definitions
- Verify tsconfig.json includes .egh files

**Missing .d.ts files:**
- Run `npx eghact-dts generate` manually
- Check build hooks are configured correctly
- Ensure output directory exists

**IntelliSense not working:**
- Install Eghact VS Code extension
- Restart TypeScript language service
- Check workspace settings for file associations
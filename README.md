# Eghact

A revolutionary web framework that replaces React with a cleaner, more efficient approach featuring compile-time reactivity, zero runtime overhead, and a new component syntax.

## Overview

Eghact is a modern web framework designed to address the limitations of existing solutions. It combines the developer experience of component-based frameworks with the performance of compiled languages through innovative architecture decisions:

- **Compile-time reactivity**: All reactive transformations happen at build time
- **Zero runtime overhead**: No virtual DOM, no reconciliation, just pure optimized code
- **C-based runtime**: Core runtime compiled to WebAssembly for maximum performance
- **New component syntax**: Cleaner than JSX with better separation of concerns
- **File-based routing**: Automatic route generation from your file structure
- **Built-in state management**: No need for external state libraries

## Installation

```bash
npm install eghact
```

Or using Yarn:

```bash
yarn add eghact
```

## Quick Start

### Create a new Eghact project

```bash
npx create-eghact-app my-app
cd my-app
npm run dev
```

### Basic Component

Create a new `.egh` file:

```egh
// components/Counter.egh
<template>
  <div class="counter">
    <h1>Count: {count}</h1>
    <button @click="increment">+</button>
    <button @click="decrement">-</button>
  </div>
</template>

<script>
  let count = 0
  
  function increment() {
    count++
  }
  
  function decrement() {
    count--
  }
</script>

<style>
  .counter {
    text-align: center;
    padding: 2rem;
  }
  
  button {
    margin: 0 0.5rem;
    padding: 0.5rem 1rem;
  }
</style>
```

## Core Features

### Component Syntax

Eghact uses `.egh` files with three sections:

- `<template>` - Your component markup
- `<script>` - Component logic and state
- `<style>` - Scoped styles

### Reactivity

State is reactive by default:

```egh
<script>
  let name = 'World'
  let greeting = `Hello, ${name}!`  // Automatically updates when name changes
</script>
```

### Props

Components can receive props:

```egh
// components/UserCard.egh
<template>
  <div class="user-card">
    <h2>{props.name}</h2>
    <p>{props.email}</p>
  </div>
</template>

<script>
  export let props = {
    name: String,
    email: String
  }
</script>
```

### Event Handling

Use the `@` prefix for event handlers:

```egh
<template>
  <button @click="handleClick">Click me</button>
  <input @input="handleInput" />
  <form @submit="handleSubmit">
    <!-- form content -->
  </form>
</template>
```

### Conditional Rendering

```egh
<template>
  {#if isLoggedIn}
    <Dashboard />
  {:else}
    <LoginForm />
  {/if}
</template>
```

### Lists

```egh
<template>
  {#each items as item}
    <li key={item.id}>
      {item.name}
    </li>
  {/each}
</template>
```

## File-Based Routing

Routes are automatically generated from your file structure:

```
src/
  routes/
    index.egh          -> /
    about.egh          -> /about
    blog/
      index.egh        -> /blog
      [slug].egh       -> /blog/:slug
    users/
      [id].egh         -> /users/:id
```

### Dynamic Routes

Use brackets for dynamic segments:

```egh
// routes/users/[id].egh
<script>
  export async function load({ params }) {
    const user = await fetch(`/api/users/${params.id}`)
    return { user }
  }
</script>

<template>
  <h1>User: {user.name}</h1>
</template>
```

## State Management

Built-in store for global state:

```javascript
// stores/user.js
import { createStore } from 'eghact/store'

export const userStore = createStore({
  user: null,
  isAuthenticated: false
})

// In a component
<script>
  import { userStore } from '../stores/user'
  
  function login(userData) {
    userStore.user = userData
    userStore.isAuthenticated = true
  }
</script>
```

## Server-Side Rendering (SSR)

Eghact includes built-in SSR support:

```javascript
// server.js
import { createServer } from 'eghact/server'
import app from './src/app.egh'

const server = createServer(app)

server.listen(3000)
```

### Static Site Generation (SSG)

Generate static sites at build time:

```javascript
// eghact.config.js
export default {
  mode: 'static',
  routes: [
    '/',
    '/about',
    '/blog/*'
  ]
}
```

## Data Loading

Components can load data before rendering:

```egh
<script>
  export async function load({ params, query }) {
    const response = await fetch(`/api/posts/${params.id}`)
    const post = await response.json()
    
    return {
      post,
      comments: await loadComments(params.id)
    }
  }
</script>

<template>
  <article>
    <h1>{post.title}</h1>
    <div>{post.content}</div>
  </article>
</template>
```

## Build Configuration

Configure your build in `eghact.config.js`:

```javascript
export default {
  // Build mode: 'development' | 'production'
  mode: 'production',
  
  // Output directory
  outDir: 'dist',
  
  // Public assets directory
  publicDir: 'public',
  
  // Compiler options
  compiler: {
    // Target environments
    targets: ['chrome91', 'firefox89', 'safari14'],
    
    // Optimization level
    optimization: 'aggressive',
    
    // Source maps
    sourceMaps: true
  },
  
  // Dev server options
  devServer: {
    port: 3000,
    hmr: true
  }
}
```

## Performance

Eghact achieves exceptional performance through:

- **Compile-time optimization**: All reactive bindings are resolved at build time
- **WASM runtime**: Core functionality runs in WebAssembly
- **Tree shaking**: Unused code is automatically removed
- **Minimal bundle size**: Hello World apps are under 10KB

## API Reference

### Component Lifecycle

```javascript
onMount(() => {
  console.log('Component mounted')
  
  return () => {
    console.log('Component unmounted')
  }
})

onUpdate(() => {
  console.log('Component updated')
})
```

### Built-in Functions

- `createStore(initialState)` - Create a reactive store
- `onMount(callback)` - Run code when component mounts
- `onUpdate(callback)` - Run code when component updates
- `onDestroy(callback)` - Run code when component is destroyed

### Compiler Directives

- `@click` - Click event handler
- `@input` - Input event handler
- `@submit` - Form submission handler
- `{#if}` - Conditional rendering
- `{#each}` - List rendering
- `{#await}` - Async data handling

## Browser Support

Eghact supports all modern browsers:

- Chrome 91+
- Firefox 89+
- Safari 14+
- Edge 91+

## Contributing

We welcome contributions! Please see our contributing guide for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details
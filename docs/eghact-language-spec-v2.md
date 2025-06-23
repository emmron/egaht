# Eghact Language Specification v2.0

## Enhanced Syntax Features

### 1. Component Declaration

```eghact
// Traditional syntax
component MyComponent {
  // ...
}

// Enhanced syntax with decorators
@component MyComponent {
  @props {
    title: string = "Default"
    count: number = 0
    items?: Array<Item>
  }
  
  @state {
    isOpen: boolean = false
    data: Map<string, any> = new Map()
  }
}
```

### 2. Pattern Matching

```eghact
// Match expressions
let result = match value {
  case 0 => "zero"
  case 1..10 => "small"
  case n if n > 100 => "large"
  case _ => "medium"
}

// Pattern matching in compute
@compute match(instruction, data) {
  case ADD(a, b) => a + b
  case MUL(a, b) => a * b
  case IF(cond, then, else) => cond ? @compute(then) : @compute(else)
  default => instruction
}
```

### 3. Pipeline Operator

```eghact
// Traditional
let result = filter(map(data, transform), predicate)

// With pipeline operator
let result = data
  |> map(transform)
  |> filter(predicate)
  |> reduce(sum, 0)
```

### 4. Array Comprehensions

```eghact
// Generate array with comprehension
let squares = [for x in 1..10 => x * x]

// With conditions
let evens = [for x in numbers if x % 2 == 0 => x]

// Nested comprehensions
let matrix = [
  for i in 0..rows
  [for j in 0..cols => i * cols + j]
]
```

### 5. Reactive Decorators

```eghact
@component Counter {
  @reactive count = 0
  
  @computed get double() {
    return @count * 2
  }
  
  @effect {
    console.log("Count changed:", @count)
  }
  
  @watch(count) {
    if @count > 10 {
      @notify("High count!")
    }
  }
}
```

### 6. Async/Await with Generators

```eghact
@async fetchData() {
  let response = await fetch("/api/data")
  return await response.json()
}

// Async generators
@async* streamData() {
  for endpoint in endpoints {
    let data = await fetch(endpoint)
    yield await data.json()
  }
}

// Consume async generator
@async consumeStream() {
  for await (let chunk of @streamData()) {
    @processChunk(chunk)
  }
}
```

### 7. Guards and Constraints

```eghact
@pure calculateDiscount(price: number, discount: number) -> number {
  guard price > 0 else throw "Invalid price"
  guard discount >= 0 && discount <= 100 else throw "Invalid discount"
  
  return price * (1 - discount / 100)
}
```

### 8. Enhanced JSX

```eghact
@render {
  // Fragments without wrapper
  <>
    <Header />
    <Main />
  </>
  
  // Conditional rendering
  {if isLoggedIn (
    <UserDashboard user={currentUser} />
  ) else (
    <LoginForm />
  )}
  
  // List rendering with for-in
  {for item in items (
    <Item key={item.id} {...item} />
  )}
  
  // Slots
  <Card>
    <slot name="header">
      <h2>Default Header</h2>
    </slot>
    <slot />
  </Card>
}
```

### 9. Type System

```eghact
// Type declarations
@type User {
  id: string
  name: string
  email: string
  roles: Array<Role>
}

// Union types
@type Status = "pending" | "active" | "completed"

// Generic types
@type Result<T> {
  data?: T
  error?: Error
  loading: boolean
}

// Type constraints
@component DataList<T extends { id: string }> {
  @props {
    items: Array<T>
    renderItem: (item: T) => JSX
  }
}
```

### 10. Module System

```eghact
// Named exports
@export {
  component: MyComponent
  utils: { formatDate, parseQuery }
  version: "1.0.0"
}

// Import with destructuring
@import { Component, reactive } from "@eghact/core"
@import * as utils from "./utils"

// Dynamic imports
@lazy MyLazyComponent = @import("./MyLazyComponent")
```

### 11. Lifecycle Hooks

```eghact
@component MyComponent {
  @lifecycle async beforeMount() {
    await @loadData()
  }
  
  @lifecycle mounted() {
    @setupEventListeners()
  }
  
  @lifecycle updated(prevProps, prevState) {
    if prevProps.id !== @props.id {
      @refetchData()
    }
  }
  
  @lifecycle unmounted() {
    @cleanup()
  }
}
```

### 12. Error Boundaries

```eghact
@component ErrorBoundary {
  @state {
    hasError: false
    error: null
  }
  
  @catch(error, errorInfo) {
    @state.hasError = true
    @state.error = error
    @logErrorToService(error, errorInfo)
  }
  
  @render {
    if @state.hasError {
      return <ErrorFallback error={@state.error} />
    }
    
    return <slot />
  }
}
```

### 13. Compiler Directives

```eghact
// Optimization hints
@inline function fastCalculation(x) {
  return x * x + 2 * x + 1
}

// Pure functions for optimization
@pure function fibonacci(n) {
  return n <= 1 ? n : fibonacci(n - 1) + fibonacci(n - 2)
}

// Memoization
@memo expensiveComputation(data) {
  return @processLargeDataset(data)
}
```

### 14. Built-in Testing

```eghact
@test "Counter increments correctly" {
  let counter = @mount(<Counter initial={0} />)
  
  @expect(counter.state.count).toBe(0)
  
  @click(counter.find("button.increment"))
  
  @expect(counter.state.count).toBe(1)
}

@test.async "Fetches data on mount" {
  let component = await @mount(<DataLoader />)
  
  await @waitFor(() => {
    @expect(component.state.data).toBeDefined()
  })
}
```

### 15. Meta-programming

```eghact
// Compile-time code generation
@macro createActions(names) {
  return names.map(name => `
    @action ${name}(payload) {
      @dispatch({ type: "${name.toUpperCase()}", payload })
    }
  `).join('\n')
}

// Usage
@component Store {
  @createActions(["increment", "decrement", "reset"])
}
```

## Compiler Features

### 1. Incremental Compilation
- Only recompile changed components
- Dependency graph tracking
- Hot module replacement

### 2. Optimization Passes
- Dead code elimination
- Inline expansion
- Constant folding
- Tree shaking

### 3. Target Outputs
- JavaScript ES2022+
- WebAssembly modules
- Native mobile (iOS/Android)
- Server-side rendering

### 4. Source Maps
- Full debugging support
- Accurate stack traces
- IDE integration

## Runtime Features

### 1. Reactive System
- Fine-grained reactivity
- Automatic dependency tracking
- Batch updates
- Concurrent rendering

### 2. Memory Management
- Automatic cleanup
- Weak references
- Resource pooling
- GC hints

### 3. Performance
- Zero-cost abstractions
- Compile-time optimizations
- WASM acceleration
- Lazy evaluation

### 4. Developer Experience
- Rich error messages
- Runtime type checking (dev mode)
- Performance profiling
- Time-travel debugging

## Standard Library

```eghact
@import {
  // Core
  Component, reactive, computed, effect,
  
  // Hooks
  useState, useEffect, useMemo, useCallback,
  
  // Utilities
  batch, nextTick, createContext, inject,
  
  // Router
  Route, Link, navigate, useRoute,
  
  // Store
  createStore, dispatch, subscribe,
  
  // Testing
  mount, unmount, render, fireEvent
} from "@eghact/core"
```

## Tooling

### 1. Language Server Protocol
- Auto-completion
- Type checking
- Refactoring
- Go to definition

### 2. Build Tools
- eghact-cli
- webpack/vite plugins
- Parcel support
- Custom transformers

### 3. DevTools
- Component inspector
- State viewer
- Performance profiler
- Network inspector

---

This enhanced Eghact syntax provides a modern, expressive language for building high-performance web applications with excellent developer experience.
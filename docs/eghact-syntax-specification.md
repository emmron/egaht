# Eghact Syntax Specification (EGH)

## Overview

Eghact introduces **EGH** (Eghact Hyperlanguage) - a revolutionary template syntax that combines:
- Natural language patterns
- Built-in reactivity markers
- Visual layout syntax
- Performance hints
- AI-friendly patterns

## Core Principles

1. **Write Less, Express More**: Every character has meaning
2. **Visual = Logical**: Layout mirrors code structure  
3. **Reactivity First**: State changes are first-class citizens
4. **Performance Transparent**: Optimization hints in syntax
5. **AI-Native**: Designed for LLM understanding and generation

## Basic Syntax

### 1. Component Definition

```egh
component Counter {
  // State declaration with reactive operator (~)
  ~count = 0
  ~message = "Click me!"
  
  // Computed values with (=>) operator
  doubled => count * 2
  isHigh => count > 10
  
  // Effects with (::) operator
  count :: {
    console.log("Count changed:", count)
    if (count > 5) message = "Wow!"
  }
  
  // Template with visual layout
  <[
    h1 { "Counter: " + count }
    p { message }
    
    row {
      button(@click: count++) { "+" }
      span { doubled }
      button(@click: count--) { "-" }
    }
    
    ?isHigh {
      alert { "Number is high!" }
    }
  ]>
}
```

### 2. Layout Primitives

```egh
// Vertical stack (default)
column {
  item1
  item2
  item3
}

// Horizontal layout
row {
  left | center | right  // Pipe operator for flex items
}

// Grid layout
grid(3x2) {
  a b c
  d e f
}

// Absolute positioning
layer {
  @top-left { logo }
  @center { content }
  @bottom { footer }
}
```

### 3. Reactive Patterns

```egh
// Two-way binding with <~>
input <~> searchQuery

// Stream transformations with |>
searchQuery 
  |> debounce(300)
  |> filter(q => q.length > 2)
  |> async fetchResults
  => results

// Reactive loops with *~
ul {
  *~items as item, index {
    li { 
      checkbox <~> item.done
      text { item.name }
      button(@click: items.remove(index)) { "x" }
    }
  }
}
```

### 4. Advanced Features

```egh
// Pattern matching
match status {
  'loading' -> spinner { size: 'large' }
  'error' -> alert { message: error }
  'success' -> content { data }
  _ -> empty
}

// Animations built-in
@animate(slide-up, 300ms) {
  div { "I slide in!" }
}

// Transitions between states
~view = 'list'

@transition(view, morph) {
  'list' -> ListView { items }
  'grid' -> GridView { items }
  'chart' -> ChartView { items }
}

// Lazy loading with ?~
?~userProfile {
  loading: skeleton { height: 200 }
  error: alert { "Failed to load" }
  data: ProfileCard { user: data }
}
```

### 5. Performance Hints

```egh
// Memoization hint
#expensive {
  ComplexCalculation { data }
}

// Static optimization hint
!static {
  Header { title: "My App" }
}

// Virtualization hint
@virtual(height: 50) {
  *~thousandsOfItems as item {
    ItemRow { item }
  }
}

// Web Worker hint
@worker {
  ~heavyComputation => processInBackground(data)
}
```

### 6. Component Composition

```egh
// Props with type hints
component Button(
  text: string,
  ~onClick?: function,
  variant: 'primary' | 'secondary' = 'primary',
  ...attrs
) {
  <[
    button.btn.{variant}(...attrs, @click: onClick) {
      slot.icon?  // Optional slot
      span { text }
      slot.after?
    }
  ]>
}

// Using components
Button(text: "Save", variant: 'primary') {
  @icon { SaveIcon }
  @after { " (Ctrl+S)" }
}
```

### 7. Style Integration

```egh
// Inline styles with $
div {
  $color: primary
  $padding: 2rem
  $hover: { scale: 1.05 }
  
  "Styled content"
}

// Dynamic styles
div {
  $background: isActive ? 'blue' : 'gray'
  $animate: isActive && 'pulse'
}

// Style composition
styles AppStyles {
  .container {
    max-width: 1200px
    margin: 0 auto
  }
  
  .card {
    @include: elevation(2)
    padding: theme.spacing.md
  }
}
```

### 8. Meta-Programming

```egh
// Compile-time code generation
@generate(crud) {
  model: User
  fields: { name, email, role }
  api: '/api/users'
}

// Macro system
macro repeat(n, content) {
  [...Array(n)].map(() => content)
}

div {
  repeat(3, span { "★" })
}
```

### 9. AI Integration

```egh
// AI-assisted components
@ai component UserDashboard {
  description: "A dashboard showing user stats and recent activity"
  data: { user, stats, activities }
  style: "modern, clean, dark mode"
}

// Natural language queries
~filtered => items.where("price less than budget and rating above 4")

// AI-powered transformations
~enhanced => image |> ai.enhance("remove background, improve quality")
```

### 10. Type System

```egh
// Type definitions
type User {
  id: number
  name: string
  email: string
  roles: Role[]
  metadata?: Record<string, any>
}

// Generic components
component List<T>(items: T[], renderItem: (T) => EGH) {
  <[
    ul {
      *~items as item {
        li { renderItem(item) }
      }
    }
  ]>
}

// Type guards
?typeof data {
  'string' -> text { data }
  'number' -> number { data.format('0,0.00') }
  User -> UserCard { data }
  Array -> List { items: data }
}
```

## Compilation Example

EGH source:
```egh
component TodoApp {
  ~todos = []
  ~filter = 'all'
  
  filtered => match filter {
    'all' -> todos
    'active' -> todos.filter(t => !t.done)
    'done' -> todos.filter(t => t.done)
  }
  
  <[
    h1 { "Todos" }
    
    row {
      *~['all', 'active', 'done'] as f {
        button(@click: filter = f, $active: filter === f) { f }
      }
    }
    
    *~filtered as todo {
      @animate(fade-in) {
        TodoItem { todo, onToggle: () => todo.done = !todo.done }
      }
    }
  ]>
}
```

Compiles to optimized JavaScript with:
- Minimal runtime overhead
- Automatic code splitting
- Built-in virtual DOM optimizations
- Reactive dependency tracking
- Zero-cost abstractions

## Benefits Over JSX

1. **50% less code** for common patterns
2. **Built-in reactivity** without hooks
3. **Visual layout** syntax
4. **Performance transparent** with hints
5. **Type-safe** by default
6. **AI-friendly** for generation
7. **Animation native** support
8. **Pattern matching** built-in
9. **Async first-class** support
10. **Compile-time optimizations**
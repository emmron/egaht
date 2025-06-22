# EGH - Eghact Hyperlanguage

## The Future of Web Component Syntax

EGH (Eghact Hyperlanguage) is a revolutionary template syntax that makes building reactive web applications faster, cleaner, and more intuitive than ever before.

## Why EGH?

- **50% Less Code**: Write less, express more
- **Built-in Reactivity**: No hooks, no boilerplate
- **Visual Layouts**: Code structure matches visual output  
- **Performance First**: Optimization hints in the syntax
- **AI-Ready**: Designed for LLM understanding

## Quick Example

```egh
component TodoList {
  ~todos = []
  ~filter = 'all'
  
  filtered => match filter {
    'all' -> todos
    'active' -> todos.filter(t => !t.done)
    'done' -> todos.filter(t => t.done)
  }
  
  <[
    column {
      h1 { "My Todos" }
      
      input <~> newTodo {
        @enter: addTodo(newTodo)
        placeholder: "What needs doing?"
      }
      
      *~filtered as todo {
        TodoItem { todo }
      }
    }
  ]>
}
```

Compare this to React:
```jsx
function TodoList() {
  const [todos, setTodos] = useState([])
  const [filter, setFilter] = useState('all')
  const [newTodo, setNewTodo] = useState('')
  
  const filtered = useMemo(() => {
    switch(filter) {
      case 'all': return todos
      case 'active': return todos.filter(t => !t.done)
      case 'done': return todos.filter(t => t.done)
    }
  }, [todos, filter])
  
  const addTodo = (text) => {
    setTodos([...todos, { id: Date.now(), text, done: false }])
    setNewTodo('')
  }
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <h1>My Todos</h1>
      <input 
        value={newTodo}
        onChange={e => setNewTodo(e.target.value)}
        onKeyPress={e => e.key === 'Enter' && addTodo(newTodo)}
        placeholder="What needs doing?"
      />
      {filtered.map(todo => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </div>
  )
}
```

## Key Features

### 1. Reactive State (`~`)
```egh
~count = 0        // Reactive state
~user = null      // Any value type
~items = []       // Arrays are deeply reactive
```

### 2. Computed Values (`=>`)
```egh
doubled => count * 2
fullName => user.firstName + ' ' + user.lastName
isValid => email.includes('@') && password.length > 8
```

### 3. Effects (`::`)
```egh
count :: {
  console.log('Count changed to:', count)
  localStorage.setItem('count', count)
}
```

### 4. Two-Way Binding (`<~>`)
```egh
input <~> username    // Automatic two-way binding
select <~> selectedOption
textarea <~> content
```

### 5. Visual Layouts
```egh
row { a | b | c }     // Horizontal with flex
column { a b c }      // Vertical stack
grid(3x2) { a b c d e f }  // Grid layout
layer {               // Absolute positioning
  @center { content }
  @top-right { close }
}
```

### 6. Pattern Matching
```egh
match status {
  'loading' -> Spinner {}
  'error' -> Alert { message }
  'success' -> Results { data }
  _ -> Empty {}
}
```

### 7. Reactive Loops (`*~`)
```egh
*~items as item, index {
  li { item.name + " (#" + index + ")" }
}
```

### 8. Conditional Rendering (`?`)
```egh
?isLoggedIn {
  UserProfile { user }
} : {
  LoginForm {}
}
```

### 9. Performance Hints
```egh
#expensive { ComplexComponent {} }     // Memoize
!static { Header {} }                  // Static optimization
@virtual(50) { *~items as item {} }    // Virtualization
@worker { HeavyComputation {} }        // Web Worker
```

### 10. Animations & Transitions
```egh
@animate(fade-in, 300ms) {
  div { "I fade in!" }
}

@transition(view, morph) {
  'list' -> ListView {}
  'grid' -> GridView {}
}
```

## Getting Started

### Installation
```bash
npm install -g @eghact/compiler
```

### Create a new project
```bash
eghc init my-app
cd my-app
npm install
npm run dev
```

### Compile EGH files
```bash
eghc compile src/App.egh
```

### Watch mode
```bash
eghc compile src dist --watch
```

## VS Code Extension

Install the official EGH extension for:
- Syntax highlighting
- IntelliSense
- Error checking
- Auto-formatting
- Snippets

## Learn More

- [Full Syntax Specification](./eghact-syntax-specification.md)
- [Migration Guide from React](./migration-from-react.md)
- [Performance Best Practices](./performance-guide.md)
- [EGH Playground](https://playground.eghact.dev)

## Community

- Discord: [discord.gg/eghact](https://discord.gg/eghact)
- Twitter: [@eghact](https://twitter.com/eghact)
- GitHub: [github.com/eghact/egh](https://github.com/eghact/egh)

## License

MIT - The Eghact Team
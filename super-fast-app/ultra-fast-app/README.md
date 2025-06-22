# Ultra Fast App - Eghact Project

This is an Eghact project using the revolutionary EGH syntax.

## Quick Start (WSL)

The dev server has been configured to work properly with WSL. To start:

```bash
# Option 1: Use the start script
./start-dev.sh

# Option 2: Direct command
node ../../dev-server/server.js
```

Then open in your Windows browser:
- http://localhost:3000

## Features

- **Revolutionary EGH Syntax**: Clean, intuitive component syntax
- **Zero Runtime Overhead**: Compile-time reactivity
- **Hot Module Replacement**: Live updates without refresh
- **Source Maps**: Full debugging support

## Project Structure

```
ultra-fast-app/
├── src/
│   ├── App.egh          # Main app component
│   ├── Counter.egh      # Interactive counter
│   └── TodoList.egh     # Todo list with virtualization
├── index.html           # Entry point
└── start-dev.sh         # Dev server launcher
```

## EGH Syntax Quick Reference

```egh
component MyComponent {
  ~state = 0                    // Reactive state
  computed => state * 2         // Computed values
  
  state :: {                    // Effects
    console.log("Changed!")
  }
  
  <[                           // Template
    button(@click: state++) { 
      "Count: " + state 
    }
  ]>
}

@style {                       // Scoped styles
  button { padding: 1rem; }
}
```

## Troubleshooting

If localhost doesn't work:
1. Make sure the server shows: `LISTEN 0.0.0.0:3000`
2. Try: http://127.0.0.1:3000
3. Check Windows Firewall settings
4. Restart WSL: `wsl --shutdown` then reopen
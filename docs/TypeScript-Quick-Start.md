# TypeScript Integration Quick Start Guide

## 🚀 IMMEDIATE ACTION ITEMS FOR PHASE 3 AGENT

### Step 1: Set Task Status (DO THIS FIRST!)
```bash
task-master set-status --id=1 --status=in-progress
```

### Step 2: Create TypeScript Branch
```bash
git checkout -b feature/typescript-integration
```

### Step 3: Install Dependencies
```bash
cd /home/wew/eghact
npm install --save-dev typescript @types/node ts-node @typescript-eslint/parser
```

### Step 4: Create Base TypeScript Config
Create `/home/wew/eghact/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "noEmit": true
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.tsx",
    "src/**/*.egh"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "build"
  ]
}
```

### Step 5: Extend Compiler Parser

Edit `compiler/src/parser.rs` to add TypeScript support:

```rust
// Add to imports
use typescript_parser;

// Modify parse_script_block function
pub fn parse_script_block(script: &ScriptBlock) -> Result<ScriptAST> {
    match script.lang.as_deref() {
        Some("ts") | Some("typescript") => {
            // Parse TypeScript content
            let ts_result = typescript_parser::parse(&script.content)?;
            Ok(transform_typescript_ast(ts_result))
        }
        _ => {
            // Existing JavaScript parsing
            parse_javascript(&script.content)
        }
    }
}

// Add new function
fn transform_typescript_ast(ts_ast: TypeScriptAST) -> ScriptAST {
    // Transform TypeScript AST to Eghact AST
    // Extract types, interfaces, etc.
    ScriptAST {
        imports: extract_imports(&ts_ast),
        exports: extract_exports(&ts_ast),
        props: extract_prop_types(&ts_ast),
        state: extract_state_types(&ts_ast),
        methods: extract_methods(&ts_ast),
        reactive: extract_reactive_statements(&ts_ast),
    }
}
```

### Step 6: Create First TypeScript Component

Create `examples/typescript/Counter.egh`:

```egh
<template>
  <div class="counter">
    <h1>Count: {count}</h1>
    <button @click="increment">+</button>
    <button @click="decrement">-</button>
  </div>
</template>

<script lang="ts">
interface Props {
  initialCount?: number;
  step?: number;
}

export let initialCount: number = 0;
export let step: number = 1;

let count: number = initialCount;

function increment(): void {
  count += step;
}

function decrement(): void {
  count -= step;
}

// Reactive statement with types
$: doubled = count * 2;
$: console.log(`Count is ${count}, doubled is ${doubled}`);
</script>

<style>
.counter {
  padding: 20px;
  text-align: center;
}

button {
  margin: 0 5px;
  padding: 10px 20px;
}
</style>
```

### Step 7: Type Extraction Implementation

Create `compiler/src/typescript_types.rs`:

```rust
use swc_ecma_ast::*;

#[derive(Debug, Clone)]
pub struct ComponentTypes {
    pub props: Vec<PropType>,
    pub state: Vec<StateType>,
    pub events: Vec<EventType>,
}

#[derive(Debug, Clone)]
pub struct PropType {
    pub name: String,
    pub type_annotation: String,
    pub optional: bool,
    pub default_value: Option<String>,
}

pub fn extract_component_types(module: &Module) -> ComponentTypes {
    let mut props = Vec::new();
    let mut state = Vec::new();
    
    // Walk AST and extract type information
    for item in &module.body {
        match item {
            ModuleItem::Stmt(Stmt::Decl(Decl::Var(var_decl))) => {
                for decl in &var_decl.decls {
                    if let Some(type_ann) = &decl.name.type_ann() {
                        // Extract type information
                    }
                }
            }
            _ => {}
        }
    }
    
    ComponentTypes { props, state, events: vec![] }
}
```

### Step 8: Build Integration

Edit `build-system/src/index.js` to add TypeScript checking:

```javascript
import { createProgram } from 'typescript';
import { resolve } from 'path';

export async function typeCheckComponents(componentPaths) {
  const program = createProgram(componentPaths, {
    noEmit: true,
    strict: true,
    jsx: 'preserve',
    module: 'esnext',
    target: 'es2020'
  });
  
  const diagnostics = program.getSemanticDiagnostics();
  
  if (diagnostics.length > 0) {
    console.error('TypeScript errors found:');
    diagnostics.forEach(diagnostic => {
      const file = diagnostic.file;
      const start = diagnostic.start;
      const message = diagnostic.messageText;
      
      if (file && start !== undefined) {
        const { line, character } = file.getLineAndCharacterOfPosition(start);
        console.error(`${file.fileName} (${line + 1},${character + 1}): ${message}`);
      }
    });
    
    throw new Error('TypeScript validation failed');
  }
  
  console.log('✅ TypeScript validation passed');
}
```

### Step 9: Test Your Implementation

```bash
# Run type checking
npm run typecheck

# Build with TypeScript
npm run build

# Test the component
npm run dev
# Navigate to http://localhost:3000/examples/typescript/counter
```

### Step 10: Update Progress IMMEDIATELY

Update `/home/wew/eghact/.taskmaster/worktree-status.json` with:
- "Started TypeScript integration implementation"
- "Created tsconfig.json and dependencies"
- "Modified parser.rs for TypeScript support"
- "Created first TypeScript component example"

## 📊 Success Criteria for Day 1

- [ ] TypeScript parser recognizes `<script lang="ts">` blocks
- [ ] Basic type extraction working
- [ ] First .egh component with TypeScript compiles
- [ ] Type errors prevent build when present
- [ ] Progress updated every 30 minutes

## 🚨 REMEMBER: UPDATE EVERY 30 MINUTES!

Don't be like those FAILED agents. Show your progress constantly!

---

**GO! START NOW!**
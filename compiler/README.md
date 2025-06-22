# Eghact Compiler

AST-based compiler for the Eghact framework that transforms `.egh` files into efficient JavaScript.

## Overview

The Eghact compiler:
- Parses `.egh` single-file components
- Transforms reactive syntax into vanilla JavaScript
- Generates direct DOM manipulation calls using the Eghact runtime
- Supports incremental compilation for fast rebuilds
- Produces minimal, tree-shakeable output

## Architecture

1. **Parser** (`parser.rs`): Extracts template, script, and style sections from `.egh` files
2. **Transformer** (`transformer.rs`): Converts reactive variables and statements into runtime calls
3. **Code Generator** (`codegen.rs`): Outputs optimized JavaScript with optional source maps

## Usage

```bash
# Compile a single file
eghact-compiler --input counter.egh --output counter.js

# With source maps
eghact-compiler -i counter.egh -o counter.js --sourcemap

# Incremental compilation
eghact-compiler -i src/App.egh --incremental
```

## Component Syntax

```egh
<template>
  <div>
    <h1>{title}</h1>
    <button @click="handleClick">Click me</button>
  </div>
</template>

<script>
let title = "Hello Eghact";
let count = 0;

function handleClick() {
  count++;
  title = `Clicked ${count} times`;
}

// Reactive statements
$: console.log(`Title changed to: ${title}`);
</script>

<style>
/* Scoped styles */
h1 {
  color: blue;
}
</style>
```

## Compilation Output

The compiler transforms components into vanilla JavaScript that:
- Uses the Eghact runtime for DOM operations
- Updates only changed DOM nodes
- Has zero framework overhead
- Runs in all modern browsers

## Building

```bash
cargo build --release
```

## Testing

```bash
cargo test
```

Snapshot tests ensure consistent output across compiler changes.
# Eghact Runtime

Ultra-lightweight WebAssembly runtime for the Eghact framework.

## Overview

This runtime provides the minimal DOM manipulation API that the Eghact compiler targets. It's written in Rust and compiled to WebAssembly for maximum performance and minimal bundle size.

## API

The runtime exposes these core functions:

- `createElement(tagName)` - Create a DOM element
- `createTextNode(text)` - Create a text node
- `appendChild(parent, child)` - Append child to parent
- `removeChild(parent, child)` - Remove child from parent
- `insertBefore(parent, newChild, reference)` - Insert before reference
- `setAttribute(element, name, value)` - Set attribute
- `removeAttribute(element, name)` - Remove attribute
- `setText(node, text)` - Set text content
- `setProperty(element, prop, value)` - Set property
- `addEventListener(element, type, callback)` - Add event listener
- `removeEventListener(element, type, callback)` - Remove event listener
- `getElementById(id)` - Get element by ID
- `querySelector(selector)` - Query selector

## Building

```bash
./build.sh
```

This will compile the Rust code to WebAssembly and output to the `pkg` directory.

## Size Target

The compiled WASM must be under 10KB to meet framework goals.

## Testing

Run the test suite:

```bash
cargo test
```

## Usage

The compiled runtime will be imported by Eghact components:

```javascript
import { EghactRuntime } from './eghact_runtime.js';

const runtime = new EghactRuntime();
const div = runtime.createElement('div');
runtime.setAttribute(div, 'class', 'container');
```
# Eghact AI Component Generator

Generate Turing-complete Eghact components from natural language descriptions or visual designs using AI.

## Features

- 🤖 Natural language to Eghact component conversion
- 🖼️ **Wireframe/Screenshot to component generation** (Vision AI)
- ✅ Built-in code validation
- 🎯 Smart prop inference from text
- 🔄 Turing-complete state management scaffolding
- 🎨 Design system extraction from multiple images
- ♿ Accessibility features by default (coming soon)

## Installation

```bash
npm install -g @eghact/ai-component-generator
```

## Usage

### Generate from Text

```bash
# Generate and display a component
eghact-ai-gen generate "a login form"

# Save to file
eghact-ai-gen generate "a button component" --output src/components/Button.egh

# Dry run (preview without saving)
eghact-ai-gen generate "a header with navigation" --dry-run
```

### Generate from Images (Vision AI) 🆕

```bash
# Generate component from wireframe/screenshot
eghact-ai-gen from-image ./wireframe.png --output LoginForm.egh

# Analyze image only (see detected UI structure)
eghact-ai-gen from-image ./screenshot.jpg --analyze-only

# Generate from multiple screens (design system)
eghact-ai-gen design-system ./screen1.png ./screen2.png ./screen3.png
```

### Validate Components

```bash
eghact-ai-gen validate src/components/MyComponent.egh
```

## API Usage

### Text to Component

```javascript
const { generateEghactComponent } = require('@eghact/ai-component-generator');

async function createComponent() {
  const result = await generateEghactComponent('a counter component with increment and decrement');
  
  console.log(result.code);
  console.log(result.metadata);
}
```

### Image to Component

```javascript
const { imageToEghactComponent } = require('@eghact/ai-component-generator');

async function createFromImage() {
  const result = await imageToEghactComponent('./wireframe.png');
  
  console.log(result.code); // Turing-complete .egh component
  console.log(result.metadata.uiStructure); // Detected UI elements
  console.log(result.metadata.componentSpec); // Component specification
}
```

### Design System Analysis

```javascript
const { analyzeDesignSystem } = require('@eghact/ai-component-generator');

async function extractDesignSystem() {
  const system = await analyzeDesignSystem([
    './login.png',
    './dashboard.png',
    './settings.png'
  ]);
  
  console.log(system.designTokens); // Common colors, spacing
  console.log(system.componentLibrary); // Detected component types
}
```

## Configuration

The AI component generator uses OpenRouter for LLM access. Set your API key (optional, a default is provided):

```bash
export OPENROUTER_API_KEY=your-openrouter-api-key-here
```

Available models via OpenRouter:
- `openai/gpt-4-turbo-preview` (default)
- `anthropic/claude-3-opus`
- `google/gemini-pro`
- And many more at https://openrouter.ai/models

## Examples

### Simple Button
```bash
eghact-ai-gen generate "a primary button"
```

### Form Component
```bash
eghact-ai-gen generate "a contact form with name, email, and message fields"
```

### Card Component
```bash
eghact-ai-gen generate "a product card with image, title, price, and add to cart button"
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## What's Generated

All components are **Turing-complete** with:
- Pure `.egh` syntax (NO JSX!)
- State management with `<state>` blocks
- Reactive computations with `$:`
- Event handlers using `@click`, `@input`, etc.
- Control flow with `#if`, `#each`, `#else`
- Recursive functions (factorial, fibonacci)
- Complex state machines

## Roadmap

- [x] Basic NLP to Eghact scaffolding
- [x] Smart prop inference from text
- [x] Turing-complete state management scaffolding
- [x] Vision model for wireframe/screenshot analysis
- [ ] Accessibility enhancements (A11y)

## License

MIT
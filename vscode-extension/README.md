# Eghact VS Code Extension

Official Visual Studio Code extension for the Eghact framework, providing comprehensive language support with syntax highlighting, IntelliSense, and advanced developer tools.

## Features

### 🎨 Syntax Highlighting
- **Complete .egh file support** with TextMate grammar
- **Template syntax highlighting** for HTML elements and Eghact directives
- **Script section support** with TypeScript/JavaScript highlighting
- **Style section support** with CSS highlighting
- **Control flow syntax** (`{#if}`, `{#each}`, `{#await}`)
- **Event bindings** (`@click`, `@input`) with special highlighting
- **Reactive statements** (`$:`) with distinct styling
- **Component props** (`export let`) with type annotations

### 🧠 IntelliSense & Auto-completion
- **Smart completions** based on context (template vs script sections)
- **Control flow snippets** for `{#if}`, `{#each}`, `{#await}` blocks
- **Event handler suggestions** for common DOM events
- **Bind directive completions** for two-way data binding
- **Lifecycle function completions** (`onMount`, `onDestroy`, etc.)
- **Component prop completions** with TypeScript integration
- **Reactive statement suggestions** for derived values

### 🔍 Navigation & Go-to Features
- **Go to Definition** - Jump to prop declarations, function definitions, imports
- **Find All References** - Locate all usages of variables, props, and functions
- **Symbol navigation** within .egh files
- **Cross-file navigation** for component imports

### 🛠️ Language Server Features
- **Real-time diagnostics** with syntax validation
- **TypeScript integration** for type checking in script blocks
- **Error detection** for unclosed braces, invalid syntax
- **Template validation** for Eghact-specific constructs
- **CSS validation** in style sections

### 📝 Code Snippets
- **Component templates** for quick scaffolding
- **TypeScript components** with prop definitions
- **Control flow blocks** with proper syntax
- **Event handlers** and lifecycle hooks
- **Store definitions** and reactive patterns

## Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Eghact"
4. Click Install

### Manual Installation
1. Download the `.vsix` file from releases
2. Open VS Code
3. Run `Extensions: Install from VSIX...` command
4. Select the downloaded file

## Getting Started

1. **Create a new .egh file** or open an existing Eghact project
2. **Start typing** - IntelliSense will provide contextual suggestions
3. **Use Ctrl+Space** to trigger completions manually
4. **Right-click** for context menu with Go to Definition and Find References

### Basic Component Example

```html
<template>
  <div class="counter">
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
  
  // Reactive statement
  $: doubled = count * 2;
  
  function increment() {
    count++;
  }
  
  function decrement() {
    count--;
  }
</script>

<style>
  .counter {
    padding: 1rem;
    text-align: center;
  }
  
  button {
    margin: 0 0.5rem;
    padding: 0.5rem 1rem;
  }
</style>
```

## Extension Settings

Configure the extension through VS Code settings:

```json
{
  "eghact.languageServer.enabled": true,
  "eghact.typescript.enabled": true,
  "eghact.format.enable": true,
  "eghact.trace.server": "off"
}
```

### Available Settings

- `eghact.languageServer.enabled` - Enable/disable language server
- `eghact.languageServer.maxNumberOfProblems` - Max diagnostic issues to show
- `eghact.trace.server` - Language server communication tracing
- `eghact.typescript.enabled` - TypeScript support for .egh files
- `eghact.format.enable` - Enable auto-formatting
- `eghact.format.config` - Formatter configuration options

## Commands

The extension provides several commands accessible via the Command Palette (Ctrl+Shift+P):

- `Eghact: Restart Language Server` - Restart the language server
- `Eghact: Show Output` - Show language server output logs
- `Eghact: Create New Component` - Generate a new component template

## Language Server Features

### Diagnostics
- **Syntax validation** for template, script, and style sections
- **TypeScript type checking** when enabled
- **Control flow validation** for proper directive syntax
- **CSS validation** for style sections

### Code Completion
- **Context-aware suggestions** based on cursor position
- **Template completions** for control flow and bindings
- **Script completions** for props, reactive statements, lifecycle
- **Trigger characters**: `{`, `@`, `$`, `:`, `.`, ` `

### Hover Information
- **Component props** with type and default value info
- **Reactive variables** with derived value explanations
- **Lifecycle functions** with usage documentation
- **Imported symbols** with source information

## File Association

The extension automatically activates for files with the `.egh` extension. You can also manually set the language mode:

1. Open a file
2. Click the language indicator in the status bar
3. Select "Eghact" from the language list

## Development

### Building from Source

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Package extension
npm run package
```

### Testing

The extension includes comprehensive tests for language server features:

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## Troubleshooting

### Language Server Not Starting
1. Check VS Code output panel for errors
2. Restart the language server: `Eghact: Restart Language Server`
3. Verify .egh files are properly associated
4. Check extension is enabled and up to date

### IntelliSense Not Working
1. Ensure `eghact.languageServer.enabled` is true
2. Check TypeScript is properly configured if using TS features
3. Verify the file is recognized as Eghact language
4. Try restarting VS Code

### Syntax Highlighting Issues
1. Verify file has `.egh` extension
2. Check VS Code theme supports the color scopes
3. Try switching themes to test highlighting
4. Report issues with specific code examples

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Reporting Issues
- Use the [GitHub Issues](https://github.com/eghact/vscode-extension/issues) page
- Include VS Code version, extension version, and sample code
- Describe expected vs actual behavior
- Include relevant error messages or logs

### Feature Requests
- Check existing issues for similar requests
- Describe the use case and expected behavior
- Consider submitting a pull request

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release notes and version history.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Related Projects

- [Eghact Framework](https://github.com/eghact/eghact) - The main framework
- [Eghact CLI](https://github.com/eghact/cli) - Command-line tools
- [Eghact DevTools](https://github.com/eghact/devtools) - Browser extension

## Support

- 📖 [Documentation](https://eghact.dev/docs)
- 💬 [Discord Community](https://discord.gg/eghact)
- 🐛 [Issue Tracker](https://github.com/eghact/vscode-extension/issues)
- 📧 [Email Support](mailto:support@eghact.dev)
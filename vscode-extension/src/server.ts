import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  HoverParams,
  Hover,
  DefinitionParams,
  Definition,
  Location,
  Range,
  Position,
  ReferenceParams
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

// Create a connection for the server
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );
  hasDiagnosticRelatedInformationCapability = !!(
    capabilities.textDocument &&
    capabilities.textDocument.publishDiagnostics &&
    capabilities.textDocument.publishDiagnostics.relatedInformation
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['{', '@', '$', ':', '.', ' ']
      },
      // Support hover information
      hoverProvider: true,
      // Support go-to definition
      definitionProvider: true,
      // Support find references
      referencesProvider: true,
      // Support document formatting
      documentFormattingProvider: true,
      // Support diagnostics
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false
      }
    }
  };
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true
      }
    };
  }
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(_event => {
      connection.console.log('Workspace folder change event received.');
    });
  }
});

// Interface definitions for Eghact components
interface EghactComponentInfo {
  props: PropInfo[];
  events: EventInfo[];
  state: StateInfo[];
  imports: ImportInfo[];
}

interface PropInfo {
  name: string;
  type?: string;
  required: boolean;
  defaultValue?: string;
}

interface EventInfo {
  name: string;
  type?: string;
  detail?: string;
}

interface StateInfo {
  name: string;
  type?: string;
  reactive: boolean;
}

interface ImportInfo {
  name: string;
  from: string;
  type: 'default' | 'named' | 'namespace';
}

// Settings interface
interface EghactSettings {
  maxNumberOfProblems: number;
  languageServer: {
    enabled: boolean;
    trace: string;
  };
  typescript: {
    enabled: boolean;
  };
  format: {
    enable: boolean;
    config: any;
  };
}

// Default settings
const defaultSettings: EghactSettings = {
  maxNumberOfProblems: 1000,
  languageServer: {
    enabled: true,
    trace: 'off'
  },
  typescript: {
    enabled: true
  },
  format: {
    enable: true,
    config: {}
  }
};

let globalSettings: EghactSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<EghactSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings
    documentSettings.clear();
  } else {
    globalSettings = <EghactSettings>(
      (change.settings.eghact || defaultSettings)
    );
  }

  // Revalidate all open text documents
  documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<EghactSettings> {
  if (!hasConfigurationCapability) {
    return Promise.resolve(globalSettings);
  }
  let result = documentSettings.get(resource);
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: 'eghact'
    });
    documentSettings.set(resource, result);
  }
  return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
  documentSettings.delete(e.document.uri);
});

// The content of a text document has changed
documents.onDidChangeContent(change => {
  validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const settings = await getDocumentSettings(textDocument.uri);
  
  if (!settings.languageServer.enabled) {
    return;
  }

  const text = textDocument.getText();
  const diagnostics: Diagnostic[] = [];

  // Parse .egh file sections
  const sections = parseEghFile(text);
  
  // Validate template section
  if (sections.template) {
    const templateDiagnostics = validateTemplateSection(
      sections.template.content,
      sections.template.start,
      textDocument
    );
    diagnostics.push(...templateDiagnostics);
  }

  // Validate script section
  if (sections.script) {
    const scriptDiagnostics = validateScriptSection(
      sections.script.content,
      sections.script.start,
      textDocument,
      settings.typescript.enabled
    );
    diagnostics.push(...scriptDiagnostics);
  }

  // Validate style section
  if (sections.style) {
    const styleDiagnostics = validateStyleSection(
      sections.style.content,
      sections.style.start,
      textDocument
    );
    diagnostics.push(...styleDiagnostics);
  }

  // Send the computed diagnostics to VS Code
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

interface EghSections {
  template?: { content: string; start: number; end: number };
  script?: { content: string; start: number; end: number };
  style?: { content: string; start: number; end: number };
}

function parseEghFile(text: string): EghSections {
  const sections: EghSections = {};
  
  // Parse template section
  const templateMatch = text.match(/<template>([\s\S]*?)<\/template>/);
  if (templateMatch) {
    const start = text.indexOf(templateMatch[0]);
    const tagStart = text.indexOf('>', start) + 1;
    const tagEnd = text.indexOf('</template>', start);
    sections.template = {
      content: templateMatch[1],
      start: tagStart,
      end: tagEnd
    };
  }

  // Parse script section
  const scriptMatch = text.match(/<script(?:\s+[^>]*)?>(.[\s\S]*?)<\/script>/);
  if (scriptMatch) {
    const start = text.indexOf(scriptMatch[0]);
    const tagStart = text.indexOf('>', start) + 1;
    const tagEnd = text.indexOf('</script>', start);
    sections.script = {
      content: scriptMatch[1],
      start: tagStart,
      end: tagEnd
    };
  }

  // Parse style section
  const styleMatch = text.match(/<style(?:\s+[^>]*)?>(.[\s\S]*?)<\/style>/);
  if (styleMatch) {
    const start = text.indexOf(styleMatch[0]);
    const tagStart = text.indexOf('>', start) + 1;
    const tagEnd = text.indexOf('</style>', start);
    sections.style = {
      content: styleMatch[1],
      start: tagStart,
      end: tagEnd
    };
  }

  return sections;
}

function validateTemplateSection(
  content: string, 
  offset: number, 
  document: TextDocument
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  
  // Check for unclosed interpolation braces
  const interpolationRegex = /\{[^}]*$/gm;
  let match;
  while ((match = interpolationRegex.exec(content)) !== null) {
    const position = document.positionAt(offset + match.index);
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: {
        start: position,
        end: { line: position.line, character: position.character + match[0].length }
      },
      message: 'Unclosed interpolation expression',
      source: 'eghact'
    });
  }

  // Check for invalid control flow syntax
  const invalidControlFlow = /\{#(if|each|await)\s*\}/g;
  while ((match = invalidControlFlow.exec(content)) !== null) {
    const position = document.positionAt(offset + match.index);
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: {
        start: position,
        end: { line: position.line, character: position.character + match[0].length }
      },
      message: `${match[1]} directive requires an expression`,
      source: 'eghact'
    });
  }

  return diagnostics;
}

function validateScriptSection(
  content: string,
  offset: number,
  document: TextDocument,
  typescriptEnabled: boolean
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Check for invalid export let syntax
  const exportLetRegex = /export\s+let\s+(\w+)\s*(?::\s*([^=\n]+?))?\s*(?:=\s*(.+?))?(?:;|\n|$)/g;
  let match;
  while ((match = exportLetRegex.exec(content)) !== null) {
    const varName = match[1];
    const type = match[2];
    const defaultValue = match[3];

    // Check if TypeScript type is provided when enabled
    if (typescriptEnabled && !type && !defaultValue) {
      const position = document.positionAt(offset + match.index);
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: {
          start: position,
          end: { line: position.line, character: position.character + match[0].length }
        },
        message: `Property '${varName}' should have a type annotation or default value`,
        source: 'eghact'
      });
    }
  }

  // Check for invalid reactive statements
  const reactiveRegex = /\$:\s*([^;]+)/g;
  while ((match = reactiveRegex.exec(content)) !== null) {
    const statement = match[1].trim();
    if (!statement) {
      const position = document.positionAt(offset + match.index);
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: position,
          end: { line: position.line, character: position.character + match[0].length }
        },
        message: 'Reactive statement cannot be empty',
        source: 'eghact'
      });
    }
  }

  return diagnostics;
}

function validateStyleSection(
  content: string,
  offset: number,
  document: TextDocument
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Basic CSS validation - check for unclosed braces
  const openBraces = (content.match(/\{/g) || []).length;
  const closeBraces = (content.match(/\}/g) || []).length;
  
  if (openBraces !== closeBraces) {
    const position = document.positionAt(offset);
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: {
        start: position,
        end: { line: position.line + content.split('\n').length - 1, character: 0 }
      },
      message: 'Mismatched CSS braces',
      source: 'eghact'
    });
  }

  return diagnostics;
}

// Auto-completion provider
connection.onCompletion(
  (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    const document = documents.get(_textDocumentPosition.textDocument.uri);
    if (!document) {
      return [];
    }

    const text = document.getText();
    const position = _textDocumentPosition.position;
    const offset = document.offsetAt(position);
    const lineText = text.split('\n')[position.line];
    
    // Get context around cursor
    const beforeCursor = lineText.substring(0, position.character);
    const afterCursor = lineText.substring(position.character);

    // Template completions
    if (isInTemplateSection(text, offset)) {
      return getTemplateCompletions(beforeCursor, afterCursor);
    }

    // Script completions
    if (isInScriptSection(text, offset)) {
      return getScriptCompletions(beforeCursor, afterCursor);
    }

    return [];
  }
);

function isInTemplateSection(text: string, offset: number): boolean {
  const beforeOffset = text.substring(0, offset);
  const templateStart = beforeOffset.lastIndexOf('<template>');
  const templateEnd = beforeOffset.lastIndexOf('</template>');
  return templateStart > templateEnd && templateStart !== -1;
}

function isInScriptSection(text: string, offset: number): boolean {
  const beforeOffset = text.substring(0, offset);
  const scriptStart = beforeOffset.lastIndexOf('<script');
  const scriptEnd = beforeOffset.lastIndexOf('</script>');
  return scriptStart > scriptEnd && scriptStart !== -1;
}

function getTemplateCompletions(beforeCursor: string, afterCursor: string): CompletionItem[] {
  const completions: CompletionItem[] = [];

  // Control flow completions
  if (beforeCursor.endsWith('{#')) {
    completions.push(
      {
        label: 'if',
        kind: CompletionItemKind.Keyword,
        detail: 'Conditional rendering',
        insertText: 'if ${1:condition}}\n\t$0\n{/if}',
        documentation: 'Render content conditionally'
      },
      {
        label: 'each',
        kind: CompletionItemKind.Keyword,
        detail: 'List rendering',
        insertText: 'each ${1:items} as ${2:item}}\n\t$0\n{/each}',
        documentation: 'Iterate over a list'
      },
      {
        label: 'await',
        kind: CompletionItemKind.Keyword,
        detail: 'Async content',
        insertText: 'await ${1:promise}}\n\t$0\n{/await}',
        documentation: 'Handle async operations'
      }
    );
  }

  // Event binding completions
  if (beforeCursor.match(/@\w*$/)) {
    const events = ['click', 'change', 'input', 'submit', 'keydown', 'keyup', 'focus', 'blur'];
    events.forEach(event => {
      completions.push({
        label: event,
        kind: CompletionItemKind.Event,
        detail: `@${event} event`,
        insertText: `${event}={${event}Handler}`,
        documentation: `Handle ${event} events`
      });
    });
  }

  // Bind directive completions
  if (beforeCursor.match(/bind:\w*$/)) {
    const bindables = ['value', 'checked', 'group', 'innerHTML', 'textContent'];
    bindables.forEach(bindable => {
      completions.push({
        label: bindable,
        kind: CompletionItemKind.Property,
        detail: `bind:${bindable}`,
        insertText: `${bindable}={${bindable}}`,
        documentation: `Two-way binding for ${bindable}`
      });
    });
  }

  return completions;
}

function getScriptCompletions(beforeCursor: string, afterCursor: string): CompletionItem[] {
  const completions: CompletionItem[] = [];

  // Export let completions
  if (beforeCursor.match(/export\s+let\s+\w*$/)) {
    completions.push({
      label: 'prop',
      kind: CompletionItemKind.Property,
      detail: 'Component property',
      insertText: '${1:name}: ${2:string} = ${3:defaultValue};',
      documentation: 'Define a component prop with type and default value'
    });
  }

  // Reactive statement completions
  if (beforeCursor.match(/\$:\s*$/)) {
    completions.push({
      label: 'reactive statement',
      kind: CompletionItemKind.Variable,
      detail: 'Reactive computation',
      insertText: '${1:derivedValue} = ${2:computation};',
      documentation: 'Create a reactive derived value'
    });
  }

  // Lifecycle function completions
  if (beforeCursor.match(/\b(on|after|before)\w*$/)) {
    const lifecycles = ['onMount', 'onDestroy', 'beforeUpdate', 'afterUpdate'];
    lifecycles.forEach(lifecycle => {
      completions.push({
        label: lifecycle,
        kind: CompletionItemKind.Function,
        detail: 'Lifecycle function',
        insertText: `${lifecycle}(() => {\n\t$0\n});`,
        documentation: `${lifecycle} lifecycle hook`
      });
    });
  }

  return completions;
}

// Definition provider
connection.onDefinition((params: DefinitionParams): Definition | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  const position = params.position;
  const text = document.getText();
  const offset = document.offsetAt(position);
  const word = getWordAtPosition(text, offset);

  if (!word) {
    return null;
  }

  // Find definition location
  const definition = findDefinition(word, text, document);
  return definition;
});

// Find references provider
connection.onReferences((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  const position = params.position;
  const text = document.getText();
  const offset = document.offsetAt(position);
  const word = getWordAtPosition(text, offset);

  if (!word) {
    return [];
  }

  // Find all references
  const references = findReferences(word, text, document);
  return references;
});

function findDefinition(word: string, text: string, document: TextDocument): Location | null {
  // Check if word is a prop definition
  const propRegex = new RegExp(`export\\s+let\\s+(${word})(?:\\s*:\\s*([^=\\n]+?))?(?:\\s*=\\s*(.+?))?(?:;|\\n|$)`);
  const propMatch = text.match(propRegex);
  if (propMatch) {
    const index = text.indexOf(propMatch[0]);
    const propNameIndex = text.indexOf(word, index);
    const position = document.positionAt(propNameIndex);
    return {
      uri: document.uri,
      range: {
        start: position,
        end: { line: position.line, character: position.character + word.length }
      }
    };
  }

  // Check if word is a reactive statement definition
  const reactiveRegex = new RegExp(`\\$:\\s*(${word})\\s*=`);
  const reactiveMatch = text.match(reactiveRegex);
  if (reactiveMatch) {
    const index = text.indexOf(reactiveMatch[0]);
    const varNameIndex = text.indexOf(word, index);
    const position = document.positionAt(varNameIndex);
    return {
      uri: document.uri,
      range: {
        start: position,
        end: { line: position.line, character: position.character + word.length }
      }
    };
  }

  // Check if word is a function definition
  const functionRegex = new RegExp(`function\\s+(${word})\\s*\\(|const\\s+(${word})\\s*=|let\\s+(${word})\\s*=|var\\s+(${word})\\s*=`);
  const functionMatch = text.match(functionRegex);
  if (functionMatch) {
    const index = text.indexOf(functionMatch[0]);
    const funcNameIndex = text.indexOf(word, index);
    const position = document.positionAt(funcNameIndex);
    return {
      uri: document.uri,
      range: {
        start: position,
        end: { line: position.line, character: position.character + word.length }
      }
    };
  }

  // Check if word is an import
  const importRegex = new RegExp(`import\\s+.*?\\b(${word})\\b.*?from`);
  const importMatch = text.match(importRegex);
  if (importMatch) {
    const index = text.indexOf(importMatch[0]);
    const importNameIndex = text.indexOf(word, index);
    const position = document.positionAt(importNameIndex);
    return {
      uri: document.uri,
      range: {
        start: position,
        end: { line: position.line, character: position.character + word.length }
      }
    };
  }

  return null;
}

function findReferences(word: string, text: string, document: TextDocument): Location[] {
  const references: Location[] = [];
  const wordRegex = new RegExp(`\\b${word}\\b`, 'g');
  
  let match;
  while ((match = wordRegex.exec(text)) !== null) {
    const position = document.positionAt(match.index);
    references.push({
      uri: document.uri,
      range: {
        start: position,
        end: { line: position.line, character: position.character + word.length }
      }
    });
  }

  return references;
}

// Hover provider
connection.onHover((params: HoverParams): Hover | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  const position = params.position;
  const text = document.getText();
  const offset = document.offsetAt(position);
  const word = getWordAtPosition(text, offset);

  if (!word) {
    return null;
  }

  // Provide hover information for Eghact-specific syntax
  const hoverInfo = getHoverInfo(word, text, offset);
  if (hoverInfo) {
    return {
      contents: {
        kind: 'markdown',
        value: hoverInfo
      }
    };
  }

  return null;
});

function getWordAtPosition(text: string, offset: number): string | null {
  const regex = /\b\w+\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index <= offset && offset <= match.index + match[0].length) {
      return match[0];
    }
  }
  return null;
}

function getHoverInfo(word: string, text: string, offset: number): string | null {
  // Check if word is a prop
  const propRegex = new RegExp(`export\\s+let\\s+${word}(?:\\s*:\\s*([^=\\n]+?))?(?:\\s*=\\s*(.+?))?(?:;|\\n|$)`);
  const propMatch = text.match(propRegex);
  if (propMatch) {
    const type = propMatch[1] || 'any';
    const defaultValue = propMatch[2] || 'undefined';
    return `**${word}** (prop)\n\nType: \`${type}\`\nDefault: \`${defaultValue}\``;
  }

  // Check if word is a reactive statement
  const reactiveRegex = new RegExp(`\\$:\\s*${word}\\s*=`);
  if (reactiveRegex.test(text)) {
    return `**${word}** (reactive)\n\nA reactive derived value that updates automatically when its dependencies change.`;
  }

  // Check for lifecycle functions
  const lifecycleFunctions = {
    'onMount': 'Called after the component is first rendered to the DOM',
    'onDestroy': 'Called when the component is destroyed',
    'beforeUpdate': 'Called before the component updates',
    'afterUpdate': 'Called after the component updates'
  };

  if (lifecycleFunctions[word]) {
    return `**${word}**\n\n${lifecycleFunctions[word]}`;
  }

  return null;
}

// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();
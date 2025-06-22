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
  Location,
  Position,
  Range,
  CodeActionParams,
  CodeAction,
  CodeActionKind,
  DocumentFormattingParams,
  TextEdit
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { EghactAnalyzer } from './analyzer';
import { EghactCompletionProvider } from './completion';
import { EghactDiagnostics } from './diagnostics';
import { EghactFormatter } from './formatter';
import { EghactHoverProvider } from './hover';
import { EghactDefinitionProvider } from './definition';

// Create a connection for the server, using Node's IPC as a transport.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Server capabilities and settings
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

// The global settings, used when the `workspace/configuration` request is not supported by the client.
const defaultSettings: EghactSettings = { 
  maxNumberOfProblems: 1000,
  typescript: { enabled: true },
  format: { enable: true },
  trace: { server: 'off' }
};
let globalSettings: EghactSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<EghactSettings>> = new Map();

// Initialize components
const analyzer = new EghactAnalyzer();
const completionProvider = new EghactCompletionProvider(analyzer);
const diagnosticsProvider = new EghactDiagnostics(analyzer);
const formatter = new EghactFormatter();
const hoverProvider = new EghactHoverProvider(analyzer);
const definitionProvider = new EghactDefinitionProvider(analyzer);

interface EghactSettings {
  maxNumberOfProblems: number;
  typescript: {
    enabled: boolean;
  };
  format: {
    enable: boolean;
  };
  trace: {
    server: string;
  };
}

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
      // Tell the client that this server supports code completion.
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['{', '@', ':', '.', ' ', '<']
      },
      // Support hover information
      hoverProvider: true,
      // Support go-to-definition
      definitionProvider: true,
      // Support document formatting
      documentFormattingProvider: true,
      // Support code actions
      codeActionProvider: {
        codeActionKinds: [
          CodeActionKind.QuickFix,
          CodeActionKind.Refactor,
          CodeActionKind.Source
        ]
      },
      // Support workspace symbols
      workspaceSymbolProvider: true,
      // Support document symbols
      documentSymbolProvider: true,
      // Support references
      referencesProvider: true,
      // Support rename
      renameProvider: {
        prepareProvider: true
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
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(_event => {
      connection.console.log('Workspace folder change event received.');
    });
  }
});

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

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
  validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const settings = await getDocumentSettings(textDocument.uri);
  
  // Analyze the document
  const analysisResult = await analyzer.analyzeDocument(textDocument);
  
  // Generate diagnostics
  const diagnostics = await diagnosticsProvider.getDiagnostics(
    textDocument,
    analysisResult,
    settings
  );

  // Send the computed diagnostics to VS Code.
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// Completion provider
connection.onCompletion(
  async (params: TextDocumentPositionParams): Promise<CompletionItem[]> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    return await completionProvider.provideCompletions(document, params.position);
  }
);

// Completion item resolve
connection.onCompletionResolve(
  (item: CompletionItem): CompletionItem => {
    return completionProvider.resolveCompletionItem(item);
  }
);

// Hover provider
connection.onHover(
  async (params: HoverParams): Promise<Hover | null> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }

    return await hoverProvider.provideHover(document, params.position);
  }
);

// Definition provider
connection.onDefinition(
  async (params: DefinitionParams): Promise<Location[]> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    return await definitionProvider.provideDefinition(document, params.position);
  }
);

// Document formatting
connection.onDocumentFormatting(
  async (params: DocumentFormattingParams): Promise<TextEdit[]> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    const settings = await getDocumentSettings(params.textDocument.uri);
    if (!settings.format.enable) {
      return [];
    }

    return await formatter.formatDocument(document, params.options);
  }
);

// Code actions
connection.onCodeAction(
  async (params: CodeActionParams): Promise<CodeAction[]> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    return await diagnosticsProvider.getCodeActions(document, params);
  }
);

// Document symbols
connection.onDocumentSymbol(
  async (params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    const analysisResult = await analyzer.analyzeDocument(document);
    return analyzer.getDocumentSymbols(analysisResult);
  }
);

// References
connection.onReferences(
  async (params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    return await definitionProvider.findReferences(document, params.position, params.context);
  }
);

// Rename
connection.onPrepareRename(
  async (params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }

    return await definitionProvider.prepareRename(document, params.position);
  }
);

connection.onRenameRequest(
  async (params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }

    return await definitionProvider.provideRename(document, params.position, params.newName);
  }
);

// Workspace symbols
connection.onWorkspaceSymbol(
  async (params) => {
    return await analyzer.findWorkspaceSymbols(params.query);
  }
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
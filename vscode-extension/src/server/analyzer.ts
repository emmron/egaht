import { TextDocument } from 'vscode-languageserver-textdocument';
import { Range, Position, DocumentSymbol, SymbolKind, WorkspaceSymbol } from 'vscode-languageserver/node';

export interface EghactComponent {
  template: ComponentSection;
  script: ComponentSection;
  style: ComponentSection;
  props: PropDefinition[];
  events: EventDefinition[];
  stores: StoreReference[];
  exports: ExportDefinition[];
  imports: ImportDefinition[];
}

export interface ComponentSection {
  content: string;
  range: Range;
  lang?: string;
}

export interface PropDefinition {
  name: string;
  type?: string;
  defaultValue?: string;
  range: Range;
  exported: boolean;
}

export interface EventDefinition {
  name: string;
  type?: string;
  range: Range;
}

export interface StoreReference {
  name: string;
  type: 'read' | 'write' | 'subscribe';
  range: Range;
}

export interface ExportDefinition {
  name: string;
  type?: string;
  kind: 'variable' | 'function' | 'class' | 'interface';
  range: Range;
}

export interface ImportDefinition {
  name: string;
  source: string;
  isDefault: boolean;
  range: Range;
}

export interface AnalysisResult {
  component: EghactComponent;
  errors: AnalysisError[];
  warnings: AnalysisWarning[];
}

export interface AnalysisError {
  message: string;
  range: Range;
  code?: string;
}

export interface AnalysisWarning {
  message: string;
  range: Range;
  code?: string;
}

export class EghactAnalyzer {
  private documentCache = new Map<string, AnalysisResult>();

  async analyzeDocument(document: TextDocument): Promise<AnalysisResult> {
    const uri = document.uri;
    const version = document.version;
    
    // Check cache
    const cached = this.documentCache.get(uri);
    if (cached && cached.component.template.content === document.getText()) {
      return cached;
    }

    const content = document.getText();
    const result = this.parseEghactComponent(content, document);
    
    // Cache result
    this.documentCache.set(uri, result);
    
    return result;
  }

  private parseEghactComponent(content: string, document: TextDocument): AnalysisResult {
    const component: EghactComponent = {
      template: { content: '', range: this.createRange(0, 0, 0, 0) },
      script: { content: '', range: this.createRange(0, 0, 0, 0) },
      style: { content: '', range: this.createRange(0, 0, 0, 0) },
      props: [],
      events: [],
      stores: [],
      exports: [],
      imports: []
    };

    const errors: AnalysisError[] = [];
    const warnings: AnalysisWarning[] = [];

    // Parse sections
    const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/);
    if (templateMatch) {
      const start = content.indexOf(templateMatch[0]);
      const end = start + templateMatch[0].length;
      component.template = {
        content: templateMatch[1],
        range: this.offsetToRange(document, start, end)
      };
    }

    const scriptMatch = content.match(/<script(?:\s+lang=["']?(ts|typescript)["']?)?>([\s\S]*?)<\/script>/);
    if (scriptMatch) {
      const start = content.indexOf(scriptMatch[0]);
      const end = start + scriptMatch[0].length;
      component.script = {
        content: scriptMatch[2],
        range: this.offsetToRange(document, start, end),
        lang: scriptMatch[1] || 'js'
      };

      // Analyze script content
      this.analyzeScriptContent(component.script.content, component, document, start);
    }

    const styleMatch = content.match(/<style(?:\s+lang=["']?(scss|sass|less|stylus)["']?)?(?:\s+scoped)?>([\s\S]*?)<\/style>/);
    if (styleMatch) {
      const start = content.indexOf(styleMatch[0]);
      const end = start + styleMatch[0].length;
      component.style = {
        content: styleMatch[2],
        range: this.offsetToRange(document, start, end),
        lang: styleMatch[1] || 'css'
      };
    }

    // Analyze template for additional insights
    this.analyzeTemplateContent(component.template.content, component, document, errors, warnings);

    return { component, errors, warnings };
  }

  private analyzeScriptContent(
    scriptContent: string, 
    component: EghactComponent, 
    document: TextDocument,
    offset: number
  ): void {
    const lines = scriptContent.split('\n');
    
    lines.forEach((line, lineIndex) => {
      const trimmed = line.trim();
      
      // Parse export let (props)
      const exportMatch = trimmed.match(/export\s+let\s+(\w+)(?:\s*:\s*([^=;]+?))?(?:\s*=\s*([^;]+?))?;?/);
      if (exportMatch) {
        const propName = exportMatch[1];
        const propType = exportMatch[2]?.trim();
        const defaultValue = exportMatch[3]?.trim();
        
        component.props.push({
          name: propName,
          type: propType,
          defaultValue: defaultValue,
          range: this.createRange(lineIndex, 0, lineIndex, line.length),
          exported: true
        });
      }

      // Parse imports
      const importMatch = trimmed.match(/import\s+(?:\{([^}]+)\}|\*\s+as\s+(\w+)|(\w+))\s+from\s+['"`]([^'"`]+)['"`]/);
      if (importMatch) {
        const namedImports = importMatch[1];
        const namespaceImport = importMatch[2];
        const defaultImport = importMatch[3];
        const source = importMatch[4];

        if (namedImports) {
          namedImports.split(',').forEach(named => {
            const importName = named.trim();
            component.imports.push({
              name: importName,
              source,
              isDefault: false,
              range: this.createRange(lineIndex, 0, lineIndex, line.length)
            });
          });
        } else if (namespaceImport || defaultImport) {
          component.imports.push({
            name: namespaceImport || defaultImport,
            source,
            isDefault: !!defaultImport,
            range: this.createRange(lineIndex, 0, lineIndex, line.length)
          });
        }
      }

      // Parse reactive statements
      if (trimmed.startsWith('$:')) {
        // This is a reactive statement - could analyze dependencies
      }

      // Parse store references ($store)
      const storeMatch = trimmed.match(/\$(\w+)/g);
      if (storeMatch) {
        storeMatch.forEach(match => {
          const storeName = match.substring(1);
          component.stores.push({
            name: storeName,
            type: 'read', // Could be more sophisticated
            range: this.createRange(lineIndex, 0, lineIndex, line.length)
          });
        });
      }
    });
  }

  private analyzeTemplateContent(
    templateContent: string,
    component: EghactComponent,
    document: TextDocument,
    errors: AnalysisError[],
    warnings: AnalysisWarning[]
  ): void {
    // Analyze template for event handlers, bindings, etc.
    const eventHandlerRegex = /@(\w+)=\{([^}]+)\}/g;
    let match;
    
    while ((match = eventHandlerRegex.exec(templateContent)) !== null) {
      const eventName = match[1];
      const handler = match[2];
      
      component.events.push({
        name: eventName,
        range: this.createRange(0, match.index, 0, match.index + match[0].length)
      });
    }

    // Check for common issues
    if (templateContent.includes('{#if') && !templateContent.includes('{/if}')) {
      errors.push({
        message: 'Unclosed {#if} block',
        range: this.createRange(0, 0, 0, 0),
        code: 'unclosed-if'
      });
    }

    if (templateContent.includes('{#each') && !templateContent.includes('{/each}')) {
      errors.push({
        message: 'Unclosed {#each} block',
        range: this.createRange(0, 0, 0, 0),
        code: 'unclosed-each'
      });
    }
  }

  getDocumentSymbols(analysisResult: AnalysisResult): DocumentSymbol[] {
    const symbols: DocumentSymbol[] = [];
    const { component } = analysisResult;

    // Add component sections as symbols
    if (component.template.content.trim()) {
      symbols.push({
        name: 'template',
        kind: SymbolKind.Module,
        range: component.template.range,
        selectionRange: component.template.range
      });
    }

    if (component.script.content.trim()) {
      symbols.push({
        name: 'script',
        kind: SymbolKind.Module,
        range: component.script.range,
        selectionRange: component.script.range
      });
    }

    if (component.style.content.trim()) {
      symbols.push({
        name: 'style',
        kind: SymbolKind.Module,
        range: component.style.range,
        selectionRange: component.style.range
      });
    }

    // Add props as symbols
    component.props.forEach(prop => {
      symbols.push({
        name: prop.name,
        kind: SymbolKind.Property,
        range: prop.range,
        selectionRange: prop.range,
        detail: prop.type || 'any'
      });
    });

    // Add events as symbols
    component.events.forEach(event => {
      symbols.push({
        name: `@${event.name}`,
        kind: SymbolKind.Event,
        range: event.range,
        selectionRange: event.range
      });
    });

    return symbols;
  }

  async findWorkspaceSymbols(query: string): Promise<WorkspaceSymbol[]> {
    // This would typically search across all .egh files in the workspace
    // For now, return empty array
    return [];
  }

  private offsetToRange(document: TextDocument, start: number, end: number): Range {
    const startPos = document.positionAt(start);
    const endPos = document.positionAt(end);
    return Range.create(startPos, endPos);
  }

  private createRange(startLine: number, startChar: number, endLine: number, endChar: number): Range {
    return Range.create(
      Position.create(startLine, startChar),
      Position.create(endLine, endChar)
    );
  }
}
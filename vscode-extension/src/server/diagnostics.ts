import { TextDocument } from 'vscode-languageserver-textdocument';
import { 
  Diagnostic, 
  DiagnosticSeverity, 
  Range,
  CodeAction,
  CodeActionKind,
  WorkspaceEdit,
  TextEdit,
  CodeActionParams
} from 'vscode-languageserver/node';
import { EghactAnalyzer, AnalysisResult } from './analyzer';

interface EghactSettings {
  maxNumberOfProblems: number;
  typescript: { enabled: boolean };
  format: { enable: boolean };
  trace: { server: string };
}

export class EghactDiagnostics {
  constructor(private analyzer: EghactAnalyzer) {}

  async getDiagnostics(
    document: TextDocument, 
    analysisResult: AnalysisResult, 
    settings: EghactSettings
  ): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    const { component, errors, warnings } = analysisResult;

    // Convert analysis errors to diagnostics
    errors.forEach(error => {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: error.range,
        message: error.message,
        code: error.code,
        source: 'eghact'
      });
    });

    // Convert analysis warnings to diagnostics
    warnings.forEach(warning => {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: warning.range,
        message: warning.message,
        code: warning.code,
        source: 'eghact'
      });
    });

    // Add custom validation
    diagnostics.push(...this.validateComponent(document, component));
    diagnostics.push(...this.validateTemplate(document, component));
    diagnostics.push(...this.validateScript(document, component));
    diagnostics.push(...this.validateProps(document, component));

    // Limit number of problems
    return diagnostics.slice(0, settings.maxNumberOfProblems);
  }

  async getCodeActions(document: TextDocument, params: CodeActionParams): Promise<CodeAction[]> {
    const actions: CodeAction[] = [];
    const text = document.getText();

    // Get diagnostics for this range
    const diagnostics = params.context.diagnostics.filter(d => d.source === 'eghact');

    for (const diagnostic of diagnostics) {
      if (diagnostic.code === 'missing-prop-type') {
        actions.push(this.createAddPropTypeAction(document, diagnostic));
      } else if (diagnostic.code === 'unused-prop') {
        actions.push(this.createRemovePropAction(document, diagnostic));
      } else if (diagnostic.code === 'unclosed-tag') {
        actions.push(this.createCloseTagAction(document, diagnostic));
      } else if (diagnostic.code === 'missing-key') {
        actions.push(this.createAddKeyAction(document, diagnostic));
      }
    }

    // Add refactoring actions
    actions.push(...this.getRefactoringActions(document, params.range));

    return actions;
  }

  private validateComponent(document: TextDocument, component: any): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    
    // Check if component has at least a template
    if (!component.template.content.trim()) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        message: 'Component should have a template section',
        code: 'missing-template',
        source: 'eghact'
      });
    }

    // Check for valid component structure
    const text = document.getText();
    if (!text.includes('<template>') && !text.includes('<script>') && !text.includes('<style>')) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        message: 'Invalid Eghact component: must contain at least one section',
        code: 'invalid-component',
        source: 'eghact'
      });
    }

    return diagnostics;
  }

  private validateTemplate(document: TextDocument, component: any): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const template = component.template.content;
    
    if (!template.trim()) return diagnostics;

    // Check for unclosed tags
    const openTags = template.match(/<(\w+)[^>]*>/g) || [];
    const closeTags = template.match(/<\/(\w+)>/g) || [];
    
    const openTagNames = openTags.map(tag => {
      const match = tag.match(/<(\w+)/);
      return match ? match[1] : '';
    }).filter(Boolean);
    
    const closeTagNames = closeTags.map(tag => {
      const match = tag.match(/<\/(\w+)>/);
      return match ? match[1] : '';
    }).filter(Boolean);

    openTagNames.forEach(tagName => {
      if (!['img', 'br', 'hr', 'input', 'meta', 'link'].includes(tagName)) {
        if (!closeTagNames.includes(tagName)) {
          diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: component.template.range,
            message: `Unclosed tag: <${tagName}>`,
            code: 'unclosed-tag',
            source: 'eghact'
          });
        }
      }
    });

    // Check for missing keys in each blocks
    const eachBlocks = template.match(/\{#each\s+[^}]+\}/g) || [];
    eachBlocks.forEach(block => {
      if (!block.includes(' as ') || !template.includes('key=')) {
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          range: component.template.range,
          message: 'Each block should have a key attribute for optimal performance',
          code: 'missing-key',
          source: 'eghact'
        });
      }
    });

    // Check for accessibility issues
    const imgTags = template.match(/<img[^>]*>/g) || [];
    imgTags.forEach(img => {
      if (!img.includes('alt=')) {
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          range: component.template.range,
          message: 'Image should have alt attribute for accessibility',
          code: 'missing-alt',
          source: 'eghact'
        });
      }
    });

    return diagnostics;
  }

  private validateScript(document: TextDocument, component: any): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const script = component.script.content;
    
    if (!script.trim()) return diagnostics;

    // Check for unused imports
    component.imports.forEach(imp => {
      if (!script.includes(imp.name)) {
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          range: imp.range,
          message: `Unused import: ${imp.name}`,
          code: 'unused-import',
          source: 'eghact'
        });
      }
    });

    // Check for reactive statements without dependencies
    const reactiveStatements = script.match(/\$:[^;]+;/g) || [];
    reactiveStatements.forEach(statement => {
      if (!statement.includes('$') && !component.props.some(p => statement.includes(p.name))) {
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          range: component.script.range,
          message: 'Reactive statement has no dependencies',
          code: 'reactive-no-deps',
          source: 'eghact'
        });
      }
    });

    return diagnostics;
  }

  private validateProps(document: TextDocument, component: any): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    
    // Check for props without types (if TypeScript is enabled)
    component.props.forEach(prop => {
      if (!prop.type) {
        diagnostics.push({
          severity: DiagnosticSeverity.Information,
          range: prop.range,
          message: `Property '${prop.name}' should have a type annotation`,
          code: 'missing-prop-type',
          source: 'eghact'
        });
      }
    });

    // Check for unused props
    const template = component.template.content;
    const script = component.script.content;
    
    component.props.forEach(prop => {
      const isUsedInTemplate = template.includes(prop.name);
      const isUsedInScript = script.includes(prop.name);
      
      if (!isUsedInTemplate && !isUsedInScript) {
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          range: prop.range,
          message: `Unused prop: ${prop.name}`,
          code: 'unused-prop',
          source: 'eghact'
        });
      }
    });

    return diagnostics;
  }

  private createAddPropTypeAction(document: TextDocument, diagnostic: Diagnostic): CodeAction {
    const text = document.getText(diagnostic.range);
    const propMatch = text.match(/export\s+let\s+(\w+)/);
    
    if (propMatch) {
      const propName = propMatch[1];
      const edit: WorkspaceEdit = {
        changes: {
          [document.uri]: [{
            range: diagnostic.range,
            newText: text.replace(
              `export let ${propName}`,
              `export let ${propName}: string`
            )
          }]
        }
      };

      return {
        title: `Add type annotation to '${propName}'`,
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit
      };
    }

    return {
      title: 'Add type annotation',
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic]
    };
  }

  private createRemovePropAction(document: TextDocument, diagnostic: Diagnostic): CodeAction {
    const edit: WorkspaceEdit = {
      changes: {
        [document.uri]: [{
          range: diagnostic.range,
          newText: ''
        }]
      }
    };

    return {
      title: 'Remove unused prop',
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit
    };
  }

  private createCloseTagAction(document: TextDocument, diagnostic: Diagnostic): CodeAction {
    const text = document.getText();
    const match = diagnostic.message.match(/Unclosed tag: <(\w+)>/);
    
    if (match) {
      const tagName = match[1];
      const insertPosition = { line: diagnostic.range.end.line + 1, character: 0 };
      
      const edit: WorkspaceEdit = {
        changes: {
          [document.uri]: [{
            range: { start: insertPosition, end: insertPosition },
            newText: `</${tagName}>\n`
          }]
        }
      };

      return {
        title: `Close ${tagName} tag`,
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit
      };
    }

    return {
      title: 'Close tag',
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic]
    };
  }

  private createAddKeyAction(document: TextDocument, diagnostic: Diagnostic): CodeAction {
    return {
      title: 'Add key attribute to each block',
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic]
    };
  }

  private getRefactoringActions(document: TextDocument, range: Range): CodeAction[] {
    const actions: CodeAction[] = [];

    // Extract component
    actions.push({
      title: 'Extract to new component',
      kind: CodeActionKind.RefactorExtract,
      command: {
        title: 'Extract Component',
        command: 'eghact.extractComponent',
        arguments: [document.uri, range]
      }
    });

    // Convert to TypeScript
    actions.push({
      title: 'Convert to TypeScript',
      kind: CodeActionKind.RefactorRewrite,
      command: {
        title: 'Convert to TypeScript',
        command: 'eghact.convertToTypeScript',
        arguments: [document.uri]
      }
    });

    return actions;
  }
}
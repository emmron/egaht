import { TextDocument } from 'vscode-languageserver-textdocument';
import { 
  CompletionItem, 
  CompletionItemKind, 
  Position, 
  Range,
  InsertTextFormat
} from 'vscode-languageserver/node';
import { EghactAnalyzer, AnalysisResult } from './analyzer';

export class EghactCompletionProvider {
  constructor(private analyzer: EghactAnalyzer) {}

  async provideCompletions(document: TextDocument, position: Position): Promise<CompletionItem[]> {
    const text = document.getText();
    const offset = document.offsetAt(position);
    const lineText = document.getText({
      start: { line: position.line, character: 0 },
      end: { line: position.line, character: position.character }
    });

    const analysisResult = await this.analyzer.analyzeDocument(document);
    const completions: CompletionItem[] = [];

    // Determine context
    const context = this.getCompletionContext(text, offset, lineText);
    
    switch (context.type) {
      case 'template':
        completions.push(...this.getTemplateCompletions(context, analysisResult));
        break;
      case 'script':
        completions.push(...this.getScriptCompletions(context, analysisResult));
        break;
      case 'style':
        completions.push(...this.getStyleCompletions(context, analysisResult));
        break;
      case 'interpolation':
        completions.push(...this.getInterpolationCompletions(context, analysisResult));
        break;
      case 'directive':
        completions.push(...this.getDirectiveCompletions(context, analysisResult));
        break;
      case 'event':
        completions.push(...this.getEventCompletions(context, analysisResult));
        break;
    }

    return completions;
  }

  resolveCompletionItem(item: CompletionItem): CompletionItem {
    // Add additional details, documentation, etc.
    if (item.data?.type === 'prop') {
      item.detail = `prop: ${item.data.propType || 'any'}`;
      item.documentation = `Component property${item.data.defaultValue ? ` (default: ${item.data.defaultValue})` : ''}`;
    } else if (item.data?.type === 'lifecycle') {
      item.detail = 'lifecycle hook';
      item.documentation = 'Eghact component lifecycle function';
    }
    
    return item;
  }

  private getCompletionContext(text: string, offset: number, lineText: string) {
    // Determine if we're in template, script, or style section
    const beforeOffset = text.substring(0, offset);
    
    let inTemplate = false;
    let inScript = false;
    let inStyle = false;
    
    // Check section boundaries
    const templateStartMatch = beforeOffset.lastIndexOf('<template>');
    const templateEndMatch = beforeOffset.lastIndexOf('</template>');
    const scriptStartMatch = beforeOffset.lastIndexOf('<script');
    const scriptEndMatch = beforeOffset.lastIndexOf('</script>');
    const styleStartMatch = beforeOffset.lastIndexOf('<style');
    const styleEndMatch = beforeOffset.lastIndexOf('</style>');
    
    inTemplate = templateStartMatch > templateEndMatch;
    inScript = scriptStartMatch > scriptEndMatch;
    inStyle = styleStartMatch > styleEndMatch;

    // Check for specific contexts within sections
    if (inTemplate) {
      if (lineText.includes('{') && !lineText.includes('}')) {
        return { type: 'interpolation', lineText, inTemplate, inScript, inStyle };
      }
      if (lineText.match(/@\w*$/)) {
        return { type: 'event', lineText, inTemplate, inScript, inStyle };
      }
      if (lineText.match(/\s(bind:|class:|style:)\w*$/)) {
        return { type: 'directive', lineText, inTemplate, inScript, inStyle };
      }
      return { type: 'template', lineText, inTemplate, inScript, inStyle };
    }
    
    if (inScript) {
      return { type: 'script', lineText, inTemplate, inScript, inStyle };
    }
    
    if (inStyle) {
      return { type: 'style', lineText, inTemplate, inScript, inStyle };
    }
    
    return { type: 'unknown', lineText, inTemplate, inScript, inStyle };
  }

  private getTemplateCompletions(context: any, analysisResult: AnalysisResult): CompletionItem[] {
    const completions: CompletionItem[] = [];
    
    // HTML elements
    const htmlElements = [
      'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'a', 'img', 'ul', 'ol', 'li', 'button', 'input', 'form',
      'section', 'article', 'header', 'footer', 'nav', 'main'
    ];
    
    htmlElements.forEach(element => {
      completions.push({
        label: element,
        kind: CompletionItemKind.Keyword,
        insertText: `<${element}>$1</${element}>`,
        insertTextFormat: InsertTextFormat.Snippet,
        documentation: `HTML ${element} element`
      });
    });

    // Eghact control flow
    completions.push(
      {
        label: '{#if}',
        kind: CompletionItemKind.Snippet,
        insertText: '{#if ${1:condition}}\n\t$2\n{/if}',
        insertTextFormat: InsertTextFormat.Snippet,
        documentation: 'Conditional rendering block'
      },
      {
        label: '{#each}',
        kind: CompletionItemKind.Snippet,
        insertText: '{#each ${1:items} as ${2:item}}\n\t$3\n{/each}',
        insertTextFormat: InsertTextFormat.Snippet,
        documentation: 'Iteration block'
      },
      {
        label: '{#await}',
        kind: CompletionItemKind.Snippet,
        insertText: '{#await ${1:promise}}\n\t${2:loading...}\n{:then ${3:result}}\n\t$4\n{:catch ${5:error}}\n\t$6\n{/await}',
        insertTextFormat: InsertTextFormat.Snippet,
        documentation: 'Async block with loading, success, and error states'
      }
    );

    return completions;
  }

  private getScriptCompletions(context: any, analysisResult: AnalysisResult): CompletionItem[] {
    const completions: CompletionItem[] = [];
    
    // Eghact-specific imports and functions
    const eghactImports = [
      'onMount', 'onDestroy', 'beforeUpdate', 'afterUpdate', 'tick',
      'createEventDispatcher', 'getContext', 'setContext'
    ];
    
    eghactImports.forEach(func => {
      completions.push({
        label: func,
        kind: CompletionItemKind.Function,
        insertText: func,
        documentation: `Eghact ${func} function`,
        data: { type: 'lifecycle' }
      });
    });

    // Store imports
    completions.push(
      {
        label: 'writable',
        kind: CompletionItemKind.Function,
        insertText: 'writable',
        documentation: 'Create a writable store'
      },
      {
        label: 'readable',
        kind: CompletionItemKind.Function,
        insertText: 'readable',
        documentation: 'Create a readable store'
      },
      {
        label: 'derived',
        kind: CompletionItemKind.Function,
        insertText: 'derived',
        documentation: 'Create a derived store'
      }
    );

    // Component props
    analysisResult.component.props.forEach(prop => {
      completions.push({
        label: prop.name,
        kind: CompletionItemKind.Property,
        insertText: prop.name,
        documentation: `Component prop: ${prop.type || 'any'}`,
        data: { type: 'prop', propType: prop.type, defaultValue: prop.defaultValue }
      });
    });

    return completions;
  }

  private getStyleCompletions(context: any, analysisResult: AnalysisResult): CompletionItem[] {
    const completions: CompletionItem[] = [];
    
    // CSS properties
    const cssProperties = [
      'color', 'background', 'background-color', 'font-size', 'font-family',
      'margin', 'padding', 'border', 'width', 'height', 'display',
      'position', 'top', 'right', 'bottom', 'left', 'z-index'
    ];
    
    cssProperties.forEach(prop => {
      completions.push({
        label: prop,
        kind: CompletionItemKind.Property,
        insertText: `${prop}: $1;`,
        insertTextFormat: InsertTextFormat.Snippet,
        documentation: `CSS ${prop} property`
      });
    });

    return completions;
  }

  private getInterpolationCompletions(context: any, analysisResult: AnalysisResult): CompletionItem[] {
    const completions: CompletionItem[] = [];
    
    // Component props
    analysisResult.component.props.forEach(prop => {
      completions.push({
        label: prop.name,
        kind: CompletionItemKind.Property,
        insertText: prop.name,
        documentation: `Component prop: ${prop.type || 'any'}`
      });
    });

    // Store references
    analysisResult.component.stores.forEach(store => {
      completions.push({
        label: `$${store.name}`,
        kind: CompletionItemKind.Variable,
        insertText: `$${store.name}`,
        documentation: `Store reference: ${store.name}`
      });
    });

    return completions;
  }

  private getDirectiveCompletions(context: any, analysisResult: AnalysisResult): CompletionItem[] {
    const completions: CompletionItem[] = [];
    
    // Binding directives
    completions.push(
      {
        label: 'bind:value',
        kind: CompletionItemKind.Keyword,
        insertText: 'bind:value={$1}',
        insertTextFormat: InsertTextFormat.Snippet,
        documentation: 'Two-way data binding for form inputs'
      },
      {
        label: 'class:',
        kind: CompletionItemKind.Keyword,
        insertText: 'class:${1:className}={${2:condition}}',
        insertTextFormat: InsertTextFormat.Snippet,
        documentation: 'Conditional class binding'
      },
      {
        label: 'style:',
        kind: CompletionItemKind.Keyword,
        insertText: 'style:${1:property}={${2:value}}',
        insertTextFormat: InsertTextFormat.Snippet,
        documentation: 'Dynamic style binding'
      }
    );

    return completions;
  }

  private getEventCompletions(context: any, analysisResult: AnalysisResult): CompletionItem[] {
    const completions: CompletionItem[] = [];
    
    // Common DOM events
    const events = [
      'click', 'change', 'input', 'submit', 'focus', 'blur',
      'mouseenter', 'mouseleave', 'keydown', 'keyup', 'load'
    ];
    
    events.forEach(event => {
      completions.push({
        label: `@${event}`,
        kind: CompletionItemKind.Event,
        insertText: `@${event}={${1:handler}}`,
        insertTextFormat: InsertTextFormat.Snippet,
        documentation: `${event} event handler`
      });
    });

    return completions;
  }
}
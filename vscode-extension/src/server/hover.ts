import { TextDocument } from 'vscode-languageserver-textdocument';
import { Hover, Position, MarkupKind } from 'vscode-languageserver/node';
import { EghactAnalyzer } from './analyzer';

export class EghactHoverProvider {
  constructor(private analyzer: EghactAnalyzer) {}

  async provideHover(document: TextDocument, position: Position): Promise<Hover | null> {
    const analysisResult = await this.analyzer.analyzeDocument(document);
    const { component } = analysisResult;
    
    const wordRange = this.getWordRangeAtPosition(document, position);
    if (!wordRange) return null;
    
    const word = document.getText(wordRange);
    
    // Check if hovering over a prop
    const prop = component.props.find(p => p.name === word);
    if (prop) {
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: [
            `**${prop.name}** *(prop)*`,
            prop.type ? `Type: \`${prop.type}\`` : '',
            prop.defaultValue ? `Default: \`${prop.defaultValue}\`` : '',
            prop.exported ? 'Exported property' : 'Internal property'
          ].filter(Boolean).join('\n\n')
        },
        range: wordRange
      };
    }

    // Check if hovering over an event
    const event = component.events.find(e => e.name === word);
    if (event) {
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: [
            `**@${event.name}** *(event)*`,
            event.type ? `Event type: \`${event.type}\`` : '',
            'Event handler for user interaction'
          ].filter(Boolean).join('\n\n')
        },
        range: wordRange
      };
    }

    // Check if hovering over a store
    const store = component.stores.find(s => s.name === word || `$${s.name}` === word);
    if (store) {
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: [
            `**$${store.name}** *(store)*`,
            `Usage: ${store.type}`,
            'Reactive store reference'
          ].join('\n\n')
        },
        range: wordRange
      };
    }

    // Check for Eghact lifecycle functions
    const lifecycleFunctions = {
      'onMount': 'Called after the component is first rendered to the DOM',
      'onDestroy': 'Called when the component is destroyed',
      'beforeUpdate': 'Called before the component updates',
      'afterUpdate': 'Called after the component updates',
      'tick': 'Returns a promise that resolves once pending state changes have been applied',
      'createEventDispatcher': 'Creates an event dispatcher function'
    };

    if (lifecycleFunctions[word]) {
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: [
            `**${word}** *(lifecycle)*`,
            lifecycleFunctions[word],
            '```typescript',
            `import { ${word} } from 'eghact';`,
            '```'
          ].join('\n')
        },
        range: wordRange
      };
    }

    // Check for Eghact directives
    const directives = {
      'bind': 'Creates a two-way data binding',
      'class': 'Conditionally applies CSS classes',
      'style': 'Dynamically sets CSS styles',
      'on': 'Adds event listeners'
    };

    for (const [directive, description] of Object.entries(directives)) {
      if (word.startsWith(directive + ':')) {
        return {
          contents: {
            kind: MarkupKind.Markdown,
            value: [
              `**${directive}:** *(directive)*`,
              description,
              '```eghact',
              `<input ${directive}:value={variable} />`,
              '```'
            ].join('\n')
          },
          range: wordRange
        };
      }
    }

    return null;
  }

  private getWordRangeAtPosition(document: TextDocument, position: Position) {
    const text = document.getText();
    const offset = document.offsetAt(position);
    
    let start = offset;
    let end = offset;
    
    // Find word boundaries
    while (start > 0 && /\w/.test(text[start - 1])) {
      start--;
    }
    
    while (end < text.length && /\w/.test(text[end])) {
      end++;
    }
    
    if (start === end) return null;
    
    return {
      start: document.positionAt(start),
      end: document.positionAt(end)
    };
  }
}
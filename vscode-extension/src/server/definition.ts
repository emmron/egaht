import { TextDocument } from 'vscode-languageserver-textdocument';
import { 
  Location, 
  Position, 
  Range,
  ReferenceParams,
  ReferenceContext,
  PrepareRenameParams,
  RenameParams,
  WorkspaceEdit
} from 'vscode-languageserver/node';
import { EghactAnalyzer } from './analyzer';

export class EghactDefinitionProvider {
  constructor(private analyzer: EghactAnalyzer) {}

  async provideDefinition(document: TextDocument, position: Position): Promise<Location[]> {
    const analysisResult = await this.analyzer.analyzeDocument(document);
    const { component } = analysisResult;
    
    const wordRange = this.getWordRangeAtPosition(document, position);
    if (!wordRange) return [];
    
    const word = document.getText(wordRange);
    const locations: Location[] = [];
    
    // Find prop definition
    const prop = component.props.find(p => p.name === word);
    if (prop) {
      locations.push({
        uri: document.uri,
        range: prop.range
      });
    }

    // Find import definition
    const importDef = component.imports.find(imp => imp.name === word);
    if (importDef) {
      // This would typically resolve to the actual file
      // For now, just return the import statement location
      locations.push({
        uri: document.uri,
        range: importDef.range
      });
    }

    return locations;
  }

  async findReferences(
    document: TextDocument, 
    position: Position, 
    context: ReferenceContext
  ): Promise<Location[]> {
    const analysisResult = await this.analyzer.analyzeDocument(document);
    const { component } = analysisResult;
    const text = document.getText();
    
    const wordRange = this.getWordRangeAtPosition(document, position);
    if (!wordRange) return [];
    
    const word = document.getText(wordRange);
    const locations: Location[] = [];
    
    // Find all occurrences of the word in the document
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const start = document.positionAt(match.index);
      const end = document.positionAt(match.index + match[0].length);
      
      locations.push({
        uri: document.uri,
        range: { start, end }
      });
    }
    
    // Include definition if requested
    if (context.includeDeclaration) {
      const definition = await this.provideDefinition(document, position);
      locations.push(...definition);
    }
    
    return locations;
  }

  async prepareRename(document: TextDocument, position: Position): Promise<Range | null> {
    const wordRange = this.getWordRangeAtPosition(document, position);
    if (!wordRange) return null;
    
    const word = document.getText(wordRange);
    const analysisResult = await this.analyzer.analyzeDocument(document);
    const { component } = analysisResult;
    
    // Check if the word is renameable (prop, variable, etc.)
    const isRenameable = component.props.some(p => p.name === word) ||
                        component.exports.some(e => e.name === word);
    
    return isRenameable ? wordRange : null;
  }

  async provideRename(
    document: TextDocument, 
    position: Position, 
    newName: string
  ): Promise<WorkspaceEdit | null> {
    const wordRange = this.getWordRangeAtPosition(document, position);
    if (!wordRange) return null;
    
    const word = document.getText(wordRange);
    
    // Find all references to rename
    const references = await this.findReferences(document, position, { includeDeclaration: true });
    
    if (references.length === 0) return null;
    
    const edit: WorkspaceEdit = {
      changes: {
        [document.uri]: references.map(ref => ({
          range: ref.range,
          newText: newName
        }))
      }
    };
    
    return edit;
  }

  private getWordRangeAtPosition(document: TextDocument, position: Position): Range | null {
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
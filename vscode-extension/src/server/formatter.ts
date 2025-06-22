import { TextDocument } from 'vscode-languageserver-textdocument';
import { TextEdit, Range, FormattingOptions } from 'vscode-languageserver/node';

export class EghactFormatter {
  async formatDocument(document: TextDocument, options: FormattingOptions): Promise<TextEdit[]> {
    const text = document.getText();
    const formatted = this.formatEghactCode(text, options);
    
    if (formatted === text) {
      return []; // No changes needed
    }
    
    // Return a single edit that replaces the entire document
    return [{
      range: {
        start: { line: 0, character: 0 },
        end: document.positionAt(text.length)
      },
      newText: formatted
    }];
  }

  private formatEghactCode(code: string, options: FormattingOptions): string {
    const { tabSize, insertSpaces } = options;
    const indent = insertSpaces ? ' '.repeat(tabSize) : '\t';
    
    // Parse sections
    const sections = this.parseSections(code);
    let formatted = '';
    
    sections.forEach(section => {
      switch (section.type) {
        case 'template':
          formatted += this.formatTemplate(section.content, indent);
          break;
        case 'script':
          formatted += this.formatScript(section.content, section.attributes, indent);
          break;
        case 'style':
          formatted += this.formatStyle(section.content, section.attributes, indent);
          break;
        case 'text':
          formatted += section.content;
          break;
      }
    });
    
    return formatted.trim() + '\n';
  }

  private parseSections(code: string) {
    const sections: Array<{type: string, content: string, attributes?: string}> = [];
    
    // Simple parser for demonstration
    const templateMatch = code.match(/(<template[^>]*>)([\s\S]*?)(<\/template>)/);
    const scriptMatch = code.match(/(<script[^>]*>)([\s\S]*?)(<\/script>)/);
    const styleMatch = code.match(/(<style[^>]*>)([\s\S]*?)(<\/style>)/);
    
    let currentIndex = 0;
    
    if (templateMatch) {
      const start = code.indexOf(templateMatch[0]);
      if (start > currentIndex) {
        sections.push({ type: 'text', content: code.substring(currentIndex, start) });
      }
      sections.push({ 
        type: 'template', 
        content: templateMatch[1] + this.formatTemplateContent(templateMatch[2]) + templateMatch[3]
      });
      currentIndex = start + templateMatch[0].length;
    }
    
    if (scriptMatch) {
      const start = code.indexOf(scriptMatch[0]);
      if (start > currentIndex) {
        sections.push({ type: 'text', content: code.substring(currentIndex, start) });
      }
      sections.push({ 
        type: 'script', 
        content: scriptMatch[1] + this.formatScriptContent(scriptMatch[2]) + scriptMatch[3],
        attributes: scriptMatch[1]
      });
      currentIndex = start + scriptMatch[0].length;
    }
    
    if (styleMatch) {
      const start = code.indexOf(styleMatch[0]);
      if (start > currentIndex) {
        sections.push({ type: 'text', content: code.substring(currentIndex, start) });
      }
      sections.push({ 
        type: 'style', 
        content: styleMatch[1] + this.formatStyleContent(styleMatch[2]) + styleMatch[3],
        attributes: styleMatch[1]
      });
      currentIndex = start + styleMatch[0].length;
    }
    
    if (currentIndex < code.length) {
      sections.push({ type: 'text', content: code.substring(currentIndex) });
    }
    
    return sections;
  }

  private formatTemplate(content: string, indent: string): string {
    return this.formatTemplateContent(content);
  }

  private formatTemplateContent(content: string): string {
    // Basic HTML formatting
    let formatted = content.trim();
    
    // Add newlines after opening tags
    formatted = formatted.replace(/(<[^/][^>]*>)(?!\s*$)/g, '$1\n');
    
    // Add newlines before closing tags
    formatted = formatted.replace(/(?<!^\s*)(<\/[^>]+>)/g, '\n$1');
    
    // Format control flow blocks
    formatted = formatted.replace(/(\{#\w+[^}]*\})/g, '\n$1\n');
    formatted = formatted.replace(/(\{:\w*[^}]*\})/g, '\n$1\n');
    formatted = formatted.replace(/(\{\/\w+\})/g, '\n$1\n');
    
    // Clean up multiple newlines
    formatted = formatted.replace(/\n\s*\n/g, '\n');
    
    // Indent content
    const lines = formatted.split('\n');
    let indentLevel = 0;
    const indentedLines = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      
      // Decrease indent for closing tags
      if (trimmed.startsWith('</') || trimmed.startsWith('{/') || trimmed.startsWith('{:')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }
      
      const indented = '  '.repeat(indentLevel) + trimmed;
      
      // Increase indent for opening tags
      if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.endsWith('/>')) {
        indentLevel++;
      } else if (trimmed.startsWith('{#')) {
        indentLevel++;
      }
      
      return indented;
    });
    
    return '\n' + indentedLines.join('\n') + '\n';
  }

  private formatScript(content: string, attributes: string, indent: string): string {
    return this.formatScriptContent(content);
  }

  private formatScriptContent(content: string): string {
    // Basic JavaScript/TypeScript formatting
    let formatted = content.trim();
    
    // Add semicolons if missing
    formatted = formatted.replace(/([^;{}\s])\s*$/gm, '$1;');
    
    // Format imports
    formatted = formatted.replace(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g, 
      (match, imports, from) => {
        const cleanImports = imports.split(',').map(imp => imp.trim()).join(', ');
        return `import { ${cleanImports} } from '${from}';`;
      });
    
    // Format reactive statements
    formatted = formatted.replace(/\$:\s*/g, '$: ');
    
    return '\n' + formatted + '\n';
  }

  private formatStyle(content: string, attributes: string, indent: string): string {
    return this.formatStyleContent(content);
  }

  private formatStyleContent(content: string): string {
    // Basic CSS formatting
    let formatted = content.trim();
    
    // Add newlines after opening braces
    formatted = formatted.replace(/\{\s*/g, ' {\n  ');
    
    // Add newlines after semicolons
    formatted = formatted.replace(/;\s*/g, ';\n  ');
    
    // Add newlines before closing braces
    formatted = formatted.replace(/\s*\}/g, '\n}');
    
    // Clean up spacing
    formatted = formatted.replace(/\n\s*\n/g, '\n');
    
    return '\n' + formatted + '\n';
  }
}
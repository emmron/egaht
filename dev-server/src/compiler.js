/**
 * Compiler integration for dev server
 */

import path from 'path';
import fs from 'fs/promises';

export function createCompiler({ root, moduleGraph }) {
  return {
    async compile(filePath) {
      // Mock compiler for now - in real implementation would use Rust compiler
      const content = await fs.readFile(filePath, 'utf-8');
      const relativePath = path.relative(root, filePath);
      
      // Basic .egh processing
      if (filePath.endsWith('.egh')) {
        return {
          code: generateComponentJS(content, relativePath),
          dependencies: [],
          map: null
        };
      }
      
      // Pass through other files
      return {
        code: content,
        dependencies: [],
        map: null
      };
    }
  };
}

function generateComponentJS(content, filePath) {
  // Parse .egh sections
  const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/);
  const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);
  const styleMatch = content.match(/<style>([\s\S]*?)<\/style>/);
  
  const template = templateMatch ? templateMatch[1].trim() : '';
  const script = scriptMatch ? scriptMatch[1].trim() : '';
  const style = styleMatch ? styleMatch[1].trim() : '';
  
  // Generate component module
  return `
// Generated from ${filePath}
import { runtime } from '/__eghact/runtime.js';

${script}

export default function create() {
  const element = runtime.createElement('div');
  element.innerHTML = \`${template.replace(/`/g, '\\`')}\`;
  
  ${style ? `
  const style = document.createElement('style');
  style.textContent = \`${style.replace(/`/g, '\\`')}\`;
  document.head.appendChild(style);
  ` : ''}
  
  return element;
}

// HMR support
if (import.meta.hot) {
  import.meta.hot.accept();
}
`;
}
/**
 * EGH Compiler - Main entry point
 */

import { Tokenizer } from './tokenizer.js';
import { Parser } from './parser.js';
import { Transformer } from './transformer.js';
import { promises as fs } from 'fs';
import path from 'path';

export class EGHCompiler {
  constructor(options = {}) {
    this.options = {
      target: 'es2022',
      module: 'esm',
      optimize: true,
      sourceMap: true,
      runtime: '@eghact/runtime-pure',
      ...options
    };
  }
  
  compile(source, filename = 'unknown.egh') {
    try {
      // Tokenize
      const tokenizer = new Tokenizer(source);
      const tokens = tokenizer.tokenize();
      
      // Parse
      const parser = new Parser(tokens);
      const ast = parser.parse();
      
      // Transform
      const transformer = new Transformer(this.options);
      const result = transformer.transform(ast);
      
      // Add source mapping comment
      if (this.options.sourceMap && result.sourceMap) {
        result.code += `\n//# sourceMappingURL=${filename}.map`;
      }
      
      return {
        code: result.code,
        sourceMap: result.sourceMap,
        ast,
        tokens
      };
    } catch (error) {
      throw new CompilerError(error.message, filename, error.line, error.column);
    }
  }
  
  async compileFile(filePath) {
    const source = await fs.readFile(filePath, 'utf-8');
    const filename = path.basename(filePath);
    return this.compile(source, filename);
  }
  
  async compileDirectory(dirPath, outDir) {
    const files = await this.findEGHFiles(dirPath);
    const results = [];
    
    for (const file of files) {
      const relativePath = path.relative(dirPath, file);
      const outPath = path.join(outDir, relativePath.replace('.egh', '.js'));
      
      console.log(`Compiling ${relativePath}...`);
      
      try {
        const result = await this.compileFile(file);
        
        // Ensure output directory exists
        await fs.mkdir(path.dirname(outPath), { recursive: true });
        
        // Write compiled JavaScript
        await fs.writeFile(outPath, result.code);
        
        // Write source map if enabled
        if (this.options.sourceMap && result.sourceMap) {
          await fs.writeFile(outPath + '.map', JSON.stringify(result.sourceMap));
        }
        
        results.push({ file, outPath, success: true });
      } catch (error) {
        console.error(`Error compiling ${relativePath}:`, error.message);
        results.push({ file, error, success: false });
      }
    }
    
    return results;
  }
  
  async findEGHFiles(dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          files.push(...await this.findEGHFiles(fullPath));
        }
      } else if (entry.name.endsWith('.egh')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }
  
  // Watch mode for development
  async watch(dirPath, outDir) {
    console.log(`Watching ${dirPath} for changes...`);
    
    // Initial compilation
    await this.compileDirectory(dirPath, outDir);
    
    // Set up file watcher
    const { watch } = await import('chokidar');
    const watcher = watch(path.join(dirPath, '**/*.egh'), {
      ignored: /node_modules/,
      persistent: true
    });
    
    watcher.on('change', async (filePath) => {
      console.log(`File changed: ${filePath}`);
      const relativePath = path.relative(dirPath, filePath);
      const outPath = path.join(outDir, relativePath.replace('.egh', '.js'));
      
      try {
        const result = await this.compileFile(filePath);
        await fs.writeFile(outPath, result.code);
        console.log(`Recompiled: ${relativePath}`);
      } catch (error) {
        console.error(`Error compiling ${relativePath}:`, error.message);
      }
    });
    
    watcher.on('add', async (filePath) => {
      console.log(`File added: ${filePath}`);
      const relativePath = path.relative(dirPath, filePath);
      const outPath = path.join(outDir, relativePath.replace('.egh', '.js'));
      
      try {
        const result = await this.compileFile(filePath);
        await fs.mkdir(path.dirname(outPath), { recursive: true });
        await fs.writeFile(outPath, result.code);
        console.log(`Compiled: ${relativePath}`);
      } catch (error) {
        console.error(`Error compiling ${relativePath}:`, error.message);
      }
    });
    
    return watcher;
  }
}

class CompilerError extends Error {
  constructor(message, filename, line, column) {
    super(message);
    this.name = 'CompilerError';
    this.filename = filename;
    this.line = line;
    this.column = column;
  }
  
  toString() {
    return `${this.name}: ${this.message} (${this.filename}:${this.line}:${this.column})`;
  }
}

// Export convenience function
export function compile(source, options) {
  const compiler = new EGHCompiler(options);
  return compiler.compile(source);
}
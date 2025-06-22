/**
 * Build Worker for Parallel Compilation - PO002
 * Worker thread that handles individual module compilation
 */

import { parentPort, workerData } from 'worker_threads';
import { transformSync } from '@babel/core';
import { createHash } from 'crypto';
import fs from 'fs-extra';
import path from 'path';

// Worker configuration
const workerId = workerData?.id || process.pid;

/**
 * Main message handler
 */
parentPort.on('message', async (msg) => {
  try {
    switch (msg.type) {
      case 'build':
        await handleBuild(msg);
        break;
      
      case 'analyze':
        await handleAnalyze(msg);
        break;
        
      case 'optimize':
        await handleOptimize(msg);
        break;
        
      default:
        console.warn(`Unknown message type: ${msg.type}`);
    }
  } catch (error) {
    parentPort.postMessage({
      type: 'error',
      taskId: msg.taskId,
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * Handle build task for a single module
 */
async function handleBuild(msg) {
  const { taskId, module, options } = msg;
  const start = process.hrtime.bigint();
  
  try {
    // Read module content
    const content = await fs.readFile(module, 'utf8');
    
    // Determine module type
    const ext = path.extname(module);
    let result;
    
    switch (ext) {
      case '.js':
      case '.jsx':
        result = await compileJavaScript(content, module, options);
        break;
        
      case '.egh':
        result = await compileEghact(content, module, options);
        break;
        
      case '.css':
        result = await compileCSS(content, module, options);
        break;
        
      default:
        result = { content, map: null };
    }
    
    // Calculate build time
    const buildTime = Number(process.hrtime.bigint() - start) / 1_000_000;
    
    // Send result back to main thread
    parentPort.postMessage({
      type: 'build-complete',
      taskId,
      workerId,
      result: {
        module,
        content: result.content,
        map: result.map,
        hash: createHash('md5').update(result.content).digest('hex'),
        buildTime,
        size: Buffer.byteLength(result.content)
      }
    });
    
  } catch (error) {
    throw new Error(`Build failed for ${module}: ${error.message}`);
  }
}

/**
 * Compile JavaScript/JSX files
 */
async function compileJavaScript(content, filename, options) {
  const result = transformSync(content, {
    filename,
    presets: [
      ['@babel/preset-env', {
        targets: options.targets || 'defaults',
        modules: false
      }]
    ],
    plugins: [
      // Fast refresh for development
      options.watchMode && '@babel/plugin-transform-react-jsx',
      // Tree shaking helpers
      '@babel/plugin-transform-runtime'
    ].filter(Boolean),
    sourceMaps: true,
    compact: options.mode === 'production',
    minified: options.mode === 'production'
  });
  
  return {
    content: result.code,
    map: result.map
  };
}

/**
 * Compile Eghact component files
 */
async function compileEghact(content, filename, options) {
  // Parse component sections
  const sections = parseEghactComponent(content);
  
  // Transform template to render function
  const renderFn = compileTemplate(sections.template);
  
  // Process script section
  const script = processScript(sections.script, renderFn);
  
  // Process styles
  const styles = await processStyles(sections.style, filename);
  
  // Generate final module
  const output = generateEghactModule({
    script,
    styles,
    filename,
    options
  });
  
  return {
    content: output.code,
    map: output.map
  };
}

/**
 * Parse Eghact component into sections
 */
function parseEghactComponent(content) {
  const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/);
  const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);
  const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  
  return {
    template: templateMatch ? templateMatch[1].trim() : '',
    script: scriptMatch ? scriptMatch[1].trim() : '',
    style: styleMatch ? styleMatch[1].trim() : ''
  };
}

/**
 * Compile template to optimized render function
 */
function compileTemplate(template) {
  // Simplified template compilation
  // In real implementation, would use proper AST transformation
  
  const renderCode = `
    function render(state) {
      return \`${template.replace(/\{(\w+)\}/g, '${state.$1}')}\`;
    }
  `;
  
  return renderCode;
}

/**
 * Process component script
 */
function processScript(script, renderFn) {
  // Add reactive system and render function
  return `
    import { reactive, createComponent } from 'eghact/runtime';
    
    ${renderFn}
    
    export default createComponent({
      setup() {
        ${script}
        
        return {
          render,
          state: reactive(state)
        };
      }
    });
  `;
}

/**
 * Process component styles
 */
async function processStyles(styles, filename) {
  if (!styles) return '';
  
  // Generate scoped class name
  const hash = createHash('md5').update(filename).digest('hex').slice(0, 8);
  const scopeId = `egh-${hash}`;
  
  // Add scope to selectors
  const scopedStyles = styles.replace(/([^{]+){/g, `$1[data-egh="${scopeId}"] {`);
  
  return {
    scopeId,
    styles: scopedStyles
  };
}

/**
 * Generate final Eghact module
 */
function generateEghactModule({ script, styles, filename, options }) {
  const code = `
    ${script}
    
    // Inject styles
    if (typeof document !== 'undefined' && ${JSON.stringify(styles.styles)}) {
      const style = document.createElement('style');
      style.textContent = ${JSON.stringify(styles.styles)};
      document.head.appendChild(style);
    }
  `;
  
  // Use Babel for final transformation
  return transformSync(code, {
    filename,
    sourceMaps: true,
    compact: options.mode === 'production'
  });
}

/**
 * Compile CSS files
 */
async function compileCSS(content, filename, options) {
  // In production, would use PostCSS
  // For now, just minify in production
  
  if (options.mode === 'production') {
    // Simple minification
    content = content
      .replace(/\s+/g, ' ')
      .replace(/:\s+/g, ':')
      .replace(/;\s+/g, ';')
      .replace(/\{\s+/g, '{')
      .replace(/\}\s+/g, '}');
  }
  
  return {
    content,
    map: null
  };
}

/**
 * Handle analyze task
 */
async function handleAnalyze(msg) {
  const { taskId, module } = msg;
  
  // Analyze module dependencies
  const content = await fs.readFile(module, 'utf8');
  const imports = extractImports(content);
  const exports = extractExports(content);
  
  parentPort.postMessage({
    type: 'analyze-complete',
    taskId,
    workerId,
    result: {
      module,
      imports,
      exports,
      size: Buffer.byteLength(content)
    }
  });
}

/**
 * Extract imports from module
 */
function extractImports(content) {
  const imports = [];
  const importRegex = /import\s+(?:{[^}]+}|[\w]+|\*\s+as\s+[\w]+)\s+from\s+['"]([^'"]+)['"]/g;
  
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  return imports;
}

/**
 * Extract exports from module
 */
function extractExports(content) {
  const exports = [];
  const exportRegex = /export\s+(?:default\s+)?(?:const|let|var|function|class)\s+([\w]+)/g;
  
  let match;
  while ((match = exportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }
  
  return exports;
}

/**
 * Handle optimize task
 */
async function handleOptimize(msg) {
  const { taskId, module, optimization } = msg;
  
  // Apply optimizations based on type
  const content = await fs.readFile(module, 'utf8');
  let optimized = content;
  
  if (optimization.includes('minify')) {
    optimized = minifyCode(optimized);
  }
  
  if (optimization.includes('tree-shake')) {
    optimized = treeShake(optimized);
  }
  
  parentPort.postMessage({
    type: 'optimize-complete',
    taskId,
    workerId,
    result: {
      module,
      content: optimized,
      originalSize: Buffer.byteLength(content),
      optimizedSize: Buffer.byteLength(optimized)
    }
  });
}

/**
 * Simple minification
 */
function minifyCode(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
    .replace(/\/\/.*$/gm, '') // Remove line comments
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
}

/**
 * Simple tree shaking
 */
function treeShake(code) {
  // In real implementation, would use proper AST analysis
  return code;
}

// Signal ready
parentPort.postMessage({
  type: 'worker-ready',
  workerId
});
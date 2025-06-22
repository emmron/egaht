import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import fs from 'fs-extra';
import path from 'path';

/**
 * Enhanced Tree-Shaking with Cross-Component Optimization
 * Performs dead code elimination across component boundaries
 */
export class TreeShaker {
  constructor(options = {}) {
    this.options = {
      aggressiveShaking: true,
      preserveComments: false,
      removeUnusedImports: true,
      removeUnusedProps: true,
      removeUnusedMethods: true,
      sideEffectFreeFunctions: [
        'console.log',
        'console.warn', 
        'console.error',
        'Math.*',
        'Object.freeze',
        'Object.seal'
      ],
      ...options
    };
    
    this.analysisResults = {
      usedExports: new Map(),
      usedImports: new Map(),
      sideEffects: new Set(),
      deadCode: new Map(),
      componentUsage: new Map(),
      propUsage: new Map()
    };
  }

  /**
   * Perform tree-shaking analysis on entire project
   */
  async analyzeProject(sourceDir, entryPoints = []) {
    console.log('🌳 Performing tree-shaking analysis...');
    
    // 1. Build dependency graph
    const dependencyGraph = await this.buildDependencyGraph(sourceDir);
    
    // 2. Mark used code starting from entry points
    await this.markUsedCode(entryPoints, dependencyGraph);
    
    // 3. Analyze component-specific usage
    await this.analyzeComponentUsage(dependencyGraph);
    
    // 4. Detect side effects
    await this.detectSideEffects(dependencyGraph);
    
    // 5. Generate removal recommendations
    const deadCode = this.identifyDeadCode(dependencyGraph);
    
    return {
      dependencyGraph,
      deadCode,
      statistics: this.generateStatistics()
    };
  }

  /**
   * Build comprehensive dependency graph
   */
  async buildDependencyGraph(sourceDir) {
    const files = await this.getAllSourceFiles(sourceDir);
    const graph = new Map();

    for (const filePath of files) {
      const analysis = await this.analyzeFileExports(filePath);
      graph.set(filePath, analysis);
    }

    // Link dependencies
    for (const [filePath, analysis] of graph) {
      for (const importInfo of analysis.imports) {
        const resolvedPath = this.resolveImportPath(importInfo.source, filePath);
        if (resolvedPath && graph.has(resolvedPath)) {
          const dependency = graph.get(resolvedPath);
          this.linkDependency(analysis, dependency, importInfo);
        }
      }
    }

    return graph;
  }

  /**
   * Analyze exports and imports in a file
   */
  async analyzeFileExports(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy']
    });

    const analysis = {
      filePath,
      exports: new Map(),
      imports: [],
      components: new Map(),
      functions: new Map(),
      variables: new Map(),
      sideEffects: [],
      isUsed: false,
      usageReasons: []
    };

    traverse(ast, {
      // Export declarations
      ExportNamedDeclaration: (path) => {
        this.analyzeNamedExport(path, analysis);
      },

      ExportDefaultDeclaration: (path) => {
        this.analyzeDefaultExport(path, analysis);
      },

      ExportAllDeclaration: (path) => {
        this.analyzeExportAll(path, analysis);
      },

      // Import declarations  
      ImportDeclaration: (path) => {
        this.analyzeImport(path, analysis);
      },

      // Function declarations
      FunctionDeclaration: (path) => {
        this.analyzeFunctionDeclaration(path, analysis);
      },

      // Variable declarations
      VariableDeclarator: (path) => {
        this.analyzeVariableDeclarator(path, analysis);
      },

      // Component definitions (React/Eghact style)
      ClassDeclaration: (path) => {
        if (this.isComponent(path.node)) {
          this.analyzeComponent(path, analysis);
        }
      },

      // Side effect detection
      CallExpression: (path) => {
        if (this.hasSideEffects(path.node)) {
          analysis.sideEffects.push({
            type: 'call',
            callee: this.getCalleeSignature(path.node),
            location: path.node.loc
          });
        }
      },

      // Assignment expressions (potential side effects)
      AssignmentExpression: (path) => {
        if (this.isGlobalAssignment(path.node)) {
          analysis.sideEffects.push({
            type: 'assignment',
            target: this.getAssignmentTarget(path.node),
            location: path.node.loc
          });
        }
      }
    });

    return analysis;
  }

  /**
   * Analyze named export
   */
  analyzeNamedExport(path, analysis) {
    const node = path.node;
    
    if (node.declaration) {
      // export const/function/class declaration
      if (t.isFunctionDeclaration(node.declaration)) {
        const name = node.declaration.id.name;
        analysis.exports.set(name, {
          type: 'function',
          name,
          declaration: node.declaration,
          isUsed: false,
          usedBy: []
        });
      } else if (t.isVariableDeclaration(node.declaration)) {
        for (const declarator of node.declaration.declarations) {
          if (t.isIdentifier(declarator.id)) {
            const name = declarator.id.name;
            analysis.exports.set(name, {
              type: 'variable',
              name,
              declaration: declarator,
              isUsed: false,
              usedBy: []
            });
          }
        }
      } else if (t.isClassDeclaration(node.declaration)) {
        const name = node.declaration.id.name;
        analysis.exports.set(name, {
          type: 'class',
          name,
          declaration: node.declaration,
          isUsed: false,
          usedBy: [],
          isComponent: this.isComponent(node.declaration)
        });
      }
    } else {
      // export { name1, name2 }
      for (const specifier of node.specifiers) {
        const exported = specifier.exported.name;
        const local = specifier.local.name;
        analysis.exports.set(exported, {
          type: 'reference',
          name: exported,
          localName: local,
          isUsed: false,
          usedBy: []
        });
      }
    }
  }

  /**
   * Analyze default export
   */
  analyzeDefaultExport(path, analysis) {
    const node = path.node;
    
    analysis.exports.set('default', {
      type: 'default',
      name: 'default',
      declaration: node.declaration,
      isUsed: false,
      usedBy: []
    });
  }

  /**
   * Analyze export all
   */
  analyzeExportAll(path, analysis) {
    const node = path.node;
    
    analysis.exports.set('*', {
      type: 'all',
      name: '*',
      source: node.source.value,
      isUsed: false,
      usedBy: []
    });
  }

  /**
   * Analyze import declaration
   */
  analyzeImport(path, analysis) {
    const node = path.node;
    const source = node.source.value;
    
    const importInfo = {
      source,
      specifiers: [],
      isUsed: false,
      sideEffectOnly: node.specifiers.length === 0
    };

    for (const specifier of node.specifiers) {
      if (t.isImportDefaultSpecifier(specifier)) {
        importInfo.specifiers.push({
          type: 'default',
          local: specifier.local.name,
          imported: 'default',
          isUsed: false
        });
      } else if (t.isImportNamespaceSpecifier(specifier)) {
        importInfo.specifiers.push({
          type: 'namespace',
          local: specifier.local.name,
          imported: '*',
          isUsed: false
        });
      } else if (t.isImportSpecifier(specifier)) {
        importInfo.specifiers.push({
          type: 'named',
          local: specifier.local.name,
          imported: specifier.imported.name,
          isUsed: false
        });
      }
    }

    analysis.imports.push(importInfo);
  }

  /**
   * Analyze function declaration
   */
  analyzeFunctionDeclaration(path, analysis) {
    const node = path.node;
    const name = node.id?.name;
    
    if (name) {
      analysis.functions.set(name, {
        name,
        params: node.params.map(param => this.getParamName(param)),
        hasSideEffects: this.functionHasSideEffects(path),
        isUsed: false,
        usedBy: []
      });
    }
  }

  /**
   * Analyze variable declarator
   */
  analyzeVariableDeclarator(path, analysis) {
    const node = path.node;
    
    if (t.isIdentifier(node.id)) {
      const name = node.id.name;
      analysis.variables.set(name, {
        name,
        type: this.getVariableType(node.init),
        isUsed: false,
        usedBy: []
      });
    }
  }

  /**
   * Analyze component declaration
   */
  analyzeComponent(path, analysis) {
    const node = path.node;
    const name = node.id?.name;
    
    if (name) {
      const component = {
        name,
        props: this.extractComponentProps(path),
        methods: this.extractComponentMethods(path),
        state: this.extractComponentState(path),
        isUsed: false,
        usedBy: []
      };
      
      analysis.components.set(name, component);
    }
  }

  /**
   * Mark used code starting from entry points
   */
  async markUsedCode(entryPoints, dependencyGraph) {
    console.log('🎯 Marking used code...');
    
    const usageQueue = [...entryPoints];
    const visited = new Set();

    while (usageQueue.length > 0) {
      const filePath = usageQueue.shift();
      
      if (visited.has(filePath) || !dependencyGraph.has(filePath)) {
        continue;
      }
      
      visited.add(filePath);
      const analysis = dependencyGraph.get(filePath);
      analysis.isUsed = true;

      // Mark all exports as potentially used (entry point behavior)
      for (const [name, exportInfo] of analysis.exports) {
        exportInfo.isUsed = true;
      }

      // Follow dependencies
      for (const importInfo of analysis.imports) {
        const resolvedPath = this.resolveImportPath(importInfo.source, filePath);
        if (resolvedPath && !visited.has(resolvedPath)) {
          usageQueue.push(resolvedPath);
        }
      }
    }

    // Propagate usage through dependency chains
    this.propagateUsage(dependencyGraph);
  }

  /**
   * Propagate usage information through dependency chains
   */
  propagateUsage(dependencyGraph) {
    let changed = true;
    
    while (changed) {
      changed = false;
      
      for (const [filePath, analysis] of dependencyGraph) {
        for (const importInfo of analysis.imports) {
          const resolvedPath = this.resolveImportPath(importInfo.source, filePath);
          if (!resolvedPath || !dependencyGraph.has(resolvedPath)) continue;
          
          const dependency = dependencyGraph.get(resolvedPath);
          
          for (const specifier of importInfo.specifiers) {
            if (specifier.isUsed) {
              const exportInfo = dependency.exports.get(specifier.imported);
              if (exportInfo && !exportInfo.isUsed) {
                exportInfo.isUsed = true;
                exportInfo.usedBy.push(filePath);
                changed = true;
              }
            }
          }
        }
      }
    }
  }

  /**
   * Analyze component-specific usage patterns
   */
  async analyzeComponentUsage(dependencyGraph) {
    console.log('🔍 Analyzing component usage...');
    
    for (const [filePath, analysis] of dependencyGraph) {
      for (const [componentName, component] of analysis.components) {
        // Analyze prop usage
        this.analyzeComponentPropUsage(component, analysis);
        
        // Analyze method usage
        this.analyzeComponentMethodUsage(component, analysis);
        
        // Store component usage data
        this.analysisResults.componentUsage.set(`${filePath}:${componentName}`, {
          component,
          usedProps: component.props.filter(prop => prop.isUsed),
          usedMethods: component.methods.filter(method => method.isUsed),
          unusedProps: component.props.filter(prop => !prop.isUsed),
          unusedMethods: component.methods.filter(method => !method.isUsed)
        });
      }
    }
  }

  /**
   * Analyze component prop usage
   */
  analyzeComponentPropUsage(component, fileAnalysis) {
    // Simple heuristic: if prop name appears in the component code, it's used
    // In a real implementation, this would use more sophisticated AST analysis
    for (const prop of component.props) {
      const propName = prop.name;
      
      // Check if prop is referenced in component methods
      for (const method of component.methods) {
        if (method.body && method.body.includes(propName)) {
          prop.isUsed = true;
          break;
        }
      }
    }
  }

  /**
   * Analyze component method usage
   */
  analyzeComponentMethodUsage(component, fileAnalysis) {
    // Mark lifecycle methods as always used
    const lifecycleMethods = ['componentDidMount', 'componentWillUnmount', 'render', 'setup', 'onMounted'];
    
    for (const method of component.methods) {
      if (lifecycleMethods.includes(method.name)) {
        method.isUsed = true;
      }
    }
  }

  /**
   * Detect side effects
   */
  async detectSideEffects(dependencyGraph) {
    console.log('⚠️  Detecting side effects...');
    
    for (const [filePath, analysis] of dependencyGraph) {
      for (const sideEffect of analysis.sideEffects) {
        this.analysisResults.sideEffects.add({
          file: filePath,
          type: sideEffect.type,
          details: sideEffect,
          isSafeToRemove: this.isSideEffectSafeToRemove(sideEffect)
        });
      }
    }
  }

  /**
   * Identify dead code for removal
   */
  identifyDeadCode(dependencyGraph) {
    console.log('💀 Identifying dead code...');
    
    const deadCode = {
      files: [],
      exports: [],
      imports: [],
      functions: [],
      variables: [],
      components: []
    };

    for (const [filePath, analysis] of dependencyGraph) {
      // Unused files
      if (!analysis.isUsed) {
        deadCode.files.push({
          filePath,
          reason: 'File not imported by any entry point'
        });
        continue;
      }

      // Unused exports
      for (const [name, exportInfo] of analysis.exports) {
        if (!exportInfo.isUsed && this.canRemoveExport(exportInfo)) {
          deadCode.exports.push({
            filePath,
            name,
            type: exportInfo.type,
            reason: 'Export not imported anywhere'
          });
        }
      }

      // Unused imports
      for (const importInfo of analysis.imports) {
        if (!importInfo.isUsed && !importInfo.sideEffectOnly) {
          deadCode.imports.push({
            filePath,
            source: importInfo.source,
            specifiers: importInfo.specifiers.filter(spec => !spec.isUsed),
            reason: 'Import not used in file'
          });
        }
      }

      // Unused functions
      for (const [name, functionInfo] of analysis.functions) {
        if (!functionInfo.isUsed && !functionInfo.hasSideEffects) {
          deadCode.functions.push({
            filePath,
            name,
            reason: 'Function not called anywhere'
          });
        }
      }

      // Unused variables
      for (const [name, variableInfo] of analysis.variables) {
        if (!variableInfo.isUsed) {
          deadCode.variables.push({
            filePath,
            name,
            reason: 'Variable not referenced anywhere'
          });
        }
      }

      // Unused component parts
      const componentUsage = this.analysisResults.componentUsage.get(`${filePath}:*`);
      if (componentUsage) {
        deadCode.components.push({
          filePath,
          unusedProps: componentUsage.unusedProps,
          unusedMethods: componentUsage.unusedMethods,
          reason: 'Component parts not used'
        });
      }
    }

    this.analysisResults.deadCode = deadCode;
    return deadCode;
  }

  /**
   * Apply tree-shaking transformations
   */
  async applyTreeShaking(filePath, deadCodeInfo) {
    const content = await fs.readFile(filePath, 'utf-8');
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy']
    });

    let modified = false;

    traverse(ast, {
      // Remove dead imports
      ImportDeclaration: (path) => {
        const source = path.node.source.value;
        const deadImport = deadCodeInfo.imports.find(imp => 
          imp.filePath === filePath && imp.source === source
        );
        
        if (deadImport && deadImport.specifiers.length === path.node.specifiers.length) {
          path.remove();
          modified = true;
        } else if (deadImport) {
          // Remove specific specifiers
          path.node.specifiers = path.node.specifiers.filter(spec => {
            const deadSpec = deadImport.specifiers.find(ds => ds.local === spec.local.name);
            if (deadSpec) {
              modified = true;
              return false;
            }
            return true;
          });
        }
      },

      // Remove dead exports
      ExportNamedDeclaration: (path) => {
        const deadExport = deadCodeInfo.exports.find(exp => 
          exp.filePath === filePath
        );
        
        if (deadExport) {
          path.remove();
          modified = true;
        }
      },

      // Remove dead functions
      FunctionDeclaration: (path) => {
        const name = path.node.id?.name;
        const deadFunction = deadCodeInfo.functions.find(func => 
          func.filePath === filePath && func.name === name
        );
        
        if (deadFunction) {
          path.remove();
          modified = true;
        }
      },

      // Remove dead variables
      VariableDeclarator: (path) => {
        if (t.isIdentifier(path.node.id)) {
          const name = path.node.id.name;
          const deadVariable = deadCodeInfo.variables.find(variable => 
            variable.filePath === filePath && variable.name === name
          );
          
          if (deadVariable) {
            // Remove the entire declaration if it's the only declarator
            const declaration = path.parent;
            if (declaration.declarations.length === 1) {
              path.parentPath.remove();
            } else {
              path.remove();
            }
            modified = true;
          }
        }
      }
    });

    if (modified) {
      const output = generate(ast, {
        retainLines: false,
        compact: !this.options.preserveComments,
        comments: this.options.preserveComments
      });
      
      return output.code;
    }

    return null; // No changes needed
  }

  /**
   * Helper methods
   */
  
  isComponent(node) {
    if (t.isClassDeclaration(node)) {
      return node.superClass && 
             (t.isIdentifier(node.superClass, { name: 'Component' }) ||
              t.isMemberExpression(node.superClass));
    }
    return false;
  }

  hasSideEffects(node) {
    if (t.isCallExpression(node)) {
      const callee = this.getCalleeSignature(node);
      return !this.options.sideEffectFreeFunctions.some(pattern => {
        return pattern.includes('*') ? 
          new RegExp(pattern.replace('*', '.*')).test(callee) :
          callee === pattern;
      });
    }
    return false;
  }

  getCalleeSignature(node) {
    if (t.isIdentifier(node.callee)) {
      return node.callee.name;
    }
    if (t.isMemberExpression(node.callee)) {
      const object = t.isIdentifier(node.callee.object) ? node.callee.object.name : 'unknown';
      const property = t.isIdentifier(node.callee.property) ? node.callee.property.name : 'unknown';
      return `${object}.${property}`;
    }
    return 'unknown';
  }

  isGlobalAssignment(node) {
    return t.isMemberExpression(node.left) &&
           t.isIdentifier(node.left.object, { name: 'window' });
  }

  getAssignmentTarget(node) {
    if (t.isMemberExpression(node.left)) {
      return generate(node.left).code;
    }
    return 'unknown';
  }

  functionHasSideEffects(path) {
    let hasSideEffects = false;
    
    path.traverse({
      CallExpression: (innerPath) => {
        if (this.hasSideEffects(innerPath.node)) {
          hasSideEffects = true;
        }
      },
      AssignmentExpression: (innerPath) => {
        if (this.isGlobalAssignment(innerPath.node)) {
          hasSideEffects = true;
        }
      }
    });
    
    return hasSideEffects;
  }

  extractComponentProps(path) {
    // Simplified prop extraction - would be more sophisticated in real implementation
    const props = [];
    
    // Look for props parameter in constructor or function signature
    path.traverse({
      Identifier: (innerPath) => {
        if (innerPath.node.name === 'props' && innerPath.isReferencedIdentifier()) {
          // This is a basic heuristic - real implementation would be more thorough
          props.push({
            name: 'props',
            type: 'object',
            isUsed: false
          });
        }
      }
    });
    
    return props;
  }

  extractComponentMethods(path) {
    const methods = [];
    
    path.traverse({
      ClassMethod: (innerPath) => {
        const methodName = innerPath.node.key.name;
        methods.push({
          name: methodName,
          isUsed: false,
          body: generate(innerPath.node.body).code
        });
      }
    });
    
    return methods;
  }

  extractComponentState(path) {
    // Simplified state extraction
    return [];
  }

  getParamName(param) {
    if (t.isIdentifier(param)) {
      return param.name;
    }
    if (t.isObjectPattern(param)) {
      return 'destructured';
    }
    if (t.isArrayPattern(param)) {
      return 'array';
    }
    return 'unknown';
  }

  getVariableType(init) {
    if (!init) return 'undefined';
    if (t.isStringLiteral(init)) return 'string';
    if (t.isNumericLiteral(init)) return 'number';
    if (t.isBooleanLiteral(init)) return 'boolean';
    if (t.isArrayExpression(init)) return 'array';
    if (t.isObjectExpression(init)) return 'object';
    if (t.isFunctionExpression(init) || t.isArrowFunctionExpression(init)) return 'function';
    return 'unknown';
  }

  canRemoveExport(exportInfo) {
    // Don't remove default exports or explicitly marked exports
    return exportInfo.name !== 'default' && 
           !exportInfo.preserveAlways;
  }

  isSideEffectSafeToRemove(sideEffect) {
    // Conservative approach - most side effects are not safe to remove
    if (sideEffect.type === 'call') {
      const safeCalls = ['console.log', 'console.warn', 'console.error'];
      return safeCalls.includes(sideEffect.callee);
    }
    return false;
  }

  resolveImportPath(source, fromFile) {
    // Simplified path resolution - real implementation would use proper resolver
    if (source.startsWith('./') || source.startsWith('../')) {
      return path.resolve(path.dirname(fromFile), source);
    }
    return null; // External module
  }

  linkDependency(analysis, dependency, importInfo) {
    // Link import to corresponding export
    for (const specifier of importInfo.specifiers) {
      if (dependency.exports.has(specifier.imported)) {
        const exportInfo = dependency.exports.get(specifier.imported);
        exportInfo.usedBy.push(analysis.filePath);
      }
    }
  }

  async getAllSourceFiles(dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files.push(...await this.getAllSourceFiles(fullPath));
      } else if (entry.isFile() && /\.(js|jsx|ts|tsx|egh)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  generateStatistics() {
    const deadCode = this.analysisResults.deadCode;
    const totalFiles = this.analysisResults.componentUsage.size;
    
    return {
      deadFiles: deadCode.files.length,
      deadExports: deadCode.exports.length,
      deadImports: deadCode.imports.length,
      deadFunctions: deadCode.functions.length,
      deadVariables: deadCode.variables.length,
      totalFiles,
      sideEffects: this.analysisResults.sideEffects.size,
      optimizationPotential: this.calculateOptimizationPotential()
    };
  }

  calculateOptimizationPotential() {
    const deadCode = this.analysisResults.deadCode;
    const totalDeadItems = deadCode.exports.length + deadCode.functions.length + deadCode.variables.length;
    
    // Estimate size reduction (rough heuristic)
    const estimatedSavingsKB = totalDeadItems * 0.5; // 0.5KB per dead item
    
    return {
      estimatedSavingsKB,
      removalCandidates: totalDeadItems,
      filesAffected: new Set([
        ...deadCode.exports.map(e => e.filePath),
        ...deadCode.functions.map(f => f.filePath),
        ...deadCode.variables.map(v => v.filePath)
      ]).size
    };
  }
}

export default TreeShaker;
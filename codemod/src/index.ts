import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { transformUseState } from './transformers/useState';
import { transformUseEffect } from './transformers/useEffect';
import { transformJSX } from './transformers/jsx-to-template';
import { TransformContext, MigrationOptions, MigrationResult } from './types';

export class ReactToEghactMigrator {
  async migrate(code: string, options: MigrationOptions): Promise<MigrationResult> {
    const context: TransformContext = {
      componentName: '',
      componentType: 'functional',
      componentState: new Set(),
      stateSetters: new Map(),
      props: new Set(),
      propTypes: new Map(),
      imports: new Set(),
      reactiveStatements: [],
      warnings: [],
      errors: []
    };
    
    try {
      // Parse React code
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
      });
      
      // First pass: identify component type and structure
      this.analyzeComponent(ast, context);
      
      // Transform AST
      traverse(ast, {
        // Transform hooks
        CallExpression(path) {
          transformUseState(path, context);
          transformUseEffect(path, context);
        },
        
        // Transform JSX
        JSXElement(path) {
          transformJSX(path, context);
        },
        
        JSXFragment(path) {
          transformJSX(path, context);
        },
        
        // Transform setter calls
        CallExpression(path) {
          if (t.isIdentifier(path.node.callee)) {
            const setterName = path.node.callee.name;
            if (context.stateSetters.has(setterName)) {
              const stateName = context.stateSetters.get(setterName)!;
              // Transform setState(value) to state = value
              path.replaceWith(
                t.assignmentExpression(
                  '=',
                  t.identifier(stateName),
                  path.node.arguments[0] || t.identifier('undefined')
                )
              );
            }
          }
        }
      });
      
      // Generate Eghact component structure
      const eghactCode = this.generateEghactComponent(ast, context);
      
      return {
        success: true,
        outputPath: options.output || options.input.replace(/\.(jsx?|tsx?)$/, '.egh'),
        warnings: context.warnings,
        errors: context.errors,
        manualSteps: this.generateManualSteps(context)
      };
    } catch (error) {
      return {
        success: false,
        outputPath: '',
        warnings: context.warnings,
        errors: [...context.errors, {
          line: 0,
          message: error instanceof Error ? error.message : 'Unknown error'
        }],
        manualSteps: []
      };
    }
  }
  
  private analyzeComponent(ast: t.File, context: TransformContext): void {
    traverse(ast, {
      // Detect functional components
      FunctionDeclaration(path) {
        if (this.looksLikeComponent(path.node.id?.name)) {
          context.componentName = path.node.id?.name || 'Component';
          context.componentType = 'functional';
          this.extractProps(path.node.params[0], context);
        }
      },
      
      VariableDeclarator(path) {
        if (t.isArrowFunctionExpression(path.node.init) && 
            t.isIdentifier(path.node.id) &&
            this.looksLikeComponent(path.node.id.name)) {
          context.componentName = path.node.id.name;
          context.componentType = 'functional';
          this.extractProps(path.node.init.params[0], context);
        }
      },
      
      // Detect class components
      ClassDeclaration(path) {
        if (path.node.superClass && 
            t.isMemberExpression(path.node.superClass) &&
            t.isIdentifier(path.node.superClass.property, { name: 'Component' })) {
          context.componentName = path.node.id?.name || 'Component';
          context.componentType = 'class';
        }
      }
    });
  }
  
  private looksLikeComponent(name?: string): boolean {
    return !!name && /^[A-Z]/.test(name);
  }
  
  private extractProps(param: any, context: TransformContext): void {
    if (t.isObjectPattern(param)) {
      param.properties.forEach((prop: any) => {
        if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
          context.props.add(prop.key.name);
        }
      });
    }
  }
  
  private generateEghactComponent(ast: t.File, context: TransformContext): string {
    // Generate .egh file structure
    const scriptSection = this.generateScriptSection(ast, context);
    const templateSection = this.generateTemplateSection(ast, context);
    const styleSection = this.generateStyleSection(ast, context);
    
    return `${scriptSection}\n\n${templateSection}\n\n${styleSection}`.trim();
  }
  
  private generateScriptSection(ast: t.File, context: TransformContext): string {
    // Extract logic and state
    let script = '<script>\n';
    
    // Add imports
    if (context.imports.size > 0) {
      script += `  import { ${Array.from(context.imports).join(', ')} } from 'eghact';\n\n`;
    }
    
    // Add props
    if (context.props.size > 0) {
      context.props.forEach(prop => {
        script += `  export let ${prop};\n`;
      });
      script += '\n';
    }
    
    // Add state
    context.componentState.forEach(state => {
      script += `  let ${state};\n`;
    });
    
    // Add reactive statements
    if (context.reactiveStatements.length > 0) {
      script += '\n';
      context.reactiveStatements.forEach(({ statement }) => {
        script += `  ${generate(statement).code}\n`;
      });
    }
    
    script += '</script>';
    return script;
  }
  
  private generateTemplateSection(ast: t.File, context: TransformContext): string {
    // Extract JSX return and convert to template
    let template = '<template>\n';
    
    // Find the return statement with JSX
    traverse(ast, {
      ReturnStatement(path) {
        if (path.node.argument && (t.isJSXElement(path.node.argument) || 
            t.isJSXFragment(path.node.argument))) {
          const code = generate(path.node.argument).code;
          template += '  ' + code.split('\n').join('\n  ');
          path.stop();
        }
      }
    });
    
    template += '\n</template>';
    return template;
  }
  
  private generateStyleSection(ast: t.File, context: TransformContext): string {
    // TODO: Extract styled-components or CSS modules if present
    return '<style>\n  /* Styles go here */\n</style>';
  }
  
  private generateManualSteps(context: TransformContext): string[] {
    const steps: string[] = [];
    
    if (context.componentType === 'class') {
      steps.push('Convert class lifecycle methods to Eghact lifecycle functions');
      steps.push('Transform this.state to reactive declarations');
    }
    
    if (context.warnings.some(w => w.message.includes('cleanup'))) {
      steps.push('Convert useEffect cleanup functions to onDestroy');
    }
    
    if (context.errors.length > 0) {
      steps.push('Fix compilation errors in the generated code');
    }
    
    return steps;
  }
}
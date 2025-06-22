import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { TransformContext } from '../types';

/**
 * Transforms React useEffect hooks to Eghact lifecycle/reactive statements
 * 
 * React:   useEffect(() => { ... }, [deps]);
 * Eghact:  $: { ... } // for reactive statements
 *          onMount(() => { ... }) // for mount effects
 */
export function transformUseEffect(
  path: NodePath<t.CallExpression>,
  context: TransformContext
): void {
  const { node } = path;
  
  if (!t.isIdentifier(node.callee, { name: 'useEffect' })) {
    return;
  }
  
  const [effectCallback, depsArray] = node.arguments;
  
  if (!t.isArrowFunctionExpression(effectCallback) && 
      !t.isFunctionExpression(effectCallback)) {
    context.warnings.push({
      line: node.loc?.start.line || 0,
      message: 'useEffect must have a function as first argument'
    });
    return;
  }
  
  const hasCleanup = effectCallback.body.type === 'BlockStatement' &&
    effectCallback.body.body.some(stmt => 
      t.isReturnStatement(stmt) && stmt.argument
    );
  
  // Determine effect type based on dependencies
  const isMount = !depsArray || 
    (t.isArrayExpression(depsArray) && depsArray.elements.length === 0);
  
  if (isMount) {
    // Transform to onMount
    const onMountCall = t.callExpression(
      t.identifier('onMount'),
      [effectCallback]
    );
    
    path.replaceWith(onMountCall);
    context.imports.add('onMount');
  } else if (t.isArrayExpression(depsArray)) {
    // Transform to reactive statement
    const deps = depsArray.elements
      .filter(el => t.isIdentifier(el))
      .map(el => (el as t.Identifier).name);
    
    // Create reactive label
    const reactiveLabel = t.labeledStatement(
      t.identifier('$'),
      t.blockStatement(
        t.isBlockStatement(effectCallback.body) 
          ? effectCallback.body.body 
          : [t.expressionStatement(effectCallback.body)]
      )
    );
    
    // Find parent statement and insert after
    const parentStatement = path.getFunctionParent();
    if (parentStatement) {
      path.remove();
      // Store for later insertion in proper location
      context.reactiveStatements.push({
        statement: reactiveLabel,
        dependencies: deps
      });
    }
  }
  
  if (hasCleanup) {
    context.imports.add('onDestroy');
    context.warnings.push({
      line: node.loc?.start.line || 0,
      message: 'useEffect cleanup requires manual transformation to onDestroy'
    });
  }
}
import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { TransformContext } from '../types';

/**
 * Transforms React useState hooks to Eghact reactive declarations
 * 
 * React:   const [count, setCount] = useState(0);
 * Eghact:  let count = 0;
 *          $: console.log(count); // reactive statements
 */
export function transformUseState(
  path: NodePath<t.CallExpression>,
  context: TransformContext
): void {
  const { node } = path;
  
  // Check if this is a useState call
  if (!t.isIdentifier(node.callee, { name: 'useState' })) {
    return;
  }
  
  // Get the parent variable declarator
  const declarator = path.findParent(p => p.isVariableDeclarator());
  if (!declarator) return;
  
  const declaratorNode = declarator.node as t.VariableDeclarator;
  
  // Extract state variable name and setter from array pattern
  if (!t.isArrayPattern(declaratorNode.id)) {
    context.warnings.push({
      line: node.loc?.start.line || 0,
      message: 'useState must use array destructuring'
    });
    return;
  }
  
  const [stateElement, setterElement] = declaratorNode.id.elements;
  
  if (!t.isIdentifier(stateElement) || !t.isIdentifier(setterElement)) {
    context.warnings.push({
      line: node.loc?.start.line || 0,
      message: 'useState destructuring must use simple identifiers'
    });
    return;
  }
  
  const stateName = stateElement.name;
  const setterName = setterElement.name;
  const initialValue = node.arguments[0] || t.identifier('undefined');
  
  // Create reactive state declaration
  const reactiveDeclaration = t.variableDeclaration('let', [
    t.variableDeclarator(t.identifier(stateName), initialValue)
  ]);
  
  // Replace the useState declaration
  const parentStatement = declarator.getFunctionParent()?.path;
  if (parentStatement && parentStatement.isVariableDeclaration()) {
    parentStatement.replaceWith(reactiveDeclaration);
  }
  
  // Track setter transformations
  context.stateSetters.set(setterName, stateName);
  
  // Add to component state tracking
  context.componentState.add(stateName);
}
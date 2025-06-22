import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { TransformContext } from '../types';

/**
 * Transforms JSX to Eghact template syntax
 * 
 * React JSX:  <div className="foo" onClick={handler}>{value}</div>
 * Eghact:     <div class="foo" @click={handler}>{value}</div>
 */
export function transformJSX(
  path: NodePath<t.JSXElement | t.JSXFragment>,
  context: TransformContext
): void {
  if (path.isJSXElement()) {
    transformJSXElement(path, context);
  } else if (path.isJSXFragment()) {
    transformJSXFragment(path, context);
  }
}

function transformJSXElement(
  path: NodePath<t.JSXElement>,
  context: TransformContext
): void {
  const { openingElement } = path.node;
  
  // Transform attributes
  openingElement.attributes.forEach(attr => {
    if (t.isJSXAttribute(attr)) {
      transformAttribute(attr, context);
    }
  });
  
  // Handle conditional rendering
  transformConditionalRendering(path, context);
  
  // Handle list rendering
  transformListRendering(path, context);
}

function transformAttribute(
  attr: t.JSXAttribute,
  context: TransformContext
): void {
  if (!t.isJSXIdentifier(attr.name)) return;
  
  const name = attr.name.name;
  
  // Transform className to class
  if (name === 'className') {
    attr.name.name = 'class';
  }
  
  // Transform event handlers
  if (name.startsWith('on') && name.length > 2) {
    const eventName = name.slice(2).toLowerCase();
    attr.name.name = `@${eventName}`;
  }
  
  // Transform htmlFor to for
  if (name === 'htmlFor') {
    attr.name.name = 'for';
  }
  
  // Handle style objects
  if (name === 'style' && attr.value && 
      t.isJSXExpressionContainer(attr.value) &&
      t.isObjectExpression(attr.value.expression)) {
    // Convert style object to string
    const styleString = objectToStyleString(attr.value.expression);
    attr.value = t.stringLiteral(styleString);
  }
}

function transformConditionalRendering(
  path: NodePath<t.JSXElement>,
  context: TransformContext
): void {
  const parent = path.parent;
  
  // Check for ternary conditional rendering
  if (t.isConditionalExpression(parent) && parent.consequent === path.node) {
    // Transform to {#if} block
    const ifBlock = createIfBlock(parent.test, path.node, parent.alternate);
    path.parentPath?.replaceWith(ifBlock);
  }
  
  // Check for && conditional rendering
  if (t.isLogicalExpression(parent) && parent.operator === '&&') {
    const ifBlock = createIfBlock(parent.left, path.node, null);
    path.parentPath?.replaceWith(ifBlock);
  }
}

function transformListRendering(
  path: NodePath<t.JSXElement>,
  context: TransformContext
): void {
  // Look for .map() calls
  path.traverse({
    CallExpression(callPath) {
      if (t.isMemberExpression(callPath.node.callee) &&
          t.isIdentifier(callPath.node.callee.property, { name: 'map' })) {
        
        const mapArg = callPath.node.arguments[0];
        if (t.isArrowFunctionExpression(mapArg) || t.isFunctionExpression(mapArg)) {
          // Transform to {#each} block
          const eachBlock = createEachBlock(
            callPath.node.callee.object,
            mapArg.params[0],
            mapArg.body
          );
          callPath.replaceWith(eachBlock);
        }
      }
    }
  });
}

function createIfBlock(
  test: t.Expression,
  consequent: any,
  alternate: any
): t.JSXElement {
  // Create Eghact {#if} syntax
  // This is a placeholder - actual implementation would generate proper template syntax
  return t.jsxElement(
    t.jsxOpeningElement(
      t.jsxIdentifier('If'),
      [t.jsxAttribute(t.jsxIdentifier('condition'), 
        t.jsxExpressionContainer(test))],
      false
    ),
    t.jsxClosingElement(t.jsxIdentifier('If')),
    [consequent].filter(Boolean)
  );
}

function createEachBlock(
  array: any,
  item: any,
  body: any
): t.JSXElement {
  // Create Eghact {#each} syntax
  return t.jsxElement(
    t.jsxOpeningElement(
      t.jsxIdentifier('Each'),
      [
        t.jsxAttribute(t.jsxIdentifier('items'), 
          t.jsxExpressionContainer(array)),
        t.jsxAttribute(t.jsxIdentifier('as'), 
          t.stringLiteral(t.isIdentifier(item) ? item.name : 'item'))
      ],
      false
    ),
    t.jsxClosingElement(t.jsxIdentifier('Each')),
    [body]
  );
}

function transformJSXFragment(
  path: NodePath<t.JSXFragment>,
  context: TransformContext
): void {
  // Fragments remain similar in Eghact
  // Just ensure children are transformed
}

function objectToStyleString(obj: t.ObjectExpression): string {
  return obj.properties
    .filter(prop => t.isObjectProperty(prop))
    .map(prop => {
      const key = t.isIdentifier(prop.key) ? prop.key.name : '';
      const value = t.isStringLiteral(prop.value) ? prop.value.value : '';
      return `${camelToKebab(key)}: ${value}`;
    })
    .join('; ');
}

function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}
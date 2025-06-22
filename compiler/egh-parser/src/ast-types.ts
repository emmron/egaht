/**
 * AST Node Types for EGH (Eghact Hyperlanguage)
 */

export type ASTNode = 
  | ComponentNode
  | StateNode
  | ComputedNode
  | EffectNode
  | TemplateNode
  | ElementNode
  | ExpressionNode
  | StatementNode
  | TypeNode;

export interface ComponentNode {
  type: 'Component';
  name: string;
  props: PropDefinition[];
  states: StateNode[];
  computed: ComputedNode[];
  effects: EffectNode[];
  template: TemplateNode | null;
  styles?: StyleNode;
  metadata?: ComponentMetadata;
}

export interface PropDefinition {
  name: string;
  type: string | TypeNode;
  optional: boolean;
  defaultValue?: ExpressionNode;
  spread?: boolean; // for ...attrs
}

export interface StateNode {
  type: 'State';
  name: string;
  reactive: boolean;
  initialValue: ExpressionNode;
}

export interface ComputedNode {
  type: 'Computed';
  name: string;
  expression: ExpressionNode;
  dependencies: string[];
  memoized?: boolean;
}

export interface EffectNode {
  type: 'Effect';
  trigger: string | string[];
  body: StatementNode[];
  dependencies: string[];
  cleanup?: StatementNode[];
}

export interface TemplateNode {
  type: 'Template';
  children: ElementNode[];
}

export interface ElementNode {
  type: 'Element';
  tag: string;
  attributes: Record<string, ExpressionNode | string>;
  events: Record<string, ExpressionNode>;
  children: (ElementNode | ExpressionNode | TextNode)[];
  directives: Record<string, any>;
  
  // Special properties
  key?: ExpressionNode;
  ref?: string;
  slot?: string;
  
  // Performance hints
  static?: boolean;
  memoized?: boolean;
  virtual?: boolean;
  lazy?: boolean;
}

export interface TextNode {
  type: 'Text';
  value: string;
}

// Expression nodes
export type ExpressionNode =
  | LiteralNode
  | IdentifierNode
  | BinaryExpressionNode
  | UnaryExpressionNode
  | CallExpressionNode
  | MemberExpressionNode
  | ConditionalExpressionNode
  | ArrayExpressionNode
  | ObjectExpressionNode
  | FunctionExpressionNode
  | PipeExpressionNode
  | TwoWayBindingNode
  | StreamExpressionNode
  | MatchExpressionNode
  | TypeofExpressionNode;

export interface LiteralNode {
  type: 'Literal';
  value: any;
  raw?: string;
}

export interface IdentifierNode {
  type: 'Identifier';
  name: string;
}

export interface BinaryExpressionNode {
  type: 'BinaryExpression';
  operator: string;
  left: ExpressionNode;
  right: ExpressionNode;
}

export interface UnaryExpressionNode {
  type: 'UnaryExpression';
  operator: string;
  argument: ExpressionNode;
  prefix: boolean;
}

export interface CallExpressionNode {
  type: 'CallExpression';
  callee: ExpressionNode;
  arguments: ExpressionNode[];
}

export interface MemberExpressionNode {
  type: 'MemberExpression';
  object: ExpressionNode;
  property: ExpressionNode;
  computed: boolean;
}

export interface ConditionalExpressionNode {
  type: 'ConditionalExpression';
  test: ExpressionNode;
  consequent: ExpressionNode;
  alternate: ExpressionNode;
}

export interface ArrayExpressionNode {
  type: 'ArrayExpression';
  elements: (ExpressionNode | null)[];
}

export interface ObjectExpressionNode {
  type: 'ObjectExpression';
  properties: PropertyNode[];
}

export interface PropertyNode {
  type: 'Property';
  key: ExpressionNode;
  value: ExpressionNode;
  computed: boolean;
  shorthand: boolean;
}

export interface FunctionExpressionNode {
  type: 'FunctionExpression';
  params: IdentifierNode[];
  body: StatementNode[] | ExpressionNode;
  async: boolean;
}

// EGH-specific expressions
export interface PipeExpressionNode {
  type: 'PipeExpression';
  left: ExpressionNode;
  right: ExpressionNode | CallExpressionNode;
}

export interface TwoWayBindingNode {
  type: 'TwoWayBinding';
  left: ExpressionNode;
  right: ExpressionNode;
}

export interface StreamExpressionNode {
  type: 'StreamExpression';
  source: ExpressionNode;
  operators: PipeOperator[];
}

export interface PipeOperator {
  name: string;
  args: ExpressionNode[];
}

export interface MatchExpressionNode {
  type: 'MatchExpression';
  discriminant: ExpressionNode;
  cases: MatchCase[];
  defaultCase?: ExpressionNode;
}

export interface MatchCase {
  pattern: ExpressionNode | string;
  consequent: ExpressionNode;
}

export interface TypeofExpressionNode {
  type: 'TypeofExpression';
  argument: ExpressionNode;
  cases: TypeofCase[];
}

export interface TypeofCase {
  type: string | TypeNode;
  consequent: ExpressionNode;
}

// Statement nodes
export type StatementNode =
  | ExpressionStatementNode
  | BlockStatementNode
  | IfStatementNode
  | ForStatementNode
  | WhileStatementNode
  | ReturnStatementNode
  | ThrowStatementNode
  | TryStatementNode;

export interface ExpressionStatementNode {
  type: 'ExpressionStatement';
  expression: ExpressionNode;
}

export interface BlockStatementNode {
  type: 'BlockStatement';
  body: StatementNode[];
}

export interface IfStatementNode {
  type: 'IfStatement';
  test: ExpressionNode;
  consequent: StatementNode;
  alternate?: StatementNode;
}

export interface ForStatementNode {
  type: 'ForStatement';
  init?: ExpressionNode;
  test?: ExpressionNode;
  update?: ExpressionNode;
  body: StatementNode;
}

export interface WhileStatementNode {
  type: 'WhileStatement';
  test: ExpressionNode;
  body: StatementNode;
}

export interface ReturnStatementNode {
  type: 'ReturnStatement';
  argument?: ExpressionNode;
}

export interface ThrowStatementNode {
  type: 'ThrowStatement';
  argument: ExpressionNode;
}

export interface TryStatementNode {
  type: 'TryStatement';
  block: BlockStatementNode;
  handler?: CatchClause;
  finalizer?: BlockStatementNode;
}

export interface CatchClause {
  type: 'CatchClause';
  param?: IdentifierNode;
  body: BlockStatementNode;
}

// Style nodes
export interface StyleNode {
  type: 'Style';
  rules: StyleRule[];
  scoped: boolean;
}

export interface StyleRule {
  selector: string;
  declarations: StyleDeclaration[];
  nested?: StyleRule[];
}

export interface StyleDeclaration {
  property: string;
  value: string | ExpressionNode;
  important: boolean;
}

// Type nodes
export interface TypeNode {
  type: 'Type';
  name: string;
  generics?: TypeNode[];
  union?: TypeNode[];
  intersection?: TypeNode[];
  properties?: TypeProperty[];
}

export interface TypeProperty {
  name: string;
  type: TypeNode;
  optional: boolean;
  readonly: boolean;
}

// Metadata
export interface ComponentMetadata {
  performance?: {
    static?: boolean;
    memoize?: boolean;
    worker?: boolean;
    virtual?: boolean;
  };
  ai?: {
    description?: string;
    style?: string;
    behavior?: string;
  };
  compiler?: {
    target?: string;
    optimization?: string;
    features?: string[];
  };
}

// Directives
export interface Directive {
  name: string;
  value?: ExpressionNode;
  modifiers?: string[];
}

// Animation
export interface AnimationNode {
  type: 'Animation';
  name: string;
  duration: number | string;
  easing?: string;
  delay?: number;
  iterations?: number;
}

// Transition
export interface TransitionNode {
  type: 'Transition';
  trigger: ExpressionNode;
  mode: 'morph' | 'fade' | 'slide' | 'scale';
  states: TransitionState[];
}

export interface TransitionState {
  value: string | ExpressionNode;
  element: ElementNode;
}
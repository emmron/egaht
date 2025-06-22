use anyhow::Result;
use std::collections::{HashMap, HashSet};
use swc_ecma_ast::*;
use swc_ecma_visit::{Visit, VisitWith};
use swc_ecma_codegen::{Emitter, text_writer::JsWriter};
use swc_common::SourceMap;

#[derive(Debug, Clone)]
pub struct ReactiveAnalysis {
    /// Variables that are reactive (declared with let)
    pub reactive_vars: HashSet<String>,
    /// Store references (variables prefixed with $)
    pub store_refs: HashSet<String>,
    /// Map from reactive variable to DOM nodes that depend on it
    pub dependencies: HashMap<String, Vec<DependencyTarget>>,
    /// Reactive statements ($:) and their dependencies
    pub reactive_statements: Vec<ReactiveStatement>,
    /// Signal subscriptions for fine-grained updates
    pub signals: HashMap<String, Signal>,
}

#[derive(Debug, Clone)]
pub struct DependencyTarget {
    pub node_id: String,
    pub target_type: TargetType,
    pub expression: String,
}

#[derive(Debug, Clone)]
pub enum TargetType {
    TextContent,
    Attribute(String),
    Conditional,
    Loop,
}

#[derive(Debug, Clone)]
pub struct ReactiveStatement {
    pub id: String,
    pub dependencies: HashSet<String>,
    pub expression: String,
    pub is_assignment: bool,
    pub target_var: Option<String>,
}

#[derive(Debug, Clone)]
pub struct Signal {
    pub name: String,
    pub initial_value: Option<String>,
    pub subscribers: Vec<String>,
}

pub fn analyze_reactivity(
    script: &Module,
    template_deps: &HashMap<String, Vec<DependencyTarget>>,
) -> Result<ReactiveAnalysis> {
    let mut analyzer = ReactivityAnalyzer::new();
    
    // First pass: collect reactive variables (let declarations)
    script.visit_with(&mut analyzer);
    
    // Second pass: analyze dependencies in reactive statements
    let reactive_statements = extract_reactive_statements(script)?;
    
    // Build signal graph
    let signals = build_signal_graph(&analyzer.reactive_vars, &reactive_statements);
    
    Ok(ReactiveAnalysis {
        reactive_vars: analyzer.reactive_vars,
        store_refs: analyzer.store_refs,
        dependencies: template_deps.clone(),
        reactive_statements,
        signals,
    })
}

struct ReactivityAnalyzer {
    reactive_vars: HashSet<String>,
    store_refs: HashSet<String>,
    current_scope: Vec<String>,
}

impl ReactivityAnalyzer {
    fn new() -> Self {
        Self {
            reactive_vars: HashSet::new(),
            store_refs: HashSet::new(),
            current_scope: Vec::new(),
        }
    }
}

impl Visit for ReactivityAnalyzer {
    fn visit_var_decl(&mut self, node: &VarDecl) {
        // In Eghact, all 'let' declarations are reactive
        if matches!(node.kind, VarDeclKind::Let) {
            for decl in &node.decls {
                if let Pat::Ident(ident) = &decl.name {
                    self.reactive_vars.insert(ident.id.sym.to_string());
                }
            }
        }
        node.visit_children_with(self);
    }
    
    fn visit_fn_decl(&mut self, node: &FnDecl) {
        // Functions create new scopes
        self.current_scope.push(node.ident.sym.to_string());
        node.visit_children_with(self);
        self.current_scope.pop();
    }
    
    fn visit_ident(&mut self, node: &Ident) {
        let name = node.sym.to_string();
        // Detect store references (variables starting with $)
        if name.starts_with('$') && name.len() > 1 {
            self.store_refs.insert(name[1..].to_string());
        }
        node.visit_children_with(self);
    }
}

fn extract_reactive_statements(module: &Module) -> Result<Vec<ReactiveStatement>> {
    let mut statements = Vec::new();
    let mut counter = 0;
    
    for item in &module.body {
        if let ModuleItem::Stmt(Stmt::Labeled(labeled)) = item {
            if labeled.label.sym == "$" {
                counter += 1;
                let id = format!("reactive_{}", counter);
                
                let mut deps = HashSet::new();
                let mut target_var = None;
                let mut is_assignment = false;
                
                // Analyze the reactive statement
                match &*labeled.body {
                    Stmt::Expr(expr_stmt) => {
                        if let Expr::Assign(assign) = &*expr_stmt.expr {
                            is_assignment = true;
                            if let AssignTarget::Simple(SimpleAssignTarget::Ident(ident)) = &assign.left {
                                target_var = Some(ident.id.sym.to_string());
                            }
                        }
                        // Extract dependencies from the expression
                        let mut dep_visitor = DependencyVisitor::new();
                        expr_stmt.expr.visit_with(&mut dep_visitor);
                        deps = dep_visitor.dependencies;
                    }
                    _ => {}
                }
                
                statements.push(ReactiveStatement {
                    id,
                    dependencies: deps,
                    expression: stmt_to_string(&labeled.body),
                    is_assignment,
                    target_var,
                });
            }
        }
    }
    
    Ok(statements)
}

struct DependencyVisitor {
    dependencies: HashSet<String>,
}

impl DependencyVisitor {
    fn new() -> Self {
        Self {
            dependencies: HashSet::new(),
        }
    }
}

impl Visit for DependencyVisitor {
    fn visit_ident(&mut self, node: &Ident) {
        // Only track identifiers that are not property accesses
        self.dependencies.insert(node.sym.to_string());
    }
    
    fn visit_member_expr(&mut self, node: &MemberExpr) {
        // For member expressions, only visit the object part
        node.obj.visit_with(self);
    }
    
    fn visit_call_expr(&mut self, node: &CallExpr) {
        // Don't track function names as dependencies
        for arg in &node.args {
            arg.expr.visit_with(self);
        }
    }
}

fn build_signal_graph(
    reactive_vars: &HashSet<String>,
    reactive_statements: &[ReactiveStatement],
) -> HashMap<String, Signal> {
    let mut signals = HashMap::new();
    
    // Create a signal for each reactive variable
    for var in reactive_vars {
        signals.insert(
            var.clone(),
            Signal {
                name: var.clone(),
                initial_value: None,
                subscribers: Vec::new(),
            },
        );
    }
    
    // Add reactive statements as subscribers
    for statement in reactive_statements {
        for dep in &statement.dependencies {
            if let Some(signal) = signals.get_mut(dep) {
                signal.subscribers.push(statement.id.clone());
            }
        }
    }
    
    signals
}

fn stmt_to_string(stmt: &Stmt) -> String {
    // Simple conversion for now - in production, use proper codegen
    match stmt {
        Stmt::Expr(expr_stmt) => expr_to_string(&expr_stmt.expr),
        _ => format!("{:?}", stmt),
    }
}

fn expr_to_string(expr: &Expr) -> String {
    match expr {
        Expr::Assign(assign) => {
            let left = match &assign.left {
                AssignTarget::Simple(simple) => match simple {
                    SimpleAssignTarget::Ident(ident) => ident.id.sym.to_string(),
                    _ => format!("{:?}", simple),
                },
                _ => format!("{:?}", assign.left),
            };
            let right = expr_to_string(&assign.right);
            format!("{} = {}", left, right)
        }
        Expr::Bin(bin) => {
            let left = expr_to_string(&bin.left);
            let right = expr_to_string(&bin.right);
            let op = match bin.op {
                BinaryOp::Add => "+",
                BinaryOp::Sub => "-",
                BinaryOp::Mul => "*",
                BinaryOp::Div => "/",
                _ => "?",
            };
            format!("{} {} {}", left, op, right)
        }
        Expr::Ident(ident) => ident.sym.to_string(),
        Expr::Lit(lit) => match lit {
            Lit::Num(n) => n.value.to_string(),
            Lit::Str(s) => format!("'{}'", s.value),
            _ => format!("{:?}", lit),
        },
        _ => format!("{:?}", expr),
    }
}

/// Generate code for reactive updates using fine-grained signals
pub fn generate_reactive_update(
    var_name: &str,
    dependencies: &[DependencyTarget],
    runtime_ref: &str,
) -> String {
    let mut update_code = String::new();
    
    // Generate update function
    update_code.push_str(&format!(
        "function update_{}() {{\n",
        var_name
    ));
    
    for dep in dependencies {
        match &dep.target_type {
            TargetType::TextContent => {
                update_code.push_str(&format!(
                    "  {}.setText({}_{}, {});\n",
                    runtime_ref,
                    dep.node_id,
                    "text",
                    dep.expression
                ));
            }
            TargetType::Attribute(attr) => {
                update_code.push_str(&format!(
                    "  {}.setAttribute({}_{}, '{}', {});\n",
                    runtime_ref,
                    dep.node_id,
                    "el",
                    attr,
                    dep.expression
                ));
            }
            TargetType::Conditional => {
                update_code.push_str(&format!(
                    "  // Update conditional block {}\n",
                    dep.node_id
                ));
            }
            TargetType::Loop => {
                update_code.push_str(&format!(
                    "  // Update loop block {}\n",
                    dep.node_id
                ));
            }
        }
    }
    
    update_code.push_str("}\n");
    
    // Create signal-based reactive setter
    update_code.push_str(&format!(
        r#"
// Create signal for {0}
const {0}_signal = {{
  _value: {0},
  _subscribers: [],
  get value() {{ return this._value; }},
  set value(newValue) {{
    if (this._value !== newValue) {{
      this._value = newValue;
      this._notify();
    }}
  }},
  _notify() {{
    this._subscribers.forEach(fn => fn());
  }},
  subscribe(fn) {{
    this._subscribers.push(fn);
    return () => {{
      const idx = this._subscribers.indexOf(fn);
      if (idx > -1) this._subscribers.splice(idx, 1);
    }};
  }}
}};

// Subscribe the update function
{0}_signal.subscribe(update_{0});

// Create getter/setter on window for compatibility
Object.defineProperty(window, '{0}', {{
  get() {{ return {0}_signal.value; }},
  set(newValue) {{ {0}_signal.value = newValue; }}
}});
"#,
        var_name
    ));
    
    update_code
}
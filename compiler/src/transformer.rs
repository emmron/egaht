use anyhow::Result;
use swc_common::DUMMY_SP;
use swc_ecma_ast::*;
use swc_ecma_utils::quote_ident;
use swc_ecma_visit::{as_folder, noop_visit_mut_type, Fold, VisitMut, VisitMutWith};

use crate::parser::EghComponent;
use crate::template::{TemplateParser, DomNode, NodeKind};
use crate::reactivity::{analyze_reactivity, generate_reactive_update, DependencyTarget, TargetType};
use std::collections::HashMap;

pub fn transform_component(component: EghComponent) -> Result<Module> {
    let mut module = component.script.unwrap_or_else(|| Module {
        span: DUMMY_SP,
        body: vec![],
        shebang: None,
    });
    
    // First, analyze the template to find dependencies
    let mut template_deps = HashMap::new();
    if let Some(ref template) = component.template {
        template_deps = analyze_template_dependencies(template)?;
    }
    
    // Analyze reactivity in the script
    let reactivity_analysis = analyze_reactivity(&module, &template_deps)?;
    
    // Transform reactive variables and statements
    let mut transformer = EghactTransformer::new(reactivity_analysis.reactive_vars.clone());
    module.visit_mut_with(&mut transformer);
    
    // Add runtime import
    let runtime_import = create_runtime_import();
    module.body.insert(0, runtime_import);
    
    // Add component initialization with reactivity
    if let Some(template) = component.template {
        let template_parser = TemplateParser::new(component.file_name.clone());
        let init_fn = create_component_init(
            &template,
            &reactivity_analysis,
            template_parser
        )?;
        module.body.push(init_fn);
        
        // Add reactive update functions
        for (var_name, deps) in &reactivity_analysis.dependencies {
            let update_code = generate_reactive_update(var_name, deps, "runtime");
            // Convert update code string to AST (simplified for now)
            // In production, parse the generated code properly
        }
    }
    
    Ok(module)
}

struct EghactTransformer {
    reactive_vars: Vec<String>,
}

impl EghactTransformer {
    fn new(reactive_vars: Vec<String>) -> Self {
        Self {
            reactive_vars,
        }
    }
}

impl VisitMut for EghactTransformer {
    noop_visit_mut_type!();
    
    fn visit_mut_var_decl(&mut self, var_decl: &mut VarDecl) {
        // Transform let declarations to use signals
        if matches!(var_decl.kind, VarDeclKind::Let) {
            for decl in &mut var_decl.decls {
                if let Pat::Ident(ident) = &decl.name {
                    let var_name = ident.id.sym.to_string();
                    if self.reactive_vars.contains(&var_name) {
                        // Will be transformed to signal in the initialization
                    }
                }
            }
        }
        
        var_decl.visit_mut_children_with(self);
    }
    
    fn visit_mut_labeled_stmt(&mut self, stmt: &mut LabeledStmt) {
        // Transform $: reactive statements
        if stmt.label.sym == "$" {
            // Extract dependencies from the reactive statement
            let deps = extract_dependencies_from_stmt(&stmt.body);
            
            // Create a reactive function that will re-run when dependencies change
            let reactive_fn = create_reactive_function(&stmt.body, &deps);
            
            // Replace the labeled statement with a call to register the reactive function
            *stmt = LabeledStmt {
                span: stmt.span,
                label: Ident::new("__reactive__".into(), DUMMY_SP),
                body: Box::new(Stmt::Expr(ExprStmt {
                    span: DUMMY_SP,
                    expr: Box::new(Expr::Call(CallExpr {
                        span: DUMMY_SP,
                        callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                            span: DUMMY_SP,
                            obj: Box::new(Expr::Ident(quote_ident!("runtime"))),
                            prop: MemberProp::Ident(quote_ident!("registerReactive")),
                        }))),
                        args: vec![
                            ExprOrSpread {
                                spread: None,
                                expr: Box::new(reactive_fn),
                            },
                            ExprOrSpread {
                                spread: None,
                                expr: Box::new(Expr::Array(ArrayLit {
                                    span: DUMMY_SP,
                                    elems: deps.into_iter().map(|dep| {
                                        Some(ExprOrSpread {
                                            spread: None,
                                            expr: Box::new(Expr::Lit(Lit::Str(Str {
                                                span: DUMMY_SP,
                                                value: dep.into(),
                                                raw: None,
                                            }))),
                                        })
                                    }).collect(),
                                })),
                            },
                        ],
                        type_args: None,
                    })),
                })),
            };
        } else {
            stmt.visit_mut_children_with(self);
        }
    }
}

fn create_runtime_import() -> ModuleItem {
    ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
        span: DUMMY_SP,
        specifiers: vec![ImportSpecifier::Named(ImportNamedSpecifier {
            span: DUMMY_SP,
            local: quote_ident!("EghactRuntime"),
            imported: None,
            is_type_only: false,
        })],
        src: Box::new(Str {
            span: DUMMY_SP,
            value: "./eghact_runtime.js".into(),
            raw: None,
        }),
        type_only: false,
        with: None,
    }))
}

fn create_component_init(
    template: &str,
    reactivity: &crate::reactivity::ReactiveAnalysis,
    template_parser: TemplateParser,
) -> Result<ModuleItem> {
    // Parse template into DOM operations
    let mut init_body = vec![
        // const runtime = new EghactRuntime();
        Stmt::Decl(Decl::Var(Box::new(VarDecl {
            span: DUMMY_SP,
            kind: VarDeclKind::Const,
            declare: false,
            decls: vec![VarDeclarator {
                span: DUMMY_SP,
                name: Pat::Ident(BindingIdent {
                    id: quote_ident!("runtime"),
                    type_ann: None,
                }),
                init: Some(Box::new(Expr::New(NewExpr {
                    span: DUMMY_SP,
                    callee: Box::new(Expr::Ident(quote_ident!("EghactRuntime"))),
                    args: Some(vec![]),
                    type_args: None,
                }))),
                definite: false,
            }],
        }))),
    ];
    
    // Add template-generated DOM creation statements
    let template_stmts = template_parser.parse_template(template)?;
    init_body.extend(template_stmts);
    
    Ok(ModuleItem::Stmt(Stmt::Decl(Decl::Fn(FnDecl {
        ident: quote_ident!("initComponent"),
        declare: false,
        function: Box::new(Function {
            params: vec![],
            decorators: vec![],
            span: DUMMY_SP,
            body: Some(BlockStmt {
                span: DUMMY_SP,
                stmts: init_body,
            }),
            is_generator: false,
            is_async: false,
            type_params: None,
            return_type: None,
        }),
    }))))
}

fn analyze_template_dependencies(template: &str) -> Result<HashMap<String, Vec<DependencyTarget>>> {
    let mut deps: HashMap<String, Vec<DependencyTarget>> = HashMap::new();
    let parser = crate::template::TemplateParser::new("temp".to_string());
    let nodes = parser.parse_nodes(template)?;
    
    // Walk the template tree and find reactive bindings
    let mut node_counter = 0;
    analyze_nodes(&nodes, &mut deps, &mut node_counter);
    
    Ok(deps)
}

fn analyze_nodes(
    nodes: &[DomNode],
    deps: &mut HashMap<String, Vec<DependencyTarget>>,
    counter: &mut usize,
) {
    for node in nodes {
        match &node.kind {
            NodeKind::Element { tag, attributes, events } => {
                let node_id = format!("el{}", counter);
                *counter += 1;
                
                // Check attributes for dynamic bindings
                for attr in attributes {
                    if let crate::template::AttributeValue::Dynamic(expr) = &attr.value {
                        // Extract variables from expression
                        let vars = extract_vars_from_expr(expr);
                        for var in vars {
                            deps.entry(var).or_insert_with(Vec::new).push(DependencyTarget {
                                node_id: node_id.clone(),
                                target_type: TargetType::Attribute(attr.name.clone()),
                                expression: expr.clone(),
                            });
                        }
                    }
                }
                
                // Recursively analyze children
                analyze_nodes(&node.children, deps, counter);
            }
            NodeKind::Interpolation(expr) => {
                let node_id = format!("text{}", counter);
                *counter += 1;
                
                let vars = extract_vars_from_expr(expr);
                for var in vars {
                    deps.entry(var).or_insert_with(Vec::new).push(DependencyTarget {
                        node_id: node_id.clone(),
                        target_type: TargetType::TextContent,
                        expression: expr.clone(),
                    });
                }
            }
            NodeKind::If { condition, then_branch, else_branch } => {
                let node_id = format!("if{}", counter);
                *counter += 1;
                
                let vars = extract_vars_from_expr(condition);
                for var in vars {
                    deps.entry(var).or_insert_with(Vec::new).push(DependencyTarget {
                        node_id: node_id.clone(),
                        target_type: TargetType::Conditional,
                        expression: condition.clone(),
                    });
                }
                
                analyze_nodes(then_branch, deps, counter);
                if let Some(else_nodes) = else_branch {
                    analyze_nodes(else_nodes, deps, counter);
                }
            }
            _ => {}
        }
    }
}

fn extract_vars_from_expr(expr: &str) -> Vec<String> {
    // Simple variable extraction - in production, use proper parsing
    let mut vars = Vec::new();
    
    // Split by common operators and delimiters
    let tokens: Vec<&str> = expr.split(|c: char| {
        c.is_whitespace() || "+-*/()[]{},.!?:;<>=&|".contains(c)
    }).collect();
    
    for token in tokens {
        if !token.is_empty() && token.chars().next().unwrap().is_alphabetic() {
            // Basic check - not a number or string literal
            if !token.parse::<f64>().is_ok() && !token.starts_with('"') && !token.starts_with('\'') {
                vars.push(token.to_string());
            }
        }
    }
    
    vars
}

fn extract_dependencies_from_stmt(stmt: &Stmt) -> Vec<String> {
    let mut deps = Vec::new();
    
    // Walk the statement AST to find variable references
    struct DepCollector {
        deps: Vec<String>,
    }
    
    impl VisitMut for DepCollector {
        noop_visit_mut_type!();
        
        fn visit_mut_ident(&mut self, ident: &mut Ident) {
            // Collect identifiers that are likely reactive variables
            let name = ident.sym.to_string();
            if !self.deps.contains(&name) && !is_builtin(&name) {
                self.deps.push(name);
            }
        }
    }
    
    let mut collector = DepCollector { deps: Vec::new() };
    let mut stmt_clone = stmt.clone();
    stmt_clone.visit_mut_with(&mut collector);
    
    collector.deps
}

fn is_builtin(name: &str) -> bool {
    matches!(name, "console" | "window" | "document" | "Math" | "Object" | "Array" | "String" | "Number" | "Boolean")
}

fn create_reactive_function(stmt: &Stmt, deps: &[String]) -> Expr {
    // Create an arrow function that wraps the reactive statement
    Expr::Arrow(ArrowExpr {
        span: DUMMY_SP,
        params: vec![],
        body: Box::new(BlockStmtOrExpr::BlockStmt(BlockStmt {
            span: DUMMY_SP,
            stmts: vec![stmt.clone()],
        })),
        is_async: false,
        is_generator: false,
        type_params: None,
        return_type: None,
    })
}
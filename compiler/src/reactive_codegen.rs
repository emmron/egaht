use anyhow::Result;
use swc_common::DUMMY_SP;
use swc_ecma_ast::*;
use swc_ecma_utils::quote_ident;

use crate::reactivity::{ReactiveAnalysis, DependencyTarget, TargetType, ReactiveStatement};

/// Generate the complete reactive component code
pub fn generate_reactive_component(
    analysis: &ReactiveAnalysis,
    component_init: Vec<Stmt>,
    original_script: &Module,
) -> Result<Module> {
    let mut module = Module {
        span: DUMMY_SP,
        body: vec![],
        shebang: None,
    };
    
    // Import runtime
    module.body.push(create_runtime_import());
    
    // Import store utilities if stores are used
    if !analysis.store_refs.is_empty() {
        module.body.push(create_store_import());
    }
    
    // Create reactive state object
    let state_init = create_state_object(&analysis.reactive_vars);
    module.body.push(ModuleItem::Stmt(state_init));
    
    // Generate signal setters
    for var in &analysis.reactive_vars {
        let setter = generate_signal_setter(var, &analysis.dependencies);
        module.body.push(ModuleItem::Stmt(setter));
    }
    
    // Generate reactive update functions
    for var in &analysis.reactive_vars {
        if let Some(deps) = analysis.dependencies.get(var) {
            let update_fn = generate_update_function(var, deps);
            module.body.push(ModuleItem::Stmt(update_fn));
        }
    }
    
    // Generate reactive statement handlers
    for reactive_stmt in &analysis.reactive_statements {
        let handler = generate_reactive_handler(reactive_stmt, &analysis.reactive_vars);
        module.body.push(ModuleItem::Stmt(handler));
    }
    
    // Add original functions and non-reactive code
    for item in &original_script.body {
        if let ModuleItem::Stmt(stmt) = item {
            match stmt {
                Stmt::Decl(Decl::Var(var_decl)) => {
                    // Skip reactive variable declarations (already handled)
                    if !is_reactive_declaration(var_decl, &analysis.reactive_vars) {
                        module.body.push(item.clone());
                    }
                }
                Stmt::Labeled(labeled) if labeled.label.sym == "$" => {
                    // Skip reactive statements (already handled)
                }
                _ => {
                    module.body.push(item.clone());
                }
            }
        } else {
            module.body.push(item.clone());
        }
    }
    
    // Add component initialization function
    let init_fn = create_component_init_function(component_init, &analysis.reactive_vars);
    module.body.push(ModuleItem::Stmt(init_fn));
    
    // Export component factory
    module.body.push(create_component_export());
    
    Ok(module)
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
            value: "/eghact-runtime.js".into(),
            raw: None,
        }),
        type_only: false,
        with: None,
    }))
}

fn create_state_object(reactive_vars: &HashSet<String>) -> Stmt {
    // const __state = { count: 0, items: [], ... };
    let mut props = vec![];
    
    for var in reactive_vars {
        props.push(PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
            key: PropName::Ident(quote_ident!(var)),
            value: Box::new(Expr::Lit(Lit::Null(Null { span: DUMMY_SP }))),
        }))));
    }
    
    Stmt::Decl(Decl::Var(Box::new(VarDecl {
        span: DUMMY_SP,
        kind: VarDeclKind::Const,
        declare: false,
        decls: vec![VarDeclarator {
            span: DUMMY_SP,
            name: Pat::Ident(BindingIdent {
                id: quote_ident!("__state"),
                type_ann: None,
            }),
            init: Some(Box::new(Expr::Object(ObjectLit {
                span: DUMMY_SP,
                props,
            }))),
            definite: false,
        }],
    })))
}

fn generate_signal_setter(var_name: &str, dependencies: &HashMap<String, Vec<DependencyTarget>>) -> Stmt {
    let update_call = if dependencies.contains_key(var_name) {
        Some(Stmt::Expr(ExprStmt {
            span: DUMMY_SP,
            expr: Box::new(Expr::Call(CallExpr {
                span: DUMMY_SP,
                callee: Callee::Expr(Box::new(Expr::Ident(quote_ident!(&format!("__update_{}", var_name))))),
                args: vec![],
                type_args: None,
            })),
        }))
    } else {
        None
    };
    
    // Object.defineProperty(window, 'count', { ... })
    Stmt::Expr(ExprStmt {
        span: DUMMY_SP,
        expr: Box::new(Expr::Call(CallExpr {
            span: DUMMY_SP,
            callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                span: DUMMY_SP,
                obj: Box::new(Expr::Ident(quote_ident!("Object"))),
                prop: MemberProp::Ident(quote_ident!("defineProperty")),
            }))),
            args: vec![
                ExprOrSpread {
                    spread: None,
                    expr: Box::new(Expr::Ident(quote_ident!("window"))),
                },
                ExprOrSpread {
                    spread: None,
                    expr: Box::new(Expr::Lit(Lit::Str(Str {
                        span: DUMMY_SP,
                        value: var_name.into(),
                        raw: None,
                    }))),
                },
                ExprOrSpread {
                    spread: None,
                    expr: Box::new(Expr::Object(ObjectLit {
                        span: DUMMY_SP,
                        props: vec![
                            // get() { return __state.count; }
                            PropOrSpread::Prop(Box::new(Prop::Method(MethodProp {
                                key: PropName::Ident(quote_ident!("get")),
                                function: Box::new(Function {
                                    params: vec![],
                                    decorators: vec![],
                                    span: DUMMY_SP,
                                    body: Some(BlockStmt {
                                        span: DUMMY_SP,
                                        stmts: vec![Stmt::Return(ReturnStmt {
                                            span: DUMMY_SP,
                                            arg: Some(Box::new(Expr::Member(MemberExpr {
                                                span: DUMMY_SP,
                                                obj: Box::new(Expr::Ident(quote_ident!("__state"))),
                                                prop: MemberProp::Ident(quote_ident!(var_name)),
                                            }))),
                                        })],
                                    }),
                                    is_generator: false,
                                    is_async: false,
                                    type_params: None,
                                    return_type: None,
                                }),
                            }))),
                            // set(value) { __state.count = value; __update_count(); }
                            PropOrSpread::Prop(Box::new(Prop::Method(MethodProp {
                                key: PropName::Ident(quote_ident!("set")),
                                function: Box::new(Function {
                                    params: vec![Param {
                                        span: DUMMY_SP,
                                        decorators: vec![],
                                        pat: Pat::Ident(BindingIdent {
                                            id: quote_ident!("value"),
                                            type_ann: None,
                                        }),
                                    }],
                                    decorators: vec![],
                                    span: DUMMY_SP,
                                    body: Some(BlockStmt {
                                        span: DUMMY_SP,
                                        stmts: {
                                            let mut stmts = vec![
                                                // __state.count = value;
                                                Stmt::Expr(ExprStmt {
                                                    span: DUMMY_SP,
                                                    expr: Box::new(Expr::Assign(AssignExpr {
                                                        span: DUMMY_SP,
                                                        op: AssignOp::Assign,
                                                        left: AssignTarget::Simple(SimpleAssignTarget::Member(MemberExpr {
                                                            span: DUMMY_SP,
                                                            obj: Box::new(Expr::Ident(quote_ident!("__state"))),
                                                            prop: MemberProp::Ident(quote_ident!(var_name)),
                                                        })),
                                                        right: Box::new(Expr::Ident(quote_ident!("value"))),
                                                    })),
                                                }),
                                            ];
                                            
                                            if let Some(update) = update_call {
                                                stmts.push(update);
                                            }
                                            
                                            // Trigger reactive statements
                                            stmts.push(Stmt::Expr(ExprStmt {
                                                span: DUMMY_SP,
                                                expr: Box::new(Expr::Call(CallExpr {
                                                    span: DUMMY_SP,
                                                    callee: Callee::Expr(Box::new(Expr::Ident(quote_ident!("__check_reactive_statements")))),
                                                    args: vec![],
                                                    type_args: None,
                                                })),
                                            }));
                                            
                                            stmts
                                        },
                                    }),
                                    is_generator: false,
                                    is_async: false,
                                    type_params: None,
                                    return_type: None,
                                }),
                            }))),
                        ],
                    })),
                },
            ],
            type_args: None,
        })),
    })
}

fn generate_update_function(var_name: &str, deps: &[DependencyTarget]) -> Stmt {
    let mut update_stmts = vec![];
    
    for dep in deps {
        match &dep.target_type {
            TargetType::TextContent => {
                // runtime.setText(text_1, count);
                update_stmts.push(Stmt::Expr(ExprStmt {
                    span: DUMMY_SP,
                    expr: Box::new(Expr::Call(CallExpr {
                        span: DUMMY_SP,
                        callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                            span: DUMMY_SP,
                            obj: Box::new(Expr::Ident(quote_ident!("runtime"))),
                            prop: MemberProp::Ident(quote_ident!("setText")),
                        }))),
                        args: vec![
                            ExprOrSpread {
                                spread: None,
                                expr: Box::new(Expr::Ident(quote_ident!(&dep.node_id))),
                            },
                            ExprOrSpread {
                                spread: None,
                                expr: Box::new(parse_expression(&dep.expression)),
                            },
                        ],
                        type_args: None,
                    })),
                }));
            }
            TargetType::Attribute(attr_name) => {
                // runtime.setAttribute(el_1, 'class', containerClass);
                update_stmts.push(Stmt::Expr(ExprStmt {
                    span: DUMMY_SP,
                    expr: Box::new(Expr::Call(CallExpr {
                        span: DUMMY_SP,
                        callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                            span: DUMMY_SP,
                            obj: Box::new(Expr::Ident(quote_ident!("runtime"))),
                            prop: MemberProp::Ident(quote_ident!("setAttribute")),
                        }))),
                        args: vec![
                            ExprOrSpread {
                                spread: None,
                                expr: Box::new(Expr::Ident(quote_ident!(&dep.node_id))),
                            },
                            ExprOrSpread {
                                spread: None,
                                expr: Box::new(Expr::Lit(Lit::Str(Str {
                                    span: DUMMY_SP,
                                    value: attr_name.into(),
                                    raw: None,
                                }))),
                            },
                            ExprOrSpread {
                                spread: None,
                                expr: Box::new(parse_expression(&dep.expression)),
                            },
                        ],
                        type_args: None,
                    })),
                }));
            }
            TargetType::Conditional => {
                // Update conditional block
                update_stmts.push(Stmt::Expr(ExprStmt {
                    span: DUMMY_SP,
                    expr: Box::new(Expr::Call(CallExpr {
                        span: DUMMY_SP,
                        callee: Callee::Expr(Box::new(Expr::Ident(quote_ident!(&format!("__update_if_{}", dep.node_id))))),
                        args: vec![],
                        type_args: None,
                    })),
                }));
            }
            TargetType::Loop => {
                // Update loop block
                update_stmts.push(Stmt::Expr(ExprStmt {
                    span: DUMMY_SP,
                    expr: Box::new(Expr::Call(CallExpr {
                        span: DUMMY_SP,
                        callee: Callee::Expr(Box::new(Expr::Ident(quote_ident!(&format!("__update_each_{}", dep.node_id))))),
                        args: vec![],
                        type_args: None,
                    })),
                }));
            }
        }
    }
    
    // function __update_count() { ... }
    Stmt::Decl(Decl::Fn(FnDecl {
        ident: quote_ident!(&format!("__update_{}", var_name)),
        declare: false,
        function: Box::new(Function {
            params: vec![],
            decorators: vec![],
            span: DUMMY_SP,
            body: Some(BlockStmt {
                span: DUMMY_SP,
                stmts: update_stmts,
            }),
            is_generator: false,
            is_async: false,
            type_params: None,
            return_type: None,
        }),
    }))
}

fn generate_reactive_handler(stmt: &ReactiveStatement, reactive_vars: &HashSet<String>) -> Stmt {
    // function __reactive_1() { doubled = count * 2; }
    Stmt::Decl(Decl::Fn(FnDecl {
        ident: quote_ident!(&format!("__{}", stmt.id)),
        declare: false,
        function: Box::new(Function {
            params: vec![],
            decorators: vec![],
            span: DUMMY_SP,
            body: Some(BlockStmt {
                span: DUMMY_SP,
                stmts: vec![
                    // Execute the reactive statement
                    parse_statement(&stmt.expression),
                ],
            }),
            is_generator: false,
            is_async: false,
            type_params: None,
            return_type: None,
        }),
    }))
}

fn create_component_init_function(init_stmts: Vec<Stmt>, reactive_vars: &HashSet<String>) -> Stmt {
    let mut stmts = vec![];
    
    // Create runtime instance
    stmts.push(Stmt::Decl(Decl::Var(Box::new(VarDecl {
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
    }))));
    
    // Add component initialization statements
    stmts.extend(init_stmts);
    
    // Initialize reactive values
    for var in reactive_vars {
        stmts.push(Stmt::Expr(ExprStmt {
            span: DUMMY_SP,
            expr: Box::new(Expr::Call(CallExpr {
                span: DUMMY_SP,
                callee: Callee::Expr(Box::new(Expr::Ident(quote_ident!(&format!("__update_{}", var))))),
                args: vec![],
                type_args: None,
            })),
        }));
    }
    
    // Run initial reactive statements
    stmts.push(Stmt::Expr(ExprStmt {
        span: DUMMY_SP,
        expr: Box::new(Expr::Call(CallExpr {
            span: DUMMY_SP,
            callee: Callee::Expr(Box::new(Expr::Ident(quote_ident!("__check_reactive_statements")))),
            args: vec![],
            type_args: None,
        })),
    }));
    
    // Return root element
    stmts.push(Stmt::Return(ReturnStmt {
        span: DUMMY_SP,
        arg: Some(Box::new(Expr::Ident(quote_ident!("root")))),
    }));
    
    Stmt::Decl(Decl::Fn(FnDecl {
        ident: quote_ident!("createComponent"),
        declare: false,
        function: Box::new(Function {
            params: vec![],
            decorators: vec![],
            span: DUMMY_SP,
            body: Some(BlockStmt {
                span: DUMMY_SP,
                stmts,
            }),
            is_generator: false,
            is_async: false,
            type_params: None,
            return_type: None,
        }),
    }))
}

fn create_component_export() -> ModuleItem {
    // export default createComponent;
    ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultExpr(ExportDefaultExpr {
        span: DUMMY_SP,
        expr: Box::new(Expr::Ident(quote_ident!("createComponent"))),
    }))
}

// Helper functions

fn is_reactive_declaration(var_decl: &VarDecl, reactive_vars: &HashSet<String>) -> bool {
    if !matches!(var_decl.kind, VarDeclKind::Let) {
        return false;
    }
    
    for decl in &var_decl.decls {
        if let Pat::Ident(ident) = &decl.name {
            if reactive_vars.contains(&ident.id.sym.to_string()) {
                return true;
            }
        }
    }
    
    false
}

fn parse_expression(expr_str: &str) -> Expr {
    // Simplified - in real implementation would parse properly
    Expr::Ident(quote_ident!(expr_str))
}

fn parse_statement(stmt_str: &str) -> Stmt {
    // Simplified - in real implementation would parse properly
    Stmt::Expr(ExprStmt {
        span: DUMMY_SP,
        expr: Box::new(Expr::Ident(quote_ident!("placeholder"))),
    })
}

use std::collections::HashSet;

/// Create store import statement
fn create_store_import() -> ModuleItem {
    ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
        span: DUMMY_SP,
        specifiers: vec![
            ImportSpecifier::Named(ImportNamedSpecifier {
                span: DUMMY_SP,
                local: quote_ident!("useStore"),
                imported: None,
                is_type_only: false,
            }),
        ],
        src: Box::new(Str {
            span: DUMMY_SP,
            value: "@eghact/store".into(),
            raw: None,
        }),
        type_only: false,
        with: None,
        phase: Default::default(),
    }))
}

/// Generate store subscription code for components
pub fn generate_store_subscriptions(store_refs: &HashSet<String>) -> Vec<Stmt> {
    let mut stmts = Vec::new();
    
    for store_name in store_refs {
        // Generate: const $storeName = useStore(storeName);
        stmts.push(Stmt::Decl(Decl::Var(Box::new(VarDecl {
            span: DUMMY_SP,
            kind: VarDeclKind::Const,
            declare: false,
            decls: vec![VarDeclarator {
                span: DUMMY_SP,
                name: Pat::Ident(BindingIdent {
                    id: quote_ident!(format!("${}", store_name)),
                    type_ann: None,
                }),
                init: Some(Box::new(Expr::Call(CallExpr {
                    span: DUMMY_SP,
                    callee: Callee::Expr(Box::new(Expr::Ident(quote_ident!("useStore")))),
                    args: vec![ExprOrSpread {
                        spread: None,
                        expr: Box::new(Expr::Ident(quote_ident!(store_name))),
                    }],
                    type_args: None,
                }))),
                definite: false,
            }],
        }))));
    }
    
    stmts
}
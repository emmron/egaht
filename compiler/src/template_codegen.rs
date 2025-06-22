use anyhow::Result;
use swc_common::DUMMY_SP;
use swc_ecma_ast::*;
use swc_ecma_utils::quote_ident;

use crate::template_parser::{TemplateNode, Attribute, AttributeValue, EventHandler};
use crate::codegen::escape_html;

/// Template code generator with built-in XSS protection
pub struct SecureTemplateCodegen {
    component_id: String,
}

impl SecureTemplateCodegen {
    pub fn new(component_id: String) -> Self {
        Self { component_id }
    }
    
    /// Generate secure JavaScript code for template nodes
    pub fn generate_template_code(&self, nodes: &[TemplateNode]) -> Result<Vec<Stmt>> {
        let mut statements = Vec::new();
        
        // Create document fragment
        let root_var = "root";
        statements.push(self.create_fragment_var(root_var));
        
        // Process all nodes with XSS protection
        for (idx, node) in nodes.iter().enumerate() {
            let var_name = format!("node_{}", idx);
            let node_stmts = self.generate_node_code(node, &var_name, root_var)?;
            statements.extend(node_stmts);
        }
        
        // Return the root fragment
        statements.push(self.create_return_stmt(root_var));
        
        Ok(statements)
    }
    
    fn generate_node_code(&self, node: &TemplateNode, var_name: &str, parent_var: &str) -> Result<Vec<Stmt>> {
        let mut stmts = Vec::new();
        
        match node {
            TemplateNode::Element { tag, attributes, children } => {
                // Create element
                stmts.push(self.create_element_stmt(var_name, tag));
                
                // Set attributes with XSS protection
                for attr in attributes {
                    stmts.extend(self.create_secure_attribute_stmts(var_name, attr)?);
                }
                
                // Process children recursively
                for (idx, child) in children.iter().enumerate() {
                    let child_var = format!("{}_child_{}", var_name, idx);
                    let child_stmts = self.generate_node_code(child, &child_var, var_name)?;
                    stmts.extend(child_stmts);
                }
                
                // Append to parent
                stmts.push(self.create_append_stmt(parent_var, var_name));
            }
            TemplateNode::Text(text) => {
                // Create text node with escaped content
                let escaped_text = escape_html(text);
                stmts.push(self.create_text_node_stmt(var_name, &escaped_text));
                stmts.push(self.create_append_stmt(parent_var, var_name));
            }
            TemplateNode::Interpolation { expression, raw_html } => {
                // Create text node for interpolation
                stmts.push(self.create_text_node_stmt(var_name, ""));
                
                // Set text content with XSS protection
                stmts.push(self.create_secure_text_stmt(var_name, expression, *raw_html)?);
                stmts.push(self.create_append_stmt(parent_var, var_name));
            }
            TemplateNode::If { condition, then_branch, else_branch } => {
                // Create conditional rendering with comment placeholders
                stmts.push(self.create_comment_stmt(var_name, &format!("if: {}", condition)));
                stmts.push(self.create_append_stmt(parent_var, var_name));
                
                // Generate conditional logic (simplified for now)
                stmts.push(self.create_if_stmt(condition, then_branch, else_branch)?);
            }
            TemplateNode::Each { items, item_name, index_name, key, children } => {
                // Create loop rendering with comment placeholders
                stmts.push(self.create_comment_stmt(var_name, &format!("each: {} as {}", items, item_name)));
                stmts.push(self.create_append_stmt(parent_var, var_name));
                
                // Generate loop logic (simplified for now)
                stmts.push(self.create_each_stmt(items, item_name, index_name, key, children)?);
            }
        }
        
        Ok(stmts)
    }
    
    fn create_secure_attribute_stmts(&self, var_name: &str, attr: &Attribute) -> Result<Vec<Stmt>> {
        let mut stmts = Vec::new();
        
        match &attr.value {
            AttributeValue::Static(value) => {
                // Static attributes are safe - no user input
                stmts.push(self.create_static_attribute_stmt(var_name, &attr.name, value));
            }
            AttributeValue::Dynamic(expr) => {
                // Dynamic attributes need XSS protection
                stmts.push(self.create_dynamic_attribute_stmt(var_name, &attr.name, expr)?);
            }
            AttributeValue::EventHandler(handler) => {
                // Event handlers are code references, not user content
                stmts.push(self.create_event_listener_stmt(var_name, handler)?);
            }
        }
        
        Ok(stmts)
    }
    
    fn create_secure_text_stmt(&self, var_name: &str, expr: &str, raw_html: bool) -> Result<Stmt> {
        if raw_html {
            // @html directive - bypass escaping (developer's responsibility)
            Ok(Stmt::Expr(ExprStmt {
                span: DUMMY_SP,
                expr: Box::new(Expr::Call(CallExpr {
                    span: DUMMY_SP,
                    callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                        span: DUMMY_SP,
                        obj: Box::new(Expr::Ident(quote_ident!("runtime"))),
                        prop: MemberProp::Ident(quote_ident!("setInnerHTML")),
                    }))),
                    args: vec![
                        ExprOrSpread {
                            spread: None,
                            expr: Box::new(Expr::Ident(Ident::new(var_name.into(), DUMMY_SP))),
                        },
                        ExprOrSpread {
                            spread: None,
                            expr: Box::new(Expr::Ident(Ident::new(expr.into(), DUMMY_SP))),
                        },
                    ],
                    type_args: None,
                })),
            }))
        } else {
            // Default: Escape content for XSS protection
            Ok(Stmt::Expr(ExprStmt {
                span: DUMMY_SP,
                expr: Box::new(Expr::Call(CallExpr {
                    span: DUMMY_SP,
                    callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                        span: DUMMY_SP,
                        obj: Box::new(Expr::Ident(quote_ident!("runtime"))),
                        prop: MemberProp::Ident(quote_ident!("setTextContent")),
                    }))),
                    args: vec![
                        ExprOrSpread {
                            spread: None,
                            expr: Box::new(Expr::Ident(Ident::new(var_name.into(), DUMMY_SP))),
                        },
                        ExprOrSpread {
                            spread: None,
                            expr: Box::new(Expr::Call(CallExpr {
                                span: DUMMY_SP,
                                callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                                    span: DUMMY_SP,
                                    obj: Box::new(Expr::Ident(quote_ident!("runtime"))),
                                    prop: MemberProp::Ident(quote_ident!("escapeHtml")),
                                }))),
                                args: vec![ExprOrSpread {
                                    spread: None,
                                    expr: Box::new(Expr::Ident(Ident::new(expr.into(), DUMMY_SP))),
                                }],
                                type_args: None,
                            })),
                        },
                    ],
                    type_args: None,
                })),
            }))
        }
    }
    
    fn create_dynamic_attribute_stmt(&self, var_name: &str, attr_name: &str, expr: &str) -> Result<Stmt> {
        // For most attributes, escape the value for XSS protection
        let needs_escaping = !matches!(attr_name, "href" | "src" | "action"); // URL attributes need different validation
        
        if needs_escaping {
            Ok(Stmt::Expr(ExprStmt {
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
                            expr: Box::new(Expr::Ident(Ident::new(var_name.into(), DUMMY_SP))),
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
                            expr: Box::new(Expr::Call(CallExpr {
                                span: DUMMY_SP,
                                callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                                    span: DUMMY_SP,
                                    obj: Box::new(Expr::Ident(quote_ident!("runtime"))),
                                    prop: MemberProp::Ident(quote_ident!("escapeHtml")),
                                }))),
                                args: vec![ExprOrSpread {
                                    spread: None,
                                    expr: Box::new(Expr::Ident(Ident::new(expr.into(), DUMMY_SP))),
                                }],
                                type_args: None,
                            })),
                        },
                    ],
                    type_args: None,
                })),
            }))
        } else {
            // URL attributes - use URL validation instead of HTML escaping
            Ok(Stmt::Expr(ExprStmt {
                span: DUMMY_SP,
                expr: Box::new(Expr::Call(CallExpr {
                    span: DUMMY_SP,
                    callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                        span: DUMMY_SP,
                        obj: Box::new(Expr::Ident(quote_ident!("runtime"))),
                        prop: MemberProp::Ident(quote_ident!("setSecureUrlAttribute")),
                    }))),
                    args: vec![
                        ExprOrSpread {
                            spread: None,
                            expr: Box::new(Expr::Ident(Ident::new(var_name.into(), DUMMY_SP))),
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
                            expr: Box::new(Expr::Ident(Ident::new(expr.into(), DUMMY_SP))),
                        },
                    ],
                    type_args: None,
                })),
            }))
        }
    }
    
    // Helper methods (simplified implementations)
    fn create_fragment_var(&self, var_name: &str) -> Stmt {
        Stmt::Decl(Decl::Var(Box::new(VarDecl {
            span: DUMMY_SP,
            kind: VarDeclKind::Const,
            declare: false,
            decls: vec![VarDeclarator {
                span: DUMMY_SP,
                name: Pat::Ident(BindingIdent {
                    id: Ident::new(var_name.into(), DUMMY_SP),
                    type_ann: None,
                }),
                init: Some(Box::new(Expr::Call(CallExpr {
                    span: DUMMY_SP,
                    callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                        span: DUMMY_SP,
                        obj: Box::new(Expr::Ident(quote_ident!("document"))),
                        prop: MemberProp::Ident(quote_ident!("createDocumentFragment")),
                    }))),
                    args: vec![],
                    type_args: None,
                }))),
                definite: false,
            }],
        })))
    }
    
    fn create_element_stmt(&self, var_name: &str, tag: &str) -> Stmt {
        Stmt::Decl(Decl::Var(Box::new(VarDecl {
            span: DUMMY_SP,
            kind: VarDeclKind::Const,
            declare: false,
            decls: vec![VarDeclarator {
                span: DUMMY_SP,
                name: Pat::Ident(BindingIdent {
                    id: Ident::new(var_name.into(), DUMMY_SP),
                    type_ann: None,
                }),
                init: Some(Box::new(Expr::Call(CallExpr {
                    span: DUMMY_SP,
                    callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                        span: DUMMY_SP,
                        obj: Box::new(Expr::Ident(quote_ident!("document"))),
                        prop: MemberProp::Ident(quote_ident!("createElement")),
                    }))),
                    args: vec![ExprOrSpread {
                        spread: None,
                        expr: Box::new(Expr::Lit(Lit::Str(Str {
                            span: DUMMY_SP,
                            value: tag.into(),
                            raw: None,
                        }))),
                    }],
                    type_args: None,
                }))),
                definite: false,
            }],
        })))
    }
    
    fn create_text_node_stmt(&self, var_name: &str, text: &str) -> Stmt {
        Stmt::Decl(Decl::Var(Box::new(VarDecl {
            span: DUMMY_SP,
            kind: VarDeclKind::Const,
            declare: false,
            decls: vec![VarDeclarator {
                span: DUMMY_SP,
                name: Pat::Ident(BindingIdent {
                    id: Ident::new(var_name.into(), DUMMY_SP),
                    type_ann: None,
                }),
                init: Some(Box::new(Expr::Call(CallExpr {
                    span: DUMMY_SP,
                    callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                        span: DUMMY_SP,
                        obj: Box::new(Expr::Ident(quote_ident!("document"))),
                        prop: MemberProp::Ident(quote_ident!("createTextNode")),
                    }))),
                    args: vec![ExprOrSpread {
                        spread: None,
                        expr: Box::new(Expr::Lit(Lit::Str(Str {
                            span: DUMMY_SP,
                            value: text.into(),
                            raw: None,
                        }))),
                    }],
                    type_args: None,
                }))),
                definite: false,
            }],
        })))
    }
    
    fn create_static_attribute_stmt(&self, var_name: &str, attr_name: &str, value: &str) -> Stmt {
        Stmt::Expr(ExprStmt {
            span: DUMMY_SP,
            expr: Box::new(Expr::Call(CallExpr {
                span: DUMMY_SP,
                callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                    span: DUMMY_SP,
                    obj: Box::new(Expr::Ident(Ident::new(var_name.into(), DUMMY_SP))),
                    prop: MemberProp::Ident(quote_ident!("setAttribute")),
                }))),
                args: vec![
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
                        expr: Box::new(Expr::Lit(Lit::Str(Str {
                            span: DUMMY_SP,
                            value: value.into(),
                            raw: None,
                        }))),
                    },
                ],
                type_args: None,
            })),
        })
    }
    
    fn create_event_listener_stmt(&self, var_name: &str, handler: &EventHandler) -> Result<Stmt> {
        Ok(Stmt::Expr(ExprStmt {
            span: DUMMY_SP,
            expr: Box::new(Expr::Call(CallExpr {
                span: DUMMY_SP,
                callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                    span: DUMMY_SP,
                    obj: Box::new(Expr::Ident(Ident::new(var_name.into(), DUMMY_SP))),
                    prop: MemberProp::Ident(quote_ident!("addEventListener")),
                }))),
                args: vec![
                    ExprOrSpread {
                        spread: None,
                        expr: Box::new(Expr::Lit(Lit::Str(Str {
                            span: DUMMY_SP,
                            value: handler.event.clone().into(),
                            raw: None,
                        }))),
                    },
                    ExprOrSpread {
                        spread: None,
                        expr: Box::new(Expr::Ident(Ident::new(handler.handler.clone().into(), DUMMY_SP))),
                    },
                ],
                type_args: None,
            })),
        }))
    }
    
    fn create_append_stmt(&self, parent_var: &str, child_var: &str) -> Stmt {
        Stmt::Expr(ExprStmt {
            span: DUMMY_SP,
            expr: Box::new(Expr::Call(CallExpr {
                span: DUMMY_SP,
                callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                    span: DUMMY_SP,
                    obj: Box::new(Expr::Ident(Ident::new(parent_var.into(), DUMMY_SP))),
                    prop: MemberProp::Ident(quote_ident!("appendChild")),
                }))),
                args: vec![ExprOrSpread {
                    spread: None,
                    expr: Box::new(Expr::Ident(Ident::new(child_var.into(), DUMMY_SP))),
                }],
                type_args: None,
            })),
        })
    }
    
    fn create_return_stmt(&self, var_name: &str) -> Stmt {
        Stmt::Return(ReturnStmt {
            span: DUMMY_SP,
            arg: Some(Box::new(Expr::Ident(Ident::new(var_name.into(), DUMMY_SP)))),
        })
    }
    
    fn create_comment_stmt(&self, var_name: &str, text: &str) -> Stmt {
        Stmt::Decl(Decl::Var(Box::new(VarDecl {
            span: DUMMY_SP,
            kind: VarDeclKind::Const,
            declare: false,
            decls: vec![VarDeclarator {
                span: DUMMY_SP,
                name: Pat::Ident(BindingIdent {
                    id: Ident::new(var_name.into(), DUMMY_SP),
                    type_ann: None,
                }),
                init: Some(Box::new(Expr::Call(CallExpr {
                    span: DUMMY_SP,
                    callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                        span: DUMMY_SP,
                        obj: Box::new(Expr::Ident(quote_ident!("document"))),
                        prop: MemberProp::Ident(quote_ident!("createComment")),
                    }))),
                    args: vec![ExprOrSpread {
                        spread: None,
                        expr: Box::new(Expr::Lit(Lit::Str(Str {
                            span: DUMMY_SP,
                            value: text.into(),
                            raw: None,
                        }))),
                    }],
                    type_args: None,
                }))),
                definite: false,
            }],
        })))
    }
    
    fn create_if_stmt(&self, _condition: &str, _then_branch: &[TemplateNode], _else_branch: &Option<Vec<TemplateNode>>) -> Result<Stmt> {
        // Simplified - would need full conditional rendering logic
        Ok(Stmt::Expr(ExprStmt {
            span: DUMMY_SP,
            expr: Box::new(Expr::Lit(Lit::Str(Str {
                span: DUMMY_SP,
                value: "// TODO: Conditional rendering".into(),
                raw: None,
            }))),
        }))
    }
    
    fn create_each_stmt(&self, _items: &str, _item_name: &str, _index_name: &Option<String>, _key: &Option<String>, _children: &[TemplateNode]) -> Result<Stmt> {
        // Simplified - would need full loop rendering logic
        Ok(Stmt::Expr(ExprStmt {
            span: DUMMY_SP,
            expr: Box::new(Expr::Lit(Lit::Str(Str {
                span: DUMMY_SP,
                value: "// TODO: Loop rendering".into(),
                raw: None,
            }))),
        }))
    }
}
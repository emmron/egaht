use anyhow::{Result, Context};
use swc_common::DUMMY_SP;
use swc_ecma_ast::*;
use swc_ecma_utils::quote_ident;
use swc_ecma_parser::{lexer::Lexer, Parser as SwcParser, StringInput, Syntax};
use swc_common::SourceMap;

pub struct TemplateParser {
    component_id: String,
}

impl TemplateParser {
    pub fn new(component_id: String) -> Self {
        Self { component_id }
    }
    
    pub fn parse_template(&self, template: &str) -> Result<Vec<Stmt>> {
        let mut statements = Vec::new();
        
        // Parse template into DOM tree
        let dom_tree = self.parse_nodes(template)?;
        
        // Generate DOM creation statements
        let root_var = "root";
        statements.push(self.create_fragment_var(root_var));
        
        for (idx, node) in dom_tree.iter().enumerate() {
            let var_name = format!("el{}", idx);
            let create_stmts = self.generate_node_creation(node, &var_name, root_var)?;
            statements.extend(create_stmts);
        }
        
        // Return the root fragment
        statements.push(self.create_return_stmt(root_var));
        
        Ok(statements)
    }
    
    pub fn parse_nodes(&self, input: &str) -> Result<Vec<DomNode>> {
        let mut parser = HtmlParser::new(input);
        parser.parse_nodes()
    }
    
    fn create_fragment_var(&self, var_name: &str) -> Stmt {
        // const root = document.createDocumentFragment();
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
    
    fn create_return_stmt(&self, var_name: &str) -> Stmt {
        // return root;
        Stmt::Return(ReturnStmt {
            span: DUMMY_SP,
            arg: Some(Box::new(Expr::Ident(Ident::new(var_name.into(), DUMMY_SP)))),
        })
    }
    
    fn generate_node_creation(&self, node: &DomNode, var_name: &str, parent_var: &str) -> Result<Vec<Stmt>> {
        let mut stmts = Vec::new();
        
        match &node.kind {
            NodeKind::Element { tag, attributes, events } => {
                // Create element
                stmts.push(self.create_element_stmt(var_name, tag));
                
                // Set attributes
                for attr in attributes {
                    stmts.push(self.create_attribute_stmt(var_name, attr)?); 
                }
                
                // Add event listeners
                for event in events {
                    stmts.push(self.create_event_listener_stmt(var_name, event)?); 
                }
                
                // Process children
                for (idx, child) in node.children.iter().enumerate() {
                    let child_var = format!("{}_{}", var_name, idx);
                    let child_stmts = self.generate_node_creation(child, &child_var, var_name)?;
                    stmts.extend(child_stmts);
                }
                
                // Append to parent
                stmts.push(self.create_append_stmt(parent_var, var_name));
            }
            NodeKind::Text(text) => {
                stmts.push(self.create_text_node_stmt(var_name, text));
                stmts.push(self.create_append_stmt(parent_var, var_name));
            }
            NodeKind::Interpolation(expr) => {
                stmts.push(self.create_text_node_stmt(var_name, ""));
                stmts.push(self.create_reactive_text_stmt(var_name, expr)?); 
                stmts.push(self.create_append_stmt(parent_var, var_name));
            }
            NodeKind::If { condition, then_branch, else_branch } => {
                // TODO: Implement conditional rendering
                stmts.push(self.create_comment_stmt(
                    var_name, 
                    &format!("if: {}", condition)
                ));
            }
            _ => {}
        }
        
        Ok(stmts)
    }
    
    fn create_element_stmt(&self, var_name: &str, tag: &str) -> Stmt {
        // const el0 = runtime.createElement('div');
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
                        obj: Box::new(Expr::Ident(quote_ident!("runtime"))),
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
        // const text0 = runtime.createTextNode('Hello');
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
                        obj: Box::new(Expr::Ident(quote_ident!("runtime"))),
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
    
    fn create_append_stmt(&self, parent_var: &str, child_var: &str) -> Stmt {
        // runtime.appendChild(parent, child);
        Stmt::Expr(ExprStmt {
            span: DUMMY_SP,
            expr: Box::new(Expr::Call(CallExpr {
                span: DUMMY_SP,
                callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                    span: DUMMY_SP,
                    obj: Box::new(Expr::Ident(quote_ident!("runtime"))),
                    prop: MemberProp::Ident(quote_ident!("appendChild")),
                }))),
                args: vec![
                    ExprOrSpread {
                        spread: None,
                        expr: Box::new(Expr::Ident(Ident::new(parent_var.into(), DUMMY_SP))),
                    },
                    ExprOrSpread {
                        spread: None,
                        expr: Box::new(Expr::Ident(Ident::new(child_var.into(), DUMMY_SP))),
                    },
                ],
                type_args: None,
            })),
        })
    }
    
    fn create_attribute_stmt(&self, var_name: &str, attr: &Attribute) -> Result<Stmt> {
        match &attr.value {
            AttributeValue::Static(value) => {
                // runtime.setAttribute(el, 'class', 'counter');
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
                                    value: attr.name.clone().into(),
                                    raw: None,
                                }))),
                            },
                            ExprOrSpread {
                                spread: None,
                                expr: Box::new(Expr::Lit(Lit::Str(Str {
                                    span: DUMMY_SP,
                                    value: value.clone().into(),
                                    raw: None,
                                }))),
                            },
                        ],
                        type_args: None,
                    })),
                }))
            }
            AttributeValue::Dynamic(expr) => {
                // TODO: Parse and set dynamic attribute
                Ok(self.create_comment_stmt(var_name, &format!("dynamic attr: {} = {}", attr.name, expr)))
            }
        }
    }
    
    fn create_event_listener_stmt(&self, var_name: &str, event: &EventHandler) -> Result<Stmt> {
        // runtime.addEventListener(el, 'click', increment);
        Ok(Stmt::Expr(ExprStmt {
            span: DUMMY_SP,
            expr: Box::new(Expr::Call(CallExpr {
                span: DUMMY_SP,
                callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                    span: DUMMY_SP,
                    obj: Box::new(Expr::Ident(quote_ident!("runtime"))),
                    prop: MemberProp::Ident(quote_ident!("addEventListener")),
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
                            value: event.event.clone().into(),
                            raw: None,
                        }))),
                    },
                    ExprOrSpread {
                        spread: None,
                        expr: Box::new(Expr::Ident(Ident::new(event.handler.clone().into(), DUMMY_SP))),
                    },
                ],
                type_args: None,
            })),
        }))
    }
    
    fn create_reactive_text_stmt(&self, var_name: &str, expr: &str) -> Result<Stmt> {
        // runtime.setText(text0, count);
        Ok(Stmt::Expr(ExprStmt {
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
    }
    
    fn create_safe_reactive_text_stmt(&self, var_name: &str, expr: &str, raw_html: bool) -> Result<Stmt> {
        // For XSS protection: runtime.setText(text0, runtime.escapeHtml(count)) OR runtime.setTextRaw(text0, count)
        let method_name = if raw_html { "setTextRaw" } else { "setText" };
        let text_expr = if raw_html {
            // Raw HTML - no escaping, use expression directly
            Box::new(Expr::Ident(Ident::new(expr.into(), DUMMY_SP)))
        } else {
            // Escaped HTML - wrap expression in escapeHtml call
            Box::new(Expr::Call(CallExpr {
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
            }))
        };
        
        Ok(Stmt::Expr(ExprStmt {
            span: DUMMY_SP,
            expr: Box::new(Expr::Call(CallExpr {
                span: DUMMY_SP,
                callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                    span: DUMMY_SP,
                    obj: Box::new(Expr::Ident(quote_ident!("runtime"))),
                    prop: MemberProp::Ident(Ident::new(method_name.into(), DUMMY_SP)),
                }))),
                args: vec![
                    ExprOrSpread {
                        spread: None,
                        expr: Box::new(Expr::Ident(Ident::new(var_name.into(), DUMMY_SP))),
                    },
                    ExprOrSpread {
                        spread: None,
                        expr: text_expr,
                    },
                ],
                type_args: None,
            })),
        }))
    }
    
    fn create_comment_stmt(&self, var_name: &str, text: &str) -> Stmt {
        // const comment0 = document.createComment('if: count > 10');
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
}

#[derive(Debug, Clone)]
pub struct DomNode {
    pub kind: NodeKind,
    pub children: Vec<DomNode>,
}

#[derive(Debug, Clone)]
pub enum NodeKind {
    Element {
        tag: String,
        attributes: Vec<Attribute>,
        events: Vec<EventHandler>,
    },
    Text(String),
    Interpolation(String),
    If {
        condition: String,
        then_branch: Vec<DomNode>,
        else_branch: Option<Vec<DomNode>>,
    },
    Each {
        expr: String,
        item_name: String,
        children: Vec<DomNode>,
    },
}

#[derive(Debug, Clone)]
pub struct Attribute {
    pub name: String,
    pub value: AttributeValue,
}

#[derive(Debug, Clone)]
pub enum AttributeValue {
    Static(String),
    Dynamic(String),
}

#[derive(Debug, Clone)]
pub struct EventHandler {
    pub event: String,
    pub handler: String,
}

// HTML Parser implementation
pub struct HtmlParser<'a> {
    input: &'a str,
    pos: usize,
}

impl<'a> HtmlParser<'a> {
    pub fn new(input: &'a str) -> Self {
        Self { input, pos: 0 }
    }
    
    pub fn parse_nodes(&mut self) -> Result<Vec<DomNode>> {
        let mut nodes = Vec::new();
        
        while self.pos < self.input.len() {
            self.skip_whitespace();
            
            if self.peek_str("</") {
                // End of parent element
                break;
            } else if self.peek_str("{#if") {
                nodes.push(self.parse_if_block()?);
            } else if self.peek_str("{#each") {
                nodes.push(self.parse_each_block()?);
            } else if self.peek_char('<') {
                nodes.push(self.parse_element()?);
            } else if self.peek_char('{') {
                nodes.push(self.parse_interpolation()?);
            } else {
                nodes.push(self.parse_text()?);
            }
        }
        
        Ok(nodes)
    }
    
    fn parse_element(&mut self) -> Result<DomNode> {
        self.expect_char('<')?;
        
        let tag = self.parse_tag_name()?;
        let (attributes, events) = self.parse_attributes()?;
        
        self.skip_whitespace();
        
        let children = if self.consume_str("/>") {
            // Self-closing tag
            vec![]
        } else {
            self.expect_char('>')?;
            let children = self.parse_nodes()?;
            
            // Parse closing tag
            self.expect_str("</")?;
            let closing_tag = self.parse_tag_name()?;
            if closing_tag != tag {
                anyhow::bail!("Mismatched closing tag: expected </{}>", tag);
            }
            self.expect_char('>')?;
            
            children
        };
        
        Ok(DomNode {
            kind: NodeKind::Element { tag, attributes, events },
            children,
        })
    }
    
    fn parse_interpolation(&mut self) -> Result<DomNode> {
        self.expect_char('{')?;
        
        let start = self.pos;
        let mut brace_count = 1;
        
        while self.pos < self.input.len() && brace_count > 0 {
            match self.current_char() {
                '{' => brace_count += 1,
                '}' => brace_count -= 1,
                _ => {}
            }
            if brace_count > 0 {
                self.pos += 1;
            }
        }
        
        let expr = self.input[start..self.pos].trim().to_string();
        self.expect_char('}')?;
        
        Ok(DomNode {
            kind: NodeKind::Interpolation(expr),
            children: vec![],
        })
    }
    
    fn parse_if_block(&mut self) -> Result<DomNode> {
        self.expect_str("{#if")?;
        self.skip_whitespace();
        
        // Parse condition
        let condition = self.parse_until('}')?;
        self.expect_char('}')?;
        
        // Parse then branch
        let then_branch = self.parse_nodes()?;
        
        // Check for else branch
        let else_branch = if self.peek_str("{:else}") {
            self.consume_str("{:else}")?;
            Some(self.parse_nodes()?)
        } else {
            None
        };
        
        // Parse closing tag
        self.expect_str("{/if}")?;
        
        Ok(DomNode {
            kind: NodeKind::If { condition, then_branch, else_branch },
            children: vec![],
        })
    }
    
    fn parse_each_block(&mut self) -> Result<DomNode> {
        self.expect_str("{#each")?;
        self.skip_whitespace();
        
        // Parse expression and item name
        let expr_part = self.parse_until('}')?;
        self.expect_char('}')?;
        
        // Extract item name from expression (e.g., "items as item")
        let parts: Vec<&str> = expr_part.split(" as ").collect();
        let expr = parts[0].trim().to_string();
        let item_name = parts.get(1).unwrap_or(&"item").trim().to_string();
        
        // Parse children
        let children = self.parse_nodes()?;
        
        // Parse closing tag
        self.expect_str("{/each}")?;
        
        Ok(DomNode {
            kind: NodeKind::Each { expr, item_name, children },
            children: vec![],
        })
    }
    
    fn parse_text(&mut self) -> Result<DomNode> {
        let start = self.pos;
        
        while self.pos < self.input.len() {
            if self.peek_char('<') || self.peek_char('{') {
                break;
            }
            self.pos += 1;
        }
        
        let text = self.input[start..self.pos].to_string();
        Ok(DomNode {
            kind: NodeKind::Text(text),
            children: vec![],
        })
    }
    
    fn parse_tag_name(&mut self) -> Result<String> {
        let start = self.pos;
        
        while self.pos < self.input.len() {
            let ch = self.current_char();
            if ch.is_alphanumeric() || ch == '-' || ch == '_' {
                self.pos += 1;
            } else {
                break;
            }
        }
        
        if start == self.pos {
            anyhow::bail!("Expected tag name");
        }
        
        Ok(self.input[start..self.pos].to_string())
    }
    
    fn parse_attributes(&mut self) -> Result<(Vec<Attribute>, Vec<EventHandler>)> {
        let mut attributes = Vec::new();
        let mut events = Vec::new();
        
        loop {
            self.skip_whitespace();
            
            if self.peek_char('>') || self.peek_str("/>") {
                break;
            }
            
            if self.peek_char('@') {
                events.push(self.parse_event_handler()?);
            } else {
                attributes.push(self.parse_attribute()?);
            }
        }
        
        Ok((attributes, events))
    }
    
    fn parse_attribute(&mut self) -> Result<Attribute> {
        let name = self.parse_attribute_name()?;
        
        self.skip_whitespace();
        
        let value = if self.consume_char('=') {
            self.skip_whitespace();
            
            if self.peek_char('{') {
                // Dynamic binding {value}
                self.pos += 1;
                let expr = self.parse_until('}')?;
                self.expect_char('}')?;
                AttributeValue::Dynamic(expr)
            } else if self.peek_char('"') {
                // Quoted string
                self.pos += 1;
                let value = self.parse_until('"')?;
                self.expect_char('"')?;
                AttributeValue::Static(value)
            } else {
                // Unquoted value
                let start = self.pos;
                while self.pos < self.input.len() {
                    let ch = self.current_char();
                    if ch.is_whitespace() || ch == '>' || ch == '/' {
                        break;
                    }
                    self.pos += 1;
                }
                let value = self.input[start..self.pos].to_string();
                AttributeValue::Static(value)
            }
        } else {
            // Boolean attribute
            AttributeValue::Static("true".to_string())
        };
        
        Ok(Attribute { name, value })
    }
    
    fn parse_event_handler(&mut self) -> Result<EventHandler> {
        self.expect_char('@')?;
        
        let event = self.parse_attribute_name()?;
        self.skip_whitespace();
        self.expect_char('=')?;
        self.skip_whitespace();
        
        if self.peek_char('{') {
            self.pos += 1;
            let handler = self.parse_until('}')?;
            self.expect_char('}')?;
            Ok(EventHandler { event, handler })
        } else {
            anyhow::bail!("Event handler must be in curly braces");
        }
    }
    
    fn parse_attribute_name(&mut self) -> Result<String> {
        let start = self.pos;
        
        while self.pos < self.input.len() {
            let ch = self.current_char();
            if ch.is_alphanumeric() || ch == '-' || ch == '_' || ch == ':' {
                self.pos += 1;
            } else {
                break;
            }
        }
        
        if start == self.pos {
            anyhow::bail!("Expected attribute name");
        }
        
        Ok(self.input[start..self.pos].to_string())
    }
    
    fn parse_until(&mut self, delimiter: char) -> Result<String> {
        let start = self.pos;
        
        while self.pos < self.input.len() && self.current_char() != delimiter {
            self.pos += 1;
        }
        
        Ok(self.input[start..self.pos].to_string())
    }
    
    // Helper methods
    fn current_char(&self) -> char {
        self.input.chars().nth(self.pos).unwrap_or('\0')
    }
    
    fn peek_char(&self, ch: char) -> bool {
        self.current_char() == ch
    }
    
    fn peek_str(&self, s: &str) -> bool {
        self.input[self.pos..].starts_with(s)
    }
    
    fn consume_char(&mut self, ch: char) -> bool {
        if self.peek_char(ch) {
            self.pos += 1;
            true
        } else {
            false
        }
    }
    
    fn consume_str(&mut self, s: &str) -> bool {
        if self.peek_str(s) {
            self.pos += s.len();
            true
        } else {
            false
        }
    }
    
    fn expect_char(&mut self, ch: char) -> Result<()> {
        if self.consume_char(ch) {
            Ok(())
        } else {
            anyhow::bail!("Expected '{}' at position {}", ch, self.pos)
        }
    }
    
    fn expect_str(&mut self, s: &str) -> Result<()> {
        if self.consume_str(s) {
            Ok(())
        } else {
            anyhow::bail!("Expected '{}' at position {}", s, self.pos)
        }
    }
    
    fn skip_whitespace(&mut self) {
        while self.pos < self.input.len() && self.current_char().is_whitespace() {
            self.pos += 1;
        }
    }
}
use anyhow::Result;
use swc_common::DUMMY_SP;
use swc_ecma_ast::*;
use crate::template_parser::{TemplateNode, EventHandler, AttributeValue};
use crate::component_parser::{ComponentUsage, PropValue};

#[derive(Debug, Clone)]
pub struct EghactAST {
    pub imports: Vec<ImportDecl>,
    pub component_name: String,
    pub props: Vec<PropDefinition>,
    pub state_vars: Vec<StateVariable>,
    pub reactive_statements: Vec<ReactiveStatement>,
    pub lifecycle_hooks: Vec<LifecycleHook>,
    pub methods: Vec<MethodDefinition>,
    pub template: TemplateAST,
    pub styles: Vec<StyleRule>,
}

#[derive(Debug, Clone)]
pub struct PropDefinition {
    pub name: String,
    pub default_value: Option<Expr>,
    pub prop_type: Option<String>,
}

#[derive(Debug, Clone)]
pub struct StateVariable {
    pub name: String,
    pub initial_value: Option<Expr>,
    pub is_reactive: bool,
}

#[derive(Debug, Clone)]
pub struct ReactiveStatement {
    pub dependencies: Vec<String>,
    pub body: Stmt,
}

#[derive(Debug, Clone)]
pub struct LifecycleHook {
    pub hook_type: String, // onMount, onDestroy, etc.
    pub body: BlockStmt,
}

#[derive(Debug, Clone)]
pub struct MethodDefinition {
    pub name: String,
    pub params: Vec<Pat>,
    pub body: BlockStmt,
    pub is_async: bool,
}

#[derive(Debug, Clone)]
pub struct TemplateAST {
    pub root_nodes: Vec<TemplateNodeAST>,
}

#[derive(Debug, Clone)]
pub enum TemplateNodeAST {
    Element {
        tag: String,
        attributes: Vec<AttributeAST>,
        children: Vec<TemplateNodeAST>,
        key: Option<String>,
    },
    Text(String),
    Interpolation {
        expression: Expr,
        raw_html: bool,
    },
    Component {
        name: String,
        props: Vec<PropAST>,
        slots: Vec<SlotAST>,
    },
    If {
        condition: Expr,
        then_branch: Vec<TemplateNodeAST>,
        else_branch: Option<Vec<TemplateNodeAST>>,
    },
    Each {
        items: Expr,
        item_binding: Pat,
        index_binding: Option<Pat>,
        key_expr: Option<Expr>,
        children: Vec<TemplateNodeAST>,
    },
    Slot {
        name: Option<String>,
        fallback: Vec<TemplateNodeAST>,
    },
}

#[derive(Debug, Clone)]
pub struct AttributeAST {
    pub name: String,
    pub value: AttributeValueAST,
}

#[derive(Debug, Clone)]
pub enum AttributeValueAST {
    Static(String),
    Dynamic(Expr),
    EventHandler {
        event: String,
        modifiers: Vec<String>,
        handler: Expr,
    },
}

#[derive(Debug, Clone)]
pub struct PropAST {
    pub name: String,
    pub value: PropValueAST,
}

#[derive(Debug, Clone)]
pub enum PropValueAST {
    Static(String),
    Dynamic(Expr),
    Shorthand(String),
}

#[derive(Debug, Clone)]
pub struct SlotAST {
    pub name: Option<String>,
    pub content: Vec<TemplateNodeAST>,
}

#[derive(Debug, Clone)]
pub struct StyleRule {
    pub selector: String,
    pub declarations: Vec<StyleDeclaration>,
    pub is_scoped: bool,
}

#[derive(Debug, Clone)]
pub struct StyleDeclaration {
    pub property: String,
    pub value: String,
}

pub fn generate_ast(
    template_nodes: Vec<TemplateNode>,
    script_module: Option<Module>,
    styles: Option<String>,
    filename: &str,
) -> Result<EghactAST> {
    let mut ast = EghactAST {
        imports: Vec::new(),
        component_name: extract_component_name(filename),
        props: Vec::new(),
        state_vars: Vec::new(),
        reactive_statements: Vec::new(),
        lifecycle_hooks: Vec::new(),
        methods: Vec::new(),
        template: TemplateAST {
            root_nodes: Vec::new(),
        },
        styles: Vec::new(),
    };
    
    // Process script section
    if let Some(module) = script_module {
        process_script_ast(&mut ast, module)?;
    }
    
    // Process template section
    ast.template.root_nodes = convert_template_nodes(template_nodes)?;
    
    // Process styles section
    if let Some(style_content) = styles {
        ast.styles = parse_styles(&style_content)?;
    }
    
    Ok(ast)
}

fn extract_component_name(filename: &str) -> String {
    filename
        .split('/')
        .last()
        .unwrap_or("Component")
        .split('.')
        .next()
        .unwrap_or("Component")
        .to_string()
}

fn process_script_ast(ast: &mut EghactAST, module: Module) -> Result<()> {
    for item in module.body {
        match item {
            ModuleItem::ModuleDecl(ModuleDecl::Import(import)) => {
                ast.imports.push(import);
            }
            ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export)) => {
                match export.decl {
                    Decl::Var(var_decl) => {
                        for decl in var_decl.decls {
                            if let Pat::Ident(ident) = &decl.name {
                                ast.props.push(PropDefinition {
                                    name: ident.id.sym.to_string(),
                                    default_value: decl.init.map(|e| *e),
                                    prop_type: None,
                                });
                            }
                        }
                    }
                    Decl::Fn(fn_decl) => {
                        let name = fn_decl.ident.sym.to_string();
                        if name == "load" {
                            // Special data loading function
                            ast.lifecycle_hooks.push(LifecycleHook {
                                hook_type: "load".to_string(),
                                body: fn_decl.function.body.unwrap_or_default(),
                            });
                        }
                    }
                    _ => {}
                }
            }
            ModuleItem::Stmt(stmt) => {
                process_statement(ast, stmt)?;
            }
            _ => {}
        }
    }
    
    Ok(())
}

fn process_statement(ast: &mut EghactAST, stmt: Stmt) -> Result<()> {
    match stmt {
        Stmt::Decl(Decl::Var(var_decl)) => {
            for decl in var_decl.decls {
                if let Pat::Ident(ident) = &decl.name {
                    ast.state_vars.push(StateVariable {
                        name: ident.id.sym.to_string(),
                        initial_value: decl.init.map(|e| *e),
                        is_reactive: matches!(var_decl.kind, VarDeclKind::Let),
                    });
                }
            }
        }
        Stmt::Labeled(labeled) if labeled.label.sym == "$" => {
            // Reactive statement
            let deps = extract_dependencies(&labeled.body);
            ast.reactive_statements.push(ReactiveStatement {
                dependencies: deps,
                body: *labeled.body,
            });
        }
        Stmt::Decl(Decl::Fn(fn_decl)) => {
            let name = fn_decl.ident.sym.to_string();
            
            // Check for lifecycle hooks
            if matches!(name.as_str(), "onMount" | "onDestroy" | "beforeUpdate" | "afterUpdate") {
                ast.lifecycle_hooks.push(LifecycleHook {
                    hook_type: name,
                    body: fn_decl.function.body.unwrap_or_default(),
                });
            } else {
                // Regular method
                ast.methods.push(MethodDefinition {
                    name,
                    params: fn_decl.function.params,
                    body: fn_decl.function.body.unwrap_or_default(),
                    is_async: fn_decl.function.is_async,
                });
            }
        }
        _ => {}
    }
    
    Ok(())
}

fn convert_template_nodes(nodes: Vec<TemplateNode>) -> Result<Vec<TemplateNodeAST>> {
    nodes.into_iter().map(convert_template_node).collect()
}

fn convert_template_node(node: TemplateNode) -> Result<TemplateNodeAST> {
    Ok(match node {
        TemplateNode::Element { tag, attributes, children } => {
            // Check if it's a component (uppercase or known component)
            let is_component = tag.chars().next().map(|c| c.is_uppercase()).unwrap_or(false);
            
            if is_component {
                // Convert to component node
                let mut props = Vec::new();
                let mut slots = Vec::new();
                
                for attr in attributes {
                    props.push(PropAST {
                        name: attr.name,
                        value: match attr.value {
                            AttributeValue::Static(s) => PropValueAST::Static(s),
                            AttributeValue::Dynamic(s) => PropValueAST::Dynamic(parse_expr(&s)?),
                            AttributeValue::EventHandler(handler) => {
                                PropValueAST::Dynamic(parse_expr(&handler.handler)?)
                            }
                        },
                    });
                }
                
                // Group children by slot
                let slot_content = group_children_by_slot(children)?;
                for (slot_name, content) in slot_content {
                    slots.push(SlotAST {
                        name: slot_name,
                        content: convert_template_nodes(content)?,
                    });
                }
                
                TemplateNodeAST::Component {
                    name: tag,
                    props,
                    slots,
                }
            } else if tag == "slot" {
                // Slot definition
                let name = attributes.iter()
                    .find(|a| a.name == "name")
                    .and_then(|a| match &a.value {
                        AttributeValue::Static(s) => Some(s.clone()),
                        _ => None,
                    });
                
                TemplateNodeAST::Slot {
                    name,
                    fallback: convert_template_nodes(children)?,
                }
            } else {
                // Regular element
                let attrs = attributes.into_iter().map(|attr| {
                    Ok(AttributeAST {
                        name: attr.name,
                        value: match attr.value {
                            AttributeValue::Static(s) => AttributeValueAST::Static(s),
                            AttributeValue::Dynamic(s) => AttributeValueAST::Dynamic(parse_expr(&s)?),
                            AttributeValue::EventHandler(handler) => AttributeValueAST::EventHandler {
                                event: handler.event,
                                modifiers: handler.modifiers,
                                handler: parse_expr(&handler.handler)?,
                            },
                        },
                    })
                }).collect::<Result<Vec<_>>>()?;
                
                TemplateNodeAST::Element {
                    tag,
                    attributes: attrs,
                    children: convert_template_nodes(children)?,
                    key: None,
                }
            }
        }
        TemplateNode::Text(text) => TemplateNodeAST::Text(text),
        TemplateNode::Interpolation { expression, raw_html } => TemplateNodeAST::Interpolation {
            expression: parse_expr(&expression)?,
            raw_html,
        },
        TemplateNode::If { condition, then_branch, else_branch } => TemplateNodeAST::If {
            condition: parse_expr(&condition)?,
            then_branch: convert_template_nodes(then_branch)?,
            else_branch: else_branch.map(convert_template_nodes).transpose()?,
        },
        TemplateNode::Each { items, item_name, index_name, key, children } => {
            let key_expr = key.map(|k| parse_expr(&k)).transpose()?;
            
            TemplateNodeAST::Each {
                items: parse_expr(&items)?,
                item_binding: Pat::Ident(BindingIdent {
                    id: Ident::new(item_name.into(), DUMMY_SP),
                    type_ann: None,
                }),
                index_binding: index_name.map(|name| Pat::Ident(BindingIdent {
                    id: Ident::new(name.into(), DUMMY_SP),
                    type_ann: None,
                })),
                key_expr,
                children: convert_template_nodes(children)?,
            }
        }
    })
}

fn group_children_by_slot(children: Vec<TemplateNode>) -> Result<Vec<(Option<String>, Vec<TemplateNode>)>> {
    let mut slots = Vec::new();
    let mut default_slot = Vec::new();
    
    for child in children {
        if let TemplateNode::Element { ref attributes, .. } = child {
            if let Some(slot_attr) = attributes.iter().find(|a| a.name == "slot") {
                if let AttributeValue::Static(slot_name) = &slot_attr.value {
                    slots.push((Some(slot_name.clone()), vec![child]));
                    continue;
                }
            }
        }
        default_slot.push(child);
    }
    
    if !default_slot.is_empty() {
        slots.push((None, default_slot));
    }
    
    Ok(slots)
}

fn extract_dependencies(stmt: &Stmt) -> Vec<String> {
    // Simple dependency extraction - in production, use proper visitor
    vec![]
}

fn parse_expr(expr_str: &str) -> Result<Expr> {
    // Simplified expression parsing - in production, use proper parser
    Ok(Expr::Ident(Ident::new(expr_str.into(), DUMMY_SP)))
}

fn parse_styles(style_content: &str) -> Result<Vec<StyleRule>> {
    // Simplified style parsing - in production, use proper CSS parser
    Ok(vec![])
}
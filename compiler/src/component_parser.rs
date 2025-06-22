use anyhow::{Context, Result};
use crate::template_parser::{parse_template, TemplateNode};

#[derive(Debug, Clone)]
pub struct ComponentImport {
    pub name: String,
    pub path: String,
    pub default: bool,
}

#[derive(Debug, Clone)]
pub struct SlotDefinition {
    pub name: Option<String>, // None for default slot
    pub fallback: Option<Vec<TemplateNode>>,
}

#[derive(Debug, Clone)]
pub struct ComponentUsage {
    pub name: String,
    pub props: Vec<ComponentProp>,
    pub slots: Vec<SlotContent>,
    pub self_closing: bool,
}

#[derive(Debug, Clone)]
pub struct ComponentProp {
    pub name: String,
    pub value: PropValue,
}

#[derive(Debug, Clone)]
pub enum PropValue {
    Static(String),
    Dynamic(String),
    Shorthand(String), // For {user} instead of user={user}
}

#[derive(Debug, Clone)]
pub struct SlotContent {
    pub name: Option<String>, // None for default slot
    pub content: Vec<TemplateNode>,
}

pub fn parse_component_imports(script: &str) -> Result<Vec<ComponentImport>> {
    let mut imports = Vec::new();
    
    // Simple regex-based import parsing (in production, use proper AST)
    let import_regex = regex::Regex::new(r"import\s+(\w+)\s+from\s+['\"]([^'\"]+)['\"]").unwrap();
    
    for cap in import_regex.captures_iter(script) {
        let name = cap[1].to_string();
        let path = cap[2].to_string();
        
        // Check if it's a .egh component import
        if path.ends_with(".egh") {
            imports.push(ComponentImport {
                name,
                path,
                default: true,
            });
        }
    }
    
    Ok(imports)
}

pub fn parse_slot_definitions(template_nodes: &[TemplateNode]) -> Vec<SlotDefinition> {
    let mut slots = Vec::new();
    
    fn find_slots(nodes: &[TemplateNode], slots: &mut Vec<SlotDefinition>) {
        for node in nodes {
            match node {
                TemplateNode::Element { tag, attributes, children } => {
                    if tag == "slot" {
                        // Extract slot name from attributes
                        let name = attributes.iter()
                            .find(|attr| attr.name == "name")
                            .and_then(|attr| match &attr.value {
                                crate::template_parser::AttributeValue::Static(s) => Some(s.clone()),
                                _ => None,
                            });
                        
                        slots.push(SlotDefinition {
                            name,
                            fallback: if children.is_empty() { None } else { Some(children.clone()) },
                        });
                    } else {
                        find_slots(children, slots);
                    }
                }
                TemplateNode::If { then_branch, else_branch, .. } => {
                    find_slots(then_branch, slots);
                    if let Some(else_nodes) = else_branch {
                        find_slots(else_nodes, slots);
                    }
                }
                TemplateNode::Each { children, .. } => {
                    find_slots(children, slots);
                }
                _ => {}
            }
        }
    }
    
    find_slots(template_nodes, &mut slots);
    slots
}

pub fn parse_component_usage(node: &TemplateNode, known_components: &[String]) -> Option<ComponentUsage> {
    if let TemplateNode::Element { tag, attributes, children } = node {
        // Check if tag is a known component (starts with uppercase or is in known_components)
        let is_component = tag.chars().next().map(|c| c.is_uppercase()).unwrap_or(false) 
            || known_components.contains(tag);
        
        if !is_component {
            return None;
        }
        
        // Parse props
        let props = attributes.iter().map(|attr| {
            let value = match &attr.value {
                crate::template_parser::AttributeValue::Static(s) => PropValue::Static(s.clone()),
                crate::template_parser::AttributeValue::Dynamic(s) => {
                    // Check for shorthand syntax
                    if attr.name == s {
                        PropValue::Shorthand(s.clone())
                    } else {
                        PropValue::Dynamic(s.clone())
                    }
                }
                crate::template_parser::AttributeValue::EventHandler(handler) => {
                    PropValue::Dynamic(format!("({}) => {}", 
                        handler.handler.contains("=>") 
                            .then(|| "event".to_string())
                            .unwrap_or_default(),
                        handler.handler
                    ))
                }
            };
            
            ComponentProp {
                name: attr.name.clone(),
                value,
            }
        }).collect();
        
        // Parse slot content
        let slots = parse_slot_content(children);
        
        Some(ComponentUsage {
            name: tag.clone(),
            props,
            slots,
            self_closing: children.is_empty(),
        })
    } else {
        None
    }
}

fn parse_slot_content(children: &[TemplateNode]) -> Vec<SlotContent> {
    let mut slots = Vec::new();
    let mut default_content = Vec::new();
    
    for child in children {
        // Check if this is a named slot
        if let TemplateNode::Element { attributes, children, .. } = child {
            if let Some(slot_attr) = attributes.iter().find(|attr| attr.name == "slot") {
                if let crate::template_parser::AttributeValue::Static(slot_name) = &slot_attr.value {
                    slots.push(SlotContent {
                        name: Some(slot_name.clone()),
                        content: children.clone(),
                    });
                    continue;
                }
            }
        }
        
        // Otherwise, it's default slot content
        default_content.push(child.clone());
    }
    
    // Add default slot if there's content
    if !default_content.is_empty() {
        slots.push(SlotContent {
            name: None,
            content: default_content,
        });
    }
    
    slots
}
use swc_ecma_ast::*;
use swc_ecma_parser::{lexer::Lexer, Parser, StringInput, Syntax, TsConfig};
use swc_common::{Span, DUMMY_SP, SourceMap, sync::Lrc};
use anyhow::Result;

/// TypeScript-specific AST transformation for .egh files
pub struct TypeScriptTransformer {
    source_map: Lrc<SourceMap>,
}

impl TypeScriptTransformer {
    pub fn new(source_map: Lrc<SourceMap>) -> Self {
        Self { source_map }
    }

    /// Parse TypeScript code from <script lang="ts"> blocks
    pub fn parse_typescript(&self, content: &str) -> Result<Module> {
        let fm = self.source_map.new_source_file(
            swc_common::FileName::Custom("component.ts".into()),
            content.into(),
        );

        let lexer = Lexer::new(
            Syntax::Typescript(TsConfig {
                tsx: false,
                decorators: true,
                ..Default::default()
            }),
            Default::default(),
            StringInput::from(&*fm),
            None,
        );

        let mut parser = Parser::new_from(lexer);
        let module = parser.parse_module()
            .map_err(|e| anyhow::anyhow!("Failed to parse TypeScript: {:?}", e))?;

        Ok(module)
    }

    /// Extract prop types from TypeScript AST
    pub fn extract_prop_types(&self, module: &Module) -> Vec<PropType> {
        let mut prop_types = Vec::new();

        for item in &module.body {
            if let ModuleItem::Stmt(Stmt::Decl(Decl::Var(var_decl))) = item {
                for decl in &var_decl.decls {
                    if let Pat::Ident(ident) = &decl.name {
                        // Check if this is an exported prop
                        if self.is_exported_prop(&ident.id.sym) {
                            let prop_type = self.extract_type_annotation(&ident.type_ann);
                            prop_types.push(PropType {
                                name: ident.id.sym.to_string(),
                                type_str: prop_type,
                                optional: false,
                                default_value: self.extract_default_value(&decl.init),
                            });
                        }
                    }
                }
            }
        }

        prop_types
    }

    /// Check if a variable is an exported prop (export let)
    fn is_exported_prop(&self, name: &str) -> bool {
        // In .egh files, props are defined with `export let`
        // This will be enhanced to check actual export statements
        true // Simplified for initial implementation
    }

    /// Extract type annotation as string
    fn extract_type_annotation(&self, type_ann: &Option<Box<TsTypeAnn>>) -> String {
        match type_ann {
            Some(ann) => self.ts_type_to_string(&ann.type_ann),
            None => "any".to_string(),
        }
    }

    /// Convert TypeScript type to string representation
    fn ts_type_to_string(&self, ts_type: &Box<TsType>) -> String {
        match &**ts_type {
            TsType::TsKeywordType(keyword) => match keyword.kind {
                TsKeywordTypeKind::TsStringKeyword => "string".to_string(),
                TsKeywordTypeKind::TsNumberKeyword => "number".to_string(),
                TsKeywordTypeKind::TsBooleanKeyword => "boolean".to_string(),
                TsKeywordTypeKind::TsVoidKeyword => "void".to_string(),
                TsKeywordTypeKind::TsUndefinedKeyword => "undefined".to_string(),
                TsKeywordTypeKind::TsNullKeyword => "null".to_string(),
                TsKeywordTypeKind::TsAnyKeyword => "any".to_string(),
                _ => "unknown".to_string(),
            },
            TsType::TsArrayType(array) => {
                format!("{}[]", self.ts_type_to_string(&array.elem_type))
            },
            TsType::TsUnionOrIntersectionType(union) => {
                match union {
                    TsUnionOrIntersectionType::TsUnionType(u) => {
                        u.types.iter()
                            .map(|t| self.ts_type_to_string(t))
                            .collect::<Vec<_>>()
                            .join(" | ")
                    },
                    TsUnionOrIntersectionType::TsIntersectionType(i) => {
                        i.types.iter()
                            .map(|t| self.ts_type_to_string(t))
                            .collect::<Vec<_>>()
                            .join(" & ")
                    }
                }
            },
            TsType::TsTypeRef(type_ref) => {
                match &type_ref.type_name {
                    TsEntityName::Ident(ident) => ident.sym.to_string(),
                    TsEntityName::TsQualifiedName(_) => "qualified".to_string(),
                }
            },
            _ => "any".to_string(),
        }
    }

    /// Extract default value from initializer
    fn extract_default_value(&self, init: &Option<Box<Expr>>) -> Option<String> {
        init.as_ref().map(|expr| {
            match &**expr {
                Expr::Lit(lit) => match lit {
                    Lit::Str(s) => format!("\"{}\"", s.value),
                    Lit::Num(n) => n.value.to_string(),
                    Lit::Bool(b) => b.value.to_string(),
                    Lit::Null(_) => "null".to_string(),
                    _ => "undefined".to_string(),
                },
                _ => "undefined".to_string(),
            }
        })
    }

    /// Transform .egh file content to TypeScript for type checking
    pub fn transform_egh_to_typescript(&self, egh_content: &str) -> Result<String> {
        // Extract script content from .egh file
        let script_content = self.extract_script_content(egh_content)?;
        
        // Wrap in component context for proper type checking
        let wrapped = format!(
            r#"
// Eghact component context
interface ComponentProps {{}}
interface ComponentState {{}}

class EghactComponent {{
    props: ComponentProps;
    state: ComponentState;
    
    constructor(props: ComponentProps) {{
        this.props = props;
        this.state = {{}};
    }}
    
    // Component script content
    {}
}}

export default EghactComponent;
"#,
            script_content
        );

        Ok(wrapped)
    }

    /// Extract script content from .egh file
    fn extract_script_content(&self, content: &str) -> Result<String> {
        // Simple extraction - will be enhanced to use proper parser
        let script_start = content.find("<script").ok_or_else(|| anyhow::anyhow!("No script tag found"))?;
        let script_end = content.find("</script>").ok_or_else(|| anyhow::anyhow!("No closing script tag"))?;
        
        let script_with_tag = &content[script_start..script_end];
        let content_start = script_with_tag.find(">").ok_or_else(|| anyhow::anyhow!("Invalid script tag"))?;
        
        Ok(script_with_tag[content_start + 1..].to_string())
    }
}

/// Represents a component prop with type information
#[derive(Debug, Clone)]
pub struct PropType {
    pub name: String,
    pub type_str: String,
    pub optional: bool,
    pub default_value: Option<String>,
}

/// Generate TypeScript declaration for a component
pub fn generate_component_declaration(
    component_name: &str,
    props: &[PropType],
    events: &[EventType],
) -> String {
    let props_interface = generate_props_interface(props);
    let events_interface = generate_events_interface(events);
    
    format!(
        r#"// Auto-generated TypeScript declarations for {} component

{}

{}

declare class {} {{
    constructor(options: {{
        target: Element;
        props?: {}Props;
    }});
    
    $on<K extends keyof {}Events>(
        event: K,
        handler: (e: {}Events[K]) => void
    ): void;
    
    $destroy(): void;
}}

export default {};
"#,
        component_name,
        props_interface,
        events_interface,
        component_name,
        component_name,
        component_name,
        component_name,
        component_name
    )
}

/// Generate TypeScript interface for component props
fn generate_props_interface(props: &[PropType]) -> String {
    if props.is_empty() {
        return format!("export interface {}Props {{}}", "Component");
    }
    
    let prop_lines: Vec<String> = props.iter().map(|prop| {
        let optional = if prop.optional { "?" } else { "" };
        format!("    {}{}: {};", prop.name, optional, prop.type_str)
    }).collect();
    
    format!(
        "export interface {}Props {{\n{}\n}}",
        "Component",
        prop_lines.join("\n")
    )
}

/// Represents a component event with type information
#[derive(Debug, Clone)]
pub struct EventType {
    pub name: String,
    pub detail_type: String,
}

/// Generate TypeScript interface for component events
fn generate_events_interface(events: &[EventType]) -> String {
    if events.is_empty() {
        return format!("export interface {}Events {{}}", "Component");
    }
    
    let event_lines: Vec<String> = events.iter().map(|event| {
        format!("    {}: CustomEvent<{}>;", event.name, event.detail_type)
    }).collect();
    
    format!(
        "export interface {}Events {{\n{}\n}}",
        "Component",
        event_lines.join("\n")
    )
}
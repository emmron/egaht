use crate::ast::{Component, PropDefinition};
use std::collections::HashMap;

pub struct PropExtractor {
    props: HashMap<String, PropDefinition>,
}

impl PropExtractor {
    pub fn new() -> Self {
        Self {
            props: HashMap::new(),
        }
    }
    
    pub fn extract_from_component(&mut self, component: &Component) -> Vec<PropDefinition> {
        let mut extracted_props = Vec::new();
        
        // Extract from props section
        if let Some(props_section) = &component.props {
            for prop in props_section {
                self.process_prop_definition(prop);
                extracted_props.push(prop.clone());
            }
        }
        
        // Infer from template usage
        if let Some(template) = &component.template {
            self.infer_props_from_template(template, &mut extracted_props);
        }
        
        extracted_props
    }
    
    fn process_prop_definition(&mut self, prop: &PropDefinition) {
        // Validate and process prop type
        let validated_type = self.validate_type(&prop.prop_type);
        
        self.props.insert(
            prop.name.clone(),
            PropDefinition {
                name: prop.name.clone(),
                prop_type: validated_type,
                default_value: prop.default_value.clone(),
                required: prop.required,
            },
        );
    }
    
    fn validate_type(&self, prop_type: &Option<String>) -> Option<String> {
        match prop_type {
            Some(t) => {
                // Map Eghact types to TypeScript types
                let ts_type = match t.as_str() {
                    "String" => "string",
                    "Number" => "number",
                    "Boolean" => "boolean",
                    "Array" => "any[]",
                    "Object" => "object",
                    "Function" => "(...args: any[]) => any",
                    _ => t.as_str(),
                };
                Some(ts_type.to_string())
            }
            None => Some("any".to_string()),
        }
    }
    
    fn infer_props_from_template(&self, template: &str, props: &mut Vec<PropDefinition>) {
        // Look for {props.xxx} usage in template
        let prop_pattern = regex::Regex::new(r"\{props\.(\w+)\}").unwrap();
        
        for cap in prop_pattern.captures_iter(template) {
            let prop_name = &cap[1];
            
            // Check if we already have this prop defined
            if !self.props.contains_key(prop_name) {
                // Infer as any type if not defined
                props.push(PropDefinition {
                    name: prop_name.to_string(),
                    prop_type: Some("any".to_string()),
                    default_value: None,
                    required: true,
                });
            }
        }
    }
    
    pub fn generate_typescript_interface(&self) -> String {
        let mut interface = "export interface ComponentProps {\n".to_string();
        
        for (_, prop) in &self.props {
            let type_str = prop.prop_type.as_ref().unwrap_or(&"any".to_string());
            let optional = if prop.required { "" } else { "?" };
            
            interface.push_str(&format!("  {}{}: {};\n", prop.name, optional, type_str));
            
            // Add JSDoc comment if default value exists
            if let Some(default) = &prop.default_value {
                interface.push_str(&format!("  /** @default {} */\n", default));
            }
        }
        
        interface.push_str("}\n");
        interface
    }
}
use crate::ast::{Component, StateVariable};
use std::collections::HashMap;

pub struct StateInferencer {
    state_vars: HashMap<String, StateVariable>,
}

impl StateInferencer {
    pub fn new() -> Self {
        Self {
            state_vars: HashMap::new(),
        }
    }
    
    pub fn infer_from_component(&mut self, component: &Component) -> Vec<StateVariable> {
        let mut inferred_state = Vec::new();
        
        // Extract state from script section
        if let Some(script) = &component.script {
            self.extract_state_declarations(script, &mut inferred_state);
            self.extract_reactive_statements(script, &mut inferred_state);
        }
        
        // Infer from template bindings
        if let Some(template) = &component.template {
            self.infer_from_template_bindings(template, &mut inferred_state);
        }
        
        inferred_state
    }
    
    fn extract_state_declarations(&mut self, script: &str, state: &mut Vec<StateVariable>) {
        // Match let/const declarations
        let var_pattern = regex::Regex::new(r"(let|const)\s+(\w+)\s*=\s*(.+?);").unwrap();
        
        for cap in var_pattern.captures_iter(script) {
            let var_name = &cap[2];
            let initial_value = &cap[3];
            
            // Don't include if it's accessing props
            if !initial_value.contains("props.") {
                let state_var = StateVariable {
                    name: var_name.to_string(),
                    var_type: self.infer_type_from_value(initial_value),
                    initial_value: Some(initial_value.to_string()),
                };
                
                self.state_vars.insert(var_name.to_string(), state_var.clone());
                state.push(state_var);
            }
        }
    }
    
    fn extract_reactive_statements(&mut self, script: &str, state: &mut Vec<StateVariable>) {
        // Match $: reactive statements
        let reactive_pattern = regex::Regex::new(r"\$:\s*(\w+)\s*=(.+?);").unwrap();
        
        for cap in reactive_pattern.captures_iter(script) {
            let var_name = &cap[1];
            let expression = &cap[2];
            
            // If this reactive var isn't already tracked
            if !self.state_vars.contains_key(var_name) {
                let state_var = StateVariable {
                    name: var_name.to_string(),
                    var_type: self.infer_type_from_expression(expression),
                    initial_value: None, // Computed value
                };
                
                self.state_vars.insert(var_name.to_string(), state_var.clone());
                state.push(state_var);
            }
        }
    }
    
    fn infer_from_template_bindings(&mut self, template: &str, state: &mut Vec<StateVariable>) {
        // Look for two-way bindings bind:value={varName}
        let bind_pattern = regex::Regex::new(r"bind:(\w+)=\{(\w+)\}").unwrap();
        
        for cap in bind_pattern.captures_iter(template) {
            let bind_type = &cap[1];
            let var_name = &cap[2];
            
            if !self.state_vars.contains_key(var_name) && !var_name.starts_with("props.") {
                // Infer type based on binding
                let var_type = match bind_type {
                    "value" => "string",
                    "checked" => "boolean",
                    _ => "any",
                };
                
                let state_var = StateVariable {
                    name: var_name.to_string(),
                    var_type: var_type.to_string(),
                    initial_value: None,
                };
                
                self.state_vars.insert(var_name.to_string(), state_var.clone());
                state.push(state_var);
            }
        }
    }
    
    fn infer_type_from_value(&self, value: &str) -> String {
        let trimmed = value.trim();
        
        if trimmed == "true" || trimmed == "false" {
            "boolean".to_string()
        } else if trimmed.parse::<f64>().is_ok() {
            "number".to_string()
        } else if trimmed.starts_with('"') || trimmed.starts_with('\'') || trimmed.starts_with('`') {
            "string".to_string()
        } else if trimmed.starts_with('[') {
            // Try to infer array type
            if trimmed.contains('"') || trimmed.contains('\'') {
                "string[]".to_string()
            } else if trimmed.contains("true") || trimmed.contains("false") {
                "boolean[]".to_string()
            } else if trimmed.chars().any(|c| c.is_numeric()) {
                "number[]".to_string()
            } else {
                "any[]".to_string()
            }
        } else if trimmed.starts_with('{') {
            "object".to_string()
        } else if trimmed.contains("new ") {
            // Extract class name
            if let Some(class_name) = trimmed.split("new ").nth(1) {
                class_name.split('(').next().unwrap_or("any").to_string()
            } else {
                "any".to_string()
            }
        } else {
            "any".to_string()
        }
    }
    
    fn infer_type_from_expression(&self, expr: &str) -> String {
        let trimmed = expr.trim();
        
        // Check for arithmetic operations
        if trimmed.contains('+') || trimmed.contains('-') || trimmed.contains('*') || trimmed.contains('/') {
            "number".to_string()
        } else if trimmed.contains("&&") || trimmed.contains("||") || trimmed.contains('!') {
            "boolean".to_string()
        } else if trimmed.contains(".length") {
            "number".to_string()
        } else if trimmed.contains(".map(") || trimmed.contains(".filter(") {
            "any[]".to_string()
        } else {
            self.infer_type_from_value(trimmed)
        }
    }
    
    pub fn generate_state_interface(&self) -> String {
        let mut interface = "interface ComponentState {\n".to_string();
        
        for (_, state_var) in &self.state_vars {
            interface.push_str(&format!("  {}: {};\n", state_var.name, state_var.var_type));
        }
        
        interface.push_str("}\n");
        interface
    }
}
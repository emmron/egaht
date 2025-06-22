use typescript::{Diagnostic, Program, CompilerOptions};
use crate::ast::Component;

pub struct TypeChecker {
    program: Program,
}

impl TypeChecker {
    pub fn new() -> Self {
        let options = CompilerOptions {
            strict: true,
            no_implicit_any: true,
            jsx: "preserve",
            module: "esnext",
            target: "es2020",
            lib: vec!["es2020", "dom"],
            types: vec!["node"],
        };
        
        Self {
            program: Program::create_with_options(options),
        }
    }
    
    pub fn check_component(&self, component: &Component, file_path: &str) -> Result<(), Vec<Diagnostic>> {
        // Generate TypeScript code from component
        let ts_code = self.component_to_typescript(component)?;
        
        // Create virtual source file
        let source_file = self.program.create_source_file(
            file_path,
            &ts_code,
            typescript::ScriptTarget::ES2020,
            true,
        );
        
        // Run type checking
        let diagnostics = self.program.get_semantic_diagnostics(&source_file);
        
        if diagnostics.is_empty() {
            Ok(())
        } else {
            Err(diagnostics)
        }
    }
    
    fn component_to_typescript(&self, component: &Component) -> Result<String, String> {
        let mut ts_code = String::new();
        
        // Import React types
        ts_code.push_str("import { FC, useState, useEffect } from 'react';\n\n");
        
        // Generate props interface
        if let Some(props) = &component.props {
            ts_code.push_str("interface Props {\n");
            for prop in props {
                let type_str = prop.prop_type.as_ref().unwrap_or(&"any".to_string());
                let optional = if prop.required { "" } else { "?" };
                ts_code.push_str(&format!("  {}{}: {};\n", prop.name, optional, type_str));
            }
            ts_code.push_str("}\n\n");
        }
        
        // Generate component function
        ts_code.push_str(&format!("const {}: FC<Props> = (props) => {{\n", 
            component.name.as_ref().unwrap_or(&"Component".to_string())
        ));
        
        // Add state declarations
        if let Some(script) = &component.script {
            let processed_script = self.process_script_section(script);
            ts_code.push_str(&processed_script);
        }
        
        // Add render return
        ts_code.push_str("  return (\n");
        if let Some(template) = &component.template {
            let jsx = self.template_to_jsx(template);
            ts_code.push_str(&jsx);
        }
        ts_code.push_str("  );\n");
        ts_code.push_str("};\n\n");
        
        // Export component
        ts_code.push_str(&format!("export default {};\n", 
            component.name.as_ref().unwrap_or(&"Component".to_string())
        ));
        
        Ok(ts_code)
    }
    
    fn process_script_section(&self, script: &str) -> String {
        let mut processed = String::new();
        
        for line in script.lines() {
            let trimmed = line.trim();
            
            // Convert let to const with useState
            if trimmed.starts_with("let ") && trimmed.contains('=') {
                let parts: Vec<&str> = trimmed[4..].split('=').collect();
                if parts.len() == 2 {
                    let var_name = parts[0].trim();
                    let initial_value = parts[1].trim().trim_end_matches(';');
                    processed.push_str(&format!(
                        "  const [{}, set{}] = useState({});\n",
                        var_name,
                        capitalize(var_name),
                        initial_value
                    ));
                }
            }
            // Convert reactive statements
            else if trimmed.starts_with("$:") {
                let reactive_code = trimmed[2..].trim();
                processed.push_str("  useEffect(() => {\n");
                processed.push_str(&format!("    {};\n", reactive_code));
                processed.push_str("  });\n");
            }
            // Keep other lines as-is
            else if !trimmed.is_empty() {
                processed.push_str(&format!("  {}\n", trimmed));
            }
        }
        
        processed
    }
    
    fn template_to_jsx(&self, template: &str) -> String {
        let mut jsx = String::new();
        
        // Simple transformation - in real implementation would use proper parser
        let processed = template
            .replace("{", "{")
            .replace("}", "}")
            .replace("@click", "onClick")
            .replace("@change", "onChange")
            .replace("@input", "onInput")
            .replace("bind:value", "value")
            .replace("#if", "{")
            .replace("#else", "} : {")
            .replace("/if", "}");
        
        for line in processed.lines() {
            if !line.trim().is_empty() {
                jsx.push_str(&format!("    {}\n", line));
            }
        }
        
        jsx
    }
}

fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(f) => f.to_uppercase().collect::<String>() + chars.as_str(),
    }
}
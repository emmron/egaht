use crate::ast::EghAst;
use crate::parser::Parser;
use std::process::Command;
use std::fs;
use std::path::Path;
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct TypeScriptConfig {
    pub enabled: bool,
    pub strict: bool,
    pub emit_declarations: bool,
    pub check_js: bool,
    pub allow_js: bool,
}

impl Default for TypeScriptConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            strict: true,
            emit_declarations: true,
            check_js: false,
            allow_js: false,
        }
    }
}

pub struct TypeScriptCompiler {
    config: TypeScriptConfig,
}

impl TypeScriptCompiler {
    pub fn new(config: TypeScriptConfig) -> Self {
        Self { config }
    }
    
    pub fn check_component(&self, file_path: &str, ast: &EghAst) -> Result<(), Vec<String>> {
        if !self.config.enabled {
            return Ok(());
        }
        
        // Generate TypeScript representation
        let ts_code = self.generate_typescript_from_ast(ast)?;
        
        // Write to temporary file
        let temp_file = format!("{}.ts", file_path);
        fs::write(&temp_file, ts_code)?;
        
        // Run TypeScript compiler
        let output = Command::new("npx")
            .arg("tsc")
            .arg("--noEmit")
            .arg("--strict")
            .arg(&temp_file)
            .output()
            .map_err(|e| vec![format!("Failed to run TypeScript: {}", e)])?;
        
        // Clean up temp file
        let _ = fs::remove_file(&temp_file);
        
        if !output.status.success() {
            let errors = String::from_utf8_lossy(&output.stderr);
            return Err(errors.lines().map(|s| s.to_string()).collect());
        }
        
        Ok(())
    }
    
    fn generate_typescript_from_ast(&self, ast: &EghAst) -> Result<String, Vec<String>> {
        let mut ts_code = String::new();
        
        // Add imports
        ts_code.push_str("import { Component } from '@eghact/runtime';\n\n");
        
        for component in &ast.components {
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
            
            // Generate component class
            let comp_name = component.name.as_ref().unwrap_or(&"Component".to_string());
            ts_code.push_str(&format!("class {} extends Component<Props> {{\n", comp_name));
            
            // Add state types
            if let Some(state) = &component.state {
                for var in state {
                    ts_code.push_str(&format!("  {}: {};\n", var.name, var.var_type));
                }
            }
            
            ts_code.push_str("}\n\n");
            
            // Export
            ts_code.push_str(&format!("export default {};\n", comp_name));
        }
        
        Ok(ts_code)
    }
    
    pub fn generate_declarations(&self, ast: &EghAst, output_dir: &str) -> Result<(), Vec<String>> {
        if !self.config.emit_declarations {
            return Ok(());
        }
        
        for component in &ast.components {
            let comp_name = component.name.as_ref().unwrap_or(&"Component".to_string());
            let dts_path = format!("{}/{}.d.ts", output_dir, comp_name);
            
            let mut dts = String::new();
            dts.push_str("import { Component } from '@eghact/runtime';\n\n");
            
            // Props interface
            if let Some(props) = &component.props {
                dts.push_str("export interface Props {\n");
                for prop in props {
                    let type_str = prop.prop_type.as_ref().unwrap_or(&"any".to_string());
                    let optional = if prop.required { "" } else { "?" };
                    dts.push_str(&format!("  {}{}: {};\n", prop.name, optional, type_str));
                }
                dts.push_str("}\n\n");
            }
            
            // Component declaration
            dts.push_str(&format!("declare class {} extends Component<Props> {{}}\n", comp_name));
            dts.push_str(&format!("export default {};\n", comp_name));
            
            fs::write(dts_path, dts).map_err(|e| vec![e.to_string()])?;
        }
        
        Ok(())
    }
}
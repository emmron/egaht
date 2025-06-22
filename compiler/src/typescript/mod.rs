pub mod parser;
pub mod type_checker;
pub mod prop_extractor;
pub mod state_inference;

use typescript::{CompilerOptions, Program, SourceFile};

pub struct TypeScriptIntegration {
    program: Program,
    options: CompilerOptions,
}

impl TypeScriptIntegration {
    pub fn new() -> Self {
        let options = CompilerOptions {
            strict: true,
            no_implicit_any: true,
            jsx: "preserve",
            module: "esnext",
            target: "es2020",
        };
        
        Self {
            program: Program::new(options.clone()),
            options,
        }
    }
    
    pub fn check_egh_file(&self, file_path: &str, content: &str) -> Result<(), Vec<String>> {
        // Transform .egh to TypeScript-compatible format
        let ts_content = self.transform_egh_to_ts(content)?;
        
        // Type check the transformed content
        self.program.check_string(&ts_content, file_path)
    }
    
    fn transform_egh_to_ts(&self, egh_content: &str) -> Result<String, String> {
        // Parser implementation for .egh -> TS
        parser::transform(egh_content)
    }
}
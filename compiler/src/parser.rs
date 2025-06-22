use anyhow::{Context, Result};
use std::path::Path;
use swc_common::{FileName, SourceMap, Spanned};
use swc_ecma_ast::*;
use swc_ecma_parser::{lexer::Lexer, Parser as SwcParser, StringInput, Syntax, TsConfig};

#[derive(Debug)]
pub struct EghComponent {
    pub template: Option<String>,
    pub script: Option<Module>,
    pub style: Option<String>,
    pub file_name: String,
}

pub fn parse_egh_file(source: &str, path: &Path) -> Result<EghComponent> {
    // Extract the three sections from the .egh file
    let template = extract_template(source);
    let script_content = extract_script(source);
    let style = extract_style(source);
    
    // Parse the script section if it exists
    let script = if let Some(script_src) = script_content {
        let cm = SourceMap::default();
        let fm = cm.new_source_file(
            FileName::Real(path.to_path_buf()),
            script_src,
        );
        
        let lexer = Lexer::new(
            Syntax::Typescript(TsConfig {
                tsx: true,
                decorators: false,
                ..Default::default()
            }),
            Default::default(),
            StringInput::from(&*fm),
            None,
        );
        
        let mut parser = SwcParser::new_from(lexer);
        
        let module = parser
            .parse_module()
            .context("Failed to parse component script")?;
        
        Some(module)
    } else {
        None
    };
    
    let component = EghComponent {
        template,
        script,
        style,
        file_name: path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
    };
    
    Ok(component)
}

fn extract_template(source: &str) -> Option<String> {
    extract_section(source, "template")
}

fn extract_script(source: &str) -> Option<String> {
    extract_section(source, "script")
}

fn extract_style(source: &str) -> Option<String> {
    extract_section(source, "style")
}

fn extract_section(source: &str, tag: &str) -> Option<String> {
    // Find opening tag with potential attributes
    let open_pattern = format!("<{}", tag);
    let close_tag = format!("</{}>", tag);
    
    if let Some(tag_start) = source.find(&open_pattern) {
        // Find the end of the opening tag (>)
        if let Some(tag_end) = source[tag_start..].find('>') {
            let content_start = tag_start + tag_end + 1;
            
            // Find the closing tag
            if let Some(close_start) = source[content_start..].find(&close_tag) {
                let content_end = content_start + close_start;
                let content = &source[content_start..content_end];
                return Some(content.trim().to_string());
            }
        }
    }
    None
}
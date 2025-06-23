use anyhow::{Context, Result};
use std::path::Path;
use swc_common::{FileName, SourceMap, Spanned, sync::Lrc};
use swc_ecma_ast::*;
use swc_ecma_parser::{lexer::Lexer, Parser as SwcParser, StringInput, Syntax, TsConfig, EsConfig};
use crate::typescript_transform::{TypeScriptTransformer, PropType, EventType};

#[derive(Debug)]
pub struct EghComponent {
    pub template: Option<String>,
    pub script: Option<Module>,
    pub style: Option<String>,
    pub file_name: String,
    pub lang: ScriptLang,
    pub prop_types: Vec<PropType>,
    pub event_types: Vec<EventType>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ScriptLang {
    JavaScript,
    TypeScript,
}

pub fn parse_egh_file(source: &str, path: &Path) -> Result<EghComponent> {
    // Extract the three sections from the .egh file
    let template = extract_template(source);
    let (script_content, lang) = extract_script_with_lang(source);
    let style = extract_style(source);
    
    let source_map = Lrc::new(SourceMap::default());
    let ts_transformer = TypeScriptTransformer::new(source_map.clone());
    
    // Parse the script section if it exists
    let (script, prop_types, event_types) = if let Some(script_src) = script_content {
        let fm = source_map.new_source_file(
            FileName::Real(path.to_path_buf()),
            script_src,
        );
        
        let syntax = match lang {
            ScriptLang::TypeScript => Syntax::Typescript(TsConfig {
                tsx: false,
                decorators: true,
                ..Default::default()
            }),
            ScriptLang::JavaScript => Syntax::Es(EsConfig {
                jsx: false,
                decorators: true,
                ..Default::default()
            }),
        };
        
        let lexer = Lexer::new(
            syntax,
            Default::default(),
            StringInput::from(&*fm),
            None,
        );
        
        let mut parser = SwcParser::new_from(lexer);
        
        let module = parser
            .parse_module()
            .context("Failed to parse component script")?;
        
        // Extract type information if TypeScript
        let (props, events) = if lang == ScriptLang::TypeScript {
            let props = ts_transformer.extract_prop_types(&module);
            let events = extract_event_types(&module);
            (props, events)
        } else {
            (vec![], vec![])
        };
        
        (Some(module), props, events)
    } else {
        (None, vec![], vec![])
    };
    
    let component = EghComponent {
        template,
        script,
        style,
        file_name: path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        lang,
        prop_types,
        event_types,
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

fn extract_script_with_lang(source: &str) -> (Option<String>, ScriptLang) {
    let open_pattern = "<script";
    let close_tag = "</script>";
    
    if let Some(tag_start) = source.find(open_pattern) {
        // Find the end of the opening tag (>)
        if let Some(tag_end_rel) = source[tag_start..].find('>') {
            let tag_end = tag_start + tag_end_rel;
            let opening_tag = &source[tag_start..tag_end];
            
            // Check for lang attribute
            let lang = if opening_tag.contains("lang=\"ts\"") || opening_tag.contains("lang='ts'") ||
                          opening_tag.contains("lang=\"typescript\"") || opening_tag.contains("lang='typescript'") {
                ScriptLang::TypeScript
            } else {
                ScriptLang::JavaScript
            };
            
            let content_start = tag_end + 1;
            
            // Find the closing tag
            if let Some(close_start) = source[content_start..].find(close_tag) {
                let content_end = content_start + close_start;
                let content = &source[content_start..content_end];
                return (Some(content.trim().to_string()), lang);
            }
        }
    }
    (None, ScriptLang::JavaScript)
}

fn extract_event_types(module: &Module) -> Vec<EventType> {
    let mut event_types = Vec::new();
    
    // Look for dispatch calls in the JavaScript/TypeScript code
    if let Some(script) = &module.js {
        // Simple pattern matching for dispatch calls
        // This looks for patterns like: dispatch('eventName', data)
        let dispatch_regex = regex::Regex::new(r#"dispatch\s*\(\s*['"`]([^'"`]+)['"`]"#).unwrap();
        
        for cap in dispatch_regex.captures_iter(script) {
            if let Some(event_name) = cap.get(1) {
                event_types.push(EventType {
                    name: event_name.as_str().to_string(),
                    detail_type: None, // Could be enhanced to infer types
                });
            }
        }
        
        // Also look for createEventDispatcher patterns
        let create_dispatcher_regex = regex::Regex::new(r#"createEventDispatcher\s*<\s*\{([^}]+)\}"#).unwrap();
        
        for cap in create_dispatcher_regex.captures_iter(script) {
            if let Some(events_def) = cap.get(1) {
                // Parse event definitions from TypeScript interface
                // This is a simplified parser - could be enhanced
                let event_defs = events_def.as_str();
                for line in event_defs.lines() {
                    if let Some(event_name) = line.split(':').next() {
                        let cleaned_name = event_name.trim().trim_matches('"').trim_matches('\'');
                        if !cleaned_name.is_empty() {
                            event_types.push(EventType {
                                name: cleaned_name.to_string(),
                                detail_type: None,
                            });
                        }
                    }
                }
            }
        }
    }
    
    event_types
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
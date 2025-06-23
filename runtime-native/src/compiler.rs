//! .eg File Compiler
//! 
//! Compiles structured markdown to native Eghact components

use nom::{
    IResult,
    branch::alt,
    bytes::complete::{tag, take_until, take_while, is_not},
    character::complete::{char, line_ending, multispace0, multispace1, not_line_ending},
    combinator::{map, opt, recognize, rest},
    multi::{many0, many1, separated_list0},
    sequence::{tuple, preceded, terminated, delimited, pair},
};
use std::collections::HashMap;
use crate::{CompiledComponent, CompiledTemplate, TemplateNode, StateValue, AttributeValue, RuntimeError};

/// Compile a .eg file to a component
pub fn compile_eg_file(content: &str) -> Result<CompiledComponent, RuntimeError> {
    let (content, frontmatter) = parse_frontmatter(content)
        .map_err(|e| RuntimeError::ParseError(format!("Failed to parse frontmatter: {:?}", e)))?;
    
    let (_, sections) = parse_sections(content)
        .map_err(|e| RuntimeError::ParseError(format!("Failed to parse sections: {:?}", e)))?;
    
    // Extract component name from title
    let name = sections.get("title")
        .and_then(|s| s.lines().next())
        .unwrap_or("Component")
        .trim_start_matches('#')
        .trim()
        .to_string();
    
    // Parse template section
    let template_content = sections.get("template")
        .ok_or_else(|| RuntimeError::ParseError("No template section found".to_string()))?;
    
    let template = compile_template(template_content)?;
    
    // Extract state from frontmatter
    let state = frontmatter.get("state")
        .cloned()
        .unwrap_or_else(HashMap::new);
    
    // Extract queries
    let queries = frontmatter.get("queries")
        .cloned()
        .unwrap_or_else(HashMap::new);
    
    // Compile logic section to native code
    let logic_content = sections.get("logic").unwrap_or(&String::new());
    let native_code = compile_logic(logic_content)?;
    
    Ok(CompiledComponent {
        name,
        template,
        state,
        queries,
        native_code,
    })
}

/// Parse YAML frontmatter
fn parse_frontmatter(input: &str) -> IResult<&str, HashMap<String, HashMap<String, StateValue>>> {
    let (input, _) = tag("---")(input)?;
    let (input, _) = line_ending(input)?;
    let (input, yaml_content) = take_until("---")(input)?;
    let (input, _) = tag("---")(input)?;
    let (input, _) = line_ending(input)?;
    
    // Parse YAML
    let yaml_value: serde_yaml::Value = serde_yaml::from_str(yaml_content)
        .map_err(|_| nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Tag)))?;
    
    // Convert to our format
    let mut result = HashMap::new();
    
    if let serde_yaml::Value::Mapping(map) = yaml_value {
        for (k, v) in map {
            if let serde_yaml::Value::String(key) = k {
                match &key[..] {
                    "state" => {
                        if let serde_yaml::Value::Mapping(state_map) = v {
                            let mut state = HashMap::new();
                            for (sk, sv) in state_map {
                                if let serde_yaml::Value::String(state_key) = sk {
                                    state.insert(state_key, yaml_to_state_value(sv));
                                }
                            }
                            result.insert("state".to_string(), state);
                        }
                    }
                    "queries" => {
                        if let serde_yaml::Value::Mapping(query_map) = v {
                            let mut queries = HashMap::new();
                            for (qk, qv) in query_map {
                                if let (serde_yaml::Value::String(query_key), serde_yaml::Value::String(query_val)) = (qk, qv) {
                                    queries.insert(query_key, StateValue::String(query_val));
                                }
                            }
                            result.insert("queries".to_string(), queries);
                        }
                    }
                    _ => {}
                }
            }
        }
    }
    
    Ok((input, result))
}

/// Parse markdown sections
fn parse_sections(input: &str) -> IResult<&str, HashMap<String, String>> {
    let mut sections = HashMap::new();
    let mut current_section = "title";
    let mut current_content = String::new();
    
    for line in input.lines() {
        if line.starts_with("##") {
            // Save previous section
            if !current_content.is_empty() {
                sections.insert(current_section.to_string(), current_content.trim().to_string());
                current_content.clear();
            }
            
            // Determine section type from class
            if line.contains("{.props-section}") || line.contains("{.props}") {
                current_section = "props";
            } else if line.contains("{.template}") {
                current_section = "template";
            } else if line.contains("{.styles}") {
                current_section = "styles";
            } else if line.contains("{.logic}") {
                current_section = "logic";
            }
        } else if line.starts_with("#") && !line.starts_with("##") {
            // Component title
            if current_section == "title" {
                current_content.push_str(line);
                current_content.push('\n');
            }
        } else {
            current_content.push_str(line);
            current_content.push('\n');
        }
    }
    
    // Save last section
    if !current_content.is_empty() {
        sections.insert(current_section.to_string(), current_content.trim().to_string());
    }
    
    Ok(("", sections))
}

/// Compile template markdown to AST
fn compile_template(content: &str) -> Result<CompiledTemplate, RuntimeError> {
    let nodes = parse_template_content(content)?;
    Ok(CompiledTemplate { nodes })
}

/// Parse template content
fn parse_template_content(content: &str) -> Result<Vec<TemplateNode>, RuntimeError> {
    let mut nodes = Vec::new();
    let lines: Vec<&str> = content.lines().collect();
    let mut i = 0;
    
    while i < lines.len() {
        let line = lines[i];
        
        // Skip empty lines
        if line.trim().is_empty() {
            i += 1;
            continue;
        }
        
        // Parse different node types
        if line.starts_with(":::for") {
            let (node, consumed) = parse_for_loop(&lines[i..])?;
            nodes.push(node);
            i += consumed;
        } else if line.starts_with(":::if") {
            let (node, consumed) = parse_if_statement(&lines[i..])?;
            nodes.push(node);
            i += consumed;
        } else if line.starts_with("[!") {
            let node = parse_component_tag(line)?;
            nodes.push(node);
            i += 1;
        } else if line.starts_with("###") || line.starts_with("##") {
            let node = parse_heading(line)?;
            nodes.push(node);
            i += 1;
        } else {
            // Regular text with interpolations
            let node = parse_text_with_interpolations(line)?;
            nodes.push(node);
            i += 1;
        }
    }
    
    Ok(nodes)
}

/// Parse for loop
fn parse_for_loop(lines: &[&str]) -> Result<(TemplateNode, usize), RuntimeError> {
    let first_line = lines[0];
    let parts: Vec<&str> = first_line.split_whitespace().collect();
    
    if parts.len() < 4 {
        return Err(RuntimeError::ParseError("Invalid for loop syntax".to_string()));
    }
    
    let item = parts[1].to_string();
    let collection = parts[3].to_string();
    
    // Find end of for loop
    let mut body_lines = Vec::new();
    let mut i = 1;
    let mut depth = 1;
    
    while i < lines.len() && depth > 0 {
        if lines[i].starts_with(":::for") {
            depth += 1;
        } else if lines[i] == ":::" {
            depth -= 1;
            if depth == 0 {
                break;
            }
        }
        if depth > 0 {
            body_lines.push(lines[i]);
        }
        i += 1;
    }
    
    let body_content = body_lines.join("\n");
    let body = parse_template_content(&body_content)?;
    
    Ok((TemplateNode::For { item, collection, body }, i + 1))
}

/// Parse if statement
fn parse_if_statement(lines: &[&str]) -> Result<(TemplateNode, usize), RuntimeError> {
    let first_line = lines[0];
    let condition = first_line.trim_start_matches(":::if").trim().to_string();
    
    let mut then_lines = Vec::new();
    let mut else_lines = Vec::new();
    let mut i = 1;
    let mut in_else = false;
    let mut depth = 1;
    
    while i < lines.len() && depth > 0 {
        if lines[i].starts_with(":::if") {
            depth += 1;
        } else if lines[i] == ":::else" && depth == 1 {
            in_else = true;
            i += 1;
            continue;
        } else if lines[i] == ":::" {
            depth -= 1;
            if depth == 0 {
                break;
            }
        }
        
        if depth > 0 {
            if in_else {
                else_lines.push(lines[i]);
            } else {
                then_lines.push(lines[i]);
            }
        }
        i += 1;
    }
    
    let then_content = then_lines.join("\n");
    let then_branch = parse_template_content(&then_content)?;
    
    let else_branch = if !else_lines.is_empty() {
        let else_content = else_lines.join("\n");
        Some(parse_template_content(&else_content)?)
    } else {
        None
    };
    
    Ok((TemplateNode::If { condition, then_branch, else_branch }, i + 1))
}

/// Parse component tag
fn parse_component_tag(line: &str) -> Result<TemplateNode, RuntimeError> {
    // Extract component name
    let start = line.find("[!").unwrap() + 2;
    let end = line[start..].find(|c: char| c.is_whitespace() || c == ']')
        .map(|i| start + i)
        .unwrap_or(line.len());
    
    let name = line[start..end].to_string();
    
    // Parse props and events
    let mut props = HashMap::new();
    
    // Simple prop parsing - would need more sophisticated parser in production
    if let Some(props_start) = line.find(' ') {
        let props_str = &line[props_start..];
        for attr in props_str.split_whitespace() {
            if attr.contains('=') {
                let parts: Vec<&str> = attr.splitn(2, '=').collect();
                if parts.len() == 2 {
                    let key = parts[0].to_string();
                    let value = parts[1].trim_matches('"').to_string();
                    
                    if key.starts_with('@') {
                        props.insert(key, AttributeValue::EventHandler(value));
                    } else if value.starts_with('{') && value.ends_with('}') {
                        props.insert(key, AttributeValue::Dynamic(value[1..value.len()-1].to_string()));
                    } else {
                        props.insert(key, AttributeValue::Static(value));
                    }
                }
            }
        }
    }
    
    Ok(TemplateNode::Component { name, props, children: Vec::new() })
}

/// Parse heading with data attributes
fn parse_heading(line: &str) -> Result<TemplateNode, RuntimeError> {
    let level = line.chars().take_while(|&c| c == '#').count();
    let tag = format!("h{}", level);
    
    // Parse content and attributes
    let content = line.trim_start_matches('#').trim();
    let mut attributes = HashMap::new();
    let mut text = content.to_string();
    
    // Extract id
    if let Some(id_start) = content.find("{#") {
        if let Some(id_end) = content[id_start+2..].find('}') {
            let id = content[id_start+2..id_start+2+id_end].to_string();
            attributes.insert("id".to_string(), AttributeValue::Static(id));
            text = content[..id_start].trim().to_string();
        }
    }
    
    // Extract data attributes
    if content.contains("data-") {
        // Simple extraction - would need better parser
        for part in content.split_whitespace() {
            if part.starts_with("data-") {
                if let Some(eq_pos) = part.find('=') {
                    let key = part[..eq_pos].to_string();
                    let value = part[eq_pos+1..].trim_matches('"').to_string();
                    attributes.insert(key, AttributeValue::Static(value));
                }
            }
        }
    }
    
    Ok(TemplateNode::Element {
        tag,
        attributes,
        children: vec![TemplateNode::Text(text)],
    })
}

/// Parse text with interpolations
fn parse_text_with_interpolations(line: &str) -> Result<TemplateNode, RuntimeError> {
    let mut nodes = Vec::new();
    let mut current_text = String::new();
    let mut chars = line.chars().peekable();
    
    while let Some(ch) = chars.next() {
        if ch == '{' && chars.peek() == Some(&'{') {
            // Skip second {
            chars.next();
            
            // Save current text
            if !current_text.is_empty() {
                nodes.push(TemplateNode::Text(current_text.clone()));
                current_text.clear();
            }
            
            // Parse interpolation
            let mut expr = String::new();
            let mut depth = 0;
            
            while let Some(ch) = chars.next() {
                if ch == '}' && chars.peek() == Some(&'}') {
                    if depth == 0 {
                        chars.next(); // Skip second }
                        break;
                    }
                } else if ch == '{' {
                    depth += 1;
                } else if ch == '}' {
                    depth -= 1;
                }
                expr.push(ch);
            }
            
            nodes.push(TemplateNode::Interpolation(expr));
        } else {
            current_text.push(ch);
        }
    }
    
    // Add remaining text
    if !current_text.is_empty() {
        nodes.push(TemplateNode::Text(current_text));
    }
    
    // Return appropriate node
    if nodes.is_empty() {
        Ok(TemplateNode::Text(String::new()))
    } else if nodes.len() == 1 {
        Ok(nodes.into_iter().next().unwrap())
    } else {
        // Wrap multiple nodes in a span
        Ok(TemplateNode::Element {
            tag: "span".to_string(),
            attributes: HashMap::new(),
            children: nodes,
        })
    }
}

/// Compile logic section to native code
fn compile_logic(content: &str) -> Result<Vec<u8>, RuntimeError> {
    // Extract code blocks
    let mut rust_code = String::new();
    let mut in_code_block = false;
    
    for line in content.lines() {
        if line.starts_with("```rust") {
            in_code_block = true;
        } else if line.starts_with("```") && in_code_block {
            in_code_block = false;
        } else if in_code_block {
            rust_code.push_str(line);
            rust_code.push('\n');
        }
    }
    
    // Compile Rust code to native
    compile_rust_to_native(&rust_code)
}

/// Compile Rust code to native bytecode
fn compile_rust_to_native(code: &str) -> Result<Vec<u8>, RuntimeError> {
    use std::process::Command;
    use std::fs;
    use std::io::Write;
    
    // Create temporary file
    let temp_file = format!("/tmp/eghact_{}.rs", uuid::Uuid::new_v4());
    let output_file = format!("/tmp/eghact_{}.wasm", uuid::Uuid::new_v4());
    
    // Write code to temp file
    let mut file = fs::File::create(&temp_file)
        .map_err(|e| RuntimeError::CompilationError(e.to_string()))?;
    
    // Wrap code in proper module structure
    let wrapped_code = format!(r#"
#![no_std]
#![no_main]

#[no_mangle]
pub extern "C" fn _start() {{}}

{}
"#, code);
    
    file.write_all(wrapped_code.as_bytes())
        .map_err(|e| RuntimeError::CompilationError(e.to_string()))?;
    
    // Compile to WASM
    let output = Command::new("rustc")
        .args(&[
            "--target", "wasm32-unknown-unknown",
            "-O",
            "--crate-type", "cdylib",
            "-o", &output_file,
            &temp_file
        ])
        .output()
        .map_err(|e| RuntimeError::CompilationError(format!("Failed to run rustc: {}", e)))?;
    
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(RuntimeError::CompilationError(format!("Compilation failed: {}", error)));
    }
    
    // Read compiled WASM
    let bytecode = fs::read(&output_file)
        .map_err(|e| RuntimeError::CompilationError(e.to_string()))?;
    
    // Cleanup
    let _ = fs::remove_file(&temp_file);
    let _ = fs::remove_file(&output_file);
    
    Ok(bytecode)
}

/// Convert YAML value to StateValue
fn yaml_to_state_value(value: serde_yaml::Value) -> StateValue {
    use serde_yaml::Value;
    
    match value {
        Value::Null => StateValue::Null,
        Value::Bool(b) => StateValue::Bool(b),
        Value::Number(n) => StateValue::Number(n.as_f64().unwrap_or(0.0)),
        Value::String(s) => StateValue::String(s),
        Value::Sequence(seq) => StateValue::Array(
            seq.into_iter().map(yaml_to_state_value).collect()
        ),
        Value::Mapping(map) => {
            let mut obj = HashMap::new();
            for (k, v) in map {
                if let Value::String(key) = k {
                    obj.insert(key, yaml_to_state_value(v));
                }
            }
            StateValue::Object(obj)
        }
    }
}
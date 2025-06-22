use crate::ast::{Component, PropDefinition, StateVariable};

pub fn transform(egh_content: &str) -> Result<String, String> {
    let mut ts_output = String::new();
    
    // Extract component parts
    let (props, state, template, script) = parse_egh_sections(egh_content)?;
    
    // Generate TypeScript interfaces
    if !props.is_empty() {
        ts_output.push_str(&generate_props_interface(&props));
    }
    
    if !state.is_empty() {
        ts_output.push_str(&generate_state_interface(&state));
    }
    
    // Transform script section
    ts_output.push_str(&transform_script_section(&script, &props, &state)?);
    
    Ok(ts_output)
}

fn parse_egh_sections(content: &str) -> Result<(Vec<PropDefinition>, Vec<StateVariable>, String, String), String> {
    // Parse .egh file sections
    let mut props = Vec::new();
    let mut state = Vec::new();
    let mut template = String::new();
    let mut script = String::new();
    
    let lines: Vec<&str> = content.lines().collect();
    let mut current_section = "";
    
    for line in lines {
        if line.starts_with("<template>") {
            current_section = "template";
        } else if line.starts_with("<script>") {
            current_section = "script";
        } else if line.starts_with("props:") {
            current_section = "props";
        } else if line.starts_with("let ") && current_section == "script" {
            // Parse state variable
            if let Some(state_var) = parse_state_variable(line) {
                state.push(state_var);
            }
        }
        
        match current_section {
            "template" => template.push_str(line),
            "script" => script.push_str(line),
            "props" => {
                if let Some(prop) = parse_prop_definition(line) {
                    props.push(prop);
                }
            }
            _ => {}
        }
    }
    
    Ok((props, state, template, script))
}

fn generate_props_interface(props: &[PropDefinition]) -> String {
    let mut interface = "interface Props {\n".to_string();
    
    for prop in props {
        let type_str = match &prop.prop_type {
            Some(t) => t,
            None => "any",
        };
        let optional = if prop.required { "" } else { "?" };
        interface.push_str(&format!("  {}{}: {};\n", prop.name, optional, type_str));
    }
    
    interface.push_str("}\n\n");
    interface
}

fn generate_state_interface(state: &[StateVariable]) -> String {
    let mut interface = "interface State {\n".to_string();
    
    for var in state {
        interface.push_str(&format!("  {}: {};\n", var.name, var.var_type));
    }
    
    interface.push_str("}\n\n");
    interface
}

fn transform_script_section(script: &str, props: &[PropDefinition], state: &[StateVariable]) -> Result<String, String> {
    // Transform Eghact script to TypeScript
    let mut ts_script = String::new();
    
    // Add component function signature
    ts_script.push_str("export default function Component(props: Props): JSX.Element {\n");
    
    // Add state declarations
    for var in state {
        ts_script.push_str(&format!("  const [{}, set{}] = useState<{}>({}));\n", 
            var.name, 
            capitalize(&var.name), 
            var.var_type,
            var.initial_value.as_deref().unwrap_or("undefined")
        ));
    }
    
    // Transform reactive statements ($:)
    let transformed_script = script.replace("$:", "useEffect(() => {");
    ts_script.push_str(&transformed_script);
    
    ts_script.push_str("}\n");
    
    Ok(ts_script)
}

fn parse_prop_definition(line: &str) -> Option<PropDefinition> {
    // Parse prop definition from line
    // Format: propName: type = defaultValue
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed == "props:" {
        return None;
    }
    
    // Simple parser for prop definitions
    let parts: Vec<&str> = trimmed.split(':').collect();
    if parts.len() >= 2 {
        let name = parts[0].trim().to_string();
        let type_and_default: Vec<&str> = parts[1].split('=').collect();
        let prop_type = Some(type_and_default[0].trim().to_string());
        let default_value = if type_and_default.len() > 1 {
            Some(type_and_default[1].trim().to_string())
        } else {
            None
        };
        
        return Some(PropDefinition {
            name,
            prop_type,
            default_value,
            required: default_value.is_none(),
        });
    }
    
    None
}

fn parse_state_variable(line: &str) -> Option<StateVariable> {
    // Parse state variable from line
    // Format: let varName = value
    if line.trim().starts_with("let ") {
        let without_let = line.trim().strip_prefix("let ").unwrap();
        let parts: Vec<&str> = without_let.split('=').collect();
        
        if parts.len() >= 2 {
            let name = parts[0].trim().to_string();
            let value = parts[1].trim().to_string();
            let var_type = infer_type_from_value(&value);
            
            return Some(StateVariable {
                name,
                var_type,
                initial_value: Some(value),
            });
        }
    }
    
    None
}

fn infer_type_from_value(value: &str) -> String {
    if value == "true" || value == "false" {
        "boolean".to_string()
    } else if value.parse::<i32>().is_ok() {
        "number".to_string()
    } else if value.starts_with('"') || value.starts_with('\'') {
        "string".to_string()
    } else if value.starts_with('[') {
        "any[]".to_string()
    } else if value.starts_with('{') {
        "object".to_string()
    } else {
        "any".to_string()
    }
}

fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(f) => f.to_uppercase().collect::<String>() + chars.as_str(),
    }
}
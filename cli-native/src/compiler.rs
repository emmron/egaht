use anyhow::{Result, Context, bail};
use std::path::Path;
use std::collections::HashMap;

use crate::build_engine::CompileTarget;

/// Eghact compiler - compiles .egh files to JavaScript
pub struct Compiler {
    target: CompileTarget,
    parsers: HashMap<String, Box<dyn Parser>>,
}

/// Compiled component output
#[derive(Clone)]
pub struct CompiledComponent {
    pub id: String,
    pub javascript: String,
    pub css: Option<String>,
    pub source_map: Option<String>,
    pub dependencies: Vec<String>,
}

/// Parser trait for different sections
trait Parser: Send + Sync {
    fn parse(&self, content: &str) -> Result<ParsedSection>;
}

/// Parsed section
struct ParsedSection {
    content: String,
    imports: Vec<String>,
    exports: Vec<String>,
}

/// Component AST
struct ComponentAST {
    template: Option<TemplateNode>,
    script: Option<ScriptNode>,
    style: Option<StyleNode>,
}

/// Template node
struct TemplateNode {
    elements: Vec<Element>,
    bindings: Vec<Binding>,
}

/// Script node
struct ScriptNode {
    imports: Vec<ImportStatement>,
    variables: Vec<Variable>,
    functions: Vec<Function>,
    exports: Vec<ExportStatement>,
}

/// Style node
struct StyleNode {
    rules: Vec<CSSRule>,
    scoped: bool,
}

/// HTML Element
struct Element {
    tag: String,
    attributes: HashMap<String, String>,
    children: Vec<ElementChild>,
}

enum ElementChild {
    Element(Element),
    Text(String),
    Expression(String),
}

/// Variable binding
struct Binding {
    target: String,
    expression: String,
    event: Option<String>,
}

/// Import statement
struct ImportStatement {
    specifiers: Vec<String>,
    source: String,
}

/// Variable declaration
struct Variable {
    name: String,
    value: String,
    reactive: bool,
}

/// Function declaration
struct Function {
    name: String,
    params: Vec<String>,
    body: String,
}

/// Export statement
struct ExportStatement {
    name: String,
    default: bool,
}

/// CSS Rule
struct CSSRule {
    selector: String,
    declarations: Vec<(String, String)>,
}

impl Compiler {
    pub fn new(target: CompileTarget) -> Result<Self> {
        let mut parsers: HashMap<String, Box<dyn Parser>> = HashMap::new();
        
        parsers.insert("template".to_string(), Box::new(TemplateParser));
        parsers.insert("script".to_string(), Box::new(ScriptParser));
        parsers.insert("style".to_string(), Box::new(StyleParser));
        
        Ok(Self {
            target,
            parsers,
        })
    }
    
    /// Compile a component file
    pub fn compile_file(&self, path: &Path) -> Result<CompiledComponent> {
        let content = std::fs::read_to_string(path)
            .with_context(|| format!("Failed to read {}", path.display()))?;
        
        let id = path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .to_string();
        
        self.compile(&id, &content)
    }
    
    /// Compile component source
    pub fn compile(&self, id: &str, source: &str) -> Result<CompiledComponent> {
        // Parse component into AST
        let ast = self.parse_component(source)?;
        
        // Transform AST to JavaScript
        let mut js_output = String::new();
        let mut dependencies = Vec::new();
        
        // Generate imports
        if let Some(script) = &ast.script {
            for import in &script.imports {
                js_output.push_str(&format!(
                    "import {} from '{}';\n",
                    import.specifiers.join(", "),
                    import.source
                ));
                dependencies.push(import.source.clone());
            }
        }
        
        // Generate component class
        js_output.push_str(&format!("\nclass {} {{\n", id));
        
        // Constructor
        js_output.push_str("  constructor() {\n");
        js_output.push_str("    this._state = {};\n");
        js_output.push_str("    this._bindings = [];\n");
        
        // Initialize reactive variables
        if let Some(script) = &ast.script {
            for var in &script.variables {
                if var.reactive {
                    js_output.push_str(&format!(
                        "    this._state.{} = {};\n",
                        var.name, var.value
                    ));
                }
            }
        }
        
        js_output.push_str("  }\n\n");
        
        // Render method
        js_output.push_str("  render() {\n");
        if let Some(template) = &ast.template {
            js_output.push_str(&self.generate_render_function(template)?);
        }
        js_output.push_str("  }\n\n");
        
        // Methods
        if let Some(script) = &ast.script {
            for func in &script.functions {
                js_output.push_str(&format!(
                    "  {}({}) {{\n{}\n  }}\n\n",
                    func.name,
                    func.params.join(", "),
                    func.body
                ));
            }
        }
        
        // Reactive getters/setters
        if let Some(script) = &ast.script {
            for var in &script.variables {
                if var.reactive {
                    js_output.push_str(&format!(
                        "  get {}() {{ return this._state.{}; }}\n",
                        var.name, var.name
                    ));
                    js_output.push_str(&format!(
                        "  set {}(value) {{\n    this._state.{} = value;\n    this._update();\n  }}\n\n",
                        var.name, var.name
                    ));
                }
            }
        }
        
        // Update method
        js_output.push_str("  _update() {\n");
        js_output.push_str("    // Re-render component\n");
        js_output.push_str("    this.render();\n");
        js_output.push_str("  }\n");
        
        js_output.push_str("}\n\n");
        
        // Export
        js_output.push_str(&format!("export default {};\n", id));
        
        // Extract CSS
        let css = if let Some(style) = &ast.style {
            Some(self.generate_css(style, id)?)
        } else {
            None
        };
        
        Ok(CompiledComponent {
            id: id.to_string(),
            javascript: js_output,
            css,
            source_map: None, // TODO: Generate source maps
            dependencies,
        })
    }
    
    /// Parse component source into AST
    fn parse_component(&self, source: &str) -> Result<ComponentAST> {
        let mut ast = ComponentAST {
            template: None,
            script: None,
            style: None,
        };
        
        // Simple regex-based parsing for now
        // In production, use a proper HTML parser
        
        // Extract template
        if let Some(template_match) = extract_section(source, "template") {
            ast.template = Some(self.parse_template(&template_match)?);
        }
        
        // Extract script
        if let Some(script_match) = extract_section(source, "script") {
            ast.script = Some(self.parse_script(&script_match)?);
        }
        
        // Extract style
        if let Some(style_match) = extract_section(source, "style") {
            ast.style = Some(self.parse_style(&style_match)?);
        }
        
        Ok(ast)
    }
    
    /// Parse template section
    fn parse_template(&self, content: &str) -> Result<TemplateNode> {
        let mut elements = Vec::new();
        let mut bindings = Vec::new();
        
        // Simple HTML parsing
        // In production, use a proper HTML parser like html5ever
        
        // For now, create a simple div element
        elements.push(Element {
            tag: "div".to_string(),
            attributes: HashMap::new(),
            children: vec![ElementChild::Text(content.to_string())],
        });
        
        Ok(TemplateNode {
            elements,
            bindings,
        })
    }
    
    /// Parse script section
    fn parse_script(&self, content: &str) -> Result<ScriptNode> {
        let mut imports = Vec::new();
        let mut variables = Vec::new();
        let mut functions = Vec::new();
        let mut exports = Vec::new();
        
        // Parse imports
        let import_regex = regex::Regex::new(r"import\s+(.+?)\s+from\s+['\"](.+?)['\"]")?;
        for cap in import_regex.captures_iter(content) {
            imports.push(ImportStatement {
                specifiers: vec![cap[1].to_string()],
                source: cap[2].to_string(),
            });
        }
        
        // Parse variables
        let var_regex = regex::Regex::new(r"let\s+(\w+)\s*=\s*(.+?)(?:;|$)")?;
        for cap in var_regex.captures_iter(content) {
            variables.push(Variable {
                name: cap[1].to_string(),
                value: cap[2].to_string(),
                reactive: true,
            });
        }
        
        // Parse functions
        let func_regex = regex::Regex::new(r"function\s+(\w+)\s*\((.*?)\)\s*\{([^}]+)\}")?;
        for cap in func_regex.captures_iter(content) {
            functions.push(Function {
                name: cap[1].to_string(),
                params: cap[2].split(',').map(|s| s.trim().to_string()).collect(),
                body: cap[3].to_string(),
            });
        }
        
        Ok(ScriptNode {
            imports,
            variables,
            functions,
            exports,
        })
    }
    
    /// Parse style section
    fn parse_style(&self, content: &str) -> Result<StyleNode> {
        let mut rules = Vec::new();
        
        // Simple CSS parsing
        // In production, use a proper CSS parser
        
        let rule_regex = regex::Regex::new(r"([^{]+)\{([^}]+)\}")?;
        for cap in rule_regex.captures_iter(content) {
            let selector = cap[1].trim().to_string();
            let mut declarations = Vec::new();
            
            for decl in cap[2].split(';') {
                let parts: Vec<&str> = decl.split(':').collect();
                if parts.len() == 2 {
                    declarations.push((
                        parts[0].trim().to_string(),
                        parts[1].trim().to_string(),
                    ));
                }
            }
            
            rules.push(CSSRule {
                selector,
                declarations,
            });
        }
        
        Ok(StyleNode {
            rules,
            scoped: true,
        })
    }
    
    /// Generate render function from template
    fn generate_render_function(&self, template: &TemplateNode) -> Result<String> {
        let mut output = String::new();
        
        output.push_str("    const container = document.createElement('div');\n");
        
        for element in &template.elements {
            output.push_str(&self.generate_element_code(element, "container")?);
        }
        
        output.push_str("    return container;\n");
        
        Ok(output)
    }
    
    /// Generate code for an element
    fn generate_element_code(&self, element: &Element, parent_var: &str) -> Result<String> {
        let mut output = String::new();
        let elem_var = format!("elem_{}", rand::random::<u32>());
        
        output.push_str(&format!(
            "    const {} = document.createElement('{}');\n",
            elem_var, element.tag
        ));
        
        // Set attributes
        for (attr, value) in &element.attributes {
            output.push_str(&format!(
                "    {}.setAttribute('{}', '{}');\n",
                elem_var, attr, value
            ));
        }
        
        // Add children
        for child in &element.children {
            match child {
                ElementChild::Text(text) => {
                    output.push_str(&format!(
                        "    {}.textContent = '{}';\n",
                        elem_var, text
                    ));
                }
                ElementChild::Element(child_elem) => {
                    output.push_str(&self.generate_element_code(child_elem, &elem_var)?);
                }
                ElementChild::Expression(expr) => {
                    output.push_str(&format!(
                        "    {}.textContent = this.{};\n",
                        elem_var, expr
                    ));
                }
            }
        }
        
        output.push_str(&format!(
            "    {}.appendChild({});\n",
            parent_var, elem_var
        ));
        
        Ok(output)
    }
    
    /// Generate CSS from style node
    fn generate_css(&self, style: &StyleNode, component_id: &str) -> Result<String> {
        let mut output = String::new();
        
        for rule in &style.rules {
            // Scope CSS if needed
            let selector = if style.scoped {
                format!(".{} {}", component_id, rule.selector)
            } else {
                rule.selector.clone()
            };
            
            output.push_str(&format!("{} {{\n", selector));
            
            for (prop, value) in &rule.declarations {
                output.push_str(&format!("  {}: {};\n", prop, value));
            }
            
            output.push_str("}\n\n");
        }
        
        Ok(output)
    }
}

/// Extract section content from component source
fn extract_section(source: &str, tag: &str) -> Option<String> {
    let pattern = format!(r"<{}>(.+?)</{}>", tag, tag);
    let regex = regex::Regex::new(&pattern).ok()?;
    
    regex.captures(source)
        .and_then(|cap| cap.get(1))
        .map(|m| m.as_str().to_string())
}

// Parser implementations
struct TemplateParser;
struct ScriptParser;
struct StyleParser;

impl Parser for TemplateParser {
    fn parse(&self, content: &str) -> Result<ParsedSection> {
        Ok(ParsedSection {
            content: content.to_string(),
            imports: vec![],
            exports: vec![],
        })
    }
}

impl Parser for ScriptParser {
    fn parse(&self, content: &str) -> Result<ParsedSection> {
        Ok(ParsedSection {
            content: content.to_string(),
            imports: vec![],
            exports: vec![],
        })
    }
}

impl Parser for StyleParser {
    fn parse(&self, content: &str) -> Result<ParsedSection> {
        Ok(ParsedSection {
            content: content.to_string(),
            imports: vec![],
            exports: vec![],
        })
    }
}
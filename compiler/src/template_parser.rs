use anyhow::{Context, Result};

#[derive(Debug, Clone)]
pub enum TemplateNode {
    Element {
        tag: String,
        attributes: Vec<Attribute>,
        children: Vec<TemplateNode>,
    },
    Text(String),
    Interpolation {
        expression: String,
        raw_html: bool,
    },
    If {
        condition: String,
        then_branch: Vec<TemplateNode>,
        else_branch: Option<Vec<TemplateNode>>,
    },
    Each {
        items: String,
        item_name: String,
        index_name: Option<String>,
        key: Option<String>,
        children: Vec<TemplateNode>,
    },
}

#[derive(Debug, Clone)]
pub struct Attribute {
    pub name: String,
    pub value: AttributeValue,
}

#[derive(Debug, Clone)]
pub struct EventHandler {
    pub event: String,
    pub modifiers: Vec<String>,
    pub handler: String,
}

#[derive(Debug, Clone)]
pub enum AttributeValue {
    Static(String),
    Dynamic(String),
    EventHandler(EventHandler),
}

pub fn parse_template(template_str: &str) -> Result<Vec<TemplateNode>> {
    let mut parser = TemplateParser::new(template_str);
    parser.parse()
}

struct TemplateParser {
    input: String,
    position: usize,
}

impl TemplateParser {
    fn new(input: &str) -> Self {
        Self {
            input: input.to_string(),
            position: 0,
        }
    }

    fn parse(&mut self) -> Result<Vec<TemplateNode>> {
        let mut nodes = Vec::new();
        
        while self.position < self.input.len() {
            self.skip_whitespace();
            
            if self.position >= self.input.len() {
                break;
            }
            
            if self.peek_str("{#if") {
                nodes.push(self.parse_if_block()?);
            } else if self.peek_str("{#each") {
                nodes.push(self.parse_each_block()?);
            } else if self.peek_char('{') {
                nodes.push(self.parse_interpolation()?);
            } else if self.peek_char('<') {
                if self.peek_str("</") {
                    // End of parent element
                    break;
                } else {
                    nodes.push(self.parse_element()?);
                }
            } else {
                nodes.push(self.parse_text()?);
            }
        }
        
        Ok(nodes)
    }

    fn parse_element(&mut self) -> Result<TemplateNode> {
        self.expect_char('<')?;
        let tag = self.parse_identifier()?;
        let attributes = self.parse_attributes()?;
        
        // Check for self-closing tag
        self.skip_whitespace();
        if self.peek_char('/') {
            self.advance();
            self.expect_char('>')?;
            return Ok(TemplateNode::Element {
                tag,
                attributes,
                children: Vec::new(),
            });
        }
        
        self.expect_char('>')?;
        
        // Parse children
        let children = self.parse()?;
        
        // Parse closing tag
        self.expect_str(&format!("</{}>", tag))?;
        
        Ok(TemplateNode::Element {
            tag,
            attributes,
            children,
        })
    }

    fn parse_attributes(&mut self) -> Result<Vec<Attribute>> {
        let mut attributes = Vec::new();
        
        while !self.peek_char('>') && !self.peek_str("/>") {
            self.skip_whitespace();
            
            if self.peek_char('>') || self.peek_str("/>") {
                break;
            }
            
            let name = self.parse_identifier()?;
            
            if self.peek_char('=') {
                self.advance();
                let value = if name.starts_with('@') {
                    // Event handler with modifiers support
                    let event_parts: Vec<&str> = name[1..].split('.').collect();
                    let event_name = event_parts[0].to_string();
                    let modifiers = event_parts[1..].iter().map(|s| s.to_string()).collect();
                    
                    self.expect_char('{')?;
                    let handler = self.parse_until_char('}')?;
                    self.expect_char('}')?;
                    
                    AttributeValue::EventHandler(EventHandler {
                        event: event_name,
                        modifiers,
                        handler: handler.trim().to_string(),
                    })
                } else if self.peek_char('{') {
                    // Dynamic attribute
                    self.advance();
                    let expr = self.parse_until_char('}')?;
                    self.expect_char('}')?;
                    AttributeValue::Dynamic(expr)
                } else if self.peek_char('"') {
                    // Static string attribute
                    self.advance();
                    let value = self.parse_until_char('"')?;
                    self.expect_char('"')?;
                    AttributeValue::Static(value)
                } else {
                    // Unquoted attribute
                    let value = self.parse_identifier()?;
                    AttributeValue::Static(value)
                };
                
                attributes.push(Attribute { name, value });
            } else {
                // Boolean attribute
                attributes.push(Attribute {
                    name,
                    value: AttributeValue::Static("true".to_string()),
                });
            }
        }
        
        Ok(attributes)
    }

    fn parse_interpolation(&mut self) -> Result<TemplateNode> {
        self.expect_char('{')?;
        
        // Check for @html directive
        let raw_html = if self.peek_char('@') {
            self.advance();
            self.expect_str("html")?;
            self.skip_whitespace();
            true
        } else {
            false
        };
        
        let expr = self.parse_expression_until_closing_brace()?;
        self.expect_char('}')?;
        
        Ok(TemplateNode::Interpolation {
            expression: expr.trim().to_string(),
            raw_html,
        })
    }
    
    fn parse_expression_until_closing_brace(&mut self) -> Result<String> {
        let mut result = String::new();
        let mut depth = 0;
        let mut in_string = false;
        let mut string_char = ' ';
        let mut escape_next = false;
        
        while self.position < self.input.len() {
            let ch = self.current_char();
            
            if escape_next {
                result.push(ch);
                self.advance();
                escape_next = false;
                continue;
            }
            
            if ch == '\\' {
                escape_next = true;
                result.push(ch);
                self.advance();
                continue;
            }
            
            if !in_string {
                if ch == '"' || ch == '\'' || ch == '`' {
                    in_string = true;
                    string_char = ch;
                } else if ch == '{' {
                    depth += 1;
                } else if ch == '}' {
                    if depth == 0 {
                        break;
                    }
                    depth -= 1;
                }
            } else if ch == string_char {
                in_string = false;
            }
            
            result.push(ch);
            self.advance();
        }
        
        Ok(result)
    }

    fn parse_if_block(&mut self) -> Result<TemplateNode> {
        self.expect_str("{#if")?;
        self.skip_whitespace();
        let condition = self.parse_until_char('}')?;
        self.expect_char('}')?;
        
        let then_branch = self.parse_until_block_end("if")?;
        
        let else_branch = if self.peek_str("{#else") {
            self.expect_str("{#else")?;
            if self.peek_str(" if") {
                // else if - treat as nested if
                self.expect_str(" if")?;
                self.skip_whitespace();
                let else_condition = self.parse_until_char('}')?;
                self.expect_char('}')?;
                let else_then = self.parse_until_block_end("if")?;
                Some(vec![TemplateNode::If {
                    condition: else_condition,
                    then_branch: else_then,
                    else_branch: None,
                }])
            } else {
                self.expect_char('}')?;
                Some(self.parse_until_block_end("if")?)
            }
        } else {
            None
        };
        
        self.expect_str("{/if}")?;
        
        Ok(TemplateNode::If {
            condition,
            then_branch,
            else_branch,
        })
    }

    fn parse_each_block(&mut self) -> Result<TemplateNode> {
        self.expect_str("{#each")?;
        self.skip_whitespace();
        
        let items = self.parse_identifier()?;
        self.skip_whitespace();
        self.expect_str("as")?;
        self.skip_whitespace();
        
        let item_name = self.parse_identifier()?;
        let mut index_name = None;
        let mut key = None;
        
        // Check for index
        if self.peek_char(',') {
            self.advance();
            self.skip_whitespace();
            index_name = Some(self.parse_identifier()?);
        }
        
        // Check for key
        self.skip_whitespace();
        if self.peek_char('(') {
            self.advance();
            key = Some(self.parse_until_char(')')?);
            self.expect_char(')')?;
        }
        
        self.expect_char('}')?;
        
        let children = self.parse_until_block_end("each")?;
        
        self.expect_str("{/each}")?;
        
        Ok(TemplateNode::Each {
            items,
            item_name,
            index_name,
            key,
            children,
        })
    }

    fn parse_text(&mut self) -> Result<TemplateNode> {
        let mut text = String::new();
        
        while self.position < self.input.len() && !self.peek_char('<') && !self.peek_char('{') {
            text.push(self.current_char());
            self.advance();
        }
        
        Ok(TemplateNode::Text(text))
    }

    fn parse_until_block_end(&mut self, block_type: &str) -> Result<Vec<TemplateNode>> {
        let end_pattern = format!("{{/{}}}", block_type);
        let else_pattern = "{#else";
        
        let mut nodes = Vec::new();
        
        while self.position < self.input.len() {
            if self.peek_str(&end_pattern) || self.peek_str(else_pattern) {
                break;
            }
            
            let node_result = if self.peek_str("{#if") {
                self.parse_if_block()
            } else if self.peek_str("{#each") {
                self.parse_each_block()
            } else if self.peek_char('{') {
                self.parse_interpolation()
            } else if self.peek_char('<') {
                self.parse_element()
            } else {
                self.parse_text()
            };
            
            nodes.push(node_result?);
        }
        
        Ok(nodes)
    }

    // Helper methods
    fn current_char(&self) -> char {
        self.input.chars().nth(self.position).unwrap_or('\0')
    }

    fn peek_char(&self, ch: char) -> bool {
        self.current_char() == ch
    }

    fn peek_str(&self, s: &str) -> bool {
        self.input[self.position..].starts_with(s)
    }

    fn advance(&mut self) {
        if self.position < self.input.len() {
            self.position += 1;
        }
    }

    fn skip_whitespace(&mut self) {
        while self.position < self.input.len() && self.current_char().is_whitespace() {
            self.advance();
        }
    }

    fn expect_char(&mut self, ch: char) -> Result<()> {
        if self.current_char() == ch {
            self.advance();
            Ok(())
        } else {
            anyhow::bail!("Expected '{}' but found '{}'", ch, self.current_char())
        }
    }

    fn expect_str(&mut self, s: &str) -> Result<()> {
        if self.peek_str(s) {
            self.position += s.len();
            Ok(())
        } else {
            anyhow::bail!("Expected '{}' at position {}", s, self.position)
        }
    }

    fn parse_identifier(&mut self) -> Result<String> {
        let mut ident = String::new();
        
        // Handle special prefixes like @
        if self.current_char() == '@' {
            ident.push(self.current_char());
            self.advance();
        }
        
        while self.position < self.input.len() {
            let ch = self.current_char();
            if ch.is_alphanumeric() || ch == '_' || ch == '-' || ch == '.' {
                ident.push(ch);
                self.advance();
            } else {
                break;
            }
        }
        
        if ident.is_empty() {
            anyhow::bail!("Expected identifier at position {}", self.position)
        }
        
        Ok(ident)
    }

    fn parse_until_char(&mut self, end_char: char) -> Result<String> {
        let mut result = String::new();
        let mut brace_count = 0;
        
        while self.position < self.input.len() {
            let ch = self.current_char();
            
            if ch == '{' {
                brace_count += 1;
            } else if ch == '}' {
                if brace_count > 0 {
                    brace_count -= 1;
                } else if ch == end_char {
                    break;
                }
            } else if ch == end_char && brace_count == 0 {
                break;
            }
            
            result.push(ch);
            self.advance();
        }
        
        Ok(result)
    }
}
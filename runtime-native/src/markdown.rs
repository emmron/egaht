//! Markdown Processing for .eg Files
//! 
//! Enhanced markdown parser with reactive bindings

use pulldown_cmark::{Parser, Event, Tag, Options};
use std::collections::HashMap;
use crate::{StateValue, RuntimeError};

/// Parse enhanced markdown with Eghact extensions
pub fn parse_eghact_markdown(content: &str) -> Result<MarkdownDocument, RuntimeError> {
    let mut doc = MarkdownDocument {
        frontmatter: HashMap::new(),
        sections: Vec::new(),
        metadata: DocumentMetadata::default(),
    };
    
    // Split frontmatter and content
    let parts: Vec<&str> = content.splitn(3, "---").collect();
    
    if parts.len() >= 3 {
        // Parse YAML frontmatter
        doc.frontmatter = parse_yaml_frontmatter(parts[1])?;
        
        // Parse markdown content
        let markdown_content = parts[2];
        doc.sections = parse_markdown_sections(markdown_content)?;
    } else {
        // No frontmatter, parse entire content
        doc.sections = parse_markdown_sections(content)?;
    }
    
    // Extract metadata
    doc.metadata = extract_metadata(&doc);
    
    Ok(doc)
}

/// Markdown document structure
#[derive(Debug, Clone)]
pub struct MarkdownDocument {
    pub frontmatter: HashMap<String, StateValue>,
    pub sections: Vec<MarkdownSection>,
    pub metadata: DocumentMetadata,
}

/// Document metadata
#[derive(Debug, Clone, Default)]
pub struct DocumentMetadata {
    pub title: Option<String>,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub created: Option<String>,
    pub modified: Option<String>,
    pub author: Option<String>,
}

/// Markdown section
#[derive(Debug, Clone)]
pub struct MarkdownSection {
    pub id: String,
    pub level: usize,
    pub title: String,
    pub content: Vec<MarkdownNode>,
    pub attributes: HashMap<String, String>,
}

/// Markdown node types
#[derive(Debug, Clone)]
pub enum MarkdownNode {
    Paragraph(Vec<InlineNode>),
    Heading {
        level: usize,
        content: Vec<InlineNode>,
        id: Option<String>,
    },
    CodeBlock {
        language: Option<String>,
        content: String,
    },
    List {
        ordered: bool,
        items: Vec<Vec<MarkdownNode>>,
    },
    BlockQuote(Vec<MarkdownNode>),
    HorizontalRule,
    Table {
        headers: Vec<String>,
        rows: Vec<Vec<String>>,
    },
    // Eghact extensions
    Component {
        name: String,
        props: HashMap<String, String>,
        children: Vec<MarkdownNode>,
    },
    ForLoop {
        item: String,
        collection: String,
        body: Vec<MarkdownNode>,
    },
    Conditional {
        condition: String,
        then_branch: Vec<MarkdownNode>,
        else_branch: Option<Vec<MarkdownNode>>,
    },
}

/// Inline node types
#[derive(Debug, Clone)]
pub enum InlineNode {
    Text(String),
    Emphasis(Vec<InlineNode>),
    Strong(Vec<InlineNode>),
    Code(String),
    Link {
        text: Vec<InlineNode>,
        url: String,
        title: Option<String>,
    },
    Image {
        alt: String,
        url: String,
        title: Option<String>,
    },
    // Eghact extensions
    Interpolation(String),
    InlineComponent {
        name: String,
        props: HashMap<String, String>,
    },
}

/// Parse YAML frontmatter
fn parse_yaml_frontmatter(yaml: &str) -> Result<HashMap<String, StateValue>, RuntimeError> {
    let value: serde_yaml::Value = serde_yaml::from_str(yaml)
        .map_err(|e| RuntimeError::ParseError(format!("Invalid YAML: {}", e)))?;
    
    if let serde_yaml::Value::Mapping(map) = value {
        let mut result = HashMap::new();
        
        for (k, v) in map {
            if let serde_yaml::Value::String(key) = k {
                result.insert(key, yaml_value_to_state(v));
            }
        }
        
        Ok(result)
    } else {
        Ok(HashMap::new())
    }
}

/// Convert YAML value to StateValue
fn yaml_value_to_state(value: serde_yaml::Value) -> StateValue {
    use serde_yaml::Value;
    
    match value {
        Value::Null => StateValue::Null,
        Value::Bool(b) => StateValue::Bool(b),
        Value::Number(n) => StateValue::Number(n.as_f64().unwrap_or(0.0)),
        Value::String(s) => StateValue::String(s),
        Value::Sequence(seq) => StateValue::Array(
            seq.into_iter().map(yaml_value_to_state).collect()
        ),
        Value::Mapping(map) => {
            let mut obj = HashMap::new();
            for (k, v) in map {
                if let Value::String(key) = k {
                    obj.insert(key, yaml_value_to_state(v));
                }
            }
            StateValue::Object(obj)
        }
    }
}

/// Parse markdown sections
fn parse_markdown_sections(content: &str) -> Result<Vec<MarkdownSection>, RuntimeError> {
    let mut sections = Vec::new();
    let mut current_section: Option<MarkdownSection> = None;
    
    // Set up parser with extensions
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_FOOTNOTES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);
    
    let parser = Parser::new_ext(content, options);
    let mut events = parser.peekable();
    
    while let Some(event) = events.next() {
        match event {
            Event::Start(Tag::Heading(level)) => {
                // Save previous section
                if let Some(section) = current_section.take() {
                    sections.push(section);
                }
                
                // Start new section
                let heading_content = collect_heading_content(&mut events);
                let (title, id, attributes) = parse_heading_attributes(&heading_content);
                
                current_section = Some(MarkdownSection {
                    id: id.unwrap_or_else(|| slugify(&title)),
                    level: level as usize,
                    title,
                    content: Vec::new(),
                    attributes,
                });
            }
            _ => {
                // Parse content into current section
                if current_section.is_none() {
                    // Create default section for content before first heading
                    current_section = Some(MarkdownSection {
                        id: "content".to_string(),
                        level: 0,
                        title: "Content".to_string(),
                        content: Vec::new(),
                        attributes: HashMap::new(),
                    });
                }
                
                if let Some(ref mut section) = current_section {
                    if let Some(node) = parse_markdown_node(event, &mut events)? {
                        section.content.push(node);
                    }
                }
            }
        }
    }
    
    // Save final section
    if let Some(section) = current_section {
        sections.push(section);
    }
    
    Ok(sections)
}

/// Parse a markdown node
fn parse_markdown_node<I>(event: Event, events: &mut I) -> Result<Option<MarkdownNode>, RuntimeError>
where
    I: Iterator<Item = Event<'static>>,
{
    match event {
        Event::Start(Tag::Paragraph) => {
            let content = collect_inline_content(events, Tag::Paragraph)?;
            Ok(Some(MarkdownNode::Paragraph(content)))
        }
        Event::Start(Tag::CodeBlock(kind)) => {
            let language = match kind {
                pulldown_cmark::CodeBlockKind::Fenced(lang) => {
                    if lang.is_empty() {
                        None
                    } else {
                        Some(lang.to_string())
                    }
                }
                _ => None,
            };
            
            let mut content = String::new();
            while let Some(event) = events.next() {
                match event {
                    Event::Text(text) => content.push_str(&text),
                    Event::End(Tag::CodeBlock(_)) => break,
                    _ => {}
                }
            }
            
            Ok(Some(MarkdownNode::CodeBlock { language, content }))
        }
        Event::Start(Tag::List(ordered)) => {
            let items = collect_list_items(events, ordered)?;
            Ok(Some(MarkdownNode::List {
                ordered: ordered.is_some(),
                items,
            }))
        }
        Event::Start(Tag::BlockQuote) => {
            let content = collect_block_content(events, Tag::BlockQuote)?;
            Ok(Some(MarkdownNode::BlockQuote(content)))
        }
        Event::Rule => Ok(Some(MarkdownNode::HorizontalRule)),
        Event::Start(Tag::Table(alignment)) => {
            let (headers, rows) = collect_table_content(events)?;
            Ok(Some(MarkdownNode::Table { headers, rows }))
        }
        Event::Text(text) => {
            // Check for Eghact extensions
            if text.starts_with("[!") {
                // Component syntax
                Ok(parse_component_syntax(&text))
            } else if text.starts_with(":::for") {
                // For loop syntax
                Ok(parse_for_loop_syntax(&text, events))
            } else if text.starts_with(":::if") {
                // Conditional syntax
                Ok(parse_conditional_syntax(&text, events))
            } else {
                // Regular text node
                Ok(Some(MarkdownNode::Paragraph(vec![parse_inline_text(&text)])))
            }
        }
        _ => Ok(None),
    }
}

/// Collect inline content
fn collect_inline_content<I>(events: &mut I, end_tag: Tag) -> Result<Vec<InlineNode>, RuntimeError>
where
    I: Iterator<Item = Event<'static>>,
{
    let mut content = Vec::new();
    
    while let Some(event) = events.next() {
        match event {
            Event::End(tag) if tag == end_tag => break,
            Event::Text(text) => content.push(parse_inline_text(&text)),
            Event::Start(Tag::Emphasis) => {
                let inner = collect_inline_content(events, Tag::Emphasis)?;
                content.push(InlineNode::Emphasis(inner));
            }
            Event::Start(Tag::Strong) => {
                let inner = collect_inline_content(events, Tag::Strong)?;
                content.push(InlineNode::Strong(inner));
            }
            Event::Code(code) => content.push(InlineNode::Code(code.to_string())),
            Event::Start(Tag::Link(_, url, title)) => {
                let text = collect_inline_content(events, Tag::Link(pulldown_cmark::LinkType::Inline, url.clone(), title.clone()))?;
                content.push(InlineNode::Link {
                    text,
                    url: url.to_string(),
                    title: if title.is_empty() { None } else { Some(title.to_string()) },
                });
            }
            Event::Start(Tag::Image(_, url, title)) => {
                let alt_text = collect_text_content(events, Tag::Image(pulldown_cmark::LinkType::Inline, url.clone(), title.clone()));
                content.push(InlineNode::Image {
                    alt: alt_text,
                    url: url.to_string(),
                    title: if title.is_empty() { None } else { Some(title.to_string()) },
                });
            }
            _ => {}
        }
    }
    
    Ok(content)
}

/// Parse inline text with interpolations
fn parse_inline_text(text: &str) -> InlineNode {
    // Check for interpolations
    if text.contains('{') && text.contains('}') {
        // For now, return as text
        // In full implementation, would parse interpolations
        InlineNode::Text(text.to_string())
    } else {
        InlineNode::Text(text.to_string())
    }
}

/// Collect heading content
fn collect_heading_content<I>(events: &mut I) -> String
where
    I: Iterator<Item = Event<'static>>,
{
    let mut content = String::new();
    
    while let Some(event) = events.next() {
        match event {
            Event::Text(text) => content.push_str(&text),
            Event::End(Tag::Heading(_)) => break,
            _ => {}
        }
    }
    
    content
}

/// Parse heading attributes
fn parse_heading_attributes(heading: &str) -> (String, Option<String>, HashMap<String, String>) {
    let mut title = heading.to_string();
    let mut id = None;
    let mut attributes = HashMap::new();
    
    // Extract ID {#some-id}
    if let Some(id_start) = heading.find("{#") {
        if let Some(id_end) = heading[id_start+2..].find('}') {
            id = Some(heading[id_start+2..id_start+2+id_end].to_string());
            title = heading[..id_start].trim().to_string();
        }
    }
    
    // Extract attributes {.class data-foo="bar"}
    // Simplified parsing for now
    
    (title, id, attributes)
}

/// Create slug from title
fn slugify(text: &str) -> String {
    text.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

/// Collect block content
fn collect_block_content<I>(events: &mut I, end_tag: Tag) -> Result<Vec<MarkdownNode>, RuntimeError>
where
    I: Iterator<Item = Event<'static>>,
{
    let mut content = Vec::new();
    
    while let Some(event) = events.next() {
        match event {
            Event::End(tag) if tag == end_tag => break,
            _ => {
                if let Some(node) = parse_markdown_node(event, events)? {
                    content.push(node);
                }
            }
        }
    }
    
    Ok(content)
}

/// Collect list items
fn collect_list_items<I>(events: &mut I, ordered: Option<u64>) -> Result<Vec<Vec<MarkdownNode>>, RuntimeError>
where
    I: Iterator<Item = Event<'static>>,
{
    let mut items = Vec::new();
    let mut current_item = Vec::new();
    
    while let Some(event) = events.next() {
        match event {
            Event::Start(Tag::Item) => {
                if !current_item.is_empty() {
                    items.push(current_item);
                    current_item = Vec::new();
                }
            }
            Event::End(Tag::List(_)) => {
                if !current_item.is_empty() {
                    items.push(current_item);
                }
                break;
            }
            _ => {
                if let Some(node) = parse_markdown_node(event, events)? {
                    current_item.push(node);
                }
            }
        }
    }
    
    Ok(items)
}

/// Collect table content
fn collect_table_content<I>(events: &mut I) -> Result<(Vec<String>, Vec<Vec<String>>), RuntimeError>
where
    I: Iterator<Item = Event<'static>>,
{
    let mut headers = Vec::new();
    let mut rows = Vec::new();
    let mut current_row = Vec::new();
    let mut in_header = true;
    
    while let Some(event) = events.next() {
        match event {
            Event::Start(Tag::TableHead) => in_header = true,
            Event::End(Tag::TableHead) => in_header = false,
            Event::Start(Tag::TableRow) => {
                if !current_row.is_empty() {
                    if in_header {
                        headers = current_row.clone();
                    } else {
                        rows.push(current_row);
                    }
                    current_row = Vec::new();
                }
            }
            Event::Text(text) => current_row.push(text.to_string()),
            Event::End(Tag::Table(_)) => {
                if !current_row.is_empty() && !in_header {
                    rows.push(current_row);
                }
                break;
            }
            _ => {}
        }
    }
    
    Ok((headers, rows))
}

/// Collect text content
fn collect_text_content<I>(events: &mut I, end_tag: Tag) -> String
where
    I: Iterator<Item = Event<'static>>,
{
    let mut content = String::new();
    
    while let Some(event) = events.next() {
        match event {
            Event::Text(text) => content.push_str(&text),
            Event::End(tag) if tag == end_tag => break,
            _ => {}
        }
    }
    
    content
}

/// Parse component syntax
fn parse_component_syntax(text: &str) -> Option<MarkdownNode> {
    // Simplified component parsing
    // [!ComponentName prop="value"]
    
    if let Some(start) = text.find("[!") {
        if let Some(end) = text.find(']') {
            let component_str = &text[start+2..end];
            let parts: Vec<&str> = component_str.split_whitespace().collect();
            
            if !parts.is_empty() {
                let name = parts[0].to_string();
                let mut props = HashMap::new();
                
                // Parse props
                for part in &parts[1..] {
                    if let Some(eq) = part.find('=') {
                        let key = part[..eq].to_string();
                        let value = part[eq+1..].trim_matches('"').to_string();
                        props.insert(key, value);
                    }
                }
                
                return Some(MarkdownNode::Component {
                    name,
                    props,
                    children: Vec::new(),
                });
            }
        }
    }
    
    None
}

/// Parse for loop syntax
fn parse_for_loop_syntax<I>(text: &str, events: &mut I) -> Option<MarkdownNode>
where
    I: Iterator<Item = Event<'static>>,
{
    // :::for item in collection
    let parts: Vec<&str> = text.split_whitespace().collect();
    
    if parts.len() >= 4 && parts[0] == ":::for" && parts[2] == "in" {
        let item = parts[1].to_string();
        let collection = parts[3].to_string();
        
        // Collect body until :::
        let body = collect_until_delimiter(events, ":::");
        
        return Some(MarkdownNode::ForLoop {
            item,
            collection,
            body,
        });
    }
    
    None
}

/// Parse conditional syntax
fn parse_conditional_syntax<I>(text: &str, events: &mut I) -> Option<MarkdownNode>
where
    I: Iterator<Item = Event<'static>>,
{
    // :::if condition
    let condition = text.trim_start_matches(":::if").trim().to_string();
    
    let then_branch = collect_until_delimiter(events, ":::else");
    let else_branch = collect_until_delimiter(events, ":::");
    
    Some(MarkdownNode::Conditional {
        condition,
        then_branch,
        else_branch: if else_branch.is_empty() { None } else { Some(else_branch) },
    })
}

/// Collect nodes until delimiter
fn collect_until_delimiter<I>(events: &mut I, delimiter: &str) -> Vec<MarkdownNode>
where
    I: Iterator<Item = Event<'static>>,
{
    let mut nodes = Vec::new();
    
    while let Some(event) = events.next() {
        if let Event::Text(text) = &event {
            if text.trim() == delimiter {
                break;
            }
        }
        
        if let Ok(Some(node)) = parse_markdown_node(event, events) {
            nodes.push(node);
        }
    }
    
    nodes
}

/// Extract metadata from document
fn extract_metadata(doc: &MarkdownDocument) -> DocumentMetadata {
    let mut metadata = DocumentMetadata::default();
    
    // Extract from frontmatter
    if let Some(StateValue::String(title)) = doc.frontmatter.get("title") {
        metadata.title = Some(title.clone());
    }
    
    if let Some(StateValue::String(desc)) = doc.frontmatter.get("description") {
        metadata.description = Some(desc.clone());
    }
    
    if let Some(StateValue::Array(tags)) = doc.frontmatter.get("tags") {
        metadata.tags = tags.iter()
            .filter_map(|v| {
                if let StateValue::String(s) = v {
                    Some(s.clone())
                } else {
                    None
                }
            })
            .collect();
    }
    
    // Extract from first heading if no title
    if metadata.title.is_none() {
        if let Some(section) = doc.sections.first() {
            metadata.title = Some(section.title.clone());
        }
    }
    
    metadata
}
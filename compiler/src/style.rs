use anyhow::Result;
use crypto::{digest::Digest, sha2::Sha256};

pub struct StyleProcessor {
    component_id: String,
}

impl StyleProcessor {
    pub fn new(component_id: String) -> Self {
        Self { component_id }
    }
    
    pub fn process_styles(&self, styles: &str) -> Result<ProcessedStyles> {
        // Generate a unique scope hash for this component
        let scope_hash = self.generate_scope_hash();
        
        // Add scope to all CSS selectors
        let scoped_css = self.scope_css(styles, &scope_hash)?;
        
        Ok(ProcessedStyles {
            css: scoped_css,
            scope_class: format!("egh-{}", scope_hash),
        })
    }
    
    fn generate_scope_hash(&self) -> String {
        // Generate a short hash based on component ID
        let mut hasher = Sha256::new();
        hasher.input_str(&self.component_id);
        let hash = hasher.result_str();
        // Take first 8 characters for brevity
        hash[..8].to_string()
    }
    
    fn scope_css(&self, css: &str, scope_hash: &str) -> Result<String> {
        let scope_class = format!(".egh-{}", scope_hash);
        let mut scoped = String::new();
        
        // Simple CSS scoping - in production, use a proper CSS parser
        let lines = css.lines();
        let mut in_rule = false;
        
        for line in lines {
            let trimmed = line.trim();
            
            if trimmed.is_empty() {
                scoped.push('\n');
                continue;
            }
            
            // Check if this is a selector line (not inside a rule)
            if !in_rule && !trimmed.starts_with('@') && trimmed.contains('{') {
                // This is a selector line
                let selector_end = trimmed.find('{').unwrap();
                let selector = &trimmed[..selector_end].trim();
                let rest = &trimmed[selector_end..];
                
                // Add scope to selector
                let scoped_selector = self.add_scope_to_selector(selector, &scope_class);
                scoped.push_str(&scoped_selector);
                scoped.push_str(rest);
                scoped.push('\n');
                in_rule = true;
            } else if trimmed.contains('}') {
                scoped.push_str(line);
                scoped.push('\n');
                in_rule = false;
            } else {
                // Regular line
                scoped.push_str(line);
                scoped.push('\n');
            }
        }
        
        Ok(scoped)
    }
    
    fn add_scope_to_selector(&self, selector: &str, scope_class: &str) -> String {
        // Handle multiple selectors separated by commas
        let selectors: Vec<&str> = selector.split(',').collect();
        let scoped_selectors: Vec<String> = selectors
            .into_iter()
            .map(|s| {
                let s = s.trim();
                // Skip global selectors
                if s.starts_with(":global(") {
                    s.to_string()
                } else {
                    format!("{} {}", scope_class, s)
                }
            })
            .collect();
        
        scoped_selectors.join(", ")
    }
}

#[derive(Debug)]
pub struct ProcessedStyles {
    pub css: String,
    pub scope_class: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_scope_css() {
        let processor = StyleProcessor::new("test-component".to_string());
        let css = r#"
.counter {
    text-align: center;
}

button {
    margin: 0 0.5rem;
}
"#;
        
        let result = processor.process_styles(css).unwrap();
        assert!(result.css.contains(".egh-"));
        assert!(result.css.contains(".counter"));
        assert!(result.css.contains("button"));
    }
}
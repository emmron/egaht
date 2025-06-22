use anyhow::Result;
use eghact_compiler::template_parser::parse_template;
use eghact_compiler::template_codegen::SecureTemplateCodegen;
use eghact_compiler::codegen::escape_html;

#[test]
fn test_html_escape_function() {
    // Test basic HTML escaping
    assert_eq!(escape_html("Hello World"), "Hello World");
    assert_eq!(escape_html("<script>alert('xss')</script>"), "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;");
    assert_eq!(escape_html("\"quoted\" & 'single'"), "&quot;quoted&quot; &amp; &#x27;single&#x27;");
    
    // Test common XSS payloads
    assert_eq!(escape_html("<img src=x onerror=alert('XSS')>"), "&lt;img src=x onerror=alert(&#x27;XSS&#x27;)&gt;");
    assert_eq!(escape_html("javascript:alert('XSS')"), "javascript:alert(&#x27;XSS&#x27;)");
}

#[test]
fn test_safe_interpolation_parsing() -> Result<()> {
    // Test that interpolations are properly parsed with raw_html flag
    let template = r#"
        <div>
            <p>{username}</p>
            <p>{@html trustedContent}</p>
            <span>{count}</span>
        </div>
    "#;
    
    let nodes = parse_template(template)?;
    
    // Find interpolation nodes and verify raw_html flag
    let mut found_unsafe = false;
    let mut found_safe = false;
    
    fn check_nodes(nodes: &[eghact_compiler::template_parser::TemplateNode], found_unsafe: &mut bool, found_safe: &mut bool) {
        for node in nodes {
            match node {
                eghact_compiler::template_parser::TemplateNode::Element { children, .. } => {
                    check_nodes(children, found_unsafe, found_safe);
                }
                eghact_compiler::template_parser::TemplateNode::Interpolation { expression, raw_html } => {
                    if expression == "trustedContent" && *raw_html {
                        *found_safe = true;
                    } else if (expression == "username" || expression == "count") && !*raw_html {
                        *found_unsafe = true;
                    }
                }
                _ => {}
            }
        }
    }
    
    check_nodes(&nodes, &mut found_unsafe, &mut found_safe);
    
    assert!(found_unsafe, "Should find unsafe interpolations that need escaping");
    assert!(found_safe, "Should find @html interpolation that bypasses escaping");
    
    Ok(())
}

#[test]
fn test_secure_template_code_generation() -> Result<()> {
    // Test that the code generator produces secure JavaScript
    let template = r#"
        <div class="container">
            <h1>{title}</h1>
            <p>{@html description}</p>
            <input value="{userInput}" />
        </div>
    "#;
    
    let nodes = parse_template(template)?;
    let codegen = SecureTemplateCodegen::new("TestComponent".to_string());
    let statements = codegen.generate_template_code(&nodes)?;
    
    // Convert statements to string to verify they contain security measures
    let code_str = format!("{:?}", statements);
    
    // Verify that escaping is applied for unsafe interpolations
    assert!(code_str.contains("escapeHtml"), "Generated code should use escapeHtml for unsafe content");
    
    // Verify that @html directive uses different method
    assert!(code_str.contains("setInnerHTML") || code_str.contains("setTextRaw"), 
            "Generated code should use different method for @html content");
    
    // Verify that attributes are handled securely
    assert!(code_str.contains("setAttribute"), "Generated code should set attributes securely");
    
    Ok(())
}

#[test]
fn test_xss_attack_vectors() {
    // Test various XSS attack vectors are properly escaped
    let attacks = vec![
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert('XSS')>",
        "<svg onload=alert('XSS')>",
        "javascript:alert('XSS')",
        "';alert('XSS');//",
        "<iframe src='javascript:alert(\"XSS\")'></iframe>",
        "<body onload=alert('XSS')>",
        "<input onfocus=alert('XSS') autofocus>",
    ];
    
    for attack in attacks {
        let escaped = escape_html(attack);
        
        // Verify that dangerous characters are escaped
        assert!(!escaped.contains("<script"), "Script tags should be escaped: {}", escaped);
        assert!(!escaped.contains("onerror="), "Event handlers should be escaped: {}", escaped);
        assert!(!escaped.contains("javascript:"), "JavaScript URLs should be escaped: {}", escaped);
        assert!(!escaped.contains("<iframe"), "Iframe tags should be escaped: {}", escaped);
        assert!(!escaped.contains("onload="), "Onload handlers should be escaped: {}", escaped);
        assert!(!escaped.contains("onfocus="), "Onfocus handlers should be escaped: {}", escaped);
    }
}

#[test]
fn test_url_attribute_handling() -> Result<()> {
    // Test that URL attributes get special handling
    let template = r#"
        <a href="{userUrl}">Link</a>
        <img src="{userImage}" alt="{userAlt}" />
        <form action="{userAction}">
            <input type="text" value="{userValue}" />
        </form>
    "#;
    
    let nodes = parse_template(template)?;
    let codegen = SecureTemplateCodegen::new("TestComponent".to_string());
    let statements = codegen.generate_template_code(&nodes)?;
    
    let code_str = format!("{:?}", statements);
    
    // URL attributes should use secure URL validation
    assert!(code_str.contains("setSecureUrlAttribute"), 
            "URL attributes should use secure URL validation");
    
    // Non-URL attributes should use regular escaping
    assert!(code_str.contains("escapeHtml"), 
            "Non-URL attributes should use HTML escaping");
    
    Ok(())
}

#[test]
fn test_nested_elements_security() -> Result<()> {
    // Test that nested elements maintain security
    let template = r#"
        <div>
            <ul>
                <li>{item1}</li>
                <li>{@html item2}</li>
                <li><span>{item3}</span></li>
            </ul>
        </div>
    "#;
    
    let nodes = parse_template(template)?;
    let codegen = SecureTemplateCodegen::new("TestComponent".to_string());
    let statements = codegen.generate_template_code(&nodes)?;
    
    let code_str = format!("{:?}", statements);
    
    // Should have both secure and raw text handling
    assert!(code_str.contains("escapeHtml"), "Should escape normal interpolations");
    assert!(code_str.contains("setInnerHTML") || code_str.contains("setTextRaw"), 
            "Should handle @html interpolations differently");
    
    Ok(())
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    
    #[test]
    fn test_end_to_end_xss_protection() -> Result<()> {
        // Simulate a complete compilation with XSS protection
        let malicious_template = r#"
            <div class="user-content">
                <h2>{userTitle}</h2>
                <p>{userBio}</p>
                <div>{@html adminContent}</div>
                <img src="{userAvatar}" alt="{userAlt}" />
            </div>
        "#;
        
        // Parse template
        let nodes = parse_template(malicious_template)?;
        
        // Generate secure code
        let codegen = SecureTemplateCodegen::new("UserProfile".to_string());
        let statements = codegen.generate_template_code(&nodes)?;
        
        // Verify security measures are in place
        let code_str = format!("{:?}", statements);
        
        // Check that user content is escaped
        assert!(code_str.contains("escapeHtml"), "User content should be escaped");
        
        // Check that admin content can use raw HTML
        assert!(code_str.contains("setInnerHTML") || code_str.contains("setTextRaw"), 
                "Admin content should allow raw HTML");
        
        // Check that URL attributes are handled securely
        assert!(code_str.contains("setSecureUrlAttribute"), 
                "URL attributes should be validated");
        
        println!("✅ End-to-end XSS protection test passed");
        
        Ok(())
    }
}
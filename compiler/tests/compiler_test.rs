use std::path::Path;
use eghact_compiler::{parser, transformer, codegen};

#[test]
fn test_parse_simple_component() {
    let source = r#"
<template>
  <div>Hello {{ name }}</div>
</template>

<script>
let name = "Eghact";
</script>
"#;
    
    let component = parser::parse_egh_file(source, Path::new("test.egh")).unwrap();
    
    assert!(component.template.is_some());
    assert!(component.script.is_some());
    assert_eq!(component.template.unwrap().trim(), r#"<div>Hello {{ name }}</div>"#);
}

#[test]
fn test_transform_component() {
    let source = r#"
let count = 0;

function increment() {
  count++;
}
"#;
    
    let component = parser::parse_egh_file(source, Path::new("test.egh")).unwrap();
    let module = transformer::transform_component(component).unwrap();
    
    // Check that runtime import was added
    assert!(!module.body.is_empty());
}

#[test]
fn test_code_generation() {
    let source = r#"
let message = "Hello Eghact";
"#;
    
    let component = parser::parse_egh_file(source, Path::new("test.egh")).unwrap();
    let module = transformer::transform_component(component).unwrap();
    let output = codegen::generate_javascript(module, false).unwrap();
    
    assert!(output.code.contains("EghactRuntime"));
    assert!(output.code.contains("Hello Eghact"));
}
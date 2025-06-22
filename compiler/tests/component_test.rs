use anyhow::Result;
use std::path::Path;
use eghact_compiler::{parser, transformer, codegen};

#[test]
fn test_basic_component_compilation() -> Result<()> {
    let input = r#"
<template>
  <div class="counter">
    <h1>Count: {count}</h1>
    <button @click={increment}>+</button>
  </div>
</template>

<script>
let count = 0;

function increment() {
  count++;
}
</script>

<style>
.counter {
  text-align: center;
  padding: 2rem;
}
</style>
"#;

    let path = Path::new("test-component.egh");
    let component = parser::parse_egh_file(input, path)?;
    
    // Verify all sections were extracted
    assert!(component.template.is_some());
    assert!(component.script.is_some());
    assert!(component.style.is_some());
    
    // Transform the component
    let transformed = transformer::transform_component(component)?;
    
    // Generate code
    let output = codegen::generate_code(&transformed, false)?;
    
    // Verify output contains expected elements
    assert!(output.contains("import EghactRuntime"));
    assert!(output.contains("createElement"));
    assert!(output.contains("addEventListener"));
    assert!(output.contains("initComponent"));
    
    Ok(())
}

#[test]
fn test_template_with_conditionals() -> Result<()> {
    let input = r#"
<template>
  <div>
    {#if showMessage}
      <p>Hello, {name}!</p>
    {/if}
  </div>
</template>

<script>
let showMessage = true;
let name = "World";
</script>
"#;

    let path = Path::new("conditional-component.egh");
    let component = parser::parse_egh_file(input, path)?;
    
    assert!(component.template.is_some());
    let template = component.template.as_ref().unwrap();
    assert!(template.contains("{#if"));
    assert!(template.contains("{/if}"));
    
    Ok(())
}

#[test]
fn test_style_scoping() -> Result<()> {
    let input = r#"
<template>
  <div class="container">
    <h1>Styled Component</h1>
  </div>
</template>

<script>
// Component logic
</script>

<style>
.container {
  background: #f0f0f0;
}

h1 {
  color: blue;
}
</style>
"#;

    let path = Path::new("styled-component.egh");
    let component = parser::parse_egh_file(input, path)?;
    
    assert!(component.style.is_some());
    
    // Transform should add scoped styles
    let transformed = transformer::transform_component(component)?;
    let output = codegen::generate_code(&transformed, false)?;
    
    // Should contain style injection logic
    assert!(output.contains("egh-")); // Scope prefix
    
    Ok(())
}

#[test]
fn test_event_handlers() -> Result<()> {
    let input = r#"
<template>
  <div>
    <button @click={handleClick}>Click me</button>
    <input @change={handleChange} />
  </div>
</template>

<script>
function handleClick() {
  console.log("Clicked!");
}

function handleChange(e) {
  console.log("Changed:", e.target.value);
}
</script>
"#;

    let path = Path::new("event-component.egh");
    let component = parser::parse_egh_file(input, path)?;
    
    let transformed = transformer::transform_component(component)?;
    let output = codegen::generate_code(&transformed, false)?;
    
    // Should contain event listener setup
    assert!(output.contains("addEventListener"));
    assert!(output.contains("click"));
    assert!(output.contains("change"));
    assert!(output.contains("handleClick"));
    assert!(output.contains("handleChange"));
    
    Ok(())
}
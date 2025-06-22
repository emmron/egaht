use eghact_compiler::{parse_component, transform_component};

#[test]
fn test_reactive_statement_simple() {
    let input = r#"
<template>
  <div>
    <p>Count: {count}</p>
    <p>Doubled: {doubled}</p>
  </div>
</template>

<script>
  let count = 0;
  let doubled = 0;
  
  $: doubled = count * 2;
</script>
"#;

    let component = parse_component("test.egh", input).unwrap();
    let module = transform_component(component).unwrap();
    
    // The transformed code should include:
    // 1. Runtime import
    // 2. Reactive variable declarations
    // 3. registerReactive call for the $: statement
    
    let code = module.to_string();
    assert!(code.contains("EghactRuntime"));
    assert!(code.contains("registerReactive"));
    assert!(code.contains("count"));
}

#[test]
fn test_reactive_statement_complex() {
    let input = r#"
<template>
  <div>
    <p>Items: {items.length}</p>
    <p>Total: {total}</p>
  </div>
</template>

<script>
  let items = [1, 2, 3];
  let total = 0;
  
  $: {
    console.log('Items changed:', items);
    total = items.reduce((sum, item) => sum + item, 0);
  }
</script>
"#;

    let component = parse_component("test.egh", input).unwrap();
    let module = transform_component(component).unwrap();
    
    let code = module.to_string();
    assert!(code.contains("registerReactive"));
    // Should track 'items' as a dependency
    assert!(code.contains("items"));
}

#[test] 
fn test_reactive_statement_chained() {
    let input = r#"
<template>
  <div>
    <p>A: {a}</p>
    <p>B: {b}</p>
    <p>C: {c}</p>
  </div>
</template>

<script>
  let a = 1;
  let b = 0;
  let c = 0;
  
  $: b = a * 2;
  $: c = b + 1;
</script>
"#;

    let component = parse_component("test.egh", input).unwrap();
    let module = transform_component(component).unwrap();
    
    let code = module.to_string();
    // Should have two registerReactive calls
    let reactive_count = code.matches("registerReactive").count();
    assert_eq!(reactive_count, 2);
}
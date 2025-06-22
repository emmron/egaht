use eghact_compiler::{parser, transformer, reactivity};
use std::path::Path;

#[test]
fn test_reactive_variable_detection() {
    let source = r#"
let count = 0;
const MAX = 100;
var legacy = "old";

function increment() {
    count++;
}
"#;
    
    let component = parser::parse_egh_file(source, Path::new("test.egh")).unwrap();
    let script = component.script.unwrap();
    
    let analysis = reactivity::analyze_reactivity(&script, &Default::default()).unwrap();
    
    // Only 'let' variables should be reactive
    assert!(analysis.reactive_vars.contains("count"));
    assert!(!analysis.reactive_vars.contains("MAX"));
    assert!(!analysis.reactive_vars.contains("legacy"));
}

#[test]
fn test_reactive_statement_parsing() {
    let source = r#"
let count = 0;
let multiplier = 2;

$: doubled = count * 2;
$: result = count * multiplier;

function calculate() {
    return doubled + result;
}
"#;
    
    let component = parser::parse_egh_file(source, Path::new("test.egh")).unwrap();
    let script = component.script.unwrap();
    
    let analysis = reactivity::analyze_reactivity(&script, &Default::default()).unwrap();
    
    // Check reactive statements were found
    assert_eq!(analysis.reactive_statements.len(), 2);
    
    // Check dependencies were tracked
    let doubled_stmt = analysis.reactive_statements.iter()
        .find(|s| s.target_var == Some("doubled".to_string()))
        .unwrap();
    assert!(doubled_stmt.dependencies.contains("count"));
    
    let result_stmt = analysis.reactive_statements.iter()
        .find(|s| s.target_var == Some("result".to_string()))
        .unwrap();
    assert!(result_stmt.dependencies.contains("count"));
    assert!(result_stmt.dependencies.contains("multiplier"));
}

#[test]
fn test_signal_graph_building() {
    let source = r#"
let x = 0;
let y = 0;

$: sum = x + y;
$: product = x * y;
$: message = `Sum: ${sum}, Product: ${product}`;
"#;
    
    let component = parser::parse_egh_file(source, Path::new("test.egh")).unwrap();
    let script = component.script.unwrap();
    
    let analysis = reactivity::analyze_reactivity(&script, &Default::default()).unwrap();
    
    // Check signal subscriptions
    let x_signal = analysis.signals.get("x").unwrap();
    assert_eq!(x_signal.subscribers.len(), 2); // sum and product
    
    let y_signal = analysis.signals.get("y").unwrap();
    assert_eq!(y_signal.subscribers.len(), 2); // sum and product
}

#[test]
fn test_reactive_update_generation() {
    use std::collections::HashMap;
    use reactivity::{DependencyTarget, TargetType};
    
    let mut deps = HashMap::new();
    deps.insert("count".to_string(), vec![
        DependencyTarget {
            node_id: "text0".to_string(),
            target_type: TargetType::TextContent,
            expression: "count".to_string(),
        },
        DependencyTarget {
            node_id: "span1".to_string(),
            target_type: TargetType::Attribute("title".to_string()),
            expression: "`Count: ${count}`".to_string(),
        },
    ]);
    
    let update_code = reactivity::generate_reactive_update("count", &deps["count"], "runtime");
    
    // Check generated code includes update function
    assert!(update_code.contains("function update_count()"));
    assert!(update_code.contains("runtime.setText"));
    assert!(update_code.contains("runtime.setAttribute"));
    
    // Check reactive setter was created
    assert!(update_code.contains("Object.defineProperty"));
    assert!(update_code.contains("update_count()"));
}

#[test]
fn test_complex_component_reactivity() {
    let source = r#"
<template>
    <div class="counter">
        <h1>Count: {count}</h1>
        <p>Doubled: {doubled}</p>
        <button @click={increment}>+</button>
        
        {#if count > 10}
            <p class="warning">That's a big number!</p>
        {/if}
    </div>
</template>

<script>
let count = 0;

$: doubled = count * 2;

function increment() {
    count++;
}
</script>
"#;
    
    let component = parser::parse_egh_file(source, Path::new("counter.egh")).unwrap();
    let transformed = transformer::transform_component(component).unwrap();
    
    // Check that reactive update functions were generated
    let code_str = format!("{:?}", transformed);
    assert!(code_str.contains("update_count"));
    assert!(code_str.contains("update_doubled"));
}
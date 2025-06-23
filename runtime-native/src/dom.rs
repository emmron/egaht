//! DOM Manipulation and Rendering
//! 
//! Direct DOM manipulation without virtual DOM overhead

use web_sys::{Document, Element, HtmlElement, Event};
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use std::collections::HashMap;
use crate::{
    CompiledTemplate, TemplateNode, AttributeValue, 
    EghactRuntime, StateValue, RuntimeError, DataBinding, BindingType
};

/// Render a component to the DOM
pub fn render_component(
    template: &CompiledTemplate,
    target_selector: &str,
    runtime: &EghactRuntime
) -> Result<(), RuntimeError> {
    let window = web_sys::window()
        .ok_or_else(|| RuntimeError::DomError("No window object".to_string()))?;
    
    let document = window.document()
        .ok_or_else(|| RuntimeError::DomError("No document object".to_string()))?;
    
    let target = document.query_selector(target_selector)
        .map_err(|_| RuntimeError::DomError("Invalid selector".to_string()))?
        .ok_or_else(|| RuntimeError::DomError(format!("Element not found: {}", target_selector)))?;
    
    // Clear target
    target.set_inner_html("");
    
    // Render template nodes
    for node in &template.nodes {
        let element = render_node(node, &document, runtime)?;
        target.append_child(&element)
            .map_err(|_| RuntimeError::DomError("Failed to append child".to_string()))?;
    }
    
    Ok(())
}

/// Render a single template node
fn render_node(
    node: &TemplateNode,
    document: &Document,
    runtime: &EghactRuntime
) -> Result<Element, RuntimeError> {
    match node {
        TemplateNode::Element { tag, attributes, children } => {
            let element = document.create_element(tag)
                .map_err(|_| RuntimeError::DomError(format!("Failed to create element: {}", tag)))?;
            
            // Set attributes
            for (name, value) in attributes {
                match value {
                    AttributeValue::Static(val) => {
                        element.set_attribute(name, val)
                            .map_err(|_| RuntimeError::DomError("Failed to set attribute".to_string()))?;
                    }
                    AttributeValue::Dynamic(expr) => {
                        // Evaluate expression and set attribute
                        let val = evaluate_expression(expr, runtime)?;
                        element.set_attribute(name, &val)
                            .map_err(|_| RuntimeError::DomError("Failed to set attribute".to_string()))?;
                        
                        // Create binding for reactive updates
                        if name.starts_with("data-bind") {
                            create_binding(&element, expr, BindingType::TwoWay, runtime)?;
                        }
                    }
                    AttributeValue::EventHandler(handler) => {
                        attach_event_handler(&element, name, handler, runtime)?;
                    }
                }
            }
            
            // Render children
            for child in children {
                let child_element = render_node(child, document, runtime)?;
                element.append_child(&child_element)
                    .map_err(|_| RuntimeError::DomError("Failed to append child".to_string()))?;
            }
            
            Ok(element)
        }
        
        TemplateNode::Text(text) => {
            let text_node = document.create_text_node(text);
            Ok(text_node.into())
        }
        
        TemplateNode::Interpolation(expr) => {
            let value = evaluate_expression(expr, runtime)?;
            let text_node = document.create_text_node(&value);
            
            // Create reactive binding
            let span = document.create_element("span")
                .map_err(|_| RuntimeError::DomError("Failed to create span".to_string()))?;
            
            span.append_child(&text_node)
                .map_err(|_| RuntimeError::DomError("Failed to append text".to_string()))?;
            
            create_binding(&span, expr, BindingType::OneWay, runtime)?;
            
            Ok(span)
        }
        
        TemplateNode::For { item, collection, body } => {
            render_for_loop(item, collection, body, document, runtime)
        }
        
        TemplateNode::If { condition, then_branch, else_branch } => {
            render_conditional(condition, then_branch, else_branch.as_ref(), document, runtime)
        }
        
        TemplateNode::Component { name, props, children } => {
            render_child_component(name, props, children, document, runtime)
        }
    }
}

/// Render a for loop
fn render_for_loop(
    item: &str,
    collection: &str,
    body: &[TemplateNode],
    document: &Document,
    runtime: &EghactRuntime
) -> Result<Element, RuntimeError> {
    let container = document.create_element("div")
        .map_err(|_| RuntimeError::DomError("Failed to create container".to_string()))?;
    
    container.set_attribute("data-for", &format!("{} in {}", item, collection))
        .map_err(|_| RuntimeError::DomError("Failed to set data-for".to_string()))?;
    
    // Get collection value
    let collection_value = runtime.get_state(collection)
        .ok_or_else(|| RuntimeError::DomError(format!("Collection not found: {}", collection)))?;
    
    if let StateValue::Array(items) = collection_value {
        for (index, item_value) in items.iter().enumerate() {
            // Create local scope with item
            let item_key = format!("{}.{}", collection, index);
            runtime.set_state(&item_key, item_value.clone())?;
            
            // Render body with item in scope
            for node in body {
                let element = render_node(node, document, runtime)?;
                container.append_child(&element)
                    .map_err(|_| RuntimeError::DomError("Failed to append loop item".to_string()))?;
            }
        }
    }
    
    // Create binding to re-render on collection change
    create_binding(&container, collection, BindingType::Query, runtime)?;
    
    Ok(container)
}

/// Render conditional content
fn render_conditional(
    condition: &str,
    then_branch: &[TemplateNode],
    else_branch: Option<&Vec<TemplateNode>>,
    document: &Document,
    runtime: &EghactRuntime
) -> Result<Element, RuntimeError> {
    let container = document.create_element("div")
        .map_err(|_| RuntimeError::DomError("Failed to create container".to_string()))?;
    
    container.set_attribute("data-if", condition)
        .map_err(|_| RuntimeError::DomError("Failed to set data-if".to_string()))?;
    
    // Evaluate condition
    let condition_result = evaluate_condition(condition, runtime)?;
    
    // Render appropriate branch
    let nodes = if condition_result {
        then_branch
    } else if let Some(else_nodes) = else_branch {
        else_nodes
    } else {
        return Ok(container);
    };
    
    for node in nodes {
        let element = render_node(node, document, runtime)?;
        container.append_child(&element)
            .map_err(|_| RuntimeError::DomError("Failed to append conditional content".to_string()))?;
    }
    
    // Create binding to re-render on condition change
    create_binding(&container, condition, BindingType::Computed, runtime)?;
    
    Ok(container)
}

/// Render a child component
fn render_child_component(
    name: &str,
    props: &HashMap<String, AttributeValue>,
    children: &[TemplateNode],
    document: &Document,
    runtime: &EghactRuntime
) -> Result<Element, RuntimeError> {
    // Get component definition
    let component = runtime.components.get(name)
        .ok_or_else(|| RuntimeError::DomError(format!("Component not found: {}", name)))?;
    
    // Create component container
    let container = document.create_element("div")
        .map_err(|_| RuntimeError::DomError("Failed to create component container".to_string()))?;
    
    container.set_attribute("data-component", name)
        .map_err(|_| RuntimeError::DomError("Failed to set data-component".to_string()))?;
    
    // Initialize component instance state
    let instance_id = format!("{}_{}", name, uuid::Uuid::new_v4());
    
    // Set props as state
    for (prop_name, prop_value) in props {
        let state_key = format!("{}.props.{}", instance_id, prop_name);
        match prop_value {
            AttributeValue::Static(val) => {
                runtime.set_state(&state_key, StateValue::String(val.clone()))?;
            }
            AttributeValue::Dynamic(expr) => {
                let val = evaluate_expression(expr, runtime)?;
                runtime.set_state(&state_key, StateValue::String(val))?;
            }
            _ => {}
        }
    }
    
    // Render component template
    for node in &component.template.nodes {
        let element = render_node(node, document, runtime)?;
        container.append_child(&element)
            .map_err(|_| RuntimeError::DomError("Failed to append component content".to_string()))?;
    }
    
    Ok(container)
}

/// Evaluate an expression
fn evaluate_expression(expr: &str, runtime: &EghactRuntime) -> Result<String, RuntimeError> {
    // Simple expression evaluation
    // In production, this would use a proper expression parser
    
    if expr.contains('.') {
        // Property access
        if let Some(value) = runtime.get_state(expr) {
            match value {
                StateValue::String(s) => Ok(s),
                StateValue::Number(n) => Ok(n.to_string()),
                StateValue::Bool(b) => Ok(b.to_string()),
                _ => Ok("".to_string()),
            }
        } else {
            Ok("".to_string())
        }
    } else {
        // Direct state access
        if let Some(value) = runtime.get_state(expr) {
            match value {
                StateValue::String(s) => Ok(s),
                StateValue::Number(n) => Ok(n.to_string()),
                StateValue::Bool(b) => Ok(b.to_string()),
                _ => Ok("".to_string()),
            }
        } else {
            Ok(expr.to_string())
        }
    }
}

/// Evaluate a condition
fn evaluate_condition(condition: &str, runtime: &EghactRuntime) -> Result<bool, RuntimeError> {
    // Simple condition evaluation
    // In production, this would use a proper expression parser
    
    let trimmed = condition.trim();
    
    // Handle negation
    if trimmed.starts_with('!') {
        let inner = evaluate_condition(&trimmed[1..], runtime)?;
        return Ok(!inner);
    }
    
    // Handle comparisons
    if trimmed.contains("==") {
        let parts: Vec<&str> = trimmed.split("==").collect();
        if parts.len() == 2 {
            let left = evaluate_expression(parts[0].trim(), runtime)?;
            let right = evaluate_expression(parts[1].trim(), runtime)?;
            return Ok(left == right);
        }
    }
    
    // Simple boolean check
    if let Some(value) = runtime.get_state(trimmed) {
        match value {
            StateValue::Bool(b) => Ok(b),
            StateValue::String(s) => Ok(!s.is_empty()),
            StateValue::Number(n) => Ok(n != 0.0),
            StateValue::Null => Ok(false),
            _ => Ok(true),
        }
    } else {
        Ok(false)
    }
}

/// Create a reactive binding
fn create_binding(
    element: &Element,
    state_path: &str,
    binding_type: BindingType,
    runtime: &EghactRuntime
) -> Result<(), RuntimeError> {
    let element_id = element.id();
    
    if element_id.is_empty() {
        // Generate ID if not present
        let id = format!("eghact_{}", uuid::Uuid::new_v4());
        element.set_id(&id);
    }
    
    let binding = DataBinding {
        element_id: element.id(),
        state_path: state_path.to_string(),
        binding_type,
    };
    
    runtime.bindings.insert(
        format!("{}_{}", element.id(), state_path),
        binding
    );
    
    Ok(())
}

/// Attach event handler
fn attach_event_handler(
    element: &Element,
    event_name: &str,
    handler_expr: &str,
    runtime: &EghactRuntime
) -> Result<(), RuntimeError> {
    let event_type = event_name.trim_start_matches('@');
    
    // Create closure for event handler
    let handler_expr = handler_expr.to_string();
    let runtime_ptr = runtime as *const EghactRuntime;
    
    let closure = Closure::wrap(Box::new(move |event: Event| {
        // Execute handler
        // In production, this would properly parse and execute the handler expression
        unsafe {
            let runtime = &*runtime_ptr;
            // Call handler function
            if handler_expr.contains('(') {
                // Function call
                let func_name = handler_expr.split('(').next().unwrap();
                // Execute native function
                // This would integrate with the compiled native code
            } else {
                // State update
                // Parse and execute state mutation
            }
        }
    }) as Box<dyn FnMut(Event)>);
    
    element.add_event_listener_with_callback(event_type, closure.as_ref().unchecked_ref())
        .map_err(|_| RuntimeError::DomError("Failed to add event listener".to_string()))?;
    
    // Leak closure to keep it alive
    closure.forget();
    
    Ok(())
}

/// Update an element's content
pub fn update_element(
    element_id: &str,
    content: &str,
    runtime: &EghactRuntime
) -> Result<(), RuntimeError> {
    let window = web_sys::window()
        .ok_or_else(|| RuntimeError::DomError("No window object".to_string()))?;
    
    let document = window.document()
        .ok_or_else(|| RuntimeError::DomError("No document object".to_string()))?;
    
    let element = document.get_element_by_id(element_id)
        .ok_or_else(|| RuntimeError::DomError(format!("Element not found: {}", element_id)))?;
    
    element.set_text_content(Some(content));
    
    Ok(())
}
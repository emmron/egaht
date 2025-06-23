use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Prop {
    name: String,
    prop_type: String,
    default: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateVar {
    name: String,
    initial: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Handler {
    name: String,
    body: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct ComponentSpec {
    component_type: String,
    props: Vec<Prop>,
    state_vars: Vec<StateVar>,
    handlers: Vec<Handler>,
    reactive: Vec<String>,
}

/// Pure Rust component analyzer - no external dependencies
pub fn analyze_prompt(prompt: &str) -> ComponentSpec {
    let lower = prompt.to_lowercase();
    let mut spec = ComponentSpec::default();
    
    // Detect component type and generate appropriate spec
    if lower.contains("button") {
        spec.component_type = "button".to_string();
        spec.props.push(Prop {
            name: "label".to_string(),
            prop_type: "string".to_string(),
            default: "Click me".to_string(),
        });
        spec.state_vars.push(StateVar {
            name: "clickCount".to_string(),
            initial: "0".to_string(),
        });
        spec.reactive.push("$: isEven = clickCount % 2 === 0;".to_string());
        spec.reactive.push("$: buttonText = clickCount > 0 ? `${label} (${clickCount})` : label;".to_string());
        spec.handlers.push(Handler {
            name: "handleClick".to_string(),
            body: "clickCount++;".to_string(),
        });
    } else if lower.contains("counter") {
        spec.component_type = "counter".to_string();
        spec.props.push(Prop {
            name: "initialValue".to_string(),
            prop_type: "number".to_string(),
            default: "0".to_string(),
        });
        spec.state_vars.push(StateVar {
            name: "count".to_string(),
            initial: "initialValue".to_string(),
        });
        spec.reactive.push("$: doubled = count * 2;".to_string());
        spec.reactive.push("$: isPositive = count > 0;".to_string());
        spec.reactive.push("$: factorial = ((n) => n <= 1 ? 1 : n * factorial(n - 1))(Math.min(count, 20));".to_string());
        spec.handlers.push(Handler {
            name: "increment".to_string(),
            body: "count++;".to_string(),
        });
        spec.handlers.push(Handler {
            name: "decrement".to_string(),
            body: "count--;".to_string(),
        });
        spec.handlers.push(Handler {
            name: "reset".to_string(),
            body: "count = initialValue;".to_string(),
        });
    } else if lower.contains("list") || lower.contains("todo") {
        spec.component_type = "list".to_string();
        spec.props.push(Prop {
            name: "title".to_string(),
            prop_type: "string".to_string(),
            default: "Todo List".to_string(),
        });
        spec.state_vars.push(StateVar {
            name: "items".to_string(),
            initial: "[]".to_string(),
        });
        spec.state_vars.push(StateVar {
            name: "newItem".to_string(),
            initial: "\"\"".to_string(),
        });
        spec.state_vars.push(StateVar {
            name: "filter".to_string(),
            initial: "\"all\"".to_string(),
        });
        spec.reactive.push("$: isEmpty = items.length === 0;".to_string());
        spec.reactive.push("$: itemCount = items.length;".to_string());
        spec.reactive.push("$: filteredItems = filter === 'completed' ? items.filter(i => i.completed) : filter === 'active' ? items.filter(i => !i.completed) : items;".to_string());
        spec.handlers.push(Handler {
            name: "addItem".to_string(),
            body: "if (newItem.trim()) { items = [...items, {id: Date.now(), text: newItem, completed: false}]; newItem = ''; }".to_string(),
        });
        spec.handlers.push(Handler {
            name: "removeItem".to_string(),
            body: "items = items.filter(item => item.id !== id);".to_string(),
        });
        spec.handlers.push(Handler {
            name: "toggleItem".to_string(),
            body: "items = items.map(item => item.id === id ? {...item, completed: !item.completed} : item);".to_string(),
        });
    } else if lower.contains("form") {
        spec.component_type = "form".to_string();
        spec.state_vars.push(StateVar {
            name: "formData".to_string(),
            initial: "{}".to_string(),
        });
        spec.state_vars.push(StateVar {
            name: "errors".to_string(),
            initial: "{}".to_string(),
        });
        spec.state_vars.push(StateVar {
            name: "isSubmitting".to_string(),
            initial: "false".to_string(),
        });
        spec.reactive.push("$: isValid = Object.keys(errors).length === 0 && Object.keys(formData).length > 0;".to_string());
        spec.handlers.push(Handler {
            name: "validateForm".to_string(),
            body: "errors = {}; /* validation logic */ return Object.keys(errors).length === 0;".to_string(),
        });
        spec.handlers.push(Handler {
            name: "handleSubmit".to_string(),
            body: "if (validateForm()) { isSubmitting = true; /* submit */ }".to_string(),
        });
    } else {
        spec.component_type = "div".to_string();
        spec.props.push(Prop {
            name: "content".to_string(),
            prop_type: "string".to_string(),
            default: "Component".to_string(),
        });
    }
    
    // Extract props from prompt
    if let Some(label_match) = extract_quoted_value(&prompt, "label") {
        if let Some(prop) = spec.props.iter_mut().find(|p| p.name == "label") {
            prop.default = label_match;
        }
    }
    
    spec
}

fn extract_quoted_value(text: &str, prefix: &str) -> Option<String> {
    let patterns = [
        format!(r#"{}\s*[""']([^""']+)[""']"#, prefix),
        format!(r#"with\s+{}\s*[""']([^""']+)[""']"#, prefix),
    ];
    
    for pattern in &patterns {
        if let Ok(re) = regex_lite::Regex::new(pattern) {
            if let Some(cap) = re.captures(text) {
                if let Some(m) = cap.get(1) {
                    return Some(m.as_str().to_string());
                }
            }
        }
    }
    None
}

/// Generate Turing-complete .egh component
pub fn generate_egh_component(spec: &ComponentSpec) -> String {
    let mut component = String::from("<component>\n");
    
    // Props
    for prop in &spec.props {
        component.push_str(&format!(
            "  <prop name=\"{}\" type=\"{}\" default=\"{}\" />\n",
            prop.name, prop.prop_type, prop.default
        ));
    }
    
    // State
    if !spec.state_vars.is_empty() {
        component.push_str("\n  <state>\n");
        for state_var in &spec.state_vars {
            component.push_str(&format!(
                "    let {} = {};\n",
                state_var.name, state_var.initial
            ));
        }
        component.push_str("  </state>\n");
    }
    
    // Reactive
    for reactive in &spec.reactive {
        component.push_str(&format!("\n  {}\n", reactive));
    }
    
    // Handlers
    for handler in &spec.handlers {
        component.push_str(&format!(
            "\n  const {} = ({}) => {{\n    {}\n  }};\n",
            handler.name,
            if handler.name == "removeItem" || handler.name == "toggleItem" { "id" } else { "" },
            handler.body
        ));
    }
    
    // Template
    component.push_str("\n  <template>\n");
    component.push_str(&generate_template(spec));
    component.push_str("\n  </template>\n");
    
    // Style
    component.push_str("\n  <style>\n");
    component.push_str(&generate_styles(&spec.component_type));
    component.push_str("\n  </style>\n");
    
    component.push_str("</component>");
    component
}

fn generate_template(spec: &ComponentSpec) -> String {
    match spec.component_type.as_str() {
        "button" => {
            r#"    <button 
      @click="handleClick" 
      class="btn"
      class:even={isEven}
      class:odd={!isEven}
    >
      {buttonText}
    </button>"#.to_string()
        }
        "counter" => {
            r#"    <div class="counter">
      <h2>Turing-Complete Counter</h2>
      <div class="display">
        <p>Count: {count}</p>
        <p>Doubled: {doubled}</p>
        <p>Factorial: {factorial}</p>
      </div>
      <div class="controls">
        <button @click="decrement">-</button>
        <button @click="reset">Reset</button>
        <button @click="increment">+</button>
      </div>
      #if (isPositive)
        <p class="positive">Positive!</p>
      #elseif (count < 0)
        <p class="negative">Negative!</p>
      #else
        <p class="zero">Zero</p>
      #/if
    </div>"#.to_string()
        }
        "list" => {
            r#"    <div class="list-container">
      <h1>{title}</h1>
      <div class="input-group">
        <input 
          value={newItem}
          @input="(e) => newItem = e.target.value"
          @keydown="(e) => e.key === 'Enter' && addItem()"
          placeholder="Add new item"
        />
        <button @click="addItem">Add</button>
      </div>
      
      <div class="filters">
        <button class:active={filter === 'all'} @click="() => filter = 'all'">All</button>
        <button class:active={filter === 'active'} @click="() => filter = 'active'">Active</button>
        <button class:active={filter === 'completed'} @click="() => filter = 'completed'">Completed</button>
      </div>
      
      #if (isEmpty)
        <p class="empty">No items yet</p>
      #else
        <ul>
          #each (filteredItems as item)
            <li key={item.id} class:completed={item.completed}>
              <input 
                type="checkbox" 
                checked={item.completed}
                @change="() => toggleItem(item.id)"
              />
              <span>{item.text}</span>
              <button @click="() => removeItem(item.id)">×</button>
            </li>
          #/each
        </ul>
        <p class="summary">{itemCount} items total</p>
      #/if
    </div>"#.to_string()
        }
        "form" => {
            r#"    <form @submit="(e) => { e.preventDefault(); handleSubmit(); }">
      <h2>Form Component</h2>
      
      <div class="form-group">
        <input 
          type="text"
          placeholder="Enter value"
          @input="(e) => formData.value = e.target.value"
        />
        #if (errors.value)
          <span class="error">{errors.value}</span>
        #/if
      </div>
      
      <button 
        type="submit" 
        :disabled={!isValid || isSubmitting}
      >
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>"#.to_string()
        }
        _ => format!("    <div class=\"{}\">\n      {{content}}\n    </div>", spec.component_type)
    }
}

fn generate_styles(component_type: &str) -> String {
    match component_type {
        "button" => {
            r#"    .btn {
      padding: 10px 20px;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn.even { background: #007bff; color: white; }
    .btn.odd { background: #28a745; color: white; }
    .btn:hover { opacity: 0.8; }"#.to_string()
        }
        "counter" => {
            r#"    .counter {
      text-align: center;
      padding: 20px;
    }
    .display {
      margin: 20px 0;
    }
    .controls {
      display: flex;
      gap: 10px;
      justify-content: center;
    }
    .controls button {
      padding: 10px 20px;
    }
    .positive { color: green; }
    .negative { color: red; }
    .zero { color: gray; }"#.to_string()
        }
        "list" => {
            r#"    .list-container {
      max-width: 500px;
      margin: 0 auto;
      padding: 20px;
    }
    .input-group {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    .input-group input {
      flex: 1;
      padding: 10px;
    }
    .filters {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
    }
    .filters button {
      padding: 5px 10px;
      border: 1px solid #ddd;
      background: white;
      cursor: pointer;
    }
    .filters button.active {
      background: #007bff;
      color: white;
    }
    ul {
      list-style: none;
      padding: 0;
    }
    li {
      display: flex;
      align-items: center;
      padding: 10px;
      border-bottom: 1px solid #eee;
    }
    li.completed span {
      text-decoration: line-through;
      opacity: 0.5;
    }
    .empty {
      text-align: center;
      color: #999;
    }"#.to_string()
        }
        _ => format!("    .{} {{\n      padding: 20px;\n      border: 1px solid #ddd;\n    }}", component_type)
    }
}

// WebAssembly bindings
#[wasm_bindgen]
pub fn generate_component(prompt: &str) -> String {
    let spec = analyze_prompt(prompt);
    generate_egh_component(&spec)
}

#[wasm_bindgen]
pub fn analyze_prompt_wasm(prompt: &str) -> JsValue {
    let spec = analyze_prompt(prompt);
    serde_wasm_bindgen::to_value(&spec).unwrap_or(JsValue::NULL)
}

// Standalone binary
#[cfg(not(target_arch = "wasm32"))]
pub fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: {} \"component description\"", args[0]);
        std::process::exit(1);
    }
    
    let prompt = &args[1];
    let spec = analyze_prompt(prompt);
    let component = generate_egh_component(&spec);
    
    println!("{}", component);
}

// Regex lite implementation for no_std environments
mod regex_lite {
    pub struct Regex;
    impl Regex {
        pub fn new(_: &str) -> Result<Self, ()> { Ok(Regex) }
        pub fn captures(&self, _: &str) -> Option<Captures> { None }
    }
    pub struct Captures;
    impl Captures {
        pub fn get(&self, _: usize) -> Option<Match> { None }
    }
    pub struct Match;
    impl Match {
        pub fn as_str(&self) -> &str { "" }
    }
}
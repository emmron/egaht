//! Eghact Native Runtime - The Red Pill
//! 
//! Zero JavaScript. Zero Node.js. Pure native performance.

#![warn(clippy::all, clippy::pedantic)]

pub mod compiler;
pub mod dom;
pub mod eghql;
pub mod reactive;
pub mod markdown;

use std::collections::HashMap;
use std::sync::Arc;
use dashmap::DashMap;
use serde::{Deserialize, Serialize};

/// The core Eghact application runtime
pub struct EghactRuntime {
    /// Component registry
    components: Arc<DashMap<String, CompiledComponent>>,
    /// Global state store
    state: Arc<DashMap<String, StateValue>>,
    /// Active queries
    queries: Arc<DashMap<String, EghQLQuery>>,
    /// DOM bindings
    bindings: Arc<DashMap<String, DataBinding>>,
}

/// Compiled component from .eg file
#[derive(Clone)]
pub struct CompiledComponent {
    pub name: String,
    pub template: CompiledTemplate,
    pub state: HashMap<String, StateValue>,
    pub queries: HashMap<String, String>,
    pub native_code: Vec<u8>, // Compiled Rust/C code
}

/// Reactive state value
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum StateValue {
    Null,
    Bool(bool),
    Number(f64),
    String(String),
    Array(Vec<StateValue>),
    Object(HashMap<String, StateValue>),
}

/// Compiled template AST
#[derive(Clone)]
pub struct CompiledTemplate {
    pub nodes: Vec<TemplateNode>,
}

/// Template node types
#[derive(Clone)]
pub enum TemplateNode {
    Element {
        tag: String,
        attributes: HashMap<String, AttributeValue>,
        children: Vec<TemplateNode>,
    },
    Text(String),
    Interpolation(String),
    For {
        item: String,
        collection: String,
        body: Vec<TemplateNode>,
    },
    If {
        condition: String,
        then_branch: Vec<TemplateNode>,
        else_branch: Option<Vec<TemplateNode>>,
    },
    Component {
        name: String,
        props: HashMap<String, AttributeValue>,
        children: Vec<TemplateNode>,
    },
}

/// Attribute value types
#[derive(Clone)]
pub enum AttributeValue {
    Static(String),
    Dynamic(String),
    EventHandler(String),
}

/// Data binding between state and DOM
pub struct DataBinding {
    pub element_id: String,
    pub state_path: String,
    pub binding_type: BindingType,
}

#[derive(Debug)]
pub enum BindingType {
    OneWay,      // State -> DOM
    TwoWay,      // State <-> DOM  
    Query,       // EghQL query result
    Computed,    // Derived state
}

/// EghQL query
pub struct EghQLQuery {
    pub id: String,
    pub source: QuerySource,
    pub ast: QueryAST,
    pub dependencies: Vec<String>,
}

pub enum QuerySource {
    Markdown(String),      // Path to .md file
    State(String),         // State key
    Remote(String),        // URL
    Native(String),        // Database connection
}

pub struct QueryAST {
    // Parsed query structure
    pub operation: QueryOperation,
    pub selections: Vec<String>,
    pub conditions: Vec<Condition>,
    pub ordering: Option<OrderBy>,
    pub limit: Option<usize>,
}

pub enum QueryOperation {
    Select,
    Match,
    Insert,
    Update,
    Delete,
    Subscribe,
}

pub struct Condition {
    pub field: String,
    pub operator: ComparisonOp,
    pub value: StateValue,
}

pub enum ComparisonOp {
    Eq,
    Ne,
    Gt,
    Lt,
    Gte,
    Lte,
    In,
    Like,
}

pub struct OrderBy {
    pub field: String,
    pub direction: SortDirection,
}

pub enum SortDirection {
    Asc,
    Desc,
}

impl EghactRuntime {
    /// Create a new runtime instance
    pub fn new() -> Self {
        Self {
            components: Arc::new(DashMap::new()),
            state: Arc::new(DashMap::new()),
            queries: Arc::new(DashMap::new()),
            bindings: Arc::new(DashMap::new()),
        }
    }

    /// Load and compile a .eg file
    pub async fn load_component(&self, path: &str) -> Result<(), RuntimeError> {
        let content = std::fs::read_to_string(path)
            .map_err(|e| RuntimeError::Io(e.to_string()))?;
        
        let component = compiler::compile_eg_file(&content)?;
        self.components.insert(component.name.clone(), component);
        
        Ok(())
    }

    /// Mount a component to DOM
    pub fn mount(&self, component_name: &str, target: &str) -> Result<(), RuntimeError> {
        let component = self.components.get(component_name)
            .ok_or_else(|| RuntimeError::ComponentNotFound(component_name.to_string()))?;
        
        // Initialize component state
        for (key, value) in &component.state {
            self.state.insert(
                format!("{}.{}", component_name, key),
                value.clone()
            );
        }
        
        // Set up queries
        for (query_name, query_def) in &component.queries {
            let query = eghql::parse_query(query_def)?;
            self.queries.insert(
                format!("{}.{}", component_name, query_name),
                query
            );
        }
        
        // Render to DOM
        dom::render_component(&component.template, target, self)?;
        
        Ok(())
    }

    /// Update reactive state
    pub fn set_state(&self, path: &str, value: StateValue) -> Result<(), RuntimeError> {
        self.state.insert(path.to_string(), value);
        
        // Trigger reactive updates
        self.update_bindings(path)?;
        self.rerun_dependent_queries(path)?;
        
        Ok(())
    }

    /// Get state value
    pub fn get_state(&self, path: &str) -> Option<StateValue> {
        self.state.get(path).map(|v| v.clone())
    }

    /// Execute EghQL query
    pub async fn execute_query(&self, query_id: &str) -> Result<Vec<StateValue>, RuntimeError> {
        let query = self.queries.get(query_id)
            .ok_or_else(|| RuntimeError::QueryNotFound(query_id.to_string()))?;
        
        eghql::execute_query(&query.value(), self).await
    }

    fn update_bindings(&self, state_path: &str) -> Result<(), RuntimeError> {
        // Find all bindings that depend on this state
        for binding in self.bindings.iter() {
            if binding.state_path == state_path {
                dom::update_element(&binding.element_id, &binding.value(), self)?;
            }
        }
        Ok(())
    }

    fn rerun_dependent_queries(&self, state_path: &str) -> Result<(), RuntimeError> {
        // Find queries that depend on this state
        for query in self.queries.iter() {
            if query.dependencies.contains(&state_path.to_string()) {
                // Re-execute query and update bindings
                let results = tokio::runtime::Runtime::new()
                    .unwrap()
                    .block_on(self.execute_query(&query.id))?;
                
                // Update bound elements
                self.update_query_bindings(&query.id, results)?;
            }
        }
        Ok(())
    }

    fn update_query_bindings(&self, query_id: &str, results: Vec<StateValue>) -> Result<(), RuntimeError> {
        // Update DOM elements bound to this query
        // Implementation depends on DOM binding strategy
        Ok(())
    }
}

#[derive(Debug)]
pub enum RuntimeError {
    Io(String),
    ParseError(String),
    ComponentNotFound(String),
    QueryNotFound(String),
    DomError(String),
    CompilationError(String),
}

impl Default for EghactRuntime {
    fn default() -> Self {
        Self::new()
    }
}

/// Entry point for standalone binary compilation
#[no_mangle]
pub extern "C" fn eghact_main() {
    // Initialize runtime
    let runtime = EghactRuntime::new();
    
    // Load app.eg
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        runtime.load_component("app.eg").await.unwrap();
        runtime.mount("App", "#root").unwrap();
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_runtime_creation() {
        let runtime = EghactRuntime::new();
        assert_eq!(runtime.components.len(), 0);
        assert_eq!(runtime.state.len(), 0);
    }
}
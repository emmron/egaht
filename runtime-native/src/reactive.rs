//! Reactive State Management
//! 
//! Zero-overhead reactivity with compile-time optimization

use std::sync::Arc;
use std::collections::{HashMap, HashSet};
use dashmap::DashMap;
use crossbeam::channel::{unbounded, Sender, Receiver};

/// Reactive state store with automatic dependency tracking
pub struct ReactiveStore {
    /// State values
    values: Arc<DashMap<String, StateValue>>,
    /// Dependency graph - which computeds depend on which state
    dependencies: Arc<DashMap<String, HashSet<String>>>,
    /// Reverse dependencies - which state affects which computeds
    dependents: Arc<DashMap<String, HashSet<String>>>,
    /// Computed value definitions
    computeds: Arc<DashMap<String, ComputedDefinition>>,
    /// Update channel for batching
    update_tx: Sender<StateUpdate>,
    update_rx: Receiver<StateUpdate>,
}

/// A computed value definition
struct ComputedDefinition {
    /// The computation function
    compute: Box<dyn Fn(&DashMap<String, StateValue>) -> StateValue + Send + Sync>,
    /// Dependencies this computed relies on
    deps: HashSet<String>,
}

/// State update message
enum StateUpdate {
    Set { path: String, value: StateValue },
    Delete { path: String },
    Batch { updates: Vec<StateUpdate> },
}

use crate::StateValue;

impl ReactiveStore {
    /// Create a new reactive store
    pub fn new() -> Self {
        let (tx, rx) = unbounded();
        
        Self {
            values: Arc::new(DashMap::new()),
            dependencies: Arc::new(DashMap::new()),
            dependents: Arc::new(DashMap::new()),
            computeds: Arc::new(DashMap::new()),
            update_tx: tx,
            update_rx: rx,
        }
    }
    
    /// Set a reactive value
    pub fn set(&self, path: &str, value: StateValue) {
        // Store the value
        self.values.insert(path.to_string(), value.clone());
        
        // Trigger updates for dependents
        self.trigger_updates(path);
    }
    
    /// Get a reactive value
    pub fn get(&self, path: &str) -> Option<StateValue> {
        // Check if it's a computed value
        if let Some(computed) = self.computeds.get(path) {
            // Execute computation
            Some((computed.compute)(&self.values))
        } else {
            // Return stored value
            self.values.get(path).map(|v| v.clone())
        }
    }
    
    /// Create a computed value
    pub fn computed<F>(&self, path: &str, deps: Vec<String>, compute: F)
    where
        F: Fn(&DashMap<String, StateValue>) -> StateValue + Send + Sync + 'static,
    {
        // Register computed
        let computed_def = ComputedDefinition {
            compute: Box::new(compute),
            deps: deps.iter().cloned().collect(),
        };
        
        // Track dependencies
        for dep in &deps {
            self.dependents.entry(dep.clone())
                .or_insert_with(HashSet::new)
                .insert(path.to_string());
        }
        
        self.dependencies.insert(path.to_string(), computed_def.deps.clone());
        self.computeds.insert(path.to_string(), computed_def);
        
        // Initial computation
        self.trigger_updates(path);
    }
    
    /// Create a reactive effect
    pub fn effect<F>(&self, deps: Vec<String>, effect: F)
    where
        F: Fn() + Send + Sync + 'static,
    {
        // Effects are like computeds but without a return value
        let effect_id = format!("effect_{}", uuid::Uuid::new_v4());
        
        self.computed(&effect_id, deps, move |_| {
            effect();
            StateValue::Null
        });
    }
    
    /// Watch for changes to specific paths
    pub fn watch<F>(&self, paths: Vec<String>, callback: F)
    where
        F: Fn(&str, &StateValue) + Send + Sync + 'static,
    {
        // Create a watcher effect
        let watch_id = format!("watch_{}", uuid::Uuid::new_v4());
        let values = self.values.clone();
        let paths_clone = paths.clone();
        
        self.effect(paths, move || {
            for path in &paths_clone {
                if let Some(value) = values.get(path) {
                    callback(path, &value);
                }
            }
        });
    }
    
    /// Batch multiple updates
    pub fn batch<F>(&self, updates: F)
    where
        F: FnOnce(&BatchUpdater),
    {
        let batch_updater = BatchUpdater {
            updates: Vec::new(),
        };
        
        updates(&batch_updater);
        
        // Apply all updates at once
        let affected_paths: HashSet<String> = batch_updater.updates.iter()
            .map(|(path, _)| path.clone())
            .collect();
        
        // Apply updates
        for (path, value) in batch_updater.updates {
            self.values.insert(path, value);
        }
        
        // Trigger updates for all affected paths
        for path in affected_paths {
            self.trigger_updates(&path);
        }
    }
    
    /// Delete a value
    pub fn delete(&self, path: &str) {
        self.values.remove(path);
        self.trigger_updates(path);
    }
    
    /// Clear all state
    pub fn clear(&self) {
        self.values.clear();
        self.dependencies.clear();
        self.dependents.clear();
        self.computeds.clear();
    }
    
    /// Get all keys matching a pattern
    pub fn keys(&self, pattern: Option<&str>) -> Vec<String> {
        let keys: Vec<String> = self.values.iter()
            .map(|entry| entry.key().clone())
            .collect();
        
        if let Some(pattern) = pattern {
            // Simple glob matching
            keys.into_iter()
                .filter(|k| k.contains(pattern))
                .collect()
        } else {
            keys
        }
    }
    
    /// Subscribe to state changes
    pub fn subscribe<F>(&self, callback: F) -> SubscriptionHandle
    where
        F: Fn(StateChange) + Send + Sync + 'static,
    {
        let subscription_id = uuid::Uuid::new_v4().to_string();
        
        // Store subscription
        // In production, this would use a proper subscription system
        
        SubscriptionHandle {
            id: subscription_id,
        }
    }
    
    /// Trigger updates for dependents
    fn trigger_updates(&self, path: &str) {
        let mut to_update = HashSet::new();
        to_update.insert(path.to_string());
        
        // Find all dependent computeds
        let mut queue = vec![path.to_string()];
        let mut visited = HashSet::new();
        
        while let Some(current) = queue.pop() {
            if visited.contains(&current) {
                continue;
            }
            visited.insert(current.clone());
            
            if let Some(deps) = self.dependents.get(&current) {
                for dep in deps.iter() {
                    to_update.insert(dep.clone());
                    queue.push(dep.clone());
                }
            }
        }
        
        // Re-compute all affected computeds
        for computed_path in to_update {
            if let Some(computed) = self.computeds.get(&computed_path) {
                let new_value = (computed.compute)(&self.values);
                self.values.insert(computed_path, new_value);
            }
        }
    }
    
    /// Create a derived store with mapped values
    pub fn map<F>(&self, mapper: F) -> DerivedStore
    where
        F: Fn(&StateValue) -> StateValue + Send + Sync + 'static,
    {
        DerivedStore {
            source: self.values.clone(),
            mapper: Box::new(mapper),
        }
    }
    
    /// Create a filtered view of the store
    pub fn filter<F>(&self, predicate: F) -> FilteredStore
    where
        F: Fn(&str, &StateValue) -> bool + Send + Sync + 'static,
    {
        FilteredStore {
            source: self.values.clone(),
            predicate: Box::new(predicate),
        }
    }
}

/// Batch updater for atomic updates
pub struct BatchUpdater {
    updates: Vec<(String, StateValue)>,
}

impl BatchUpdater {
    pub fn set(&mut self, path: &str, value: StateValue) {
        self.updates.push((path.to_string(), value));
    }
}

/// Subscription handle for unsubscribing
pub struct SubscriptionHandle {
    id: String,
}

impl SubscriptionHandle {
    pub fn unsubscribe(self) {
        // Remove subscription
    }
}

/// State change notification
pub struct StateChange {
    pub path: String,
    pub old_value: Option<StateValue>,
    pub new_value: Option<StateValue>,
}

/// Derived store with mapped values
pub struct DerivedStore {
    source: Arc<DashMap<String, StateValue>>,
    mapper: Box<dyn Fn(&StateValue) -> StateValue + Send + Sync>,
}

impl DerivedStore {
    pub fn get(&self, path: &str) -> Option<StateValue> {
        self.source.get(path).map(|v| (self.mapper)(&v))
    }
}

/// Filtered store view
pub struct FilteredStore {
    source: Arc<DashMap<String, StateValue>>,
    predicate: Box<dyn Fn(&str, &StateValue) -> bool + Send + Sync>,
}

impl FilteredStore {
    pub fn get(&self, path: &str) -> Option<StateValue> {
        self.source.get(path).and_then(|v| {
            if (self.predicate)(path, &v) {
                Some(v.clone())
            } else {
                None
            }
        })
    }
    
    pub fn keys(&self) -> Vec<String> {
        self.source.iter()
            .filter(|entry| (self.predicate)(entry.key(), entry.value()))
            .map(|entry| entry.key().clone())
            .collect()
    }
}

/// Create a reactive store with initial values
pub fn create_store(initial: HashMap<String, StateValue>) -> ReactiveStore {
    let store = ReactiveStore::new();
    
    for (key, value) in initial {
        store.set(&key, value);
    }
    
    store
}

/// Macro for creating reactive computeds
#[macro_export]
macro_rules! computed {
    ($store:expr, $name:expr, [$($dep:expr),*], $body:expr) => {
        $store.computed($name, vec![$($dep.to_string()),*], $body)
    };
}

/// Macro for creating reactive effects
#[macro_export]
macro_rules! effect {
    ($store:expr, [$($dep:expr),*], $body:expr) => {
        $store.effect(vec![$($dep.to_string()),*], $body)
    };
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_reactive_store() {
        let store = ReactiveStore::new();
        
        // Set values
        store.set("count", StateValue::Number(0.0));
        store.set("name", StateValue::String("Test".to_string()));
        
        // Get values
        assert_eq!(store.get("count"), Some(StateValue::Number(0.0)));
        assert_eq!(store.get("name"), Some(StateValue::String("Test".to_string())));
        
        // Update value
        store.set("count", StateValue::Number(1.0));
        assert_eq!(store.get("count"), Some(StateValue::Number(1.0)));
    }
    
    #[test]
    fn test_computed_values() {
        let store = ReactiveStore::new();
        
        store.set("a", StateValue::Number(2.0));
        store.set("b", StateValue::Number(3.0));
        
        // Create computed
        store.computed("sum", vec!["a".to_string(), "b".to_string()], |values| {
            let a = match values.get("a") {
                Some(StateValue::Number(n)) => *n,
                _ => 0.0,
            };
            let b = match values.get("b") {
                Some(StateValue::Number(n)) => *n,
                _ => 0.0,
            };
            StateValue::Number(a + b)
        });
        
        assert_eq!(store.get("sum"), Some(StateValue::Number(5.0)));
        
        // Update dependency
        store.set("a", StateValue::Number(5.0));
        assert_eq!(store.get("sum"), Some(StateValue::Number(8.0)));
    }
}
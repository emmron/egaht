use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

// Performance tracking
static mut PERF_TIMERS: Option<HashMap<String, f64>> = None;
static mut PERF_STATS: Option<PerformanceStats> = None;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
    
    #[wasm_bindgen(js_namespace = performance)]
    fn now() -> f64;
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[derive(Serialize, Deserialize, Debug)]
struct PerformanceStats {
    total_diffs: u64,
    total_diff_time: f64,
    avg_diff_time: f64,
    total_compilations: u64,
    total_compile_time: f64,
    avg_compile_time: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "nodeType")]
enum VNode {
    #[serde(rename = "1")]
    Element {
        #[serde(rename = "type")]
        tag: String,
        props: HashMap<String, serde_json::Value>,
        children: Vec<VNode>,
        key: Option<String>,
    },
    #[serde(rename = "2")]
    Text {
        value: String,
    },
    #[serde(rename = "3")]
    Component {
        #[serde(rename = "type")]
        component: String,
        props: HashMap<String, serde_json::Value>,
        children: Vec<VNode>,
        key: Option<String>,
    },
    #[serde(rename = "4")]
    Fragment {
        children: Vec<VNode>,
    },
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
enum Patch {
    #[serde(rename = "CREATE")]
    Create { node: VNode },
    #[serde(rename = "REMOVE")]
    Remove,
    #[serde(rename = "REPLACE")]
    Replace { node: VNode },
    #[serde(rename = "TEXT")]
    Text { value: String },
    #[serde(rename = "PROPS")]
    Props { patches: Vec<PropPatch> },
    #[serde(rename = "CHILDREN")]
    Children { patches: Vec<ChildPatch> },
}

#[derive(Serialize, Deserialize, Debug)]
struct PropPatch {
    key: String,
    value: serde_json::Value,
}

#[derive(Serialize, Deserialize, Debug)]
struct ChildPatch {
    index: usize,
    patches: Vec<Patch>,
}

// Memory management
static mut ALLOCATED_BUFFERS: Option<HashMap<usize, Vec<u8>>> = None;
static mut NEXT_BUFFER_ID: usize = 0;

#[wasm_bindgen]
pub fn init() {
    unsafe {
        ALLOCATED_BUFFERS = Some(HashMap::new());
        PERF_TIMERS = Some(HashMap::new());
        PERF_STATS = Some(PerformanceStats {
            total_diffs: 0,
            total_diff_time: 0.0,
            avg_diff_time: 0.0,
            total_compilations: 0,
            total_compile_time: 0.0,
            avg_compile_time: 0.0,
        });
    }
    console_log!("WASM Runtime initialized");
}

#[wasm_bindgen]
pub fn alloc(size: usize) -> *mut u8 {
    let mut buffer = vec![0u8; size];
    let ptr = buffer.as_mut_ptr();
    
    unsafe {
        if let Some(buffers) = &mut ALLOCATED_BUFFERS {
            buffers.insert(ptr as usize, buffer);
        }
    }
    
    ptr
}

#[wasm_bindgen]
pub fn free(ptr: *mut u8) {
    unsafe {
        if let Some(buffers) = &mut ALLOCATED_BUFFERS {
            buffers.remove(&(ptr as usize));
        }
    }
}

// Fast VDOM diffing
#[wasm_bindgen]
pub fn diff_vnodes(old_ptr: *const u8, old_len: usize, new_ptr: *const u8, new_len: usize) -> *mut u8 {
    let start = now();
    
    // Deserialize vnodes
    let old_slice = unsafe { std::slice::from_raw_parts(old_ptr, old_len) };
    let new_slice = unsafe { std::slice::from_raw_parts(new_ptr, new_len) };
    
    let old_str = std::str::from_utf8(old_slice).unwrap_or("");
    let new_str = std::str::from_utf8(new_slice).unwrap_or("");
    
    let old_vnode: VNode = serde_json::from_str(old_str).unwrap_or(VNode::Fragment { children: vec![] });
    let new_vnode: VNode = serde_json::from_str(new_str).unwrap_or(VNode::Fragment { children: vec![] });
    
    // Perform diff
    let patches = diff_vnodes_internal(&old_vnode, &new_vnode);
    
    // Serialize patches
    let patches_json = serde_json::to_string(&patches).unwrap_or_else(|_| "[]".to_string());
    let bytes = patches_json.as_bytes();
    
    // Allocate and copy result
    let result_ptr = alloc(bytes.len());
    unsafe {
        std::ptr::copy_nonoverlapping(bytes.as_ptr(), result_ptr, bytes.len());
        
        // Update stats
        if let Some(stats) = &mut PERF_STATS {
            let diff_time = now() - start;
            stats.total_diffs += 1;
            stats.total_diff_time += diff_time;
            stats.avg_diff_time = stats.total_diff_time / stats.total_diffs as f64;
        }
    }
    
    result_ptr
}

fn diff_vnodes_internal(old: &VNode, new: &VNode) -> Vec<Patch> {
    let mut patches = Vec::new();
    
    match (old, new) {
        (VNode::Text { value: old_val }, VNode::Text { value: new_val }) => {
            if old_val != new_val {
                patches.push(Patch::Text { value: new_val.clone() });
            }
        }
        (VNode::Element { tag: old_tag, props: old_props, children: old_children, .. },
         VNode::Element { tag: new_tag, props: new_props, children: new_children, .. }) => {
            if old_tag != new_tag {
                patches.push(Patch::Replace { node: new.clone() });
            } else {
                // Diff props
                let prop_patches = diff_props(old_props, new_props);
                if !prop_patches.is_empty() {
                    patches.push(Patch::Props { patches: prop_patches });
                }
                
                // Diff children with key-based algorithm
                let child_patches = diff_children(old_children, new_children);
                if !child_patches.is_empty() {
                    patches.push(Patch::Children { patches: child_patches });
                }
            }
        }
        _ => {
            // Different node types - replace
            patches.push(Patch::Replace { node: new.clone() });
        }
    }
    
    patches
}

fn diff_props(old: &HashMap<String, serde_json::Value>, new: &HashMap<String, serde_json::Value>) -> Vec<PropPatch> {
    let mut patches = Vec::new();
    let mut all_keys = HashSet::new();
    
    all_keys.extend(old.keys());
    all_keys.extend(new.keys());
    
    for key in all_keys {
        if key == "key" {
            continue;
        }
        
        match (old.get(key), new.get(key)) {
            (Some(old_val), Some(new_val)) if old_val != new_val => {
                patches.push(PropPatch { 
                    key: key.clone(), 
                    value: new_val.clone() 
                });
            }
            (Some(_), None) => {
                patches.push(PropPatch { 
                    key: key.clone(), 
                    value: serde_json::Value::Null 
                });
            }
            (None, Some(new_val)) => {
                patches.push(PropPatch { 
                    key: key.clone(), 
                    value: new_val.clone() 
                });
            }
            _ => {}
        }
    }
    
    patches
}

fn diff_children(old_children: &[VNode], new_children: &[VNode]) -> Vec<ChildPatch> {
    let mut patches = Vec::new();
    
    // Build key maps for efficient lookup
    let old_keyed: HashMap<&str, (usize, &VNode)> = old_children
        .iter()
        .enumerate()
        .filter_map(|(i, node)| {
            match node {
                VNode::Element { key: Some(k), .. } | 
                VNode::Component { key: Some(k), .. } => Some((k.as_str(), (i, node))),
                _ => None
            }
        })
        .collect();
    
    let new_keyed: HashMap<&str, (usize, &VNode)> = new_children
        .iter()
        .enumerate()
        .filter_map(|(i, node)| {
            match node {
                VNode::Element { key: Some(k), .. } | 
                VNode::Component { key: Some(k), .. } => Some((k.as_str(), (i, node))),
                _ => None
            }
        })
        .collect();
    
    // Diff keyed children
    for (key, (new_idx, new_node)) in &new_keyed {
        if let Some((old_idx, old_node)) = old_keyed.get(key) {
            let node_patches = diff_vnodes_internal(old_node, new_node);
            if !node_patches.is_empty() {
                patches.push(ChildPatch {
                    index: *new_idx,
                    patches: node_patches,
                });
            }
        }
    }
    
    // Diff non-keyed children by index
    let max_len = old_children.len().max(new_children.len());
    for i in 0..max_len {
        match (old_children.get(i), new_children.get(i)) {
            (Some(old), Some(new)) => {
                let node_patches = diff_vnodes_internal(old, new);
                if !node_patches.is_empty() {
                    patches.push(ChildPatch {
                        index: i,
                        patches: node_patches,
                    });
                }
            }
            (Some(_), None) => {
                patches.push(ChildPatch {
                    index: i,
                    patches: vec![Patch::Remove],
                });
            }
            (None, Some(new)) => {
                patches.push(ChildPatch {
                    index: i,
                    patches: vec![Patch::Create { node: new.clone() }],
                });
            }
            _ => {}
        }
    }
    
    patches
}

#[wasm_bindgen]
pub fn get_patches_len(ptr: *const u8) -> *mut u8 {
    // Calculate the length of the patches buffer
    unsafe {
        if let Some(buffers) = &ALLOCATED_BUFFERS {
            for (buf_ptr, buffer) in buffers.iter() {
                if *buf_ptr == ptr as usize {
                    let len = buffer.len() as u32;
                    let len_ptr = alloc(4);
                    *(len_ptr as *mut u32) = len;
                    return len_ptr;
                }
            }
        }
    }
    
    // Return 0 if not found
    let len_ptr = alloc(4);
    unsafe {
        *(len_ptr as *mut u32) = 0;
    }
    len_ptr
}

// Template compilation
#[wasm_bindgen]
pub fn compile_template(template_ptr: *const u8, template_len: usize) -> *mut u8 {
    let start = now();
    
    let template_slice = unsafe { std::slice::from_raw_parts(template_ptr, template_len) };
    let template = std::str::from_utf8(template_slice).unwrap_or("");
    
    // Fast template compilation
    let compiled = compile_template_internal(template);
    let bytes = compiled.as_bytes();
    
    let result_ptr = alloc(bytes.len());
    unsafe {
        std::ptr::copy_nonoverlapping(bytes.as_ptr(), result_ptr, bytes.len());
        
        // Update stats
        if let Some(stats) = &mut PERF_STATS {
            let compile_time = now() - start;
            stats.total_compilations += 1;
            stats.total_compile_time += compile_time;
            stats.avg_compile_time = stats.total_compile_time / stats.total_compilations as f64;
        }
    }
    
    result_ptr
}

fn compile_template_internal(template: &str) -> String {
    // Simple template compiler - convert Eghact template to optimized render function
    let mut output = String::from("function render(state) {\n  const h = this.h;\n");
    
    // Parse template and generate optimized code
    // This is a simplified version - real implementation would use proper parser
    let lines: Vec<&str> = template.lines().collect();
    
    for line in lines {
        let trimmed = line.trim();
        if trimmed.starts_with("<") && trimmed.ends_with(">") {
            // Handle element
            let tag = extract_tag(trimmed);
            output.push_str(&format!("  return h('{}', {{}}, []);\n", tag));
        } else if trimmed.contains("{") && trimmed.contains("}") {
            // Handle interpolation
            let expr = extract_expression(trimmed);
            output.push_str(&format!("  return state.{};\n", expr));
        }
    }
    
    output.push_str("}");
    output
}

fn extract_tag(element: &str) -> &str {
    element
        .trim_start_matches('<')
        .trim_end_matches('>')
        .split_whitespace()
        .next()
        .unwrap_or("div")
}

fn extract_expression(line: &str) -> &str {
    line.trim_start_matches('{')
        .trim_end_matches('}')
        .trim()
}

#[wasm_bindgen]
pub fn get_compiled_len(ptr: *const u8) -> usize {
    unsafe {
        if let Some(buffers) = &ALLOCATED_BUFFERS {
            for (buf_ptr, buffer) in buffers.iter() {
                if *buf_ptr == ptr as usize {
                    return buffer.len();
                }
            }
        }
    }
    0
}

// Dependency computation for reactive system
#[wasm_bindgen]
pub fn compute_dependencies(effect_id: u32, deps_ptr: *const u32, deps_len: usize) -> *mut u8 {
    let deps_slice = unsafe { std::slice::from_raw_parts(deps_ptr, deps_len) };
    let deps: Vec<u32> = deps_slice.to_vec();
    
    // Compute optimal dependency update order
    let mut result = Vec::new();
    let mut visited = HashSet::new();
    
    // Topological sort for dependency order
    for &dep in &deps {
        if !visited.contains(&dep) {
            dfs_dependencies(dep, &deps, &mut visited, &mut result);
        }
    }
    
    // Convert to bytes
    let result_bytes: Vec<u8> = result
        .iter()
        .flat_map(|&x| x.to_le_bytes())
        .collect();
    
    let result_ptr = alloc(result_bytes.len());
    unsafe {
        std::ptr::copy_nonoverlapping(result_bytes.as_ptr(), result_ptr, result_bytes.len());
    }
    
    result_ptr
}

fn dfs_dependencies(node: u32, deps: &[u32], visited: &mut HashSet<u32>, result: &mut Vec<u32>) {
    visited.insert(node);
    
    // In real implementation, we'd have a dependency graph
    // For now, just add the node
    result.push(node);
}

#[wasm_bindgen]
pub fn get_result_len(ptr: *const u8) -> usize {
    unsafe {
        if let Some(buffers) = &ALLOCATED_BUFFERS {
            for (buf_ptr, buffer) in buffers.iter() {
                if *buf_ptr == ptr as usize {
                    return buffer.len() / 4; // u32 is 4 bytes
                }
            }
        }
    }
    0
}

// Performance tracking
#[wasm_bindgen]
pub fn start_timer(name_ptr: *const u8, name_len: usize) -> u32 {
    let name_slice = unsafe { std::slice::from_raw_parts(name_ptr, name_len) };
    let name = std::str::from_utf8(name_slice).unwrap_or("unnamed");
    
    unsafe {
        if let Some(timers) = &mut PERF_TIMERS {
            let id = NEXT_BUFFER_ID;
            NEXT_BUFFER_ID += 1;
            timers.insert(format!("{}_{}", name, id), now());
            return id as u32;
        }
    }
    
    0
}

#[wasm_bindgen]
pub fn end_timer(id: u32) -> f64 {
    let key = format!("timer_{}", id);
    
    unsafe {
        if let Some(timers) = &mut PERF_TIMERS {
            if let Some(start_time) = timers.remove(&key) {
                return now() - start_time;
            }
        }
    }
    
    0.0
}

#[wasm_bindgen]
pub fn get_performance_stats() -> *mut u8 {
    unsafe {
        if let Some(stats) = &PERF_STATS {
            let json = serde_json::to_string(stats).unwrap_or_else(|_| "{}".to_string());
            let bytes = json.as_bytes();
            
            let result_ptr = alloc(bytes.len());
            std::ptr::copy_nonoverlapping(bytes.as_ptr(), result_ptr, bytes.len());
            
            return result_ptr;
        }
    }
    
    let empty = b"{}";
    let result_ptr = alloc(empty.len());
    unsafe {
        std::ptr::copy_nonoverlapping(empty.as_ptr(), result_ptr, empty.len());
    }
    result_ptr
}

#[wasm_bindgen]
pub fn get_stats_len(ptr: *const u8) -> usize {
    unsafe {
        if let Some(buffers) = &ALLOCATED_BUFFERS {
            for (buf_ptr, buffer) in buffers.iter() {
                if *buf_ptr == ptr as usize {
                    return buffer.len();
                }
            }
        }
    }
    0
}
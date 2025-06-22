use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};

/// Module dependency graph for incremental compilation
/// Tracks all .egh files, their dependencies, and compilation artifacts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyGraph {
    /// Map of file path to its module info
    pub modules: HashMap<PathBuf, ModuleInfo>,
    /// Reverse dependency map: file -> files that depend on it
    pub dependents: HashMap<PathBuf, HashSet<PathBuf>>,
    /// Cache metadata
    pub cache_version: String,
    pub last_updated: u64,
}

/// Information about a single module
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleInfo {
    /// File path
    pub path: PathBuf,
    /// Content hash for change detection
    pub content_hash: String,
    /// Last modification time
    pub mtime: u64,
    /// Direct dependencies (imports)
    pub dependencies: HashSet<PathBuf>,
    /// Template dependencies (variables used in template)
    pub template_dependencies: HashSet<String>,
    /// Style dependencies (CSS imports and variables)
    pub style_dependencies: HashSet<PathBuf>,
    /// Component dependencies (component imports)
    pub component_dependencies: HashSet<PathBuf>,
    /// Type dependencies (TypeScript type imports)
    pub type_dependencies: HashSet<PathBuf>,
    /// Compilation artifacts
    pub artifacts: CompilationArtifacts,
    /// Last compilation time
    pub last_compiled: u64,
    /// Section-specific hashes for fine-grained change detection
    pub section_hashes: SectionHashes,
}

/// Section-specific hashes for fine-grained change detection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SectionHashes {
    /// Hash of template section
    pub template_hash: Option<String>,
    /// Hash of script section
    pub script_hash: Option<String>,
    /// Hash of style section
    pub style_hash: Option<String>,
}

/// Compilation artifacts for a module
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompilationArtifacts {
    /// Compiled JavaScript code
    pub js_code: Option<String>,
    /// CSS code
    pub css_code: Option<String>,
    /// AST representation (serialized)
    pub ast_data: Option<Vec<u8>>,
    /// Source map
    pub source_map: Option<String>,
    /// Type definitions
    pub type_defs: Option<String>,
    /// Reactive dependencies cache
    pub reactive_deps: Option<String>,
    /// Template DOM cache
    pub template_dom: Option<String>,
}

impl DependencyGraph {
    /// Create a new empty dependency graph
    pub fn new() -> Self {
        Self {
            modules: HashMap::new(),
            dependents: HashMap::new(),
            cache_version: "1.0.0".to_string(),
            last_updated: current_timestamp(),
        }
    }

    /// Load dependency graph from cache file
    pub fn load_from_cache<P: AsRef<Path>>(cache_path: P) -> Result<Self, Box<dyn std::error::Error>> {
        let content = fs::read_to_string(cache_path)?;
        let graph: Self = serde_json::from_str(&content)?;
        Ok(graph)
    }

    /// Save dependency graph to cache file
    pub fn save_to_cache<P: AsRef<Path>>(&self, cache_path: P) -> Result<(), Box<dyn std::error::Error>> {
        let content = serde_json::to_string_pretty(self)?;
        if let Some(parent) = cache_path.as_ref().parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(cache_path, content)?;
        Ok(())
    }

    /// Add or update a module in the graph
    pub fn add_module(&mut self, path: PathBuf, dependencies: HashSet<PathBuf>) -> Result<(), Box<dyn std::error::Error>> {
        let content_hash = calculate_file_hash(&path)?;
        let mtime = get_file_mtime(&path)?;

        // Remove old dependencies from reverse map
        if let Some(old_module) = self.modules.get(&path) {
            for old_dep in &old_module.dependencies {
                if let Some(dependents) = self.dependents.get_mut(old_dep) {
                    dependents.remove(&path);
                }
            }
        }

        // Add new dependencies to reverse map
        for dep in &dependencies {
            self.dependents.entry(dep.clone()).or_insert_with(HashSet::new).insert(path.clone());
        }

        let module_info = ModuleInfo {
            path: path.clone(),
            content_hash,
            mtime,
            dependencies,
            template_dependencies: HashSet::new(),
            style_dependencies: HashSet::new(),
            component_dependencies: HashSet::new(),
            type_dependencies: HashSet::new(),
            artifacts: CompilationArtifacts {
                js_code: None,
                css_code: None,
                ast_data: None,
                source_map: None,
                type_defs: None,
                reactive_deps: None,
                template_dom: None,
            },
            last_compiled: 0,
            section_hashes: SectionHashes {
                template_hash: None,
                script_hash: None,
                style_hash: None,
            },
        };

        self.modules.insert(path, module_info);
        self.last_updated = current_timestamp();
        Ok(())
    }

    /// Add or update a module with detailed dependency information
    pub fn add_module_with_deps(
        &mut self, 
        path: PathBuf, 
        dependencies: ModuleDependencies
    ) -> Result<(), Box<dyn std::error::Error>> {
        let content_hash = calculate_file_hash(&path)?;
        let mtime = get_file_mtime(&path)?;
        let section_hashes = calculate_section_hashes(&path)?;

        // Remove old dependencies from reverse map
        if let Some(old_module) = self.modules.get(&path) {
            for old_dep in &old_module.dependencies {
                if let Some(dependents) = self.dependents.get_mut(old_dep) {
                    dependents.remove(&path);
                }
            }
        }

        // Add new dependencies to reverse map
        for dep in &dependencies.imports {
            self.dependents.entry(dep.clone()).or_insert_with(HashSet::new).insert(path.clone());
        }
        for dep in &dependencies.components {
            self.dependents.entry(dep.clone()).or_insert_with(HashSet::new).insert(path.clone());
        }
        for dep in &dependencies.styles {
            self.dependents.entry(dep.clone()).or_insert_with(HashSet::new).insert(path.clone());
        }
        for dep in &dependencies.types {
            self.dependents.entry(dep.clone()).or_insert_with(HashSet::new).insert(path.clone());
        }

        let module_info = ModuleInfo {
            path: path.clone(),
            content_hash,
            mtime,
            dependencies: dependencies.imports.clone(),
            template_dependencies: dependencies.template_vars,
            style_dependencies: dependencies.styles,
            component_dependencies: dependencies.components,
            type_dependencies: dependencies.types,
            artifacts: CompilationArtifacts {
                js_code: None,
                css_code: None,
                ast_data: None,
                source_map: None,
                type_defs: None,
                reactive_deps: None,
                template_dom: None,
            },
            last_compiled: 0,
            section_hashes,
        };

        self.modules.insert(path, module_info);
        self.last_updated = current_timestamp();
        Ok(())
    }

    /// Check if a file has changed since last compilation
    pub fn has_changed(&self, path: &Path) -> Result<bool, Box<dyn std::error::Error>> {
        if let Some(module) = self.modules.get(path) {
            let current_hash = calculate_file_hash(path)?;
            let current_mtime = get_file_mtime(path)?;
            
            Ok(module.content_hash != current_hash || module.mtime != current_mtime)
        } else {
            // New file
            Ok(true)
        }
    }

    /// Determine the invalidation level for a changed file
    pub fn get_invalidation_level(&self, path: &Path) -> Result<InvalidationLevel, Box<dyn std::error::Error>> {
        if let Some(module) = self.modules.get(path) {
            let current_sections = calculate_section_hashes(path)?;
            
            // Check which sections changed
            let template_changed = current_sections.template_hash != module.section_hashes.template_hash;
            let script_changed = current_sections.script_hash != module.section_hashes.script_hash;
            let style_changed = current_sections.style_hash != module.section_hashes.style_hash;
            
            if template_changed && script_changed && style_changed {
                Ok(InvalidationLevel::Full)
            } else if template_changed {
                Ok(InvalidationLevel::TemplateStructure)
            } else if script_changed {
                // Need to check if it's a type-only change
                if self.is_type_only_change(path)? {
                    Ok(InvalidationLevel::TypeDefinitions)
                } else {
                    Ok(InvalidationLevel::Dependencies)
                }
            } else if style_changed {
                Ok(InvalidationLevel::ContentOnly)
            } else {
                Ok(InvalidationLevel::ContentOnly)
            }
        } else {
            Ok(InvalidationLevel::Full)
        }
    }

    /// Check if change is type-only (heuristic)
    fn is_type_only_change(&self, _path: &Path) -> Result<bool, Box<dyn std::error::Error>> {
        // Simplified heuristic - in real implementation this would 
        // analyze the AST to determine if only type annotations changed
        Ok(false)
    }

    /// Get modules that need recompilation based on invalidation level
    pub fn get_modules_to_recompile(&self, changed_file: &Path, level: InvalidationLevel) -> HashSet<PathBuf> {
        let mut to_recompile = HashSet::new();
        
        match level {
            InvalidationLevel::ContentOnly => {
                // Only the file itself needs recompilation
                to_recompile.insert(changed_file.to_path_buf());
            },
            InvalidationLevel::Dependencies | InvalidationLevel::TemplateStructure | InvalidationLevel::Full => {
                // File and all dependents need recompilation
                to_recompile = self.get_affected_files(changed_file);
            },
            InvalidationLevel::TypeDefinitions => {
                // Only files that depend on types need recompilation
                to_recompile = self.get_type_dependent_files(changed_file);
            },
        }
        
        to_recompile
    }

    /// Get files that depend on types from the given file
    fn get_type_dependent_files(&self, changed_file: &Path) -> HashSet<PathBuf> {
        let mut dependents = HashSet::new();
        dependents.insert(changed_file.to_path_buf());
        
        for (path, module) in &self.modules {
            if module.type_dependencies.contains(changed_file) {
                dependents.insert(path.clone());
            }
        }
        
        dependents
    }

    /// Get all files that need recompilation when a file changes
    pub fn get_affected_files(&self, changed_file: &Path) -> HashSet<PathBuf> {
        let mut affected = HashSet::new();
        let mut to_visit = vec![changed_file.to_path_buf()];
        let mut visited = HashSet::new();

        while let Some(current) = to_visit.pop() {
            if visited.contains(&current) {
                continue;
            }
            visited.insert(current.clone());
            affected.insert(current.clone());

            // Add all dependents
            if let Some(dependents) = self.dependents.get(&current) {
                for dependent in dependents {
                    if !visited.contains(dependent) {
                        to_visit.push(dependent.clone());
                    }
                }
            }
        }

        affected
    }

    /// Update compilation artifacts for a module
    pub fn update_artifacts(&mut self, path: &Path, artifacts: CompilationArtifacts) {
        if let Some(module) = self.modules.get_mut(path) {
            module.artifacts = artifacts;
            module.last_compiled = current_timestamp();
        }
    }

    /// Get cached artifacts for a module
    pub fn get_artifacts(&self, path: &Path) -> Option<&CompilationArtifacts> {
        self.modules.get(path).map(|m| &m.artifacts)
    }

    /// Remove a module from the graph
    pub fn remove_module(&mut self, path: &Path) {
        if let Some(module) = self.modules.remove(path) {
            // Remove from reverse dependencies
            for dep in &module.dependencies {
                if let Some(dependents) = self.dependents.get_mut(dep) {
                    dependents.remove(path);
                }
            }
        }

        // Remove as dependent
        self.dependents.remove(path);
    }

    /// Get compilation statistics
    pub fn get_stats(&self) -> DependencyStats {
        let total_modules = self.modules.len();
        let cached_modules = self.modules.values().filter(|m| m.last_compiled > 0).count();
        let total_dependencies = self.modules.values().map(|m| m.dependencies.len()).sum();
        
        DependencyStats {
            total_modules,
            cached_modules,
            total_dependencies,
            cache_hit_rate: if total_modules > 0 {
                cached_modules as f64 / total_modules as f64
            } else {
                0.0
            },
        }
    }

    /// Validate and clean the dependency graph
    pub fn validate_and_clean(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let mut to_remove = Vec::new();

        for (path, module) in &self.modules {
            // Check if file still exists
            if !path.exists() {
                to_remove.push(path.clone());
                continue;
            }

            // Check if content has changed significantly
            if let Ok(current_hash) = calculate_file_hash(path) {
                if current_hash != module.content_hash {
                    // File changed, mark for recompilation by clearing artifacts
                    // Note: We don't remove it, just clear artifacts
                }
            }
        }

        // Remove non-existent files
        for path in to_remove {
            self.remove_module(&path);
        }

        Ok(())
    }
}

/// Detailed dependency information for a module
#[derive(Debug, Clone)]
pub struct ModuleDependencies {
    /// Import dependencies (ES modules, CommonJS)
    pub imports: HashSet<PathBuf>,
    /// Component dependencies (Eghact components)
    pub components: HashSet<PathBuf>,
    /// Style dependencies (CSS imports)
    pub styles: HashSet<PathBuf>,
    /// Type dependencies (TypeScript types)
    pub types: HashSet<PathBuf>,
    /// Template variable dependencies
    pub template_vars: HashSet<String>,
}

/// Statistics about the dependency graph
#[derive(Debug, Clone)]
pub struct DependencyStats {
    pub total_modules: usize,
    pub cached_modules: usize,
    pub total_dependencies: usize,
    pub cache_hit_rate: f64,
}

/// Invalidation level for incremental compilation
#[derive(Debug, Clone, PartialEq)]
pub enum InvalidationLevel {
    /// Only file content changed
    ContentOnly,
    /// Dependencies changed
    Dependencies,
    /// Type definitions changed  
    TypeDefinitions,
    /// Template structure changed
    TemplateStructure,
    /// Full recompilation needed
    Full,
}

/// Calculate SHA-256 hash of file content
fn calculate_file_hash<P: AsRef<Path>>(path: P) -> Result<String, Box<dyn std::error::Error>> {
    let content = fs::read(path)?;
    let mut hasher = Sha256::new();
    hasher.update(&content);
    Ok(format!("{:x}", hasher.finalize()))
}

/// Calculate section-specific hashes for .egh files
fn calculate_section_hashes<P: AsRef<Path>>(path: P) -> Result<SectionHashes, Box<dyn std::error::Error>> {
    let content = fs::read_to_string(path)?;
    
    // Parse the .egh file to extract sections
    let (template, script, style) = parse_egh_sections(&content);
    
    let mut template_hash = None;
    let mut script_hash = None;
    let mut style_hash = None;
    
    if let Some(template_content) = template {
        template_hash = Some(calculate_content_hash(&template_content));
    }
    
    if let Some(script_content) = script {
        script_hash = Some(calculate_content_hash(&script_content));
    }
    
    if let Some(style_content) = style {
        style_hash = Some(calculate_content_hash(&style_content));
    }
    
    Ok(SectionHashes {
        template_hash,
        script_hash,
        style_hash,
    })
}

/// Calculate hash of content string
fn calculate_content_hash(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Parse .egh file sections (simplified version)
fn parse_egh_sections(content: &str) -> (Option<String>, Option<String>, Option<String>) {
    let mut template = None;
    let mut script = None;
    let mut style = None;
    
    // Basic parsing - in real implementation this would use the proper parser
    let lines: Vec<&str> = content.lines().collect();
    let mut current_section = None;
    let mut section_content = String::new();
    
    for line in lines {
        let trimmed = line.trim();
        
        if trimmed.starts_with("<template>") {
            if let Some(ref section) = current_section {
                match section.as_str() {
                    "template" => template = Some(section_content.clone()),
                    "script" => script = Some(section_content.clone()),
                    "style" => style = Some(section_content.clone()),
                    _ => {}
                }
            }
            current_section = Some("template".to_string());
            section_content.clear();
        } else if trimmed.starts_with("<script>") {
            if let Some(ref section) = current_section {
                match section.as_str() {
                    "template" => template = Some(section_content.clone()),
                    "script" => script = Some(section_content.clone()),
                    "style" => style = Some(section_content.clone()),
                    _ => {}
                }
            }
            current_section = Some("script".to_string());
            section_content.clear();
        } else if trimmed.starts_with("<style>") {
            if let Some(ref section) = current_section {
                match section.as_str() {
                    "template" => template = Some(section_content.clone()),
                    "script" => script = Some(section_content.clone()),
                    "style" => style = Some(section_content.clone()),
                    _ => {}
                }
            }
            current_section = Some("style".to_string());
            section_content.clear();
        } else if trimmed.starts_with("</template>") || trimmed.starts_with("</script>") || trimmed.starts_with("</style>") {
            if let Some(ref section) = current_section {
                match section.as_str() {
                    "template" => template = Some(section_content.clone()),
                    "script" => script = Some(section_content.clone()),
                    "style" => style = Some(section_content.clone()),
                    _ => {}
                }
            }
            current_section = None;
            section_content.clear();
        } else if current_section.is_some() {
            section_content.push_str(line);
            section_content.push('\n');
        }
    }
    
    // Handle last section
    if let Some(ref section) = current_section {
        match section.as_str() {
            "template" => template = Some(section_content),
            "script" => script = Some(section_content),
            "style" => style = Some(section_content),
            _ => {}
        }
    }
    
    (template, script, style)
}

/// Get file modification time as timestamp
fn get_file_mtime<P: AsRef<Path>>(path: P) -> Result<u64, Box<dyn std::error::Error>> {
    let metadata = fs::metadata(path)?;
    let mtime = metadata.modified()?;
    Ok(mtime.duration_since(UNIX_EPOCH)?.as_secs())
}

/// Get current timestamp
fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_dependency_graph_creation() {
        let mut graph = DependencyGraph::new();
        assert_eq!(graph.modules.len(), 0);
        assert_eq!(graph.dependents.len(), 0);
    }

    #[test]
    fn test_add_module() -> Result<(), Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let file_path = temp_dir.path().join("test.egh");
        fs::write(&file_path, "test content")?;

        let mut graph = DependencyGraph::new();
        let dependencies = HashSet::new();
        
        graph.add_module(file_path.clone(), dependencies)?;
        
        assert_eq!(graph.modules.len(), 1);
        assert!(graph.modules.contains_key(&file_path));
        Ok(())
    }

    #[test]
    fn test_dependency_tracking() -> Result<(), Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let file_a = temp_dir.path().join("a.egh");
        let file_b = temp_dir.path().join("b.egh");
        
        fs::write(&file_a, "import './b.egh'")?;
        fs::write(&file_b, "export default component")?;

        let mut graph = DependencyGraph::new();
        
        // Add file B (no dependencies)
        graph.add_module(file_b.clone(), HashSet::new())?;
        
        // Add file A (depends on B)
        let mut deps = HashSet::new();
        deps.insert(file_b.clone());
        graph.add_module(file_a.clone(), deps)?;

        // Check reverse dependencies
        let dependents = graph.dependents.get(&file_b).unwrap();
        assert!(dependents.contains(&file_a));

        // Check affected files when B changes
        let affected = graph.get_affected_files(&file_b);
        assert!(affected.contains(&file_a));
        assert!(affected.contains(&file_b));

        Ok(())
    }

    #[test]
    fn test_change_detection() -> Result<(), Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let file_path = temp_dir.path().join("test.egh");
        fs::write(&file_path, "original content")?;

        let mut graph = DependencyGraph::new();
        graph.add_module(file_path.clone(), HashSet::new())?;

        // File should not have changed initially
        assert!(!graph.has_changed(&file_path)?);

        // Modify file
        std::thread::sleep(std::time::Duration::from_millis(10));
        fs::write(&file_path, "modified content")?;

        // File should now show as changed
        assert!(graph.has_changed(&file_path)?);

        Ok(())
    }
}
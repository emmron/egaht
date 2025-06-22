use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use super::cache::{CacheManager, CacheConfig};
use super::{DependencyGraph, ModuleInfo, CompilationArtifacts};
use crate::parser::EghactParser;
use crate::transformer::EghactTransformer;
use crate::codegen::CodeGenerator;

/// Incremental compiler for Eghact with sub-100ms rebuild performance
pub struct IncrementalCompiler {
    /// Dependency graph tracking all modules
    dependency_graph: Arc<Mutex<DependencyGraph>>,
    /// Multi-level cache manager
    cache_manager: Arc<CacheManager>,
    /// Parser instance
    parser: EghactParser,
    /// Code transformer
    transformer: EghactTransformer,
    /// Code generator
    code_generator: CodeGenerator,
    /// Compiler configuration
    config: CompilerConfig,
    /// Performance metrics
    metrics: Arc<Mutex<CompilationMetrics>>,
}

/// Configuration for incremental compilation
#[derive(Debug, Clone)]
pub struct CompilerConfig {
    /// Root source directory
    pub source_dir: PathBuf,
    /// Output directory
    pub output_dir: PathBuf,
    /// Cache directory
    pub cache_dir: PathBuf,
    /// Enable incremental compilation
    pub enable_incremental: bool,
    /// Enable parallel compilation
    pub enable_parallel: bool,
    /// Maximum parallel jobs
    pub max_parallel_jobs: usize,
    /// Cache configuration
    pub cache_config: CacheConfig,
}

impl Default for CompilerConfig {
    fn default() -> Self {
        Self {
            source_dir: PathBuf::from("src"),
            output_dir: PathBuf::from("dist"),
            cache_dir: PathBuf::from(".eghact/cache"),
            enable_incremental: true,
            enable_parallel: true,
            max_parallel_jobs: num_cpus::get(),
            cache_config: CacheConfig::default(),
        }
    }
}

/// Compilation performance metrics
#[derive(Debug, Clone, Default)]
pub struct CompilationMetrics {
    /// Total compilation time
    pub total_time_ms: u64,
    /// Time spent on dependency analysis
    pub dependency_analysis_ms: u64,
    /// Time spent on parsing
    pub parsing_ms: u64,
    /// Time spent on transformation
    pub transformation_ms: u64,
    /// Time spent on code generation
    pub codegen_ms: u64,
    /// Cache hit count
    pub cache_hits: u64,
    /// Cache miss count
    pub cache_misses: u64,
    /// Number of files compiled
    pub files_compiled: u64,
    /// Number of files skipped (cached)
    pub files_skipped: u64,
}

/// Result of incremental compilation
#[derive(Debug)]
pub struct CompilationResult {
    /// Whether compilation was successful
    pub success: bool,
    /// Compilation metrics
    pub metrics: CompilationMetrics,
    /// List of compiled files
    pub compiled_files: Vec<PathBuf>,
    /// List of errors
    pub errors: Vec<CompilationError>,
    /// List of warnings
    pub warnings: Vec<CompilationWarning>,
}

/// Compilation error
#[derive(Debug, Clone)]
pub struct CompilationError {
    pub file: PathBuf,
    pub line: u32,
    pub column: u32,
    pub message: String,
    pub code: String,
}

/// Compilation warning
#[derive(Debug, Clone)]
pub struct CompilationWarning {
    pub file: PathBuf,
    pub line: u32,
    pub column: u32,
    pub message: String,
}

impl IncrementalCompiler {
    /// Create a new incremental compiler
    pub fn new(config: CompilerConfig) -> Result<Self, Box<dyn std::error::Error>> {
        // Load or create dependency graph
        let graph_cache_path = config.cache_dir.join("dependency_graph.json");
        let dependency_graph = if graph_cache_path.exists() {
            Arc::new(Mutex::new(DependencyGraph::load_from_cache(&graph_cache_path)?))
        } else {
            Arc::new(Mutex::new(DependencyGraph::new()))
        };

        // Create cache manager
        let cache_manager = Arc::new(CacheManager::new(&config.cache_dir, config.cache_config.clone())?);

        Ok(Self {
            dependency_graph,
            cache_manager,
            parser: EghactParser::new(),
            transformer: EghactTransformer::new(),
            code_generator: CodeGenerator::new(),
            config,
            metrics: Arc::new(Mutex::new(CompilationMetrics::default())),
        })
    }

    /// Perform full compilation of all source files
    pub fn compile_all(&self) -> Result<CompilationResult, Box<dyn std::error::Error>> {
        let start_time = Instant::now();
        let mut errors = Vec::new();
        let mut warnings = Vec::new();
        let mut compiled_files = Vec::new();

        // Discover all .egh files
        let source_files = self.discover_source_files()?;
        
        // Build dependency graph
        let dependency_start = Instant::now();
        self.build_dependency_graph(&source_files)?;
        let dependency_time = dependency_start.elapsed().as_millis() as u64;

        // Compile files in dependency order
        let compile_order = self.get_compilation_order(&source_files)?;
        
        for file_path in compile_order {
            match self.compile_file(&file_path, false) {
                Ok(Some(_)) => {
                    compiled_files.push(file_path);
                }
                Ok(None) => {
                    // File was cached, skipped
                }
                Err(error) => {
                    errors.push(CompilationError {
                        file: file_path,
                        line: 0,
                        column: 0,
                        message: error.to_string(),
                        code: "COMPILE_ERROR".to_string(),
                    });
                }
            }
        }

        let total_time = start_time.elapsed().as_millis() as u64;

        // Update metrics
        if let Ok(mut metrics) = self.metrics.lock() {
            metrics.total_time_ms = total_time;
            metrics.dependency_analysis_ms = dependency_time;
            metrics.files_compiled = compiled_files.len() as u64;
        }

        // Save dependency graph
        if let Ok(graph) = self.dependency_graph.lock() {
            let graph_cache_path = self.config.cache_dir.join("dependency_graph.json");
            let _ = graph.save_to_cache(&graph_cache_path);
        }

        Ok(CompilationResult {
            success: errors.is_empty(),
            metrics: self.metrics.lock().unwrap().clone(),
            compiled_files,
            errors,
            warnings,
        })
    }

    /// Perform incremental compilation of changed files
    pub fn compile_incremental(&self, changed_files: &[PathBuf]) -> Result<CompilationResult, Box<dyn std::error::Error>> {
        let start_time = Instant::now();
        let mut errors = Vec::new();
        let mut warnings = Vec::new();
        let mut compiled_files = Vec::new();

        if !self.config.enable_incremental {
            return self.compile_all();
        }

        // Get all affected files
        let mut affected_files = HashSet::new();
        {
            let graph = self.dependency_graph.lock().unwrap();
            for changed_file in changed_files {
                let affected = graph.get_affected_files(changed_file);
                affected_files.extend(affected);
            }
        }

        // Compile affected files in dependency order
        let compile_order = self.get_compilation_order(&affected_files.into_iter().collect())?;
        
        for file_path in compile_order {
            match self.compile_file(&file_path, true) {
                Ok(Some(_)) => {
                    compiled_files.push(file_path);
                }
                Ok(None) => {
                    // File was cached, skipped
                }
                Err(error) => {
                    errors.push(CompilationError {
                        file: file_path,
                        line: 0,
                        column: 0,
                        message: error.to_string(),
                        code: "COMPILE_ERROR".to_string(),
                    });
                }
            }
        }

        let total_time = start_time.elapsed().as_millis() as u64;

        // Update metrics
        if let Ok(mut metrics) = self.metrics.lock() {
            metrics.total_time_ms = total_time;
            metrics.files_compiled = compiled_files.len() as u64;
        }

        println!("🚀 Incremental compilation completed in {}ms ({} files)", total_time, compiled_files.len());

        Ok(CompilationResult {
            success: errors.is_empty(),
            metrics: self.metrics.lock().unwrap().clone(),
            compiled_files,
            errors,
            warnings,
        })
    }

    /// Compile a single file with caching
    fn compile_file(&self, file_path: &Path, incremental: bool) -> Result<Option<CompilationArtifacts>, Box<dyn std::error::Error>> {
        let start_time = Instant::now();

        // Calculate content hash for cache key
        let content = std::fs::read_to_string(file_path)?;
        let content_hash = calculate_content_hash(&content);

        // Check cache first if incremental compilation is enabled
        if incremental && self.config.enable_incremental {
            if let Some(cached_entry) = self.cache_manager.get(file_path, &content_hash) {
                // Update metrics
                if let Ok(mut metrics) = self.metrics.lock() {
                    metrics.cache_hits += 1;
                    metrics.files_skipped += 1;
                }
                return Ok(None); // File was cached
            }
        }

        // Parse the file
        let parse_start = Instant::now();
        let ast = self.parser.parse(&content, file_path)?;
        let parse_time = parse_start.elapsed().as_millis() as u64;

        // Transform the AST
        let transform_start = Instant::now();
        let transformed_ast = self.transformer.transform(ast)?;
        let transform_time = transform_start.elapsed().as_millis() as u64;

        // Generate code
        let codegen_start = Instant::now();
        let generated_code = self.code_generator.generate(&transformed_ast)?;
        let codegen_time = codegen_start.elapsed().as_millis() as u64;

        // Create compilation artifacts
        let artifacts = CompilationArtifacts {
            js_code: Some(generated_code.js),
            css_code: generated_code.css,
            ast_data: Some(bincode::serialize(&transformed_ast)?),
            source_map: generated_code.source_map,
            type_defs: generated_code.type_definitions,
        };

        // Create module info
        let module_info = ModuleInfo {
            path: file_path.to_path_buf(),
            content_hash,
            mtime: std::fs::metadata(file_path)?.modified()?.duration_since(std::time::UNIX_EPOCH)?.as_secs(),
            dependencies: self.extract_dependencies(&transformed_ast)?,
            artifacts: artifacts.clone(),
            last_compiled: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)?.as_secs(),
        };

        // Update dependency graph
        {
            let mut graph = self.dependency_graph.lock().unwrap();
            graph.add_module(file_path.to_path_buf(), module_info.dependencies.clone())?;
            graph.update_artifacts(file_path, artifacts.clone());
        }

        // Cache the result
        self.cache_manager.put(file_path.to_path_buf(), module_info, artifacts.clone())?;

        let total_compile_time = start_time.elapsed().as_millis() as u64;

        // Update metrics
        if let Ok(mut metrics) = self.metrics.lock() {
            metrics.cache_misses += 1;
            metrics.parsing_ms += parse_time;
            metrics.transformation_ms += transform_time;
            metrics.codegen_ms += codegen_time;
        }

        println!("✨ Compiled {} in {}ms", file_path.display(), total_compile_time);

        Ok(Some(artifacts))
    }

    /// Discover all .egh source files
    fn discover_source_files(&self) -> Result<Vec<PathBuf>, Box<dyn std::error::Error>> {
        let mut source_files = Vec::new();
        self.discover_files_recursive(&self.config.source_dir, &mut source_files)?;
        Ok(source_files)
    }

    /// Recursively discover .egh files
    fn discover_files_recursive(&self, dir: &Path, files: &mut Vec<PathBuf>) -> Result<(), Box<dyn std::error::Error>> {
        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_dir() {
                self.discover_files_recursive(&path, files)?;
            } else if path.extension().map_or(false, |ext| ext == "egh") {
                files.push(path);
            }
        }
        Ok(())
    }

    /// Build or update the dependency graph
    fn build_dependency_graph(&self, source_files: &[PathBuf]) -> Result<(), Box<dyn std::error::Error>> {
        let mut graph = self.dependency_graph.lock().unwrap();
        
        for file_path in source_files {
            // Check if file has changed
            if graph.has_changed(file_path)? {
                // Parse file to extract dependencies
                let content = std::fs::read_to_string(file_path)?;
                let ast = self.parser.parse(&content, file_path)?;
                let dependencies = self.extract_dependencies(&ast)?;
                
                graph.add_module(file_path.clone(), dependencies)?;
            }
        }

        // Validate and clean the graph
        graph.validate_and_clean()?;

        Ok(())
    }

    /// Extract dependencies from AST
    fn extract_dependencies(&self, ast: &serde_json::Value) -> Result<HashSet<PathBuf>, Box<dyn std::error::Error>> {
        let mut dependencies = HashSet::new();
        
        // TODO: Implement proper AST traversal to find import statements
        // For now, this is a placeholder that would need to be implemented
        // based on the actual AST structure
        
        if let Some(imports) = ast.get("imports") {
            if let Some(imports_array) = imports.as_array() {
                for import in imports_array {
                    if let Some(path_str) = import.get("path").and_then(|p| p.as_str()) {
                        let import_path = PathBuf::from(path_str);
                        dependencies.insert(import_path);
                    }
                }
            }
        }

        Ok(dependencies)
    }

    /// Get compilation order based on dependencies
    fn get_compilation_order(&self, files: &[PathBuf]) -> Result<Vec<PathBuf>, Box<dyn std::error::Error>> {
        let graph = self.dependency_graph.lock().unwrap();
        let mut ordered = Vec::new();
        let mut visited = HashSet::new();
        let mut visiting = HashSet::new();

        fn visit(
            file: &PathBuf,
            graph: &DependencyGraph,
            ordered: &mut Vec<PathBuf>,
            visited: &mut HashSet<PathBuf>,
            visiting: &mut HashSet<PathBuf>,
        ) -> Result<(), Box<dyn std::error::Error>> {
            if visited.contains(file) {
                return Ok(());
            }

            if visiting.contains(file) {
                return Err(format!("Circular dependency detected involving {}", file.display()).into());
            }

            visiting.insert(file.clone());

            // Visit dependencies first
            if let Some(module) = graph.modules.get(file) {
                for dep in &module.dependencies {
                    visit(dep, graph, ordered, visited, visiting)?;
                }
            }

            visiting.remove(file);
            visited.insert(file.clone());
            ordered.push(file.clone());

            Ok(())
        }

        for file in files {
            visit(file, &graph, &mut ordered, &mut visited, &mut visiting)?;
        }

        Ok(ordered)
    }

    /// Get compilation metrics
    pub fn get_metrics(&self) -> CompilationMetrics {
        self.metrics.lock().unwrap().clone()
    }

    /// Clear all caches
    pub fn clear_cache(&self) -> Result<(), Box<dyn std::error::Error>> {
        self.cache_manager.clear()?;
        
        let mut graph = self.dependency_graph.lock().unwrap();
        *graph = DependencyGraph::new();

        Ok(())
    }

    /// Get cache statistics
    pub fn get_cache_stats(&self) -> super::cache::CacheStats {
        self.cache_manager.get_stats()
    }
}

/// Calculate SHA-256 hash of content
fn calculate_content_hash(content: &str) -> String {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

// Placeholder structs for the actual compiler components
// These would be implemented in their respective modules

struct EghactParser;

impl EghactParser {
    fn new() -> Self {
        Self
    }

    fn parse(&self, _content: &str, _file_path: &Path) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
        // Placeholder implementation
        Ok(serde_json::json!({
            "type": "Module",
            "imports": [],
            "exports": [],
            "body": []
        }))
    }
}

struct EghactTransformer;

impl EghactTransformer {
    fn new() -> Self {
        Self
    }

    fn transform(&self, ast: serde_json::Value) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
        // Placeholder implementation
        Ok(ast)
    }
}

struct CodeGenerator;

#[derive(Debug, Clone)]
struct GeneratedCode {
    js: String,
    css: Option<String>,
    source_map: Option<String>,
    type_definitions: Option<String>,
}

impl CodeGenerator {
    fn new() -> Self {
        Self
    }

    fn generate(&self, _ast: &serde_json::Value) -> Result<GeneratedCode, Box<dyn std::error::Error>> {
        // Placeholder implementation
        Ok(GeneratedCode {
            js: "// Generated JavaScript code".to_string(),
            css: Some("/* Generated CSS */".to_string()),
            source_map: None,
            type_definitions: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_incremental_compiler_creation() -> Result<(), Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let config = CompilerConfig {
            source_dir: temp_dir.path().join("src"),
            output_dir: temp_dir.path().join("dist"),
            cache_dir: temp_dir.path().join(".cache"),
            ..Default::default()
        };

        let compiler = IncrementalCompiler::new(config)?;
        assert!(compiler.config.enable_incremental);
        Ok(())
    }

    #[test]
    fn test_content_hash_consistency() {
        let content = "console.log('test')";
        let hash1 = calculate_content_hash(content);
        let hash2 = calculate_content_hash(content);
        assert_eq!(hash1, hash2);
        assert!(!hash1.is_empty());
    }
}
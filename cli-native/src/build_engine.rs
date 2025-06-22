use anyhow::{Result, Context};
use colored::*;
use dashmap::DashMap;
use indicatif::{ProgressBar, ProgressStyle, MultiProgress};
use parking_lot::RwLock;
use rayon::prelude::*;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Instant;
use walkdir::WalkDir;

use crate::compiler::{Compiler, CompiledComponent};
use crate::utils::{calculate_hash, format_size, format_time};

/// High-performance build engine for Eghact
pub struct BuildEngine {
    /// Project root directory
    root: PathBuf,
    
    /// Output directory
    output: PathBuf,
    
    /// Component cache
    cache: Arc<DashMap<String, CachedComponent>>,
    
    /// Module graph
    module_graph: Arc<RwLock<ModuleGraph>>,
    
    /// Build options
    options: BuildOptions,
    
    /// Compiler instance
    compiler: Arc<Compiler>,
    
    /// Progress tracking
    progress: MultiProgress,
}

#[derive(Clone)]
pub struct BuildOptions {
    pub watch: bool,
    pub analyze: bool,
    pub minify: bool,
    pub source_maps: bool,
    pub target: CompileTarget,
    pub parallel: bool,
    pub cache_enabled: bool,
}

#[derive(Clone, Copy)]
pub enum CompileTarget {
    ES2020,
    ES2022,
    ESNext,
}

#[derive(Clone)]
struct CachedComponent {
    hash: String,
    compiled: CompiledComponent,
    dependencies: Vec<String>,
    timestamp: u64,
}

struct ModuleGraph {
    nodes: HashMap<String, ModuleNode>,
    edges: HashMap<String, HashSet<String>>,
}

struct ModuleNode {
    path: PathBuf,
    component_type: ComponentType,
    dependencies: Vec<String>,
    dependents: HashSet<String>,
}

#[derive(Clone, Copy)]
enum ComponentType {
    Component,
    Page,
    Layout,
    Store,
    Hook,
}

impl BuildEngine {
    pub fn new(root: PathBuf, output: PathBuf, options: BuildOptions) -> Result<Self> {
        let compiler = Arc::new(Compiler::new(options.target)?);
        let progress = MultiProgress::new();
        
        Ok(Self {
            root,
            output,
            cache: Arc::new(DashMap::new()),
            module_graph: Arc::new(RwLock::new(ModuleGraph {
                nodes: HashMap::new(),
                edges: HashMap::new(),
            })),
            options,
            compiler,
            progress,
        })
    }
    
    /// Run the build process
    pub async fn build(&self) -> Result<BuildStats> {
        let start = Instant::now();
        
        println!("{} {}", "Building".blue().bold(), "Eghact project...".dimmed());
        println!();
        
        // Phase 1: Discovery
        let components = self.discover_components().await?;
        println!("  {} Found {} components", "✓".green(), components.len());
        
        // Phase 2: Analysis
        self.analyze_dependencies(&components).await?;
        println!("  {} Analyzed dependencies", "✓".green());
        
        // Phase 3: Compilation
        let compiled = self.compile_components(components).await?;
        println!("  {} Compiled {} components", "✓".green(), compiled.len());
        
        // Phase 4: Optimization
        let optimized = self.optimize_output(compiled).await?;
        println!("  {} Optimized bundle", "✓".green());
        
        // Phase 5: Output
        let output_stats = self.write_output(optimized).await?;
        println!("  {} Written to {}", "✓".green(), self.output.display());
        
        let elapsed = start.elapsed();
        
        Ok(BuildStats {
            duration: elapsed,
            components_count: output_stats.file_count,
            total_size: output_stats.total_size,
            cache_hits: self.get_cache_hits(),
        })
    }
    
    /// Discover all components in the project
    async fn discover_components(&self) -> Result<Vec<PathBuf>> {
        let mut components = Vec::new();
        let src_dir = self.root.join("src");
        
        let pb = self.create_progress_bar("Discovering components...");
        
        for entry in WalkDir::new(&src_dir)
            .follow_links(true)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("egh") {
                components.push(path.to_path_buf());
                pb.inc(1);
            }
        }
        
        pb.finish_with_message(format!("Found {} components", components.len()));
        
        Ok(components)
    }
    
    /// Analyze component dependencies
    async fn analyze_dependencies(&self, components: &[PathBuf]) -> Result<()> {
        let pb = self.create_progress_bar("Analyzing dependencies...");
        pb.set_length(components.len() as u64);
        
        // Parallel analysis using rayon
        let results: Vec<(String, ModuleNode)> = components
            .par_iter()
            .map(|path| {
                let id = self.get_component_id(path);
                let deps = self.extract_dependencies(path)?;
                
                let node = ModuleNode {
                    path: path.clone(),
                    component_type: self.detect_component_type(path),
                    dependencies: deps,
                    dependents: HashSet::new(),
                };
                
                pb.inc(1);
                Ok((id, node))
            })
            .collect::<Result<Vec<_>>>()?;
        
        // Build module graph
        let mut graph = self.module_graph.write();
        for (id, node) in results {
            graph.nodes.insert(id.clone(), node);
        }
        
        // Build reverse dependencies
        for (id, node) in &graph.nodes {
            for dep in &node.dependencies {
                if let Some(dep_node) = graph.nodes.get_mut(dep) {
                    dep_node.dependents.insert(id.clone());
                }
            }
        }
        
        pb.finish_with_message("Dependency analysis complete");
        
        Ok(())
    }
    
    /// Compile components in parallel
    async fn compile_components(&self, components: Vec<PathBuf>) -> Result<Vec<CompiledComponent>> {
        let pb = self.create_progress_bar("Compiling components...");
        pb.set_length(components.len() as u64);
        
        let results: Vec<CompiledComponent> = components
            .into_par_iter()
            .map(|path| {
                let result = self.compile_single_component(&path)?;
                pb.inc(1);
                Ok(result)
            })
            .collect::<Result<Vec<_>>>()?;
        
        pb.finish_with_message("Compilation complete");
        
        Ok(results)
    }
    
    /// Compile a single component
    fn compile_single_component(&self, path: &Path) -> Result<CompiledComponent> {
        let id = self.get_component_id(path);
        
        // Check cache
        if self.options.cache_enabled {
            let content = std::fs::read_to_string(path)?;
            let hash = calculate_hash(&content);
            
            if let Some(cached) = self.cache.get(&id) {
                if cached.hash == hash {
                    return Ok(cached.compiled.clone());
                }
            }
        }
        
        // Compile component
        let compiled = self.compiler.compile_file(path)?;
        
        // Update cache
        if self.options.cache_enabled {
            let content = std::fs::read_to_string(path)?;
            let hash = calculate_hash(&content);
            
            self.cache.insert(
                id.clone(),
                CachedComponent {
                    hash,
                    compiled: compiled.clone(),
                    dependencies: vec![],
                    timestamp: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)?
                        .as_secs(),
                },
            );
        }
        
        Ok(compiled)
    }
    
    /// Optimize the compiled output
    async fn optimize_output(&self, mut components: Vec<CompiledComponent>) -> Result<Bundle> {
        let pb = self.create_progress_bar("Optimizing bundle...");
        
        // Tree shaking
        pb.set_message("Tree shaking...");
        components = self.tree_shake(components)?;
        pb.inc(20);
        
        // Code splitting
        pb.set_message("Code splitting...");
        let chunks = self.code_split(components)?;
        pb.inc(20);
        
        // Minification
        if self.options.minify {
            pb.set_message("Minifying...");
            // Minification logic here
            pb.inc(20);
        }
        
        // Source maps
        if self.options.source_maps {
            pb.set_message("Generating source maps...");
            // Source map generation here
            pb.inc(20);
        }
        
        pb.finish_with_message("Optimization complete");
        
        Ok(Bundle {
            chunks,
            manifest: self.generate_manifest(&chunks)?,
        })
    }
    
    /// Write output files
    async fn write_output(&self, bundle: Bundle) -> Result<OutputStats> {
        let pb = self.create_progress_bar("Writing output...");
        pb.set_length(bundle.chunks.len() as u64);
        
        // Ensure output directory exists
        tokio::fs::create_dir_all(&self.output).await?;
        
        let mut total_size = 0;
        let mut file_count = 0;
        
        // Write chunks
        for chunk in bundle.chunks {
            let output_path = self.output.join(&chunk.filename);
            
            // Create subdirectories if needed
            if let Some(parent) = output_path.parent() {
                tokio::fs::create_dir_all(parent).await?;
            }
            
            // Write file
            tokio::fs::write(&output_path, &chunk.content).await?;
            
            total_size += chunk.content.len();
            file_count += 1;
            pb.inc(1);
        }
        
        // Write manifest
        let manifest_path = self.output.join("manifest.json");
        let manifest_content = serde_json::to_string_pretty(&bundle.manifest)?;
        tokio::fs::write(manifest_path, manifest_content).await?;
        
        pb.finish_with_message(format!("Wrote {} files", file_count));
        
        Ok(OutputStats {
            file_count,
            total_size,
        })
    }
    
    /// Tree shake unused code
    fn tree_shake(&self, components: Vec<CompiledComponent>) -> Result<Vec<CompiledComponent>> {
        // Implement tree shaking logic
        // For now, return all components
        Ok(components)
    }
    
    /// Split code into chunks
    fn code_split(&self, components: Vec<CompiledComponent>) -> Result<Vec<Chunk>> {
        // Implement code splitting logic
        // For now, create a single chunk
        let mut main_chunk = Chunk {
            id: "main".to_string(),
            filename: "main.js".to_string(),
            content: Vec::new(),
            dependencies: vec![],
        };
        
        for component in components {
            main_chunk.content.extend_from_slice(component.javascript.as_bytes());
            main_chunk.content.push(b'\n');
        }
        
        Ok(vec![main_chunk])
    }
    
    /// Generate build manifest
    fn generate_manifest(&self, chunks: &[Chunk]) -> Result<BuildManifest> {
        Ok(BuildManifest {
            version: env!("CARGO_PKG_VERSION").to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            chunks: chunks.iter().map(|c| ChunkInfo {
                id: c.id.clone(),
                filename: c.filename.clone(),
                size: c.content.len(),
                dependencies: c.dependencies.clone(),
            }).collect(),
        })
    }
    
    /// Extract dependencies from a component file
    fn extract_dependencies(&self, path: &Path) -> Result<Vec<String>> {
        let content = std::fs::read_to_string(path)?;
        let mut dependencies = Vec::new();
        
        // Simple regex-based import extraction
        // In production, use proper AST parsing
        let import_regex = regex::Regex::new(r#"import\s+.*?\s+from\s+['"](.+?)['"]"#)?;
        
        for cap in import_regex.captures_iter(&content) {
            if let Some(dep) = cap.get(1) {
                dependencies.push(dep.as_str().to_string());
            }
        }
        
        Ok(dependencies)
    }
    
    /// Get component ID from path
    fn get_component_id(&self, path: &Path) -> String {
        path.strip_prefix(&self.root)
            .unwrap_or(path)
            .to_string_lossy()
            .to_string()
    }
    
    /// Detect component type from path
    fn detect_component_type(&self, path: &Path) -> ComponentType {
        let path_str = path.to_string_lossy();
        
        if path_str.contains("/pages/") || path_str.contains("/routes/") {
            ComponentType::Page
        } else if path_str.contains("/layouts/") {
            ComponentType::Layout
        } else if path_str.contains("/stores/") {
            ComponentType::Store
        } else if path_str.contains("/hooks/") {
            ComponentType::Hook
        } else {
            ComponentType::Component
        }
    }
    
    /// Create progress bar
    fn create_progress_bar(&self, message: &str) -> ProgressBar {
        let pb = self.progress.add(ProgressBar::new(100));
        pb.set_style(
            ProgressStyle::default_bar()
                .template("{spinner:.green} {msg} [{bar:40.cyan/blue}] {pos}/{len}")
                .unwrap()
                .progress_chars("#>-"),
        );
        pb.set_message(message.to_string());
        pb
    }
    
    /// Get cache hit count
    fn get_cache_hits(&self) -> usize {
        // Implementation would track actual cache hits
        0
    }
}

/// Build statistics
pub struct BuildStats {
    pub duration: std::time::Duration,
    pub components_count: usize,
    pub total_size: usize,
    pub cache_hits: usize,
}

/// Output statistics
struct OutputStats {
    file_count: usize,
    total_size: usize,
}

/// Compiled bundle
struct Bundle {
    chunks: Vec<Chunk>,
    manifest: BuildManifest,
}

/// Code chunk
struct Chunk {
    id: String,
    filename: String,
    content: Vec<u8>,
    dependencies: Vec<String>,
}

/// Build manifest
#[derive(serde::Serialize)]
struct BuildManifest {
    version: String,
    timestamp: String,
    chunks: Vec<ChunkInfo>,
}

#[derive(serde::Serialize)]
struct ChunkInfo {
    id: String,
    filename: String,
    size: usize,
    dependencies: Vec<String>,
}

impl Default for BuildOptions {
    fn default() -> Self {
        Self {
            watch: false,
            analyze: false,
            minify: true,
            source_maps: true,
            target: CompileTarget::ES2020,
            parallel: true,
            cache_enabled: true,
        }
    }
}
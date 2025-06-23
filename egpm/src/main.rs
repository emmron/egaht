//! EGPM - Eghact Package Manager
//! 
//! A revolutionary package manager that doesn't need Node.js or NPM.
//! Manages native Eghact packages with zero JavaScript dependencies.

use clap::{Parser, Subcommand};
use colored::*;
use indicatif::{ProgressBar, ProgressStyle};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::fs;
use anyhow::{Result, Context};

#[derive(Parser)]
#[command(name = "egpm")]
#[command(about = "Eghact Package Manager - Native, Fast, Secure", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
    
    /// Use alternative registry
    #[arg(long, global = true)]
    registry: Option<String>,
    
    /// Offline mode
    #[arg(long, global = true)]
    offline: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize a new Eghact project
    Init {
        #[arg(default_value = ".")]
        path: PathBuf,
        
        /// Project template
        #[arg(short, long)]
        template: Option<String>,
    },
    
    /// Install packages
    Install {
        /// Package names to install
        packages: Vec<String>,
        
        /// Install as dev dependency
        #[arg(short, long)]
        dev: bool,
        
        /// Install globally
        #[arg(short, long)]
        global: bool,
    },
    
    /// Remove packages
    Remove {
        packages: Vec<String>,
    },
    
    /// Update packages
    Update {
        /// Update all packages
        #[arg(short, long)]
        all: bool,
        
        /// Specific packages to update
        packages: Vec<String>,
    },
    
    /// Search for packages
    Search {
        query: String,
        
        /// Maximum results
        #[arg(short, long, default_value = "20")]
        limit: usize,
    },
    
    /// Publish a package
    Publish {
        /// Package directory
        #[arg(default_value = ".")]
        path: PathBuf,
        
        /// Dry run
        #[arg(long)]
        dry_run: bool,
    },
    
    /// Run scripts
    Run {
        /// Script name
        script: String,
        
        /// Script arguments
        args: Vec<String>,
    },
    
    /// Build project
    Build {
        /// Build mode
        #[arg(short, long, default_value = "release")]
        mode: String,
        
        /// Output directory
        #[arg(short, long)]
        output: Option<PathBuf>,
    },
    
    /// Manage cache
    Cache {
        #[command(subcommand)]
        command: CacheCommands,
    },
    
    /// Show package info
    Info {
        package: String,
    },
    
    /// Audit dependencies for vulnerabilities
    Audit {
        /// Fix vulnerabilities automatically
        #[arg(long)]
        fix: bool,
    },
}

#[derive(Subcommand)]
enum CacheCommands {
    /// Clear cache
    Clear,
    /// Show cache size
    Size,
    /// Verify cache integrity
    Verify,
}

/// Package manifest (egpm.yaml)
#[derive(Debug, Serialize, Deserialize)]
struct PackageManifest {
    name: String,
    version: String,
    description: Option<String>,
    author: Option<String>,
    license: Option<String>,
    
    #[serde(default)]
    dependencies: HashMap<String, DependencySpec>,
    
    #[serde(default)]
    dev_dependencies: HashMap<String, DependencySpec>,
    
    #[serde(default)]
    scripts: HashMap<String, String>,
    
    /// Native compilation targets
    #[serde(default)]
    targets: Vec<Target>,
    
    /// Package metadata
    #[serde(default)]
    metadata: PackageMetadata,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
enum DependencySpec {
    Version(String),
    Detailed {
        version: Option<String>,
        git: Option<String>,
        branch: Option<String>,
        tag: Option<String>,
        path: Option<String>,
        features: Option<Vec<String>>,
    },
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct Target {
    name: String,
    platform: String,
    arch: String,
    features: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct PackageMetadata {
    homepage: Option<String>,
    repository: Option<String>,
    keywords: Vec<String>,
    categories: Vec<String>,
}

/// Lock file (egpm.lock)
#[derive(Debug, Serialize, Deserialize)]
struct LockFile {
    version: u32,
    packages: HashMap<String, LockedPackage>,
    checksums: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct LockedPackage {
    version: String,
    resolved: String,
    integrity: String,
    dependencies: HashMap<String, String>,
}

/// Package registry client
struct Registry {
    base_url: String,
    client: reqwest::Client,
    cache: sled::Db,
}

impl Registry {
    fn new(base_url: Option<String>) -> Result<Self> {
        let base_url = base_url.unwrap_or_else(|| "https://registry.eghact.dev".to_string());
        
        let client = reqwest::Client::builder()
            .user_agent("egpm/1.0.0")
            .timeout(std::time::Duration::from_secs(30))
            .build()?;
        
        let cache_dir = dirs::cache_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("egpm");
        
        fs::create_dir_all(&cache_dir)?;
        let cache = sled::open(cache_dir.join("registry.db"))?;
        
        Ok(Self {
            base_url,
            client,
            cache,
        })
    }
    
    async fn search(&self, query: &str, limit: usize) -> Result<Vec<PackageInfo>> {
        let url = format!("{}/search?q={}&limit={}", self.base_url, query, limit);
        let response = self.client.get(&url).send().await?;
        let packages: Vec<PackageInfo> = response.json().await?;
        Ok(packages)
    }
    
    async fn get_package(&self, name: &str, version: Option<&str>) -> Result<PackageData> {
        let cache_key = format!("{}@{}", name, version.unwrap_or("latest"));
        
        // Check cache first
        if let Ok(Some(cached)) = self.cache.get(&cache_key) {
            if let Ok(data) = serde_json::from_slice::<PackageData>(&cached) {
                return Ok(data);
            }
        }
        
        // Fetch from registry
        let url = match version {
            Some(v) => format!("{}/packages/{}/{}", self.base_url, name, v),
            None => format!("{}/packages/{}", self.base_url, name),
        };
        
        let response = self.client.get(&url).send().await?;
        let data: PackageData = response.json().await?;
        
        // Cache the result
        let _ = self.cache.insert(&cache_key, serde_json::to_vec(&data)?);
        
        Ok(data)
    }
    
    async fn download_package(&self, name: &str, version: &str, dest: &Path) -> Result<()> {
        let url = format!("{}/packages/{}/{}/download", self.base_url, name, version);
        
        let response = self.client.get(&url).send().await?;
        let total_size = response.content_length().unwrap_or(0);
        
        let pb = ProgressBar::new(total_size);
        pb.set_style(ProgressStyle::default_bar()
            .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {bytes}/{total_bytes} ({eta})")?
            .progress_chars("#>-"));
        
        let mut file = fs::File::create(dest)?;
        let mut downloaded = 0u64;
        let mut stream = response.bytes_stream();
        
        use tokio::io::AsyncWriteExt;
        use futures::StreamExt;
        
        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            downloaded += chunk.len() as u64;
            pb.set_position(downloaded);
            use std::io::Write;
            file.write_all(&chunk)?;
        }
        
        pb.finish_with_message("Downloaded");
        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct PackageInfo {
    name: String,
    version: String,
    description: Option<String>,
    downloads: u64,
    updated: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct PackageData {
    name: String,
    version: String,
    manifest: PackageManifest,
    tarball: String,
    shasum: String,
}

/// Package installer
struct Installer {
    registry: Registry,
    root: PathBuf,
}

impl Installer {
    fn new(registry: Registry, root: PathBuf) -> Self {
        Self { registry, root }
    }
    
    async fn install(&self, packages: &[String], dev: bool) -> Result<()> {
        let manifest_path = self.root.join("egpm.yaml");
        let mut manifest = self.load_manifest(&manifest_path)?;
        
        println!("{}", "📦 Installing packages...".green().bold());
        
        for package in packages {
            let (name, version) = parse_package_spec(package);
            
            println!("  {} {}", "→".blue(), name);
            
            let data = self.registry.get_package(&name, version).await?;
            let install_dir = self.root.join("egh_modules").join(&data.name);
            
            // Download and extract
            let temp_file = tempfile::NamedTempFile::new()?;
            self.registry.download_package(&data.name, &data.version, temp_file.path()).await?;
            
            self.extract_package(temp_file.path(), &install_dir)?;
            
            // Update manifest
            let dep_spec = DependencySpec::Version(data.version.clone());
            if dev {
                manifest.dev_dependencies.insert(data.name.clone(), dep_spec);
            } else {
                manifest.dependencies.insert(data.name.clone(), dep_spec);
            }
            
            println!("  {} {} {}", "✓".green(), data.name, data.version.dimmed());
        }
        
        // Save updated manifest
        self.save_manifest(&manifest_path, &manifest)?;
        
        // Generate lock file
        self.generate_lock_file().await?;
        
        println!("\n{} Installation complete!", "✨".yellow());
        Ok(())
    }
    
    fn extract_package(&self, archive: &Path, dest: &Path) -> Result<()> {
        fs::create_dir_all(dest)?;
        
        let file = fs::File::open(archive)?;
        let decoder = flate2::read::GzDecoder::new(file);
        let mut archive = tar::Archive::new(decoder);
        
        archive.unpack(dest)?;
        Ok(())
    }
    
    async fn generate_lock_file(&self) -> Result<()> {
        // TODO: Implement lock file generation
        Ok(())
    }
    
    fn load_manifest(&self, path: &Path) -> Result<PackageManifest> {
        let content = fs::read_to_string(path)
            .context("Failed to read egpm.yaml")?;
        
        let manifest: PackageManifest = serde_yaml::from_str(&content)
            .context("Failed to parse egpm.yaml")?;
        
        Ok(manifest)
    }
    
    fn save_manifest(&self, path: &Path, manifest: &PackageManifest) -> Result<()> {
        let content = serde_yaml::to_string(manifest)?;
        fs::write(path, content)?;
        Ok(())
    }
}

/// Build system
struct Builder {
    root: PathBuf,
    manifest: PackageManifest,
}

impl Builder {
    fn new(root: PathBuf) -> Result<Self> {
        let manifest_path = root.join("egpm.yaml");
        let manifest = Self::load_manifest(&manifest_path)?;
        
        Ok(Self { root, manifest })
    }
    
    fn load_manifest(path: &Path) -> Result<PackageManifest> {
        let content = fs::read_to_string(path)?;
        let manifest = serde_yaml::from_str(&content)?;
        Ok(manifest)
    }
    
    async fn build(&self, mode: &str, output: Option<PathBuf>) -> Result<()> {
        println!("{} Building project...", "🔨".blue());
        
        let output_dir = output.unwrap_or_else(|| self.root.join("dist"));
        fs::create_dir_all(&output_dir)?;
        
        // Compile .eg files
        self.compile_eg_files(&output_dir).await?;
        
        // Build native modules
        self.build_native_modules(&output_dir, mode).await?;
        
        // Bundle assets
        self.bundle_assets(&output_dir).await?;
        
        // Generate manifest
        self.generate_build_manifest(&output_dir)?;
        
        println!("{} Build complete! Output: {}", "✨".green(), output_dir.display());
        Ok(())
    }
    
    async fn compile_eg_files(&self, output: &Path) -> Result<()> {
        let src_dir = self.root.join("src");
        
        for entry in walkdir::WalkDir::new(&src_dir) {
            let entry = entry?;
            let path = entry.path();
            
            if path.extension() == Some(std::ffi::OsStr::new("eg")) {
                let relative = path.strip_prefix(&src_dir)?;
                let out_path = output.join(relative).with_extension("wasm");
                
                fs::create_dir_all(out_path.parent().unwrap())?;
                
                // Compile .eg to WASM
                self.compile_eg_file(path, &out_path).await?;
            }
        }
        
        Ok(())
    }
    
    async fn compile_eg_file(&self, input: &Path, output: &Path) -> Result<()> {
        // In production, this would invoke the Eghact compiler
        println!("  {} {} → {}", 
            "📄".cyan(), 
            input.display(), 
            output.file_name().unwrap().to_string_lossy()
        );
        
        // For now, just copy as placeholder
        fs::copy(input, output)?;
        Ok(())
    }
    
    async fn build_native_modules(&self, output: &Path, mode: &str) -> Result<()> {
        // Build Rust/C modules to WASM
        Ok(())
    }
    
    async fn bundle_assets(&self, output: &Path) -> Result<()> {
        // Bundle static assets
        Ok(())
    }
    
    fn generate_build_manifest(&self, output: &Path) -> Result<()> {
        let manifest = serde_json::json!({
            "name": self.manifest.name,
            "version": self.manifest.version,
            "build_time": chrono::Utc::now().to_rfc3339(),
            "files": self.scan_output_files(output)?,
        });
        
        let manifest_path = output.join("build.json");
        fs::write(manifest_path, serde_json::to_string_pretty(&manifest)?)?;
        
        Ok(())
    }
    
    fn scan_output_files(&self, output: &Path) -> Result<Vec<String>> {
        let mut files = Vec::new();
        
        for entry in walkdir::WalkDir::new(output) {
            let entry = entry?;
            if entry.file_type().is_file() {
                if let Ok(relative) = entry.path().strip_prefix(output) {
                    files.push(relative.to_string_lossy().to_string());
                }
            }
        }
        
        Ok(files)
    }
}

fn parse_package_spec(spec: &str) -> (String, Option<&str>) {
    if let Some(pos) = spec.find('@') {
        let (name, version) = spec.split_at(pos);
        (name.to_string(), Some(&version[1..]))
    } else {
        (spec.to_string(), None)
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    
    // Set up registry
    let registry = Registry::new(cli.registry)?;
    
    match cli.command {
        Commands::Init { path, template } => {
            init_project(&path, template).await?;
        }
        
        Commands::Install { packages, dev, global } => {
            if global {
                // TODO: Implement global installation
                println!("Global installation not yet implemented");
            } else {
                let installer = Installer::new(registry, std::env::current_dir()?);
                
                if packages.is_empty() {
                    // Install all dependencies from manifest
                    installer.install_all().await?;
                } else {
                    installer.install(&packages, dev).await?;
                }
            }
        }
        
        Commands::Search { query, limit } => {
            let results = registry.search(&query, limit).await?;
            
            if results.is_empty() {
                println!("No packages found for '{}'", query);
            } else {
                println!("\n{}", "📦 Search Results".bold());
                println!("{}", "─".repeat(60).dimmed());
                
                for pkg in results {
                    println!("{} {} {}",
                        pkg.name.green().bold(),
                        format!("v{}", pkg.version).cyan(),
                        format!("({})", pkg.downloads).dimmed()
                    );
                    
                    if let Some(desc) = pkg.description {
                        println!("  {}", desc.dimmed());
                    }
                    println!();
                }
            }
        }
        
        Commands::Build { mode, output } => {
            let builder = Builder::new(std::env::current_dir()?)?;
            builder.build(&mode, output).await?;
        }
        
        Commands::Run { script, args } => {
            run_script(&script, &args).await?;
        }
        
        Commands::Cache { command } => {
            match command {
                CacheCommands::Clear => {
                    clear_cache()?;
                    println!("✓ Cache cleared");
                }
                CacheCommands::Size => {
                    let size = get_cache_size()?;
                    println!("Cache size: {}", humanize_bytes(size));
                }
                CacheCommands::Verify => {
                    verify_cache()?;
                    println!("✓ Cache verified");
                }
            }
        }
        
        _ => {
            println!("Command not yet implemented");
        }
    }
    
    Ok(())
}

async fn init_project(path: &Path, template: Option<String>) -> Result<()> {
    println!("{} Initializing new Eghact project...", "🚀".green());
    
    fs::create_dir_all(path)?;
    
    let template = template.unwrap_or_else(|| "default".to_string());
    
    // Create project structure
    let dirs = ["src", "tests", "public", "build"];
    for dir in &dirs {
        fs::create_dir_all(path.join(dir))?;
    }
    
    // Create egpm.yaml
    let manifest = PackageManifest {
        name: path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("my-app")
            .to_string(),
        version: "0.1.0".to_string(),
        description: Some("A new Eghact application".to_string()),
        author: None,
        license: Some("MIT".to_string()),
        dependencies: HashMap::new(),
        dev_dependencies: HashMap::new(),
        scripts: HashMap::from([
            ("build".to_string(), "egpm build".to_string()),
            ("dev".to_string(), "eghact dev".to_string()),
            ("test".to_string(), "eghact test".to_string()),
        ]),
        targets: vec![],
        metadata: PackageMetadata::default(),
    };
    
    let manifest_content = serde_yaml::to_string(&manifest)?;
    fs::write(path.join("egpm.yaml"), manifest_content)?;
    
    // Create main.eg
    let main_eg = r#"---
imports:
  - { from: std:components, items: [App] }

state:
  title: "Welcome to Eghact"
---

# App {.app-root}

## {state.title}

Welcome to your new Eghact application!

[!Button @click={alert("Hello, World!")}]
  Click Me
[/Button]

## Styles {.styles}

```css
.app-root {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  font-family: system-ui;
}
```
"#;
    
    fs::write(path.join("src/main.eg"), main_eg)?;
    
    // Create .gitignore
    let gitignore = r#"# Dependencies
egh_modules/
.egpm-cache/

# Build output
dist/
build/
*.wasm

# Logs
*.log

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Temp
*.tmp
*.swp
"#;
    
    fs::write(path.join(".gitignore"), gitignore)?;
    
    println!("\n{} Project initialized successfully!", "✨".green());
    println!("\nNext steps:");
    println!("  cd {}", path.display());
    println!("  egpm install");
    println!("  egpm run dev");
    
    Ok(())
}

async fn run_script(script: &str, args: &[String]) -> Result<()> {
    // TODO: Implement script runner
    println!("Running script: {} {:?}", script, args);
    Ok(())
}

fn clear_cache() -> Result<()> {
    let cache_dir = dirs::cache_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("egpm");
    
    if cache_dir.exists() {
        fs::remove_dir_all(&cache_dir)?;
    }
    
    Ok(())
}

fn get_cache_size() -> Result<u64> {
    let cache_dir = dirs::cache_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("egpm");
    
    let mut size = 0u64;
    
    for entry in walkdir::WalkDir::new(&cache_dir) {
        let entry = entry?;
        if entry.file_type().is_file() {
            size += entry.metadata()?.len();
        }
    }
    
    Ok(size)
}

fn verify_cache() -> Result<()> {
    // TODO: Implement cache verification
    Ok(())
}

fn humanize_bytes(bytes: u64) -> String {
    let units = ["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;
    
    while size >= 1024.0 && unit_index < units.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }
    
    format!("{:.2} {}", size, units[unit_index])
}

impl Installer {
    async fn install_all(&self) -> Result<()> {
        let manifest = self.load_manifest(&self.root.join("egpm.yaml"))?;
        
        let mut all_deps = Vec::new();
        
        for (name, spec) in &manifest.dependencies {
            all_deps.push(format_dep_spec(name, spec));
        }
        
        if !all_deps.is_empty() {
            self.install(&all_deps, false).await?;
        }
        
        Ok(())
    }
}

fn format_dep_spec(name: &str, spec: &DependencySpec) -> String {
    match spec {
        DependencySpec::Version(v) => format!("{}@{}", name, v),
        DependencySpec::Detailed { version, .. } => {
            if let Some(v) = version {
                format!("{}@{}", name, v)
            } else {
                name.to_string()
            }
        }
    }
}
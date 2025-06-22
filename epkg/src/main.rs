/**
 * EPkg - Eghact Package Manager
 * A blazing-fast, native package manager for Eghact projects
 * Written in Rust for maximum performance
 */

use anyhow::{Result, Context};
use clap::{Parser, Subcommand};
use colored::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::io::AsyncWriteExt;

mod registry;
mod resolver;
mod installer;
mod cache;
mod lockfile;

use registry::Registry;
use resolver::DependencyResolver;
use installer::PackageInstaller;
use cache::PackageCache;
use lockfile::Lockfile;

#[derive(Parser)]
#[command(name = "epkg")]
#[command(about = "📦 Eghact Package Manager - Fast, reliable, and secure", long_about = None)]
#[command(version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Install dependencies
    Install {
        /// Package name to install
        package: Option<String>,
        
        /// Save as dependency
        #[arg(short, long)]
        save: bool,
        
        /// Save as dev dependency
        #[arg(short = 'D', long)]
        save_dev: bool,
        
        /// Force reinstall
        #[arg(short, long)]
        force: bool,
    },
    
    /// Remove packages
    Remove {
        /// Package name to remove
        package: String,
    },
    
    /// Update packages
    Update {
        /// Package to update (all if not specified)
        package: Option<String>,
        
        /// Update to latest version
        #[arg(short, long)]
        latest: bool,
    },
    
    /// List installed packages
    List {
        /// Show dependency tree
        #[arg(short, long)]
        tree: bool,
        
        /// Show only top-level dependencies
        #[arg(long)]
        depth: Option<u32>,
    },
    
    /// Search for packages
    Search {
        /// Search query
        query: String,
        
        /// Limit results
        #[arg(short, long, default_value = "10")]
        limit: usize,
    },
    
    /// Initialize new package
    Init {
        /// Package name
        #[arg(short, long)]
        name: Option<String>,
        
        /// Skip prompts
        #[arg(short = 'y', long)]
        yes: bool,
    },
    
    /// Publish package
    Publish {
        /// Pre-release tag
        #[arg(long)]
        tag: Option<String>,
        
        /// Dry run
        #[arg(long)]
        dry_run: bool,
    },
    
    /// Clean cache
    Clean {
        /// Remove all cached packages
        #[arg(long)]
        all: bool,
    },
    
    /// Run scripts
    Run {
        /// Script name
        script: String,
        
        /// Arguments to pass
        args: Vec<String>,
    },
    
    /// Audit dependencies for vulnerabilities
    Audit {
        /// Fix vulnerabilities automatically
        #[arg(long)]
        fix: bool,
    },
}

#[derive(Debug, Serialize, Deserialize)]
struct PackageJson {
    name: String,
    version: String,
    description: Option<String>,
    #[serde(default)]
    dependencies: HashMap<String, String>,
    #[serde(default, rename = "devDependencies")]
    dev_dependencies: HashMap<String, String>,
    #[serde(default)]
    scripts: HashMap<String, String>,
    #[serde(default)]
    eghact: EghactConfig,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct EghactConfig {
    #[serde(default)]
    compiler: CompilerConfig,
    #[serde(default)]
    runtime: RuntimeConfig,
}

#[derive(Debug, Serialize, Deserialize)]
struct CompilerConfig {
    target: String,
    #[serde(default)]
    features: Vec<String>,
}

impl Default for CompilerConfig {
    fn default() -> Self {
        Self {
            target: "es2020".to_string(),
            features: vec![],
        }
    }
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct RuntimeConfig {
    #[serde(default)]
    wasm: bool,
    #[serde(default)]
    minimal: bool,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    
    // Initialize components
    let cache = PackageCache::new()?;
    let registry = Registry::new("https://registry.eghact.dev")?;
    
    match cli.command {
        Commands::Install { package, save, save_dev, force } => {
            install(package, save, save_dev, force, &cache, &registry).await?;
        }
        
        Commands::Remove { package } => {
            remove(&package).await?;
        }
        
        Commands::Update { package, latest } => {
            update(package, latest, &cache, &registry).await?;
        }
        
        Commands::List { tree, depth } => {
            list(tree, depth).await?;
        }
        
        Commands::Search { query, limit } => {
            search(&query, limit, &registry).await?;
        }
        
        Commands::Init { name, yes } => {
            init(name, yes).await?;
        }
        
        Commands::Publish { tag, dry_run } => {
            publish(tag, dry_run, &registry).await?;
        }
        
        Commands::Clean { all } => {
            clean(all, &cache).await?;
        }
        
        Commands::Run { script, args } => {
            run_script(&script, args).await?;
        }
        
        Commands::Audit { fix } => {
            audit(fix, &registry).await?;
        }
    }
    
    Ok(())
}

async fn install(
    package: Option<String>,
    save: bool,
    save_dev: bool,
    force: bool,
    cache: &PackageCache,
    registry: &Registry,
) -> Result<()> {
    println!("{} {}", "📦".bold(), "Installing packages...".blue());
    
    let mut package_json = load_package_json().await?;
    let mut lockfile = Lockfile::load().await.unwrap_or_default();
    
    if let Some(pkg_spec) = package {
        // Install specific package
        let (name, version) = parse_package_spec(&pkg_spec)?;
        
        println!("  {} {}", "→".dimmed(), format!("{}@{}", name, version).cyan());
        
        // Resolve version
        let resolved = registry.resolve(&name, &version).await?;
        
        // Download and install
        let installer = PackageInstaller::new(cache);
        installer.install(&resolved, force).await?;
        
        // Update package.json if requested
        if save || save_dev {
            if save {
                package_json.dependencies.insert(name.clone(), version.clone());
            } else {
                package_json.dev_dependencies.insert(name.clone(), version.clone());
            }
            save_package_json(&package_json).await?;
        }
        
        // Update lockfile
        lockfile.add_package(&name, &resolved);
        lockfile.save().await?;
        
        println!("{} Installed {} successfully!", "✨".green(), name.bold());
    } else {
        // Install all dependencies
        let resolver = DependencyResolver::new(registry, cache);
        let resolution = resolver.resolve_all(&package_json, &lockfile).await?;
        
        let installer = PackageInstaller::new(cache);
        let total = resolution.packages.len();
        
        println!("  {} Installing {} packages...", "→".dimmed(), total);
        
        for (i, pkg) in resolution.packages.iter().enumerate() {
            print!("  {} [{}/{}] {}... ", 
                "→".dimmed(), 
                i + 1, 
                total, 
                pkg.name.cyan()
            );
            
            installer.install(pkg, force).await?;
            println!("{}", "✓".green());
        }
        
        // Save lockfile
        lockfile = resolution.to_lockfile();
        lockfile.save().await?;
        
        println!();
        println!("{} All packages installed successfully!", "✨".green().bold());
        println!("  {} packages", total);
        println!("  {} epkg-lock.json", "created".dimmed());
    }
    
    Ok(())
}

async fn remove(package: &str) -> Result<()> {
    println!("{} {} {}", "🗑️".bold(), "Removing".red(), package.bold());
    
    let mut package_json = load_package_json().await?;
    
    // Remove from dependencies
    let removed_dep = package_json.dependencies.remove(package);
    let removed_dev = package_json.dev_dependencies.remove(package);
    
    if removed_dep.is_none() && removed_dev.is_none() {
        println!("{} Package {} not found in dependencies", "⚠️".yellow(), package);
        return Ok(());
    }
    
    // Save updated package.json
    save_package_json(&package_json).await?;
    
    // Remove from node_modules
    let module_path = Path::new("eghact_modules").join(package);
    if module_path.exists() {
        fs::remove_dir_all(&module_path).await?;
    }
    
    println!("{} Removed {} successfully!", "✨".green(), package.bold());
    
    Ok(())
}

async fn update(
    package: Option<String>,
    latest: bool,
    cache: &PackageCache,
    registry: &Registry,
) -> Result<()> {
    println!("{} {}", "🔄".bold(), "Updating packages...".blue());
    
    let package_json = load_package_json().await?;
    let mut lockfile = Lockfile::load().await?;
    
    if let Some(pkg) = package {
        // Update specific package
        println!("  {} Checking {} for updates...", "→".dimmed(), pkg.cyan());
        
        let current_version = package_json.dependencies.get(&pkg)
            .or_else(|| package_json.dev_dependencies.get(&pkg))
            .context("Package not found in dependencies")?;
        
        let new_version = if latest {
            registry.get_latest_version(&pkg).await?
        } else {
            registry.resolve(&pkg, current_version).await?.version
        };
        
        if &new_version != current_version {
            println!("  {} {} → {}", 
                "↑".green(), 
                current_version.dimmed(), 
                new_version.green().bold()
            );
            
            // Install new version
            let resolved = registry.get_package(&pkg, &new_version).await?;
            let installer = PackageInstaller::new(cache);
            installer.install(&resolved, true).await?;
            
            // Update lockfile
            lockfile.update_package(&pkg, &resolved);
            lockfile.save().await?;
        } else {
            println!("  {} {} is already up to date", "✓".green(), pkg);
        }
    } else {
        // Update all packages
        println!("  {} Checking all packages for updates...", "→".dimmed());
        
        let resolver = DependencyResolver::new(registry, cache);
        let updates = resolver.check_updates(&package_json, &lockfile, latest).await?;
        
        if updates.is_empty() {
            println!("{} All packages are up to date!", "✨".green().bold());
        } else {
            println!();
            println!("  {} updates available:", updates.len().to_string().bold());
            
            for update in &updates {
                println!("  {} {} {} → {}", 
                    "↑".green(),
                    update.name.cyan(),
                    update.current.dimmed(),
                    update.new.green().bold()
                );
            }
            
            // TODO: Prompt to confirm updates
            // TODO: Install updates
        }
    }
    
    Ok(())
}

async fn list(tree: bool, depth: Option<u32>) -> Result<()> {
    let package_json = load_package_json().await?;
    
    println!("{} {} {}", 
        "📦".bold(), 
        package_json.name.cyan().bold(),
        format!("v{}", package_json.version).dimmed()
    );
    
    if let Some(desc) = &package_json.description {
        println!("  {}", desc.dimmed());
    }
    
    println!();
    
    // Dependencies
    if !package_json.dependencies.is_empty() {
        println!("{}", "dependencies:".bold());
        for (name, version) in &package_json.dependencies {
            println!("  {} {}@{}", "•".dimmed(), name.cyan(), version);
        }
        println!();
    }
    
    // Dev dependencies
    if !package_json.dev_dependencies.is_empty() {
        println!("{}", "devDependencies:".bold());
        for (name, version) in &package_json.dev_dependencies {
            println!("  {} {}@{}", "•".dimmed(), name.cyan(), version.dimmed());
        }
    }
    
    if tree {
        // TODO: Show dependency tree
        println!();
        println!("{} Dependency tree not yet implemented", "ℹ️".blue());
    }
    
    Ok(())
}

async fn search(query: &str, limit: usize, registry: &Registry) -> Result<()> {
    println!("{} {} '{}'", "🔍".bold(), "Searching for".blue(), query.cyan());
    
    let results = registry.search(query, limit).await?;
    
    if results.is_empty() {
        println!("{} No packages found", "⚠️".yellow());
    } else {
        println!();
        for result in results {
            println!("{} {} {}", 
                result.name.cyan().bold(),
                format!("v{}", result.version).dimmed(),
                result.downloads.to_string().dimmed()
            );
            
            if let Some(desc) = result.description {
                println!("  {}", desc);
            }
            
            println!();
        }
    }
    
    Ok(())
}

async fn init(name: Option<String>, yes: bool) -> Result<()> {
    println!("{} {}", "🎉".bold(), "Initializing new Eghact package".green());
    
    let package_name = name.unwrap_or_else(|| {
        std::env::current_dir()
            .unwrap()
            .file_name()
            .unwrap()
            .to_string_lossy()
            .to_string()
    });
    
    let package_json = PackageJson {
        name: package_name.clone(),
        version: "0.1.0".to_string(),
        description: Some("An Eghact package".to_string()),
        dependencies: HashMap::new(),
        dev_dependencies: HashMap::new(),
        scripts: HashMap::from([
            ("dev".to_string(), "eghact dev".to_string()),
            ("build".to_string(), "eghact build".to_string()),
            ("test".to_string(), "eghact test".to_string()),
        ]),
        eghact: EghactConfig::default(),
    };
    
    // Save package.json
    save_package_json(&package_json).await?;
    
    // Create .gitignore
    let gitignore = r#"eghact_modules/
dist/
.epkg-cache/
*.log
.DS_Store
"#;
    
    fs::write(".gitignore", gitignore).await?;
    
    // Create basic structure
    fs::create_dir_all("src").await?;
    
    let main_egh = r#"component App {
  ~message = "Hello, Eghact!"
  
  <[
    h1 { message }
    p { "Edit src/App.egh to get started" }
  ]>
}
"#;
    
    fs::write("src/App.egh", main_egh).await?;
    
    println!();
    println!("{} Package initialized successfully!", "✨".green().bold());
    println!();
    println!("  {} {}", "name:".dimmed(), package_name.cyan());
    println!("  {} {}", "version:".dimmed(), "0.1.0");
    println!();
    println!("{}", "Next steps:".bold());
    println!("  {} to install dependencies", "epkg install".cyan());
    println!("  {} to start development", "epkg run dev".cyan());
    
    Ok(())
}

async fn publish(tag: Option<String>, dry_run: bool, registry: &Registry) -> Result<()> {
    println!("{} {}", "📤".bold(), "Publishing package...".blue());
    
    let package_json = load_package_json().await?;
    
    // TODO: Build package
    // TODO: Run tests
    // TODO: Check credentials
    // TODO: Upload to registry
    
    if dry_run {
        println!("{} Dry run - no changes made", "ℹ️".blue());
    } else {
        println!("{} Publishing not yet implemented", "⚠️".yellow());
    }
    
    Ok(())
}

async fn clean(all: bool, cache: &PackageCache) -> Result<()> {
    println!("{} {}", "🧹".bold(), "Cleaning cache...".blue());
    
    if all {
        cache.clear_all().await?;
        println!("{} Removed all cached packages", "✨".green());
    } else {
        let freed = cache.clean_old().await?;
        println!("{} Freed {} of disk space", "✨".green(), format_size(freed));
    }
    
    Ok(())
}

async fn run_script(script: &str, args: Vec<String>) -> Result<()> {
    let package_json = load_package_json().await?;
    
    let command = package_json.scripts.get(script)
        .context(format!("Script '{}' not found", script))?;
    
    println!("{} {} {}", "▶️".bold(), "Running".blue(), script.cyan());
    println!("  {} {}", "$".dimmed(), command.dimmed());
    
    // Parse and execute command
    let mut parts = command.split_whitespace();
    let program = parts.next().unwrap();
    let mut cmd_args: Vec<&str> = parts.collect();
    cmd_args.extend(args.iter().map(|s| s.as_str()));
    
    let status = tokio::process::Command::new(program)
        .args(&cmd_args)
        .status()
        .await?;
    
    if !status.success() {
        anyhow::bail!("Script failed with exit code: {}", status.code().unwrap_or(-1));
    }
    
    Ok(())
}

async fn audit(fix: bool, registry: &Registry) -> Result<()> {
    println!("{} {}", "🔒".bold(), "Auditing dependencies...".blue());
    
    let lockfile = Lockfile::load().await?;
    let vulnerabilities = registry.audit(&lockfile).await?;
    
    if vulnerabilities.is_empty() {
        println!("{} No vulnerabilities found!", "✨".green().bold());
    } else {
        println!();
        println!("{} {} vulnerabilities found", "⚠️".yellow(), vulnerabilities.len());
        
        for vuln in &vulnerabilities {
            println!();
            println!("  {} {} ({})", 
                vuln.severity.to_uppercase().red().bold(),
                vuln.title.bold(),
                vuln.id.dimmed()
            );
            println!("  {} {}", "Package:".dimmed(), vuln.package.cyan());
            println!("  {} {} → {}", 
                "Version:".dimmed(), 
                vuln.version.red(), 
                vuln.fixed_version.green()
            );
            println!("  {}", vuln.description);
        }
        
        if fix {
            println!();
            println!("{} Attempting to fix vulnerabilities...", "🔧".bold());
            // TODO: Implement fix logic
        }
    }
    
    Ok(())
}

// Helper functions
async fn load_package_json() -> Result<PackageJson> {
    let content = fs::read_to_string("package.json")
        .await
        .context("Failed to read package.json")?;
    
    serde_json::from_str(&content)
        .context("Failed to parse package.json")
}

async fn save_package_json(package_json: &PackageJson) -> Result<()> {
    let content = serde_json::to_string_pretty(package_json)?;
    fs::write("package.json", content).await?;
    Ok(())
}

fn parse_package_spec(spec: &str) -> Result<(String, String)> {
    if let Some(pos) = spec.rfind('@') {
        if pos > 0 {
            Ok((spec[..pos].to_string(), spec[pos+1..].to_string()))
        } else {
            Ok((spec.to_string(), "latest".to_string()))
        }
    } else {
        Ok((spec.to_string(), "latest".to_string()))
    }
}

fn format_size(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB"];
    
    if bytes == 0 {
        return "0 B".to_string();
    }
    
    let i = (bytes as f64).log(1024.0).floor() as usize;
    let size = bytes as f64 / 1024_f64.powi(i as i32);
    
    format!("{:.1} {}", size, UNITS[i.min(UNITS.len() - 1)])
}
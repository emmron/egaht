use anyhow::Result;
use colored::*;
use std::path::Path;

pub async fn execute() -> Result<()> {
    println!("{} {}", "🩺".bold(), "Running Eghact health check...".blue());
    println!();
    
    let checks = vec![
        Check::new("Rust version", check_rust_version),
        Check::new("Project structure", check_project_structure),
        Check::new("Config file", check_config_file),
        Check::new("Dependencies", check_dependencies),
        Check::new("Build cache", check_build_cache),
    ];
    
    let mut passed = 0;
    let mut failed = 0;
    
    for check in checks {
        match (check.func)().await {
            Ok(message) => {
                println!("{} {} {}", "✅".green(), check.name.bold(), message.dimmed());
                passed += 1;
            }
            Err(e) => {
                println!("{} {} {}", "❌".red(), check.name.bold(), e.to_string().red());
                failed += 1;
            }
        }
    }
    
    println!();
    println!("{}", "Summary:".bold());
    println!("  {} {}", "Passed:".green(), passed);
    println!("  {} {}", "Failed:".red(), failed);
    
    if failed > 0 {
        println!();
        println!("{} Run {} for help", 
            "💡".yellow(),
            "eghact doctor --verbose".cyan()
        );
    } else {
        println!();
        println!("{} {}", "✨".green(), "All checks passed!".green().bold());
    }
    
    Ok(())
}

struct Check {
    name: &'static str,
    func: Box<dyn Fn() -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<String>> + Send>> + Send>,
}

impl Check {
    fn new<F, Fut>(name: &'static str, func: F) -> Self
    where
        F: Fn() -> Fut + Send + 'static,
        Fut: std::future::Future<Output = Result<String>> + Send + 'static,
    {
        Self {
            name,
            func: Box::new(move || Box::pin(func())),
        }
    }
}

async fn check_rust_version() -> Result<String> {
    let version = env!("CARGO_PKG_RUST_VERSION");
    Ok(format!("v{}", version))
}

async fn check_project_structure() -> Result<String> {
    let required_dirs = ["src", "public"];
    let mut missing = Vec::new();
    
    for dir in &required_dirs {
        if !Path::new(dir).exists() {
            missing.push(*dir);
        }
    }
    
    if missing.is_empty() {
        Ok("Valid".to_string())
    } else {
        Err(anyhow::anyhow!("Missing directories: {}", missing.join(", ")))
    }
}

async fn check_config_file() -> Result<String> {
    let config_paths = ["eghact.config.json", "eghact.config.js"];
    
    for path in &config_paths {
        if Path::new(path).exists() {
            return Ok(format!("Found {}", path));
        }
    }
    
    Ok("Using defaults".to_string())
}

async fn check_dependencies() -> Result<String> {
    if Path::new("package.json").exists() {
        Ok("package.json found".to_string())
    } else {
        Ok("No package.json (pure Eghact project)".to_string())
    }
}

async fn check_build_cache() -> Result<String> {
    let cache_dir = Path::new(".eghact-cache");
    
    if cache_dir.exists() {
        // Calculate cache size
        let size = calculate_dir_size(cache_dir).await?;
        Ok(format!("Cache size: {}", crate::utils::format_size(size)))
    } else {
        Ok("No cache".to_string())
    }
}

async fn calculate_dir_size(path: &Path) -> Result<usize> {
    let mut size = 0;
    let mut entries = tokio::fs::read_dir(path).await?;
    
    while let Some(entry) = entries.next_entry().await? {
        let metadata = entry.metadata().await?;
        if metadata.is_file() {
            size += metadata.len() as usize;
        } else if metadata.is_dir() {
            size += Box::pin(calculate_dir_size(&entry.path())).await?;
        }
    }
    
    Ok(size)
}
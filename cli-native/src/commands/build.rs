use anyhow::Result;
use colored::*;
use std::path::PathBuf;
use std::time::Instant;

use crate::build_engine::{BuildEngine, BuildOptions};
use crate::utils::{format_size, format_time};

pub async fn execute(output: PathBuf, watch: bool, analyze: bool) -> Result<()> {
    let start = Instant::now();
    
    // Get current directory
    let root = std::env::current_dir()?;
    
    // Create build options
    let options = BuildOptions {
        watch,
        analyze,
        ..Default::default()
    };
    
    // Create build engine
    let engine = BuildEngine::new(root.clone(), output.clone(), options)?;
    
    // Run build
    let stats = engine.build().await?;
    
    // Print results
    println!();
    println!("{} {} {}", 
        "✨".bold(),
        "Build completed successfully!".green().bold(),
        format!("({})", format_time(stats.duration)).dimmed()
    );
    
    println!();
    println!("  {} {}", "Components:".bold(), stats.components_count);
    println!("  {} {}", "Total size:".bold(), format_size(stats.total_size));
    println!("  {} {}", "Output:".bold(), output.display());
    
    if stats.cache_hits > 0 {
        println!("  {} {} ({}% hit rate)", 
            "Cache hits:".bold(), 
            stats.cache_hits,
            (stats.cache_hits as f64 / stats.components_count as f64 * 100.0) as u32
        );
    }
    
    if analyze {
        println!();
        println!("  {} Bundle analysis available at {}", 
            "📊".bold(),
            output.join("analyze.html").display()
        );
    }
    
    if watch {
        println!();
        println!("{} Watching for changes...", "👀".bold());
        println!("{}", "Press Ctrl+C to stop".dimmed());
        
        // Watch implementation would go here
        tokio::signal::ctrl_c().await?;
        println!("\n{} Build watch stopped", "✋".bold());
    }
    
    Ok(())
}
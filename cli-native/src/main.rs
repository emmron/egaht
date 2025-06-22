use anyhow::Result;
use clap::{Parser, Subcommand};
use colored::*;
use std::path::PathBuf;
use std::time::Instant;

mod commands;
mod config;
mod dev_server;
mod build_engine;
mod compiler;
mod utils;

use commands::*;

#[derive(Parser)]
#[command(name = "eghact")]
#[command(about = "🚀 Eghact Framework CLI - The revolutionary web framework", long_about = None)]
#[command(version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Create a new Eghact project
    Create {
        /// Project name
        name: String,
        
        /// Template to use
        #[arg(short, long, default_value = "basic")]
        template: String,
        
        /// Use TypeScript
        #[arg(long)]
        typescript: bool,
        
        /// Skip git initialization
        #[arg(long)]
        no_git: bool,
    },
    
    /// Start development server
    Dev {
        /// Port to use
        #[arg(short, long, default_value = "3000")]
        port: u16,
        
        /// Host to bind to
        #[arg(short = 'H', long, default_value = "0.0.0.0")]
        host: String,
        
        /// Open browser automatically
        #[arg(short, long)]
        open: bool,
    },
    
    /// Build project for production
    Build {
        /// Output directory
        #[arg(short, long, default_value = "dist")]
        output: PathBuf,
        
        /// Watch for changes
        #[arg(short, long)]
        watch: bool,
        
        /// Analyze bundle
        #[arg(long)]
        analyze: bool,
    },
    
    /// Generate components, pages, etc.
    Generate {
        /// Type (component, page, hook, store)
        r#type: String,
        
        /// Name
        name: String,
        
        /// Output directory
        #[arg(short, long)]
        directory: Option<PathBuf>,
    },
    
    /// Run tests
    Test {
        /// Watch mode
        #[arg(short, long)]
        watch: bool,
        
        /// Coverage report
        #[arg(short, long)]
        coverage: bool,
    },
    
    /// Lint and format code
    Lint {
        /// Auto-fix issues
        #[arg(long)]
        fix: bool,
    },
    
    /// Deploy to production
    Deploy {
        /// Target platform
        #[arg(short, long, default_value = "static")]
        target: String,
        
        /// Dry run
        #[arg(long)]
        dry_run: bool,
    },
    
    /// Check project health
    Doctor,
}

#[tokio::main]
async fn main() -> Result<()> {
    let start = Instant::now();
    let cli = Cli::parse();
    
    // Set up error handling
    if let Err(e) = run_command(cli.command).await {
        eprintln!("{} {}", "Error:".red().bold(), e);
        std::process::exit(1);
    }
    
    // Show execution time in debug mode
    if std::env::var("EGHACT_DEBUG").is_ok() {
        let elapsed = start.elapsed();
        eprintln!("{} {:?}", "Execution time:".dimmed(), elapsed);
    }
    
    Ok(())
}

async fn run_command(command: Commands) -> Result<()> {
    match command {
        Commands::Create { name, template, typescript, no_git } => {
            create::execute(name, template, typescript, !no_git).await
        }
        
        Commands::Dev { port, host, open } => {
            dev::execute(port, host, open).await
        }
        
        Commands::Build { output, watch, analyze } => {
            build::execute(output, watch, analyze).await
        }
        
        Commands::Generate { r#type, name, directory } => {
            generate::execute(r#type, name, directory).await
        }
        
        Commands::Test { watch, coverage } => {
            test::execute(watch, coverage).await
        }
        
        Commands::Lint { fix } => {
            lint::execute(fix).await
        }
        
        Commands::Deploy { target, dry_run } => {
            deploy::execute(target, dry_run).await
        }
        
        Commands::Doctor => {
            doctor::execute().await
        }
    }
}
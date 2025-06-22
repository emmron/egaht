use anyhow::Result;
use colored::*;
use std::net::SocketAddr;
use std::time::Instant;

use crate::dev_server::DevServer;
use crate::utils::format_time;

pub async fn execute(port: u16, host: String, open: bool) -> Result<()> {
    let start = Instant::now();
    
    println!("{} {}", "🔥".bold(), "Starting Eghact development server...".blue());
    println!();
    
    // Parse address
    let addr: SocketAddr = format!("{}:{}", host, port).parse()?;
    
    // Create dev server
    let server = DevServer::new(std::env::current_dir()?, addr)?;
    
    // Start server
    let local_url = format!("http://localhost:{}", port);
    let network_url = format!("http://{}:{}", get_local_ip()?, port);
    
    server.start().await?;
    
    let boot_time = start.elapsed();
    
    println!("{} {} {}", 
        "🚀".bold(),
        "Server ready!".green().bold(),
        format!("({})", format_time(boot_time)).dimmed()
    );
    println!();
    
    println!("  {} {}", "Local:".bold().pad_to_width(10), local_url.cyan());
    println!("  {} {}", "Network:".bold().pad_to_width(10), network_url.cyan());
    println!();
    
    println!("  {} Development", "Mode:".dimmed());
    println!("  {} HMR enabled", "Features:".dimmed());
    println!();
    
    println!("{}", "Press Ctrl+C to stop".dimmed());
    
    // Open browser if requested
    if open {
        if let Err(e) = open::that(&local_url) {
            eprintln!("{} Failed to open browser: {}", "Warning:".yellow(), e);
        }
    }
    
    // Wait for shutdown
    tokio::signal::ctrl_c().await?;
    
    println!();
    println!("{} Shutting down server...", "🛑".bold());
    
    Ok(())
}

fn get_local_ip() -> Result<String> {
    // Get local IP address
    // For now, return a default
    Ok("192.168.1.100".to_string())
}

trait PadToWidth {
    fn pad_to_width(&self, width: usize) -> String;
}

impl PadToWidth for &str {
    fn pad_to_width(&self, width: usize) -> String {
        format!("{:width$}", self, width = width)
    }
}
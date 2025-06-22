use std::time::Duration;
use sha2::{Sha256, Digest};

/// Format duration for display
pub fn format_time(duration: Duration) -> String {
    let millis = duration.as_millis();
    
    if millis < 1000 {
        format!("{}ms", millis)
    } else if millis < 60000 {
        format!("{:.1}s", millis as f64 / 1000.0)
    } else {
        let secs = duration.as_secs();
        format!("{}m {}s", secs / 60, secs % 60)
    }
}

/// Format size in bytes for display
pub fn format_size(bytes: usize) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB"];
    
    if bytes == 0 {
        return "0 B".to_string();
    }
    
    let i = (bytes as f64).log(1024.0).floor() as usize;
    let size = bytes as f64 / 1024_f64.powi(i as i32);
    
    if i == 0 {
        format!("{} {}", bytes, UNITS[0])
    } else {
        format!("{:.1} {}", size, UNITS[i.min(UNITS.len() - 1)])
    }
}

/// Calculate SHA256 hash of content
pub fn calculate_hash(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}
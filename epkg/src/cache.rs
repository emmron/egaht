/**
 * Package Cache
 * Manages local cache of downloaded packages
 */

use anyhow::{Result, Context};
use std::path::{Path, PathBuf};
use tokio::fs;
use sha2::{Sha256, Digest};

use crate::{Package, Registry};

pub struct PackageCache {
    cache_dir: PathBuf,
}

impl PackageCache {
    pub fn new() -> Result<Self> {
        let cache_dir = dirs::cache_dir()
            .map(|d| d.join("epkg"))
            .or_else(|| dirs::home_dir().map(|d| d.join(".epkg-cache")))
            .context("Failed to determine cache directory")?;
        
        Ok(Self { cache_dir })
    }
    
    pub async fn get_or_fetch(&self, package: &Package) -> Result<Vec<u8>> {
        let cache_path = self.get_cache_path(package);
        
        // Check if cached
        if cache_path.exists() {
            let data = fs::read(&cache_path).await?;
            
            // Verify checksum
            if self.verify_checksum(&data, &package.shasum)? {
                return Ok(data);
            }
            
            // Invalid cache, remove it
            fs::remove_file(&cache_path).await?;
        }
        
        // Download from registry
        let registry = Registry::new("https://registry.eghact.dev")?;
        let data = registry.download(package).await?;
        
        // Verify checksum
        if !self.verify_checksum(&data, &package.shasum)? {
            anyhow::bail!("Checksum verification failed for {}", package.name);
        }
        
        // Save to cache
        self.save_to_cache(&cache_path, &data).await?;
        
        Ok(data)
    }
    
    pub async fn clear_all(&self) -> Result<()> {
        if self.cache_dir.exists() {
            fs::remove_dir_all(&self.cache_dir).await?;
        }
        Ok(())
    }
    
    pub async fn clean_old(&self) -> Result<u64> {
        let mut freed = 0u64;
        
        if !self.cache_dir.exists() {
            return Ok(0);
        }
        
        // Remove packages older than 30 days
        let cutoff = std::time::SystemTime::now() - std::time::Duration::from_secs(30 * 24 * 60 * 60);
        
        let mut entries = fs::read_dir(&self.cache_dir).await?;
        while let Some(entry) = entries.next_entry().await? {
            let metadata = entry.metadata().await?;
            
            if let Ok(modified) = metadata.modified() {
                if modified < cutoff {
                    freed += metadata.len();
                    fs::remove_file(entry.path()).await?;
                }
            }
        }
        
        Ok(freed)
    }
    
    fn get_cache_path(&self, package: &Package) -> PathBuf {
        let filename = format!("{}-{}.tgz", package.name.replace('/', "-"), package.version);
        self.cache_dir.join(filename)
    }
    
    fn verify_checksum(&self, data: &[u8], expected: &str) -> Result<bool> {
        let mut hasher = Sha256::new();
        hasher.update(data);
        let result = format!("{:x}", hasher.finalize());
        Ok(result == expected)
    }
    
    async fn save_to_cache(&self, path: &Path, data: &[u8]) -> Result<()> {
        // Ensure cache directory exists
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).await?;
        }
        
        // Write atomically
        let temp_path = path.with_extension("tmp");
        fs::write(&temp_path, data).await?;
        fs::rename(temp_path, path).await?;
        
        Ok(())
    }
}
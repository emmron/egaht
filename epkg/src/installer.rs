/**
 * Package Installer
 * Downloads and installs packages to eghact_modules
 */

use anyhow::{Result, Context};
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::io::AsyncWriteExt;
use flate2::read::GzDecoder;
use tar::Archive;
use std::io::Cursor;

use crate::{Package, PackageCache, Registry};

pub struct PackageInstaller<'a> {
    cache: &'a PackageCache,
}

impl<'a> PackageInstaller<'a> {
    pub fn new(cache: &'a PackageCache) -> Self {
        Self { cache }
    }
    
    pub async fn install(&self, package: &Package, force: bool) -> Result<()> {
        let install_path = Path::new("eghact_modules").join(&package.name);
        
        // Check if already installed
        if !force && install_path.exists() {
            if self.verify_installation(&install_path, package).await? {
                return Ok(());
            }
        }
        
        // Get package data (from cache or download)
        let data = self.cache.get_or_fetch(package).await?;
        
        // Extract package
        self.extract_package(&data, &install_path).await?;
        
        // Create package metadata
        self.write_metadata(&install_path, package).await?;
        
        // Run post-install scripts if any
        self.run_post_install(&install_path).await?;
        
        Ok(())
    }
    
    async fn verify_installation(&self, path: &Path, package: &Package) -> Result<bool> {
        let metadata_path = path.join(".epkg-metadata.json");
        
        if !metadata_path.exists() {
            return Ok(false);
        }
        
        let metadata = fs::read_to_string(metadata_path).await?;
        let installed: PackageMetadata = serde_json::from_str(&metadata)?;
        
        Ok(installed.version == package.version && installed.shasum == package.shasum)
    }
    
    async fn extract_package(&self, data: &[u8], install_path: &Path) -> Result<()> {
        // Remove existing installation
        if install_path.exists() {
            fs::remove_dir_all(install_path).await?;
        }
        
        // Create directory
        fs::create_dir_all(install_path).await?;
        
        // Extract tarball
        let cursor = Cursor::new(data);
        let tar = GzDecoder::new(cursor);
        let mut archive = Archive::new(tar);
        
        // Extract files
        for entry in archive.entries()? {
            let mut entry = entry?;
            let path = entry.path()?;
            
            // Skip package/ prefix if present
            let relative_path = if path.starts_with("package/") {
                path.strip_prefix("package/").unwrap()
            } else {
                &path
            };
            
            let dest_path = install_path.join(relative_path);
            
            // Create parent directories
            if let Some(parent) = dest_path.parent() {
                fs::create_dir_all(parent).await?;
            }
            
            // Extract file
            if entry.header().entry_type().is_file() {
                let mut file_data = Vec::new();
                std::io::copy(&mut entry, &mut file_data)?;
                fs::write(&dest_path, file_data).await?;
                
                // Preserve executable bit
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let mode = entry.header().mode()?;
                    if mode & 0o111 != 0 {
                        let mut perms = fs::metadata(&dest_path).await?.permissions();
                        perms.set_mode(mode);
                        fs::set_permissions(&dest_path, perms).await?;
                    }
                }
            }
        }
        
        Ok(())
    }
    
    async fn write_metadata(&self, install_path: &Path, package: &Package) -> Result<()> {
        let metadata = PackageMetadata {
            name: package.name.clone(),
            version: package.version.clone(),
            shasum: package.shasum.clone(),
            installed_at: chrono::Utc::now().to_rfc3339(),
        };
        
        let metadata_path = install_path.join(".epkg-metadata.json");
        let content = serde_json::to_string_pretty(&metadata)?;
        fs::write(metadata_path, content).await?;
        
        Ok(())
    }
    
    async fn run_post_install(&self, install_path: &Path) -> Result<()> {
        let scripts_path = install_path.join(".epkg-scripts");
        let post_install = scripts_path.join("post-install");
        
        if post_install.exists() {
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = fs::metadata(&post_install).await?.permissions();
                perms.set_mode(0o755);
                fs::set_permissions(&post_install, perms).await?;
            }
            
            let status = tokio::process::Command::new(&post_install)
                .current_dir(install_path)
                .status()
                .await?;
            
            if !status.success() {
                eprintln!("Warning: post-install script failed");
            }
        }
        
        Ok(())
    }
}

#[derive(serde::Serialize, serde::Deserialize)]
struct PackageMetadata {
    name: String,
    version: String,
    shasum: String,
    installed_at: String,
}
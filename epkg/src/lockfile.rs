/**
 * Lock File Management
 * Handles epkg-lock.json for deterministic installs
 */

use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::fs;

use crate::Package;

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Lockfile {
    version: u32,
    packages: HashMap<String, LockedPackage>,
    #[serde(default)]
    integrity: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockedPackage {
    pub version: String,
    pub resolved: String,
    pub integrity: String,
    pub dependencies: HashMap<String, String>,
    #[serde(default)]
    pub dev: bool,
}

impl Lockfile {
    pub async fn load() -> Result<Self> {
        let path = "epkg-lock.json";
        
        if !std::path::Path::new(path).exists() {
            return Ok(Self::default());
        }
        
        let content = fs::read_to_string(path)
            .await
            .context("Failed to read lockfile")?;
        
        serde_json::from_str(&content)
            .context("Failed to parse lockfile")
    }
    
    pub async fn save(&self) -> Result<()> {
        let content = serde_json::to_string_pretty(self)?;
        fs::write("epkg-lock.json", content)
            .await
            .context("Failed to write lockfile")
    }
    
    pub fn add_package(&mut self, name: &str, package: &Package) {
        let locked = LockedPackage {
            version: package.version.clone(),
            resolved: package.tarball.clone(),
            integrity: format!("sha256-{}", package.shasum),
            dependencies: package.dependencies.clone(),
            dev: false,
        };
        
        self.packages.insert(name.to_string(), locked);
        self.version = 1;
    }
    
    pub fn update_package(&mut self, name: &str, package: &Package) {
        self.add_package(name, package);
    }
    
    pub fn get_package(&self, name: &str) -> Option<Package> {
        self.packages.get(name).map(|locked| Package {
            name: name.to_string(),
            version: locked.version.clone(),
            description: None,
            tarball: locked.resolved.clone(),
            shasum: locked.integrity.strip_prefix("sha256-").unwrap_or(&locked.integrity).to_string(),
            dependencies: locked.dependencies.clone(),
            dev_dependencies: HashMap::new(),
            size: 0,
            files: vec![],
        })
    }
    
    pub fn remove_package(&mut self, name: &str) {
        self.packages.remove(name);
    }
}

impl From<&Package> for LockedPackage {
    fn from(package: &Package) -> Self {
        Self {
            version: package.version.clone(),
            resolved: package.tarball.clone(),
            integrity: format!("sha256-{}", package.shasum),
            dependencies: package.dependencies.clone(),
            dev: false,
        }
    }
}
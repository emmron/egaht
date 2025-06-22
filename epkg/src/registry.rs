/**
 * Package Registry Client
 * Handles communication with the Eghact package registry
 */

use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub struct Registry {
    base_url: String,
    client: reqwest::Client,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Package {
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub tarball: String,
    pub shasum: String,
    pub dependencies: HashMap<String, String>,
    pub dev_dependencies: HashMap<String, String>,
    pub size: u64,
    pub files: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub downloads: u64,
    pub score: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Vulnerability {
    pub id: String,
    pub title: String,
    pub description: String,
    pub severity: String,
    pub package: String,
    pub version: String,
    pub fixed_version: String,
}

impl Registry {
    pub fn new(base_url: &str) -> Result<Self> {
        Ok(Self {
            base_url: base_url.to_string(),
            client: reqwest::Client::builder()
                .user_agent("epkg/0.1.0")
                .timeout(std::time::Duration::from_secs(30))
                .build()?,
        })
    }
    
    pub async fn resolve(&self, name: &str, version_spec: &str) -> Result<Package> {
        // For now, simplified version resolution
        // In production, implement full semver resolution
        
        if version_spec == "latest" {
            self.get_latest(name).await
        } else {
            self.get_package(name, version_spec).await
        }
    }
    
    pub async fn get_latest(&self, name: &str) -> Result<Package> {
        let url = format!("{}/packages/{}/latest", self.base_url, name);
        
        let response = self.client
            .get(&url)
            .send()
            .await
            .context("Failed to fetch package info")?;
        
        if !response.status().is_success() {
            anyhow::bail!("Package not found: {}", name);
        }
        
        response.json()
            .await
            .context("Failed to parse package info")
    }
    
    pub async fn get_package(&self, name: &str, version: &str) -> Result<Package> {
        let url = format!("{}/packages/{}/{}", self.base_url, name, version);
        
        let response = self.client
            .get(&url)
            .send()
            .await
            .context("Failed to fetch package")?;
        
        if !response.status().is_success() {
            anyhow::bail!("Package not found: {}@{}", name, version);
        }
        
        response.json()
            .await
            .context("Failed to parse package")
    }
    
    pub async fn get_latest_version(&self, name: &str) -> Result<String> {
        let pkg = self.get_latest(name).await?;
        Ok(pkg.version)
    }
    
    pub async fn search(&self, query: &str, limit: usize) -> Result<Vec<SearchResult>> {
        let url = format!("{}/search", self.base_url);
        
        let response = self.client
            .get(&url)
            .query(&[("q", query), ("limit", &limit.to_string())])
            .send()
            .await
            .context("Search failed")?;
        
        response.json()
            .await
            .context("Failed to parse search results")
    }
    
    pub async fn download(&self, package: &Package) -> Result<Vec<u8>> {
        let response = self.client
            .get(&package.tarball)
            .send()
            .await
            .context("Failed to download package")?;
        
        if !response.status().is_success() {
            anyhow::bail!("Failed to download package: {}", package.name);
        }
        
        response.bytes()
            .await
            .map(|b| b.to_vec())
            .context("Failed to read package data")
    }
    
    pub async fn audit(&self, lockfile: &crate::lockfile::Lockfile) -> Result<Vec<Vulnerability>> {
        let url = format!("{}/audit", self.base_url);
        
        let response = self.client
            .post(&url)
            .json(lockfile)
            .send()
            .await
            .context("Audit request failed")?;
        
        response.json()
            .await
            .context("Failed to parse audit results")
    }
    
    pub async fn publish(&self, tarball: Vec<u8>, auth_token: &str) -> Result<()> {
        let url = format!("{}/publish", self.base_url);
        
        let response = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", auth_token))
            .body(tarball)
            .send()
            .await
            .context("Publish failed")?;
        
        if !response.status().is_success() {
            let error = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            anyhow::bail!("Publish failed: {}", error);
        }
        
        Ok(())
    }
}
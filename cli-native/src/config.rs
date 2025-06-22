use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct EghactConfig {
    pub mode: Mode,
    pub out_dir: String,
    pub public_dir: String,
    pub compiler: CompilerConfig,
    pub dev_server: DevServerConfig,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    Development,
    Production,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CompilerConfig {
    pub targets: Vec<String>,
    pub optimization: OptimizationLevel,
    pub source_maps: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OptimizationLevel {
    None,
    Balanced,
    Aggressive,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DevServerConfig {
    pub port: u16,
    pub hmr: bool,
}

impl Default for EghactConfig {
    fn default() -> Self {
        Self {
            mode: Mode::Development,
            out_dir: "dist".to_string(),
            public_dir: "public".to_string(),
            compiler: CompilerConfig {
                targets: vec!["chrome91".to_string(), "firefox89".to_string(), "safari14".to_string()],
                optimization: OptimizationLevel::Balanced,
                source_maps: true,
            },
            dev_server: DevServerConfig {
                port: 3000,
                hmr: true,
            },
        }
    }
}

impl EghactConfig {
    pub fn load(path: &Path) -> Result<Self> {
        if path.exists() {
            let content = std::fs::read_to_string(path)?;
            Ok(serde_json::from_str(&content)?)
        } else {
            Ok(Self::default())
        }
    }
}
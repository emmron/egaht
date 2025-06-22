use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};

use super::{CompilationArtifacts, ModuleInfo};

/// Multi-level caching system for ASTs and compilation results
/// Provides both in-memory and persistent disk caching
pub struct CacheManager {
    /// In-memory cache for hot modules
    memory_cache: Arc<RwLock<HashMap<PathBuf, CacheEntry>>>,
    /// Path to disk cache directory
    disk_cache_dir: PathBuf,
    /// Maximum memory cache size (number of entries)
    max_memory_entries: usize,
    /// Cache configuration
    config: CacheConfig,
}

/// Configuration for caching behavior
#[derive(Debug, Clone)]
pub struct CacheConfig {
    /// Enable persistent disk cache
    pub enable_disk_cache: bool,
    /// Enable in-memory cache
    pub enable_memory_cache: bool,
    /// Maximum memory cache size in MB
    pub max_memory_mb: usize,
    /// Cache entry TTL in seconds
    pub ttl_seconds: u64,
    /// Compression level for disk cache (0-9)
    pub compression_level: u32,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            enable_disk_cache: true,
            enable_memory_cache: true,
            max_memory_mb: 256,
            ttl_seconds: 3600, // 1 hour
            compression_level: 6,
        }
    }
}

/// Cache entry with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry {
    /// Cache key (file path hash + content hash)
    pub key: String,
    /// Module information
    pub module_info: ModuleInfo,
    /// Compilation artifacts
    pub artifacts: CompilationArtifacts,
    /// Cache creation timestamp
    pub created_at: u64,
    /// Last access timestamp
    pub last_accessed: u64,
    /// Cache hit count
    pub hit_count: u64,
}

/// Cache statistics
#[derive(Debug, Clone)]
pub struct CacheStats {
    pub memory_entries: usize,
    pub disk_entries: usize,
    pub memory_hit_rate: f64,
    pub disk_hit_rate: f64,
    pub total_size_mb: f64,
    pub eviction_count: u64,
}

impl CacheManager {
    /// Create a new cache manager
    pub fn new<P: AsRef<Path>>(cache_dir: P, config: CacheConfig) -> Result<Self, Box<dyn std::error::Error>> {
        let disk_cache_dir = cache_dir.as_ref().to_path_buf();
        
        // Create cache directory if it doesn't exist
        if config.enable_disk_cache {
            fs::create_dir_all(&disk_cache_dir)?;
        }

        let max_memory_entries = (config.max_memory_mb * 1024 * 1024) / 1024; // Estimate ~1KB per entry

        Ok(Self {
            memory_cache: Arc::new(RwLock::new(HashMap::new())),
            disk_cache_dir,
            max_memory_entries,
            config,
        })
    }

    /// Generate cache key for a file
    pub fn generate_cache_key(&self, file_path: &Path, content_hash: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(file_path.to_string_lossy().as_bytes());
        hasher.update(content_hash.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    /// Get cache entry from memory or disk
    pub fn get(&self, file_path: &Path, content_hash: &str) -> Option<CacheEntry> {
        let cache_key = self.generate_cache_key(file_path, content_hash);

        // Try memory cache first
        if self.config.enable_memory_cache {
            if let Ok(mut memory_cache) = self.memory_cache.write() {
                if let Some(entry) = memory_cache.get_mut(&file_path.to_path_buf()) {
                    if entry.key == cache_key && !self.is_expired(entry) {
                        entry.last_accessed = current_timestamp();
                        entry.hit_count += 1;
                        return Some(entry.clone());
                    } else {
                        // Remove expired or invalid entry
                        memory_cache.remove(&file_path.to_path_buf());
                    }
                }
            }
        }

        // Try disk cache
        if self.config.enable_disk_cache {
            if let Some(entry) = self.load_from_disk(&cache_key) {
                if !self.is_expired(&entry) {
                    // Promote to memory cache
                    if self.config.enable_memory_cache {
                        self.put_memory_cache(file_path.to_path_buf(), entry.clone());
                    }
                    return Some(entry);
                } else {
                    // Remove expired disk entry
                    let _ = self.remove_from_disk(&cache_key);
                }
            }
        }

        None
    }

    /// Put cache entry in both memory and disk
    pub fn put(&self, file_path: PathBuf, module_info: ModuleInfo, artifacts: CompilationArtifacts) -> Result<(), Box<dyn std::error::Error>> {
        let cache_key = self.generate_cache_key(&file_path, &module_info.content_hash);
        let now = current_timestamp();

        let entry = CacheEntry {
            key: cache_key.clone(),
            module_info,
            artifacts,
            created_at: now,
            last_accessed: now,
            hit_count: 0,
        };

        // Store in memory cache
        if self.config.enable_memory_cache {
            self.put_memory_cache(file_path.clone(), entry.clone());
        }

        // Store in disk cache
        if self.config.enable_disk_cache {
            self.save_to_disk(&cache_key, &entry)?;
        }

        Ok(())
    }

    /// Put entry in memory cache with LRU eviction
    fn put_memory_cache(&self, file_path: PathBuf, entry: CacheEntry) {
        if let Ok(mut memory_cache) = self.memory_cache.write() {
            // Check if we need to evict entries
            if memory_cache.len() >= self.max_memory_entries {
                // Find LRU entry
                let mut lru_path: Option<PathBuf> = None;
                let mut oldest_access = u64::MAX;

                for (path, cached_entry) in memory_cache.iter() {
                    if cached_entry.last_accessed < oldest_access {
                        oldest_access = cached_entry.last_accessed;
                        lru_path = Some(path.clone());
                    }
                }

                if let Some(path_to_remove) = lru_path {
                    memory_cache.remove(&path_to_remove);
                }
            }

            memory_cache.insert(file_path, entry);
        }
    }

    /// Load cache entry from disk
    fn load_from_disk(&self, cache_key: &str) -> Option<CacheEntry> {
        let cache_file = self.get_disk_cache_path(cache_key);
        
        if cache_file.exists() {
            if let Ok(compressed_data) = fs::read(&cache_file) {
                if let Ok(json_data) = self.decompress_data(&compressed_data) {
                    if let Ok(entry) = serde_json::from_slice::<CacheEntry>(&json_data) {
                        return Some(entry);
                    }
                }
            }
        }
        
        None
    }

    /// Save cache entry to disk
    fn save_to_disk(&self, cache_key: &str, entry: &CacheEntry) -> Result<(), Box<dyn std::error::Error>> {
        let cache_file = self.get_disk_cache_path(cache_key);
        
        // Create subdirectory if needed
        if let Some(parent) = cache_file.parent() {
            fs::create_dir_all(parent)?;
        }

        let json_data = serde_json::to_vec(entry)?;
        let compressed_data = self.compress_data(&json_data)?;
        
        fs::write(cache_file, compressed_data)?;
        Ok(())
    }

    /// Remove cache entry from disk
    fn remove_from_disk(&self, cache_key: &str) -> Result<(), Box<dyn std::error::Error>> {
        let cache_file = self.get_disk_cache_path(cache_key);
        if cache_file.exists() {
            fs::remove_file(cache_file)?;
        }
        Ok(())
    }

    /// Get disk cache file path for a cache key
    fn get_disk_cache_path(&self, cache_key: &str) -> PathBuf {
        // Use first two characters as subdirectory for better filesystem performance
        let subdir = &cache_key[0..2];
        self.disk_cache_dir.join(subdir).join(format!("{}.cache", cache_key))
    }

    /// Check if cache entry is expired
    fn is_expired(&self, entry: &CacheEntry) -> bool {
        let now = current_timestamp();
        now - entry.created_at > self.config.ttl_seconds
    }

    /// Compress data for disk storage
    fn compress_data(&self, data: &[u8]) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        use flate2::write::GzEncoder;
        use flate2::Compression;
        use std::io::Write;

        let mut encoder = GzEncoder::new(Vec::new(), Compression::new(self.config.compression_level));
        encoder.write_all(data)?;
        Ok(encoder.finish()?)
    }

    /// Decompress data from disk storage
    fn decompress_data(&self, compressed_data: &[u8]) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        use flate2::read::GzDecoder;
        use std::io::Read;

        let mut decoder = GzDecoder::new(compressed_data);
        let mut decompressed = Vec::new();
        decoder.read_to_end(&mut decompressed)?;
        Ok(decompressed)
    }

    /// Clear all cached entries
    pub fn clear(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Clear memory cache
        if let Ok(mut memory_cache) = self.memory_cache.write() {
            memory_cache.clear();
        }

        // Clear disk cache
        if self.config.enable_disk_cache && self.disk_cache_dir.exists() {
            fs::remove_dir_all(&self.disk_cache_dir)?;
            fs::create_dir_all(&self.disk_cache_dir)?;
        }

        Ok(())
    }

    /// Get cache statistics
    pub fn get_stats(&self) -> CacheStats {
        let memory_entries = if let Ok(memory_cache) = self.memory_cache.read() {
            memory_cache.len()
        } else {
            0
        };

        let disk_entries = self.count_disk_entries();
        let total_size_mb = self.calculate_cache_size_mb();

        CacheStats {
            memory_entries,
            disk_entries,
            memory_hit_rate: 0.0, // TODO: Implement hit rate tracking
            disk_hit_rate: 0.0,   // TODO: Implement hit rate tracking
            total_size_mb,
            eviction_count: 0,    // TODO: Implement eviction counting
        }
    }

    /// Count entries in disk cache
    fn count_disk_entries(&self) -> usize {
        if !self.config.enable_disk_cache || !self.disk_cache_dir.exists() {
            return 0;
        }

        let mut count = 0;
        if let Ok(entries) = fs::read_dir(&self.disk_cache_dir) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    if let Ok(subentries) = fs::read_dir(entry.path()) {
                        count += subentries.count();
                    }
                }
            }
        }
        count
    }

    /// Calculate total cache size in MB
    fn calculate_cache_size_mb(&self) -> f64 {
        if !self.config.enable_disk_cache || !self.disk_cache_dir.exists() {
            return 0.0;
        }

        let mut total_size = 0u64;
        
        fn dir_size(path: &Path) -> Result<u64, std::io::Error> {
            let mut size = 0;
            for entry in fs::read_dir(path)? {
                let entry = entry?;
                let metadata = entry.metadata()?;
                if metadata.is_dir() {
                    size += dir_size(&entry.path())?;
                } else {
                    size += metadata.len();
                }
            }
            Ok(size)
        }

        if let Ok(size) = dir_size(&self.disk_cache_dir) {
            total_size = size;
        }

        total_size as f64 / (1024.0 * 1024.0)
    }

    /// Cleanup expired entries
    pub fn cleanup_expired(&self) -> Result<u64, Box<dyn std::error::Error>> {
        let mut removed_count = 0;

        // Cleanup memory cache
        if let Ok(mut memory_cache) = self.memory_cache.write() {
            let mut to_remove = Vec::new();
            for (path, entry) in memory_cache.iter() {
                if self.is_expired(entry) {
                    to_remove.push(path.clone());
                }
            }
            for path in to_remove {
                memory_cache.remove(&path);
                removed_count += 1;
            }
        }

        // Cleanup disk cache
        if self.config.enable_disk_cache && self.disk_cache_dir.exists() {
            removed_count += self.cleanup_disk_cache()?;
        }

        Ok(removed_count)
    }

    /// Cleanup expired entries from disk cache
    fn cleanup_disk_cache(&self) -> Result<u64, Box<dyn std::error::Error>> {
        let mut removed_count = 0;

        fn cleanup_dir(dir: &Path, cache_manager: &CacheManager, removed_count: &mut u64) -> Result<(), Box<dyn std::error::Error>> {
            for entry in fs::read_dir(dir)? {
                let entry = entry?;
                let path = entry.path();
                
                if path.is_dir() {
                    cleanup_dir(&path, cache_manager, removed_count)?;
                } else if path.extension().map_or(false, |ext| ext == "cache") {
                    // Try to load and check if expired
                    if let Some(file_stem) = path.file_stem() {
                        if let Some(cache_key) = file_stem.to_str() {
                            if let Some(cached_entry) = cache_manager.load_from_disk(cache_key) {
                                if cache_manager.is_expired(&cached_entry) {
                                    fs::remove_file(&path)?;
                                    *removed_count += 1;
                                }
                            }
                        }
                    }
                }
            }
            Ok(())
        }

        cleanup_dir(&self.disk_cache_dir, self, &mut removed_count)?;
        Ok(removed_count)
    }
}

/// Get current timestamp in seconds
fn current_timestamp() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_cache_manager_creation() -> Result<(), Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let config = CacheConfig::default();
        let cache_manager = CacheManager::new(temp_dir.path(), config)?;
        
        assert!(temp_dir.path().exists());
        Ok(())
    }

    #[test]
    fn test_cache_key_generation() -> Result<(), Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let config = CacheConfig::default();
        let cache_manager = CacheManager::new(temp_dir.path(), config)?;

        let file_path = PathBuf::from("test.egh");
        let content_hash = "abc123";
        
        let key1 = cache_manager.generate_cache_key(&file_path, content_hash);
        let key2 = cache_manager.generate_cache_key(&file_path, content_hash);
        
        assert_eq!(key1, key2);
        assert!(!key1.is_empty());
        Ok(())
    }

    #[test]
    fn test_memory_cache_operations() -> Result<(), Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let mut config = CacheConfig::default();
        config.enable_disk_cache = false; // Only test memory cache
        
        let cache_manager = CacheManager::new(temp_dir.path(), config)?;
        
        let file_path = PathBuf::from("test.egh");
        let module_info = ModuleInfo {
            path: file_path.clone(),
            content_hash: "abc123".to_string(),
            mtime: current_timestamp(),
            dependencies: Default::default(),
            artifacts: CompilationArtifacts {
                js_code: Some("console.log('test')".to_string()),
                css_code: None,
                ast_data: None,
                source_map: None,
                type_defs: None,
            },
            last_compiled: current_timestamp(),
        };

        let artifacts = module_info.artifacts.clone();
        
        // Put entry in cache
        cache_manager.put(file_path.clone(), module_info.clone(), artifacts)?;
        
        // Retrieve entry
        let retrieved = cache_manager.get(&file_path, &module_info.content_hash);
        assert!(retrieved.is_some());
        
        let entry = retrieved.unwrap();
        assert_eq!(entry.module_info.content_hash, module_info.content_hash);
        assert!(entry.artifacts.js_code.is_some());
        
        Ok(())
    }

    #[test]
    fn test_disk_cache_operations() -> Result<(), Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let mut config = CacheConfig::default();
        config.enable_memory_cache = false; // Only test disk cache
        
        let cache_manager = CacheManager::new(temp_dir.path(), config)?;
        
        let file_path = PathBuf::from("test.egh");
        let module_info = ModuleInfo {
            path: file_path.clone(),
            content_hash: "abc123".to_string(),
            mtime: current_timestamp(),
            dependencies: Default::default(),
            artifacts: CompilationArtifacts {
                js_code: Some("console.log('test')".to_string()),
                css_code: None,
                ast_data: None,
                source_map: None,
                type_defs: None,
            },
            last_compiled: current_timestamp(),
        };

        let artifacts = module_info.artifacts.clone();
        
        // Put entry in cache
        cache_manager.put(file_path.clone(), module_info.clone(), artifacts)?;
        
        // Create new cache manager to test persistence
        let cache_manager2 = CacheManager::new(temp_dir.path(), CacheConfig::default())?;
        
        // Retrieve entry
        let retrieved = cache_manager2.get(&file_path, &module_info.content_hash);
        assert!(retrieved.is_some());
        
        let entry = retrieved.unwrap();
        assert_eq!(entry.module_info.content_hash, module_info.content_hash);
        
        Ok(())
    }

    #[test]
    fn test_cache_expiration() -> Result<(), Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let mut config = CacheConfig::default();
        config.ttl_seconds = 1; // 1 second TTL
        
        let cache_manager = CacheManager::new(temp_dir.path(), config)?;
        
        let file_path = PathBuf::from("test.egh");
        let module_info = ModuleInfo {
            path: file_path.clone(),
            content_hash: "abc123".to_string(),
            mtime: current_timestamp(),
            dependencies: Default::default(),
            artifacts: CompilationArtifacts {
                js_code: Some("console.log('test')".to_string()),
                css_code: None,
                ast_data: None,
                source_map: None,
                type_defs: None,
            },
            last_compiled: current_timestamp(),
        };

        let artifacts = module_info.artifacts.clone();
        
        // Put entry in cache
        cache_manager.put(file_path.clone(), module_info.clone(), artifacts)?;
        
        // Should be available immediately
        assert!(cache_manager.get(&file_path, &module_info.content_hash).is_some());
        
        // Wait for expiration
        thread::sleep(Duration::from_secs(2));
        
        // Should be expired now
        assert!(cache_manager.get(&file_path, &module_info.content_hash).is_none());
        
        Ok(())
    }
}
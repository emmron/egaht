//! EghactDB - Native Database Engine
//! 
//! A database that understands .eg files and EghQL natively.
//! No SQL, no external database needed.

#![warn(clippy::all, clippy::pedantic)]
#![allow(clippy::module_name_repetitions)]

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::collections::HashMap;
use serde::{Serialize, Deserialize};
use parking_lot::RwLock;

pub mod engine;
pub mod query;
pub mod index;
pub mod storage;
pub mod replication;
pub mod schema;

use crate::engine::Engine;
use crate::query::{Query, QueryResult};
use crate::schema::Schema;

/// The main database instance
pub struct EghactDB {
    engine: Arc<Engine>,
    schemas: Arc<RwLock<HashMap<String, Schema>>>,
    path: PathBuf,
}

impl EghactDB {
    /// Create a new database instance
    pub fn open(path: impl AsRef<Path>) -> Result<Self, Error> {
        let path = path.as_ref().to_path_buf();
        std::fs::create_dir_all(&path)?;
        
        let engine = Arc::new(Engine::new(&path)?);
        let schemas = Arc::new(RwLock::new(HashMap::new()));
        
        // Load existing schemas
        let schema_path = path.join("schemas");
        if schema_path.exists() {
            for entry in std::fs::read_dir(&schema_path)? {
                let entry = entry?;
                if entry.path().extension() == Some(std::ffi::OsStr::new("schema")) {
                    let schema: Schema = serde_json::from_slice(&std::fs::read(entry.path())?)?;
                    schemas.write().insert(schema.name.clone(), schema);
                }
            }
        }
        
        Ok(Self {
            engine,
            schemas,
            path,
        })
    }
    
    /// Execute an EghQL query
    pub fn query(&self, eghql: &str) -> Result<QueryResult, Error> {
        let query = Query::parse(eghql)?;
        self.engine.execute(query)
    }
    
    /// Insert data from .eg files
    pub fn insert_eg(&self, collection: &str, eg_content: &str) -> Result<String, Error> {
        let document = parse_eg_to_document(eg_content)?;
        self.engine.insert(collection, document)
    }
    
    /// Create a new collection with schema
    pub fn create_collection(&self, name: &str, schema: Schema) -> Result<(), Error> {
        self.schemas.write().insert(name.to_string(), schema.clone());
        
        // Persist schema
        let schema_path = self.path.join("schemas");
        std::fs::create_dir_all(&schema_path)?;
        
        let schema_file = schema_path.join(format!("{}.schema", name));
        std::fs::write(schema_file, serde_json::to_vec_pretty(&schema)?)?;
        
        self.engine.create_collection(name, schema)
    }
    
    /// Start real-time subscription
    pub async fn subscribe(&self, query: &str) -> Result<Subscription, Error> {
        let query = Query::parse(query)?;
        self.engine.subscribe(query).await
    }
    
    /// Begin a transaction
    pub fn transaction(&self) -> Transaction {
        Transaction::new(self.engine.clone())
    }
    
    /// Backup the database
    pub fn backup(&self, dest: impl AsRef<Path>) -> Result<(), Error> {
        self.engine.backup(dest.as_ref())
    }
    
    /// Get database statistics
    pub fn stats(&self) -> DbStats {
        DbStats {
            collections: self.schemas.read().len(),
            total_documents: self.engine.document_count(),
            disk_usage: self.calculate_disk_usage(),
            memory_usage: self.engine.memory_usage(),
        }
    }
    
    fn calculate_disk_usage(&self) -> u64 {
        walkdir::WalkDir::new(&self.path)
            .into_iter()
            .filter_map(|entry| entry.ok())
            .filter_map(|entry| entry.metadata().ok())
            .map(|metadata| metadata.len())
            .sum()
    }
}

/// Database statistics
#[derive(Debug, Serialize)]
pub struct DbStats {
    pub collections: usize,
    pub total_documents: u64,
    pub disk_usage: u64,
    pub memory_usage: u64,
}

/// Real-time subscription handle
pub struct Subscription {
    id: String,
    receiver: tokio::sync::mpsc::Receiver<Document>,
}

impl Subscription {
    pub async fn next(&mut self) -> Option<Document> {
        self.receiver.recv().await
    }
    
    pub fn id(&self) -> &str {
        &self.id
    }
}

/// Transaction handle
pub struct Transaction {
    engine: Arc<Engine>,
    operations: Vec<Operation>,
}

impl Transaction {
    fn new(engine: Arc<Engine>) -> Self {
        Self {
            engine,
            operations: Vec::new(),
        }
    }
    
    pub fn insert(&mut self, collection: &str, document: Document) -> &mut Self {
        self.operations.push(Operation::Insert {
            collection: collection.to_string(),
            document,
        });
        self
    }
    
    pub fn update(&mut self, collection: &str, id: &str, updates: Document) -> &mut Self {
        self.operations.push(Operation::Update {
            collection: collection.to_string(),
            id: id.to_string(),
            updates,
        });
        self
    }
    
    pub fn delete(&mut self, collection: &str, id: &str) -> &mut Self {
        self.operations.push(Operation::Delete {
            collection: collection.to_string(),
            id: id.to_string(),
        });
        self
    }
    
    pub async fn commit(self) -> Result<(), Error> {
        self.engine.execute_transaction(self.operations).await
    }
    
    pub fn rollback(self) {
        // Operations are dropped
    }
}

#[derive(Debug)]
enum Operation {
    Insert { collection: String, document: Document },
    Update { collection: String, id: String, updates: Document },
    Delete { collection: String, id: String },
}

/// Document type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    
    #[serde(flatten)]
    pub fields: HashMap<String, Value>,
}

/// Value types supported by the database
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Value {
    Null,
    Bool(bool),
    Integer(i64),
    Float(f64),
    String(String),
    Binary(Vec<u8>),
    Array(Vec<Value>),
    Object(HashMap<String, Value>),
    Date(chrono::DateTime<chrono::Utc>),
}

/// Parse .eg file content to document
fn parse_eg_to_document(content: &str) -> Result<Document, Error> {
    // Parse frontmatter and content
    let parts: Vec<&str> = content.splitn(3, "---").collect();
    
    if parts.len() < 3 {
        return Err(Error::ParseError("Invalid .eg file format".to_string()));
    }
    
    let frontmatter = parts[1];
    let body = parts[2];
    
    // Parse YAML frontmatter
    let mut fields: HashMap<String, Value> = serde_yaml::from_str(frontmatter)?;
    
    // Add body content
    fields.insert("_content".to_string(), Value::String(body.to_string()));
    
    Ok(Document {
        id: None,
        fields,
    })
}

/// Database errors
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Parse error: {0}")]
    ParseError(String),
    
    #[error("Query error: {0}")]
    QueryError(String),
    
    #[error("Schema error: {0}")]
    SchemaError(String),
    
    #[error("Transaction error: {0}")]
    TransactionError(String),
    
    #[error("Serialization error: {0}")]
    SerializationError(#[from] bincode::Error),
    
    #[error("JSON error: {0}")]
    JsonError(#[from] serde_json::Error),
    
    #[error("YAML error: {0}")]
    YamlError(#[from] serde_yaml::Error),
}

/// Native bindings for other languages
#[no_mangle]
pub extern "C" fn eghactdb_open(path: *const std::os::raw::c_char) -> *mut EghactDB {
    unsafe {
        let path = std::ffi::CStr::from_ptr(path).to_str().unwrap();
        match EghactDB::open(path) {
            Ok(db) => Box::into_raw(Box::new(db)),
            Err(_) => std::ptr::null_mut(),
        }
    }
}

#[no_mangle]
pub extern "C" fn eghactdb_close(db: *mut EghactDB) {
    if !db.is_null() {
        unsafe {
            let _ = Box::from_raw(db);
        }
    }
}

#[no_mangle]
pub extern "C" fn eghactdb_query(
    db: *mut EghactDB,
    query: *const std::os::raw::c_char,
) -> *mut std::os::raw::c_char {
    unsafe {
        let db = &*db;
        let query = std::ffi::CStr::from_ptr(query).to_str().unwrap();
        
        match db.query(query) {
            Ok(result) => {
                let json = serde_json::to_string(&result).unwrap();
                std::ffi::CString::new(json).unwrap().into_raw()
            }
            Err(_) => std::ptr::null_mut(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_database_creation() {
        let temp_dir = tempfile::tempdir().unwrap();
        let db = EghactDB::open(temp_dir.path()).unwrap();
        
        let stats = db.stats();
        assert_eq!(stats.collections, 0);
        assert_eq!(stats.total_documents, 0);
    }
    
    #[test]
    fn test_eg_parsing() {
        let eg_content = r#"---
title: Test Document
tags: [test, example]
---

# Test Content

This is the body of the document."#;
        
        let doc = parse_eg_to_document(eg_content).unwrap();
        assert_eq!(doc.fields.get("title").unwrap(), &Value::String("Test Document".to_string()));
    }
}
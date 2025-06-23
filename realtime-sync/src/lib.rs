//! Eghact Real-Time Database Sync Engine
//! 
//! Provides bidirectional real-time synchronization between client and server
//! with automatic conflict resolution using CRDTs (Conflict-free Replicated Data Types)

#![warn(clippy::all, clippy::pedantic)]
#![allow(clippy::module_name_repetitions)]

use std::sync::Arc;
use std::collections::{HashMap, HashSet};
use std::time::{Duration, SystemTime};

use tokio::sync::{RwLock, mpsc, broadcast, watch};
use serde::{Serialize, Deserialize};
use blake3::Hash;
use crdt::{Orswot, VClock, CmRDT};

pub mod network;
pub mod storage;
pub mod conflict;
pub mod offline;
pub mod security;

/// The main sync engine
pub struct SyncEngine {
    /// Local node ID
    node_id: NodeId,
    
    /// Local database
    local_db: Arc<storage::LocalDatabase>,
    
    /// CRDT store for conflict-free updates
    crdt_store: Arc<RwLock<CrdtStore>>,
    
    /// Network layer
    network: Arc<network::NetworkLayer>,
    
    /// Offline queue for pending operations
    offline_queue: Arc<offline::OfflineQueue>,
    
    /// Active subscriptions
    subscriptions: Arc<RwLock<HashMap<SubscriptionId, Subscription>>>,
    
    /// Sync status broadcaster
    status_tx: broadcast::Sender<SyncStatus>,
    
    /// Conflict resolver
    conflict_resolver: Arc<conflict::ConflictResolver>,
    
    /// Security layer
    security: Arc<security::SecurityLayer>,
}

/// Node identifier
#[derive(Debug, Clone, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct NodeId(pub [u8; 32]);

/// Subscription identifier
#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub struct SubscriptionId(pub uuid::Uuid);

/// Document identifier
#[derive(Debug, Clone, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct DocumentId(pub String);

/// Sync status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SyncStatus {
    Connected { peers: usize },
    Disconnected,
    Syncing { progress: f32 },
    Conflict { doc_id: DocumentId },
    Error { message: String },
}

/// A document in the database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: DocumentId,
    pub data: serde_json::Value,
    pub version: VClock<NodeId>,
    pub checksum: Hash,
    pub metadata: DocumentMetadata,
}

/// Document metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentMetadata {
    pub created_at: SystemTime,
    pub updated_at: SystemTime,
    pub created_by: NodeId,
    pub collection: String,
    pub tags: HashSet<String>,
    pub access_control: AccessControl,
}

/// Access control for documents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessControl {
    pub owner: NodeId,
    pub read_access: HashSet<NodeId>,
    pub write_access: HashSet<NodeId>,
    pub public_read: bool,
}

/// CRDT store for different data types
struct CrdtStore {
    /// Set CRDTs for collections
    sets: HashMap<String, Orswot<String, NodeId>>,
    
    /// Text CRDTs for collaborative editing
    texts: HashMap<DocumentId, diamond_types::list::ListCrdt>,
    
    /// Counter CRDTs for numeric values
    counters: HashMap<String, crdt::GCounter<NodeId>>,
    
    /// Map CRDTs for key-value data
    maps: HashMap<String, crdt::Map<String, serde_json::Value, NodeId>>,
}

/// Subscription to document changes
struct Subscription {
    id: SubscriptionId,
    query: SubscriptionQuery,
    callback: Box<dyn Fn(DocumentChange) + Send + Sync>,
    created_at: SystemTime,
}

/// Query for subscriptions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionQuery {
    pub collection: Option<String>,
    pub document_ids: Option<Vec<DocumentId>>,
    pub tags: Option<Vec<String>>,
    pub filter: Option<serde_json::Value>,
}

/// Document change event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DocumentChange {
    Created(Document),
    Updated { old: Document, new: Document },
    Deleted(DocumentId),
    Conflict { doc_id: DocumentId, versions: Vec<Document> },
}

/// Sync operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SyncOperation {
    Insert { doc: Document },
    Update { doc_id: DocumentId, patches: Vec<Patch> },
    Delete { doc_id: DocumentId, version: VClock<NodeId> },
    Merge { doc_id: DocumentId, crdt_op: CrdtOperation },
}

/// Patch for partial updates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Patch {
    pub path: String,
    pub operation: PatchOperation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PatchOperation {
    Set(serde_json::Value),
    Unset,
    Increment(f64),
    Append(serde_json::Value),
    Remove { index: usize },
}

/// CRDT operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CrdtOperation {
    SetAdd { element: String },
    SetRemove { element: String },
    CounterIncrement { amount: u64 },
    TextOperation { op: Vec<u8> }, // Serialized text CRDT op
    MapUpdate { key: String, value: serde_json::Value },
}

impl SyncEngine {
    /// Create a new sync engine
    pub async fn new(config: SyncConfig) -> Result<Self, SyncError> {
        let node_id = NodeId(rand::random());
        
        let local_db = Arc::new(storage::LocalDatabase::open(&config.db_path)?);
        let crdt_store = Arc::new(RwLock::new(CrdtStore::new()));
        let network = Arc::new(network::NetworkLayer::new(node_id.clone(), config.network).await?);
        let offline_queue = Arc::new(offline::OfflineQueue::new(&config.db_path)?);
        let subscriptions = Arc::new(RwLock::new(HashMap::new()));
        let (status_tx, _) = broadcast::channel(1024);
        let conflict_resolver = Arc::new(conflict::ConflictResolver::new(config.conflict_strategy));
        let security = Arc::new(security::SecurityLayer::new(config.security)?);
        
        let engine = Self {
            node_id,
            local_db,
            crdt_store,
            network,
            offline_queue,
            subscriptions,
            status_tx,
            conflict_resolver,
            security,
        };
        
        // Start background tasks
        engine.start_sync_loop();
        engine.start_offline_processor();
        engine.start_garbage_collector();
        
        Ok(engine)
    }
    
    /// Insert or update a document
    pub async fn upsert(&self, doc: Document) -> Result<(), SyncError> {
        // Validate access
        self.security.check_write_access(&doc).await?;
        
        // Update version clock
        let mut doc = doc;
        doc.version.apply(self.node_id.clone(), doc.version.get(&self.node_id) + 1);
        doc.updated_at = SystemTime::now();
        
        // Calculate checksum
        doc.checksum = self.calculate_checksum(&doc);
        
        // Store locally
        self.local_db.insert(&doc).await?;
        
        // Create sync operation
        let op = SyncOperation::Insert { doc: doc.clone() };
        
        // Queue for sync
        if self.network.is_connected().await {
            self.network.broadcast(op).await?;
        } else {
            self.offline_queue.enqueue(op).await?;
        }
        
        // Notify subscribers
        self.notify_subscribers(DocumentChange::Created(doc)).await;
        
        Ok(())
    }
    
    /// Delete a document
    pub async fn delete(&self, doc_id: &DocumentId) -> Result<(), SyncError> {
        // Get current document
        let doc = self.local_db.get(doc_id).await?
            .ok_or(SyncError::DocumentNotFound)?;
        
        // Validate access
        self.security.check_write_access(&doc).await?;
        
        // Create tombstone
        let version = doc.version.clone();
        self.local_db.delete(doc_id).await?;
        
        // Create sync operation
        let op = SyncOperation::Delete { 
            doc_id: doc_id.clone(), 
            version 
        };
        
        // Queue for sync
        if self.network.is_connected().await {
            self.network.broadcast(op).await?;
        } else {
            self.offline_queue.enqueue(op).await?;
        }
        
        // Notify subscribers
        self.notify_subscribers(DocumentChange::Deleted(doc_id.clone())).await;
        
        Ok(())
    }
    
    /// Query documents
    pub async fn query(&self, query: Query) -> Result<Vec<Document>, SyncError> {
        let docs = self.local_db.query(query).await?;
        
        // Filter by access control
        let mut filtered = Vec::new();
        for doc in docs {
            if self.security.check_read_access(&doc).await.is_ok() {
                filtered.push(doc);
            }
        }
        
        Ok(filtered)
    }
    
    /// Subscribe to document changes
    pub async fn subscribe<F>(
        &self, 
        query: SubscriptionQuery,
        callback: F
    ) -> Result<SubscriptionId, SyncError>
    where
        F: Fn(DocumentChange) + Send + Sync + 'static
    {
        let id = SubscriptionId(uuid::Uuid::new_v4());
        
        let subscription = Subscription {
            id: id.clone(),
            query,
            callback: Box::new(callback),
            created_at: SystemTime::now(),
        };
        
        self.subscriptions.write().await.insert(id.clone(), subscription);
        
        Ok(id)
    }
    
    /// Unsubscribe from changes
    pub async fn unsubscribe(&self, id: &SubscriptionId) -> Result<(), SyncError> {
        self.subscriptions.write().await.remove(id);
        Ok(())
    }
    
    /// Get sync status
    pub fn status(&self) -> broadcast::Receiver<SyncStatus> {
        self.status_tx.subscribe()
    }
    
    /// Force sync with peers
    pub async fn sync(&self) -> Result<(), SyncError> {
        let peers = self.network.get_peers().await;
        
        for peer in peers {
            self.sync_with_peer(peer).await?;
        }
        
        Ok(())
    }
    
    /// Handle incoming sync operation
    async fn handle_sync_operation(&self, op: SyncOperation, from: NodeId) -> Result<(), SyncError> {
        match op {
            SyncOperation::Insert { doc } => {
                self.handle_insert(doc, from).await?;
            }
            SyncOperation::Update { doc_id, patches } => {
                self.handle_update(doc_id, patches, from).await?;
            }
            SyncOperation::Delete { doc_id, version } => {
                self.handle_delete(doc_id, version, from).await?;
            }
            SyncOperation::Merge { doc_id, crdt_op } => {
                self.handle_crdt_operation(doc_id, crdt_op, from).await?;
            }
        }
        
        Ok(())
    }
    
    /// Handle document insert
    async fn handle_insert(&self, remote_doc: Document, from: NodeId) -> Result<(), SyncError> {
        // Check if document exists locally
        if let Some(local_doc) = self.local_db.get(&remote_doc.id).await? {
            // Conflict detected
            self.handle_conflict(local_doc, remote_doc, from).await?;
        } else {
            // New document
            self.local_db.insert(&remote_doc).await?;
            self.notify_subscribers(DocumentChange::Created(remote_doc)).await;
        }
        
        Ok(())
    }
    
    /// Handle conflict between local and remote documents
    async fn handle_conflict(
        &self, 
        local: Document, 
        remote: Document, 
        from: NodeId
    ) -> Result<(), SyncError> {
        // Use version vectors to determine causality
        match local.version.partial_cmp(&remote.version) {
            Some(std::cmp::Ordering::Less) => {
                // Remote is newer, accept it
                self.local_db.insert(&remote).await?;
                self.notify_subscribers(DocumentChange::Updated { 
                    old: local, 
                    new: remote 
                }).await;
            }
            Some(std::cmp::Ordering::Greater) => {
                // Local is newer, keep it
                // Send our version to the peer
                let op = SyncOperation::Insert { doc: local };
                self.network.send_to(from, op).await?;
            }
            _ => {
                // Concurrent updates - resolve conflict
                let resolved = self.conflict_resolver.resolve(&local, &remote).await?;
                
                // Update local
                self.local_db.insert(&resolved).await?;
                
                // Notify about conflict
                self.notify_subscribers(DocumentChange::Conflict {
                    doc_id: local.id.clone(),
                    versions: vec![local, remote],
                }).await;
                
                // Broadcast resolved version
                let op = SyncOperation::Insert { doc: resolved };
                self.network.broadcast(op).await?;
            }
        }
        
        Ok(())
    }
    
    /// Calculate document checksum
    fn calculate_checksum(&self, doc: &Document) -> Hash {
        let mut hasher = blake3::Hasher::new();
        hasher.update(doc.id.0.as_bytes());
        hasher.update(&bincode::serialize(&doc.data).unwrap());
        hasher.update(&bincode::serialize(&doc.version).unwrap());
        hasher.finalize()
    }
    
    /// Notify subscribers of changes
    async fn notify_subscribers(&self, change: DocumentChange) {
        let subs = self.subscriptions.read().await;
        
        for (_, sub) in subs.iter() {
            if self.matches_query(&change, &sub.query) {
                (sub.callback)(change.clone());
            }
        }
    }
    
    /// Check if change matches subscription query
    fn matches_query(&self, change: &DocumentChange, query: &SubscriptionQuery) -> bool {
        let doc = match change {
            DocumentChange::Created(doc) => doc,
            DocumentChange::Updated { new, .. } => new,
            DocumentChange::Deleted(id) => return query.document_ids
                .as_ref()
                .map(|ids| ids.contains(id))
                .unwrap_or(true),
            DocumentChange::Conflict { doc_id, .. } => return query.document_ids
                .as_ref()
                .map(|ids| ids.contains(doc_id))
                .unwrap_or(true),
        };
        
        // Check collection
        if let Some(collection) = &query.collection {
            if &doc.metadata.collection != collection {
                return false;
            }
        }
        
        // Check document IDs
        if let Some(ids) = &query.document_ids {
            if !ids.contains(&doc.id) {
                return false;
            }
        }
        
        // Check tags
        if let Some(tags) = &query.tags {
            if !tags.iter().any(|t| doc.metadata.tags.contains(t)) {
                return false;
            }
        }
        
        // TODO: Check custom filter
        
        true
    }
    
    /// Start background sync loop
    fn start_sync_loop(&self) {
        let engine = self.clone();
        
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(5));
            
            loop {
                interval.tick().await;
                
                if let Err(e) = engine.sync().await {
                    tracing::error!("Sync error: {}", e);
                }
            }
        });
    }
    
    /// Start offline queue processor
    fn start_offline_processor(&self) {
        let engine = self.clone();
        
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(1));
            
            loop {
                interval.tick().await;
                
                if engine.network.is_connected().await {
                    if let Err(e) = engine.process_offline_queue().await {
                        tracing::error!("Offline queue error: {}", e);
                    }
                }
            }
        });
    }
    
    /// Process offline queue
    async fn process_offline_queue(&self) -> Result<(), SyncError> {
        while let Some(op) = self.offline_queue.dequeue().await? {
            self.network.broadcast(op).await?;
        }
        Ok(())
    }
    
    /// Start garbage collector
    fn start_garbage_collector(&self) {
        let engine = self.clone();
        
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(3600)); // 1 hour
            
            loop {
                interval.tick().await;
                
                if let Err(e) = engine.garbage_collect().await {
                    tracing::error!("Garbage collection error: {}", e);
                }
            }
        });
    }
    
    /// Garbage collect old data
    async fn garbage_collect(&self) -> Result<(), SyncError> {
        // Remove old tombstones
        self.local_db.vacuum().await?;
        
        // Clean up old subscriptions
        let mut subs = self.subscriptions.write().await;
        let now = SystemTime::now();
        let timeout = Duration::from_secs(86400); // 24 hours
        
        subs.retain(|_, sub| {
            now.duration_since(sub.created_at)
                .map(|d| d < timeout)
                .unwrap_or(true)
        });
        
        Ok(())
    }
    
    /// Sync with specific peer
    async fn sync_with_peer(&self, peer: NodeId) -> Result<(), SyncError> {
        // Get peer's version vector
        let peer_vector = self.network.get_version_vector(peer.clone()).await?;
        
        // Find documents that peer doesn't have
        let to_send = self.local_db.get_updates_since(&peer_vector).await?;
        
        // Send updates
        for doc in to_send {
            let op = SyncOperation::Insert { doc };
            self.network.send_to(peer.clone(), op).await?;
        }
        
        Ok(())
    }
}

impl Clone for SyncEngine {
    fn clone(&self) -> Self {
        Self {
            node_id: self.node_id.clone(),
            local_db: Arc::clone(&self.local_db),
            crdt_store: Arc::clone(&self.crdt_store),
            network: Arc::clone(&self.network),
            offline_queue: Arc::clone(&self.offline_queue),
            subscriptions: Arc::clone(&self.subscriptions),
            status_tx: self.status_tx.clone(),
            conflict_resolver: Arc::clone(&self.conflict_resolver),
            security: Arc::clone(&self.security),
        }
    }
}

impl CrdtStore {
    fn new() -> Self {
        Self {
            sets: HashMap::new(),
            texts: HashMap::new(),
            counters: HashMap::new(),
            maps: HashMap::new(),
        }
    }
}

/// Sync configuration
#[derive(Debug, Clone)]
pub struct SyncConfig {
    pub db_path: std::path::PathBuf,
    pub network: network::NetworkConfig,
    pub conflict_strategy: conflict::ConflictStrategy,
    pub security: security::SecurityConfig,
}

/// Query for documents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Query {
    pub collection: Option<String>,
    pub filter: Option<serde_json::Value>,
    pub sort: Option<Vec<SortField>>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortField {
    pub field: String,
    pub ascending: bool,
}

/// Sync errors
#[derive(Debug, thiserror::Error)]
pub enum SyncError {
    #[error("Document not found")]
    DocumentNotFound,
    
    #[error("Access denied")]
    AccessDenied,
    
    #[error("Network error: {0}")]
    NetworkError(String),
    
    #[error("Storage error: {0}")]
    StorageError(String),
    
    #[error("Conflict resolution failed: {0}")]
    ConflictError(String),
    
    #[error("Security error: {0}")]
    SecurityError(String),
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_sync_engine() {
        let config = SyncConfig {
            db_path: tempfile::tempdir().unwrap().into_path(),
            network: network::NetworkConfig::default(),
            conflict_strategy: conflict::ConflictStrategy::LastWriteWins,
            security: security::SecurityConfig::default(),
        };
        
        let engine = SyncEngine::new(config).await.unwrap();
        
        // Test document insertion
        let doc = Document {
            id: DocumentId("test-doc".to_string()),
            data: serde_json::json!({ "title": "Test" }),
            version: VClock::new(),
            checksum: blake3::hash(b"test"),
            metadata: DocumentMetadata {
                created_at: SystemTime::now(),
                updated_at: SystemTime::now(),
                created_by: engine.node_id.clone(),
                collection: "test".to_string(),
                tags: HashSet::new(),
                access_control: AccessControl {
                    owner: engine.node_id.clone(),
                    read_access: HashSet::new(),
                    write_access: HashSet::new(),
                    public_read: true,
                },
            },
        };
        
        engine.upsert(doc).await.unwrap();
    }
}
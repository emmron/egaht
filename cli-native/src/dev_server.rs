use anyhow::Result;
use axum::{
    extract::State,
    response::{Html, IntoResponse, Response},
    routing::{get, get_service},
    Router,
};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::services::ServeDir;
use tower_http::cors::CorsLayer;
use tower_http::compression::CompressionLayer;

/// Development server for Eghact
pub struct DevServer {
    root: PathBuf,
    addr: SocketAddr,
    router: Router,
}

struct ServerState {
    root: PathBuf,
    websocket_clients: Arc<dashmap::DashMap<String, tokio::sync::mpsc::Sender<String>>>,
}

impl DevServer {
    pub fn new(root: PathBuf, addr: SocketAddr) -> Result<Self> {
        let state = Arc::new(ServerState {
            root: root.clone(),
            websocket_clients: Arc::new(dashmap::DashMap::new()),
        });
        
        // Build router
        let router = Router::new()
            // API routes
            .route("/api/health", get(health_check))
            .route("/ws", get(websocket_handler))
            
            // SPA fallback
            .fallback(get_service(ServeDir::new(&root)).handle_error(handle_error))
            
            // Middleware
            .layer(CorsLayer::permissive())
            .layer(CompressionLayer::new())
            .with_state(state);
        
        Ok(Self {
            root,
            addr,
            router,
        })
    }
    
    pub async fn start(self) -> Result<()> {
        let listener = TcpListener::bind(self.addr).await?;
        
        // Start file watcher in background
        let watcher_root = self.root.clone();
        tokio::spawn(async move {
            if let Err(e) = start_file_watcher(watcher_root).await {
                eprintln!("File watcher error: {}", e);
            }
        });
        
        // Start server
        axum::serve(listener, self.router).await?;
        
        Ok(())
    }
}

async fn health_check() -> impl IntoResponse {
    axum::Json(serde_json::json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION")
    }))
}

async fn websocket_handler(
    ws: axum::extract::WebSocketUpgrade,
    State(state): State<Arc<ServerState>>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(
    mut socket: axum::extract::ws::WebSocket,
    state: Arc<ServerState>,
) {
    let (tx, mut rx) = tokio::sync::mpsc::channel(100);
    let client_id = uuid::Uuid::new_v4().to_string();
    
    // Store client
    state.websocket_clients.insert(client_id.clone(), tx);
    
    // Handle messages
    loop {
        tokio::select! {
            Some(msg) = socket.recv() => {
                match msg {
                    Ok(axum::extract::ws::Message::Text(text)) => {
                        // Handle incoming messages
                        if text == "ping" {
                            let _ = socket.send(axum::extract::ws::Message::Text("pong".to_string())).await;
                        }
                    }
                    Ok(axum::extract::ws::Message::Close(_)) => break,
                    _ => {}
                }
            }
            Some(msg) = rx.recv() => {
                // Send HMR updates
                let _ = socket.send(axum::extract::ws::Message::Text(msg)).await;
            }
        }
    }
    
    // Remove client on disconnect
    state.websocket_clients.remove(&client_id);
}

async fn handle_error(error: std::io::Error) -> impl IntoResponse {
    (
        axum::http::StatusCode::INTERNAL_SERVER_ERROR,
        format!("Unhandled internal error: {}", error),
    )
}

async fn start_file_watcher(root: PathBuf) -> Result<()> {
    use notify::{RecursiveMode, Watcher};
    use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
    use std::time::Duration;
    
    let (tx, mut rx) = tokio::sync::mpsc::channel(100);
    
    let mut debouncer = new_debouncer(Duration::from_millis(100), move |res| {
        if let Ok(events) = res {
            for event in events {
                let _ = tx.blocking_send(event);
            }
        }
    })?;
    
    debouncer.watcher().watch(&root, RecursiveMode::Recursive)?;
    
    while let Some(event) = rx.recv().await {
        match event.kind {
            DebouncedEventKind::Any => {
                // Trigger HMR update
                println!("File changed: {:?}", event.path);
            }
        }
    }
    
    Ok(())
}
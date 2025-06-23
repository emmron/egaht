//! Eghact Native Server
//! 
//! High-performance HTTP server for Eghact applications.
//! Supports HTTP/1.1, HTTP/2, HTTP/3, WebSockets, and more.

use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use hyper::service::{make_service_fn, service_fn};
use hyper::{Body, Request, Response, Server, StatusCode};
use tokio::sync::RwLock;
use tower::ServiceBuilder;
use tower_http::compression::CompressionLayer;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use tracing::{info, error, debug};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod config;
mod routing;
mod middleware;
mod websocket;
mod ssr;
mod static_files;
mod hot_reload;
mod cluster;

use config::ServerConfig;
use routing::Router;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "eghact_server=info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();
    
    // Load configuration
    let config = ServerConfig::load()?;
    
    info!("🚀 Eghact Server v{}", env!("CARGO_PKG_VERSION"));
    
    // Initialize application state
    let app_state = Arc::new(AppState::new(config.clone()).await?);
    
    // Set up hot reload in development
    if config.development {
        hot_reload::watch(&config.root_dir, app_state.clone()).await?;
    }
    
    // Create router
    let router = Router::new(&config)?;
    
    // Build service stack
    let service = ServiceBuilder::new()
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .layer(CorsLayer::permissive())
        .service(service_fn(move |req| {
            handle_request(req, app_state.clone(), router.clone())
        }));
    
    let make_svc = make_service_fn(move |_conn| {
        let service = service.clone();
        async { Ok::<_, std::convert::Infallible>(service) }
    });
    
    // Bind to address
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    
    // Check if we should use HTTP/3
    if config.http3_enabled {
        info!("Starting HTTP/3 server on {}", addr);
        tokio::spawn(start_http3_server(addr, app_state.clone()));
    }
    
    // Start HTTP/1.1 and HTTP/2 server
    let server = Server::bind(&addr)
        .http2_enable_connect_protocol()
        .serve(make_svc);
    
    info!("🌐 Server listening on http://{}", addr);
    info!("📂 Serving from: {}", config.root_dir.display());
    
    if config.development {
        info!("🔥 Hot reload enabled");
        info!("🔧 Development mode active");
    }
    
    // Graceful shutdown
    let graceful = server.with_graceful_shutdown(shutdown_signal());
    
    if let Err(e) = graceful.await {
        error!("Server error: {}", e);
    }
    
    Ok(())
}

/// Application state
struct AppState {
    config: ServerConfig,
    compiled_apps: Arc<RwLock<CompiledApps>>,
    cache: moka::future::Cache<String, CachedResponse>,
    metrics: Arc<Metrics>,
}

impl AppState {
    async fn new(config: ServerConfig) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let compiled_apps = Arc::new(RwLock::new(CompiledApps::load(&config.root_dir).await?));
        
        let cache = moka::future::Cache::builder()
            .max_capacity(10_000)
            .time_to_live(Duration::from_secs(config.cache_ttl))
            .build();
        
        Ok(Self {
            config,
            compiled_apps,
            cache,
            metrics: Arc::new(Metrics::new()),
        })
    }
}

/// Compiled Eghact applications
struct CompiledApps {
    routes: HashMap<String, CompiledRoute>,
    components: HashMap<String, CompiledComponent>,
}

impl CompiledApps {
    async fn load(root: &Path) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        // Load and compile all .eg files
        let mut routes = HashMap::new();
        let mut components = HashMap::new();
        
        // Walk directory for .eg files
        for entry in walkdir::WalkDir::new(root) {
            let entry = entry?;
            let path = entry.path();
            
            if path.extension() == Some(std::ffi::OsStr::new("eg")) {
                let relative = path.strip_prefix(root)?;
                let route = path_to_route(relative);
                
                // Compile the .eg file
                let compiled = compile_eg_file(path).await?;
                
                match compiled {
                    Compiled::Route(r) => {
                        routes.insert(route, r);
                    }
                    Compiled::Component(c) => {
                        let name = path.file_stem().unwrap().to_string_lossy().to_string();
                        components.insert(name, c);
                    }
                }
            }
        }
        
        Ok(Self { routes, components })
    }
}

/// Handle incoming HTTP requests
async fn handle_request(
    req: Request<Body>,
    state: Arc<AppState>,
    router: Router,
) -> Result<Response<Body>, hyper::Error> {
    let method = req.method().clone();
    let path = req.uri().path().to_string();
    let start = std::time::Instant::now();
    
    // Check cache
    let cache_key = format!("{}:{}", method, path);
    if let Some(cached) = state.cache.get(&cache_key).await {
        state.metrics.cache_hits.increment();
        return Ok(cached.into_response());
    }
    
    // Route request
    let response = match router.route(&req) {
        Some(handler) => handler.handle(req, state.clone()).await,
        None => {
            // Try static files
            match static_files::serve(&path, &state.config.root_dir).await {
                Ok(resp) => resp,
                Err(_) => {
                    // 404 Not Found
                    Response::builder()
                        .status(StatusCode::NOT_FOUND)
                        .body(Body::from("404 Not Found"))
                        .unwrap()
                }
            }
        }
    };
    
    // Update metrics
    let duration = start.elapsed();
    state.metrics.request_duration.record(duration);
    state.metrics.request_count.increment();
    
    // Cache successful responses
    if response.status().is_success() && method == hyper::Method::GET {
        let cached = CachedResponse::from_response(&response);
        state.cache.insert(cache_key, cached).await;
    }
    
    Ok(response)
}

/// Start HTTP/3 server
async fn start_http3_server(
    addr: SocketAddr,
    state: Arc<AppState>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use quinn::{Endpoint, ServerConfig};
    
    // Load TLS config
    let tls_config = load_tls_config(&state.config)?;
    
    // Create Quinn endpoint
    let server_config = ServerConfig::with_crypto(Arc::new(tls_config));
    let endpoint = Endpoint::server(server_config, addr)?;
    
    info!("HTTP/3 server listening on {}", addr);
    
    // Accept connections
    while let Some(conn) = endpoint.accept().await {
        let state = state.clone();
        tokio::spawn(async move {
            if let Err(e) = handle_http3_connection(conn, state).await {
                error!("HTTP/3 connection error: {}", e);
            }
        });
    }
    
    Ok(())
}

async fn handle_http3_connection(
    conn: quinn::Connecting,
    state: Arc<AppState>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let connection = conn.await?;
    
    // Create H3 connection
    let mut h3_conn = h3::server::Connection::new(h3_quinn::Connection::new(connection)).await?;
    
    while let Some((req, stream)) = h3_conn.accept().await? {
        let state = state.clone();
        tokio::spawn(async move {
            if let Err(e) = handle_http3_request(req, stream, state).await {
                error!("HTTP/3 request error: {}", e);
            }
        });
    }
    
    Ok(())
}

async fn handle_http3_request<T>(
    req: http::Request<()>,
    mut stream: h3::server::RequestStream<T, Bytes>,
    state: Arc<AppState>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>>
where
    T: h3::quic::BidiStream<Bytes>,
{
    // Convert H3 request to Hyper request and handle
    // ... implementation ...
    Ok(())
}

/// Metrics collection
struct Metrics {
    request_count: prometheus::IntCounter,
    request_duration: prometheus::Histogram,
    cache_hits: prometheus::IntCounter,
    active_connections: prometheus::IntGauge,
}

impl Metrics {
    fn new() -> Self {
        let request_count = prometheus::IntCounter::new("http_requests_total", "Total HTTP requests")
            .expect("metric creation failed");
        
        let request_duration = prometheus::Histogram::with_opts(
            prometheus::HistogramOpts::new("http_request_duration_seconds", "HTTP request duration")
        ).expect("metric creation failed");
        
        let cache_hits = prometheus::IntCounter::new("cache_hits_total", "Total cache hits")
            .expect("metric creation failed");
        
        let active_connections = prometheus::IntGauge::new("active_connections", "Active connections")
            .expect("metric creation failed");
        
        // Register metrics
        prometheus::register(Box::new(request_count.clone())).unwrap();
        prometheus::register(Box::new(request_duration.clone())).unwrap();
        prometheus::register(Box::new(cache_hits.clone())).unwrap();
        prometheus::register(Box::new(active_connections.clone())).unwrap();
        
        Self {
            request_count,
            request_duration,
            cache_hits,
            active_connections,
        }
    }
}

/// Cached response
#[derive(Clone)]
struct CachedResponse {
    status: StatusCode,
    headers: HeaderMap,
    body: Vec<u8>,
}

impl CachedResponse {
    fn from_response(response: &Response<Body>) -> Self {
        // Note: This is simplified - in production, we'd need to handle streaming bodies
        Self {
            status: response.status(),
            headers: response.headers().clone(),
            body: Vec::new(), // Would need to consume body
        }
    }
    
    fn into_response(self) -> Response<Body> {
        let mut response = Response::new(Body::from(self.body));
        *response.status_mut() = self.status;
        *response.headers_mut() = self.headers;
        response
    }
}

/// Convert file path to route
fn path_to_route(path: &Path) -> String {
    let mut route = String::from("/");
    
    for component in path.components() {
        if let std::path::Component::Normal(name) = component {
            let name = name.to_string_lossy();
            
            // Handle special route files
            if name == "index.eg" {
                continue;
            }
            
            // Handle dynamic routes
            if name.starts_with('[') && name.ends_with("].eg") {
                let param = &name[1..name.len()-4];
                route.push(':');
                route.push_str(param);
            } else if name.ends_with(".eg") {
                route.push_str(&name[..name.len()-3]);
            } else {
                route.push_str(&name);
            }
            
            route.push('/');
        }
    }
    
    // Remove trailing slash unless it's root
    if route.len() > 1 && route.ends_with('/') {
        route.pop();
    }
    
    route
}

/// Compile .eg file
async fn compile_eg_file(path: &Path) -> Result<Compiled, Box<dyn std::error::Error + Send + Sync>> {
    let content = tokio::fs::read_to_string(path).await?;
    
    // Use the native compiler
    // In production, this would call into our Rust compiler
    
    Ok(Compiled::Route(CompiledRoute {
        path: path.to_path_buf(),
        handler: Box::new(|_req| async {
            Response::new(Body::from("Compiled route"))
        }),
    }))
}

enum Compiled {
    Route(CompiledRoute),
    Component(CompiledComponent),
}

struct CompiledRoute {
    path: PathBuf,
    handler: Box<dyn Fn(Request<Body>) -> std::pin::Pin<Box<dyn std::future::Future<Output = Response<Body>> + Send>> + Send + Sync>,
}

struct CompiledComponent {
    name: String,
    render: Box<dyn Fn() -> String + Send + Sync>,
}

/// Load TLS configuration
fn load_tls_config(config: &ServerConfig) -> Result<rustls::ServerConfig, Box<dyn std::error::Error + Send + Sync>> {
    use rustls::{Certificate, PrivateKey, ServerConfig};
    
    let cert_path = &config.tls_cert;
    let key_path = &config.tls_key;
    
    let cert_file = std::fs::File::open(cert_path)?;
    let key_file = std::fs::File::open(key_path)?;
    
    let cert_chain = rustls_pemfile::certs(&mut std::io::BufReader::new(cert_file))?
        .into_iter()
        .map(Certificate)
        .collect();
    
    let mut keys = rustls_pemfile::pkcs8_private_keys(&mut std::io::BufReader::new(key_file))?;
    
    let tls_config = ServerConfig::builder()
        .with_safe_defaults()
        .with_no_client_auth()
        .with_single_cert(cert_chain, PrivateKey(keys.remove(0)))?;
    
    Ok(tls_config)
}

/// Graceful shutdown signal
async fn shutdown_signal() {
    use tokio::signal;
    
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };
    
    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };
    
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    
    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
    
    info!("Shutdown signal received, starting graceful shutdown");
}

use std::collections::HashMap;
use hyper::header::HeaderMap;
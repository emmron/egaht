/**
 * Dependency Resolver
 * Resolves package dependencies and handles version conflicts
 */

use anyhow::{Result, Context};
use std::collections::{HashMap, HashSet, VecDeque};
use semver::{Version, VersionReq};

use crate::{PackageJson, Registry, Package, PackageCache, Lockfile};

pub struct DependencyResolver<'a> {
    registry: &'a Registry,
    cache: &'a PackageCache,
}

#[derive(Debug)]
pub struct Resolution {
    pub packages: Vec<Package>,
    pub graph: DependencyGraph,
}

#[derive(Debug, Default)]
pub struct DependencyGraph {
    pub nodes: HashMap<String, GraphNode>,
    pub edges: HashMap<String, HashSet<String>>,
}

#[derive(Debug)]
pub struct GraphNode {
    pub name: String,
    pub version: String,
    pub dependencies: HashMap<String, String>,
}

#[derive(Debug)]
pub struct UpdateInfo {
    pub name: String,
    pub current: String,
    pub new: String,
    pub breaking: bool,
}

impl<'a> DependencyResolver<'a> {
    pub fn new(registry: &'a Registry, cache: &'a PackageCache) -> Self {
        Self { registry, cache }
    }
    
    pub async fn resolve_all(
        &self, 
        package_json: &PackageJson,
        lockfile: &Lockfile,
    ) -> Result<Resolution> {
        let mut resolved = HashMap::new();
        let mut graph = DependencyGraph::default();
        let mut queue = VecDeque::new();
        
        // Start with direct dependencies
        for (name, version_spec) in &package_json.dependencies {
            queue.push_back((name.clone(), version_spec.clone(), false));
        }
        
        for (name, version_spec) in &package_json.dev_dependencies {
            queue.push_back((name.clone(), version_spec.clone(), true));
        }
        
        // BFS resolution
        while let Some((name, version_spec, is_dev)) = queue.pop_front() {
            if resolved.contains_key(&name) {
                // Check version compatibility
                let existing = &resolved[&name];
                if !self.is_compatible(&version_spec, &existing.version)? {
                    anyhow::bail!(
                        "Version conflict: {} requires {} but {} is already resolved",
                        name, version_spec, existing.version
                    );
                }
                continue;
            }
            
            // Check lockfile first
            let package = if let Some(locked) = lockfile.get_package(&name) {
                locked.clone()
            } else {
                // Resolve from registry
                self.registry.resolve(&name, &version_spec).await?
            };
            
            // Add to graph
            let node = GraphNode {
                name: name.clone(),
                version: package.version.clone(),
                dependencies: package.dependencies.clone(),
            };
            
            graph.nodes.insert(name.clone(), node);
            
            // Queue dependencies (skip dev deps for transitive)
            if !is_dev {
                for (dep_name, dep_version) in &package.dependencies {
                    queue.push_back((dep_name.clone(), dep_version.clone(), false));
                    
                    // Add edge
                    graph.edges
                        .entry(name.clone())
                        .or_insert_with(HashSet::new)
                        .insert(dep_name.clone());
                }
            }
            
            resolved.insert(name, package);
        }
        
        // Topological sort for installation order
        let packages = self.topological_sort(&resolved, &graph)?;
        
        Ok(Resolution { packages, graph })
    }
    
    pub async fn check_updates(
        &self,
        package_json: &PackageJson,
        lockfile: &Lockfile,
        check_latest: bool,
    ) -> Result<Vec<UpdateInfo>> {
        let mut updates = Vec::new();
        
        // Check all dependencies
        let all_deps: Vec<_> = package_json.dependencies
            .iter()
            .chain(package_json.dev_dependencies.iter())
            .collect();
        
        for (name, version_spec) in all_deps {
            if let Some(locked) = lockfile.get_package(name) {
                let latest = self.registry.get_latest_version(name).await?;
                
                let should_update = if check_latest {
                    &latest != &locked.version
                } else {
                    // Check if newer version satisfies spec
                    let spec = VersionReq::parse(version_spec)?;
                    let current = Version::parse(&locked.version)?;
                    let latest_ver = Version::parse(&latest)?;
                    
                    spec.matches(&latest_ver) && latest_ver > current
                };
                
                if should_update {
                    let current_major = Version::parse(&locked.version)?.major;
                    let new_major = Version::parse(&latest)?.major;
                    
                    updates.push(UpdateInfo {
                        name: name.clone(),
                        current: locked.version.clone(),
                        new: latest,
                        breaking: new_major > current_major,
                    });
                }
            }
        }
        
        Ok(updates)
    }
    
    fn is_compatible(&self, spec: &str, version: &str) -> Result<bool> {
        // Simple compatibility check
        // In production, use full semver range parsing
        
        if spec == "*" || spec == "latest" {
            return Ok(true);
        }
        
        if spec.starts_with('^') {
            // Caret range - compatible with same major version
            let spec_version = Version::parse(&spec[1..])?;
            let version = Version::parse(version)?;
            
            Ok(version.major == spec_version.major && version >= spec_version)
        } else if spec.starts_with('~') {
            // Tilde range - compatible with same minor version
            let spec_version = Version::parse(&spec[1..])?;
            let version = Version::parse(version)?;
            
            Ok(version.major == spec_version.major && 
               version.minor == spec_version.minor &&
               version >= spec_version)
        } else {
            // Exact version
            Ok(spec == version)
        }
    }
    
    fn topological_sort(
        &self,
        packages: &HashMap<String, Package>,
        graph: &DependencyGraph,
    ) -> Result<Vec<Package>> {
        let mut result = Vec::new();
        let mut visited = HashSet::new();
        let mut visiting = HashSet::new();
        
        // DFS post-order traversal
        fn visit(
            name: &str,
            packages: &HashMap<String, Package>,
            graph: &DependencyGraph,
            visited: &mut HashSet<String>,
            visiting: &mut HashSet<String>,
            result: &mut Vec<Package>,
        ) -> Result<()> {
            if visited.contains(name) {
                return Ok(());
            }
            
            if visiting.contains(name) {
                anyhow::bail!("Circular dependency detected involving {}", name);
            }
            
            visiting.insert(name.to_string());
            
            // Visit dependencies first
            if let Some(deps) = graph.edges.get(name) {
                for dep in deps {
                    visit(dep, packages, graph, visited, visiting, result)?;
                }
            }
            
            visiting.remove(name);
            visited.insert(name.to_string());
            
            if let Some(pkg) = packages.get(name) {
                result.push(pkg.clone());
            }
            
            Ok(())
        }
        
        // Visit all packages
        for name in packages.keys() {
            visit(name, packages, graph, &mut visited, &mut visiting, &mut result)?;
        }
        
        Ok(result)
    }
}

impl Resolution {
    pub fn to_lockfile(&self) -> Lockfile {
        let mut lockfile = Lockfile::default();
        
        for package in &self.packages {
            lockfile.add_package(&package.name, package);
        }
        
        lockfile
    }
}
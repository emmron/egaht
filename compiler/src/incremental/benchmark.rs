use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use std::collections::HashMap;
use serde::{Deserialize, Serialize};

use super::compiler::{IncrementalCompiler, CompilerConfig};

/// Benchmark suite for incremental compilation performance
pub struct CompilationBenchmark {
    /// Benchmark configuration
    config: BenchmarkConfig,
    /// Test project path
    test_project_path: PathBuf,
    /// Benchmark results
    results: Vec<BenchmarkResult>,
}

/// Configuration for benchmark tests
#[derive(Debug, Clone)]
pub struct BenchmarkConfig {
    /// Number of test components to generate
    pub component_count: usize,
    /// Maximum nesting depth for components
    pub max_nesting_depth: usize,
    /// Number of dependencies per component
    pub dependencies_per_component: usize,
    /// Number of benchmark iterations
    pub iterations: usize,
    /// Target build time threshold (ms)
    pub target_build_time_ms: u64,
    /// Target incremental rebuild time threshold (ms)
    pub target_incremental_time_ms: u64,
}

impl Default for BenchmarkConfig {
    fn default() -> Self {
        Self {
            component_count: 500,
            max_nesting_depth: 10,
            dependencies_per_component: 5,
            iterations: 5,
            target_build_time_ms: 5000,  // 5 seconds for full build
            target_incremental_time_ms: 100,  // 100ms for incremental
        }
    }
}

/// Result of a single benchmark run
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResult {
    /// Test name
    pub test_name: String,
    /// Full build time in milliseconds
    pub full_build_time_ms: u64,
    /// Incremental build time in milliseconds
    pub incremental_build_time_ms: u64,
    /// Memory usage during compilation (MB)
    pub memory_usage_mb: f64,
    /// Number of files compiled
    pub files_compiled: u64,
    /// Number of files cached
    pub files_cached: u64,
    /// Cache hit rate percentage
    pub cache_hit_rate: f64,
    /// Bundle size in KB
    pub bundle_size_kb: f64,
    /// Timestamp of benchmark
    pub timestamp: u64,
    /// Git commit hash if available
    pub commit_hash: Option<String>,
}

/// Comprehensive benchmark report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkReport {
    /// Individual benchmark results
    pub results: Vec<BenchmarkResult>,
    /// Average metrics across all runs
    pub averages: BenchmarkAverages,
    /// Performance regression analysis
    pub regressions: Vec<PerformanceRegression>,
    /// Benchmark configuration used
    pub config: BenchmarkConfigSnapshot,
    /// Total benchmark duration
    pub total_duration_ms: u64,
}

/// Average benchmark metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkAverages {
    pub avg_full_build_ms: f64,
    pub avg_incremental_ms: f64,
    pub avg_memory_mb: f64,
    pub avg_cache_hit_rate: f64,
    pub avg_bundle_size_kb: f64,
}

/// Performance regression detected in benchmarks
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceRegression {
    pub metric: String,
    pub current_value: f64,
    pub baseline_value: f64,
    pub regression_percent: f64,
    pub severity: RegressionSeverity,
}

/// Severity level of performance regression
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RegressionSeverity {
    Minor,   // < 10% regression
    Major,   // 10-25% regression
    Critical, // > 25% regression
}

/// Snapshot of benchmark configuration for historical tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkConfigSnapshot {
    pub component_count: usize,
    pub max_nesting_depth: usize,
    pub dependencies_per_component: usize,
    pub target_build_time_ms: u64,
    pub target_incremental_time_ms: u64,
}

impl CompilationBenchmark {
    /// Create a new benchmark suite
    pub fn new<P: AsRef<Path>>(test_project_path: P, config: BenchmarkConfig) -> Self {
        Self {
            config,
            test_project_path: test_project_path.as_ref().to_path_buf(),
            results: Vec::new(),
        }
    }

    /// Run the complete benchmark suite
    pub fn run_benchmarks(&mut self) -> Result<BenchmarkReport, Box<dyn std::error::Error>> {
        let start_time = Instant::now();
        
        println!("🚀 Starting Eghact compilation benchmark suite...");
        println!("📊 Configuration: {} components, {} iterations", 
            self.config.component_count, self.config.iterations);

        // Generate test project
        self.generate_test_project()?;

        // Run benchmark iterations
        for iteration in 1..=self.config.iterations {
            println!("🔄 Running benchmark iteration {}/{}", iteration, self.config.iterations);
            
            let result = self.run_single_benchmark(iteration)?;
            self.results.push(result);
        }

        let total_duration = start_time.elapsed().as_millis() as u64;
        let report = self.generate_report(total_duration)?;

        println!("✅ Benchmark completed in {}ms", total_duration);
        self.print_summary(&report);

        Ok(report)
    }

    /// Generate a large-scale test project for benchmarking
    fn generate_test_project(&self) -> Result<(), Box<dyn std::error::Error>> {
        let src_dir = self.test_project_path.join("src");
        let components_dir = src_dir.join("components");
        
        // Clean and create directories
        if self.test_project_path.exists() {
            fs::remove_dir_all(&self.test_project_path)?;
        }
        fs::create_dir_all(&components_dir)?;

        println!("📝 Generating {} test components...", self.config.component_count);

        // Generate components with realistic dependencies
        for i in 0..self.config.component_count {
            let component_name = format!("Component{:04}", i);
            let file_path = components_dir.join(format!("{}.egh", component_name));
            
            let component_content = self.generate_component_content(&component_name, i)?;
            fs::write(&file_path, component_content)?;
        }

        // Generate main app file
        let app_content = self.generate_app_component()?;
        fs::write(src_dir.join("App.egh"), app_content)?;

        // Generate package.json
        let package_json = serde_json::json!({
            "name": "eghact-benchmark",
            "version": "1.0.0",
            "private": true,
            "dependencies": {
                "@eghact/core": "*"
            }
        });
        fs::write(self.test_project_path.join("package.json"), serde_json::to_string_pretty(&package_json)?)?;

        println!("✅ Test project generated with {} components", self.config.component_count);
        Ok(())
    }

    /// Generate content for a single component
    fn generate_component_content(&self, component_name: &str, index: usize) -> Result<String, Box<dyn std::error::Error>> {
        let mut imports = Vec::new();
        let mut template_parts = Vec::new();
        let mut reactive_vars = Vec::new();

        // Generate realistic dependencies
        let dep_count = std::cmp::min(self.config.dependencies_per_component, index);
        for i in 0..dep_count {
            let dep_index = (index + i * 17) % self.config.component_count; // Pseudo-random distribution
            if dep_index != index {
                let dep_name = format!("Component{:04}", dep_index);
                imports.push(format!("import {} from './components/{}.egh';", dep_name, dep_name));
                template_parts.push(format!("    <{} prop{i}={{data{i}}} />", dep_name, i = i));
            }
        }

        // Generate reactive state
        for i in 0..3 {
            reactive_vars.push(format!("  let data{} = 'value{}';", i, i));
            reactive_vars.push(format!("  let count{} = {};", i, i * 10));
        }

        // Generate template with realistic structure
        let template = format!(
            r#"<div class="component-{}">
  <h2>{{title}}</h2>
  <div class="content">
    <p>This is component {} with {{count0}} items</p>
    <button @click="{{() => count0++}}">Increment</button>
    {{#if showDetails}}
      <div class="details">
        <span>Data: {{data0}}</span>
        <span>Count: {{count1}}</span>
      </div>
    {{/if}}
    {{#each items as item}}
      <div class="item-{{item.id}}">{{item.name}}</div>
    {{/each}}
  </div>
  <div class="children">
{}
  </div>
</div>"#,
            index,
            index,
            template_parts.join("\n")
        );

        // Generate styles
        let styles = format!(
            r#".component-{} {{
  padding: 16px;
  margin: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #f9f9f9;
}}

.component-{} h2 {{
  color: #333;
  font-size: 1.2em;
  margin-bottom: 8px;
}}

.component-{} .content {{
  display: flex;
  flex-direction: column;
  gap: 8px;
}}

.component-{} button {{
  padding: 4px 8px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 2px;
  cursor: pointer;
}}

.component-{} .children {{
  margin-top: 16px;
  padding: 8px;
  background: #fff;
  border: 1px solid #eee;
}}"#,
            index, index, index, index, index
        );

        let content = format!(
            r#"{}

<template>
{}
</template>

<script>
{}
  let title = '{}';
  let showDetails = false;
  let items = [
    {{ id: 1, name: 'Item 1' }},
    {{ id: 2, name: 'Item 2' }},
    {{ id: 3, name: 'Item 3' }}
  ];

  // Reactive statements
  $: displayTitle = `Component: ${{title}}`;
  $: totalCount = count0 + count1 + count2;
  $: hasData = data0 && data1 && data2;

  // Lifecycle
  function onMount() {{
    console.log('Component {} mounted');
  }}

  function onUpdate() {{
    console.log('Component {} updated');
  }}

  // Event handlers
  function handleClick() {{
    showDetails = !showDetails;
  }}

  function handleItemClick(item) {{
    console.log('Clicked item:', item.name);
  }}
</script>

<style>
{}
</style>"#,
            imports.join("\n"),
            template,
            reactive_vars.join("\n"),
            component_name,
            index,
            index,
            styles
        );

        Ok(content)
    }

    /// Generate main app component that imports others
    fn generate_app_component(&self) -> Result<String, Box<dyn std::error::Error>> {
        let mut imports = Vec::new();
        let mut components = Vec::new();

        // Import first 10 components for the main app
        for i in 0..std::cmp::min(10, self.config.component_count) {
            let component_name = format!("Component{:04}", i);
            imports.push(format!("import {} from './components/{}.egh';", component_name, component_name));
            components.push(format!("    <{} />", component_name));
        }

        let content = format!(
            r#"{}

<template>
  <div class="app">
    <h1>Eghact Benchmark App</h1>
    <div class="components">
{}
    </div>
  </div>
</template>

<script>
  let appTitle = 'Benchmark Application';
  let componentCount = {};

  $: displayInfo = `App with ${{componentCount}} components`;
</script>

<style>
.app {{
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}}

.app h1 {{
  text-align: center;
  color: #333;
  margin-bottom: 30px;
}}

.components {{
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}}
</style>"#,
            imports.join("\n"),
            components.join("\n"),
            self.config.component_count
        );

        Ok(content)
    }

    /// Run a single benchmark iteration
    fn run_single_benchmark(&self, iteration: usize) -> Result<BenchmarkResult, Box<dyn std::error::Error>> {
        let compiler_config = CompilerConfig {
            source_dir: self.test_project_path.join("src"),
            output_dir: self.test_project_path.join("dist"),
            cache_dir: self.test_project_path.join(".eghact/cache"),
            enable_incremental: true,
            enable_parallel: true,
            max_parallel_jobs: num_cpus::get(),
            ..Default::default()
        };

        let compiler = IncrementalCompiler::new(compiler_config)?;

        // Clear cache for clean test
        compiler.clear_cache()?;

        // Measure full build time
        let full_build_start = Instant::now();
        let full_result = compiler.compile_all()?;
        let full_build_time = full_build_start.elapsed().as_millis() as u64;

        // Make a small change to trigger incremental build
        let test_file = self.test_project_path.join("src/components/Component0001.egh");
        let mut content = fs::read_to_string(&test_file)?;
        content.push_str("\n// Benchmark change");
        fs::write(&test_file, content)?;

        // Measure incremental build time
        let incremental_start = Instant::now();
        let changed_files = vec![test_file];
        let incremental_result = compiler.compile_incremental(&changed_files)?;
        let incremental_time = incremental_start.elapsed().as_millis() as u64;

        // Calculate metrics
        let metrics = compiler.get_metrics();
        let cache_stats = compiler.get_cache_stats();
        let bundle_size = self.calculate_bundle_size()?;

        let result = BenchmarkResult {
            test_name: format!("iteration_{}", iteration),
            full_build_time_ms: full_build_time,
            incremental_build_time_ms: incremental_time,
            memory_usage_mb: cache_stats.total_size_mb,
            files_compiled: metrics.files_compiled,
            files_cached: metrics.files_skipped,
            cache_hit_rate: if metrics.files_compiled + metrics.files_skipped > 0 {
                metrics.files_skipped as f64 / (metrics.files_compiled + metrics.files_skipped) as f64 * 100.0
            } else {
                0.0
            },
            bundle_size_kb: bundle_size,
            timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)?.as_secs(),
            commit_hash: self.get_git_commit_hash(),
        };

        println!("📊 Iteration {}: Full={}ms, Incremental={}ms, Cache={:.1}%", 
            iteration, full_build_time, incremental_time, result.cache_hit_rate);

        Ok(result)
    }

    /// Calculate total bundle size
    fn calculate_bundle_size(&self) -> Result<f64, Box<dyn std::error::Error>> {
        let dist_dir = self.test_project_path.join("dist");
        if !dist_dir.exists() {
            return Ok(0.0);
        }

        let mut total_size = 0u64;
        for entry in fs::read_dir(&dist_dir)? {
            let entry = entry?;
            if entry.path().is_file() {
                total_size += entry.metadata()?.len();
            }
        }

        Ok(total_size as f64 / 1024.0) // Convert to KB
    }

    /// Get current git commit hash if available
    fn get_git_commit_hash(&self) -> Option<String> {
        use std::process::Command;
        
        if let Ok(output) = Command::new("git")
            .args(&["rev-parse", "HEAD"])
            .output() {
            if output.status.success() {
                return Some(String::from_utf8_lossy(&output.stdout).trim().to_string());
            }
        }
        None
    }

    /// Generate comprehensive benchmark report
    fn generate_report(&self, total_duration: u64) -> Result<BenchmarkReport, Box<dyn std::error::Error>> {
        let averages = self.calculate_averages();
        let regressions = self.detect_regressions()?;

        let config_snapshot = BenchmarkConfigSnapshot {
            component_count: self.config.component_count,
            max_nesting_depth: self.config.max_nesting_depth,
            dependencies_per_component: self.config.dependencies_per_component,
            target_build_time_ms: self.config.target_build_time_ms,
            target_incremental_time_ms: self.config.target_incremental_time_ms,
        };

        Ok(BenchmarkReport {
            results: self.results.clone(),
            averages,
            regressions,
            config: config_snapshot,
            total_duration_ms: total_duration,
        })
    }

    /// Calculate average metrics across all benchmark runs
    fn calculate_averages(&self) -> BenchmarkAverages {
        let count = self.results.len() as f64;
        
        if count == 0.0 {
            return BenchmarkAverages {
                avg_full_build_ms: 0.0,
                avg_incremental_ms: 0.0,
                avg_memory_mb: 0.0,
                avg_cache_hit_rate: 0.0,
                avg_bundle_size_kb: 0.0,
            };
        }

        BenchmarkAverages {
            avg_full_build_ms: self.results.iter().map(|r| r.full_build_time_ms as f64).sum::<f64>() / count,
            avg_incremental_ms: self.results.iter().map(|r| r.incremental_build_time_ms as f64).sum::<f64>() / count,
            avg_memory_mb: self.results.iter().map(|r| r.memory_usage_mb).sum::<f64>() / count,
            avg_cache_hit_rate: self.results.iter().map(|r| r.cache_hit_rate).sum::<f64>() / count,
            avg_bundle_size_kb: self.results.iter().map(|r| r.bundle_size_kb).sum::<f64>() / count,
        }
    }

    /// Detect performance regressions compared to targets
    fn detect_regressions(&self) -> Result<Vec<PerformanceRegression>, Box<dyn std::error::Error>> {
        let mut regressions = Vec::new();
        let averages = self.calculate_averages();

        // Check full build time regression
        if averages.avg_full_build_ms > self.config.target_build_time_ms as f64 {
            let regression_percent = (averages.avg_full_build_ms - self.config.target_build_time_ms as f64) 
                / self.config.target_build_time_ms as f64 * 100.0;
            
            regressions.push(PerformanceRegression {
                metric: "Full Build Time".to_string(),
                current_value: averages.avg_full_build_ms,
                baseline_value: self.config.target_build_time_ms as f64,
                regression_percent,
                severity: if regression_percent > 25.0 {
                    RegressionSeverity::Critical
                } else if regression_percent > 10.0 {
                    RegressionSeverity::Major
                } else {
                    RegressionSeverity::Minor
                },
            });
        }

        // Check incremental build time regression
        if averages.avg_incremental_ms > self.config.target_incremental_time_ms as f64 {
            let regression_percent = (averages.avg_incremental_ms - self.config.target_incremental_time_ms as f64) 
                / self.config.target_incremental_time_ms as f64 * 100.0;
            
            regressions.push(PerformanceRegression {
                metric: "Incremental Build Time".to_string(),
                current_value: averages.avg_incremental_ms,
                baseline_value: self.config.target_incremental_time_ms as f64,
                regression_percent,
                severity: if regression_percent > 25.0 {
                    RegressionSeverity::Critical
                } else if regression_percent > 10.0 {
                    RegressionSeverity::Major
                } else {
                    RegressionSeverity::Minor
                },
            });
        }

        Ok(regressions)
    }

    /// Print benchmark summary to console
    fn print_summary(&self, report: &BenchmarkReport) {
        println!("\n🎯 BENCHMARK SUMMARY");
        println!("═══════════════════");
        
        println!("📊 Averages across {} iterations:", self.config.iterations);
        println!("   Full Build:     {:.1}ms", report.averages.avg_full_build_ms);
        println!("   Incremental:    {:.1}ms", report.averages.avg_incremental_ms);
        println!("   Memory Usage:   {:.1}MB", report.averages.avg_memory_mb);
        println!("   Cache Hit Rate: {:.1}%", report.averages.avg_cache_hit_rate);
        println!("   Bundle Size:    {:.1}KB", report.averages.avg_bundle_size_kb);

        println!("\n🎯 Target vs Actual:");
        let full_target_met = report.averages.avg_full_build_ms <= self.config.target_build_time_ms as f64;
        let incremental_target_met = report.averages.avg_incremental_ms <= self.config.target_incremental_time_ms as f64;
        
        println!("   Full Build:     {} (target: {}ms)", 
            if full_target_met { "✅ PASS" } else { "❌ FAIL" }, 
            self.config.target_build_time_ms);
        println!("   Incremental:    {} (target: {}ms)", 
            if incremental_target_met { "✅ PASS" } else { "❌ FAIL" }, 
            self.config.target_incremental_time_ms);

        if !report.regressions.is_empty() {
            println!("\n⚠️  PERFORMANCE REGRESSIONS DETECTED:");
            for regression in &report.regressions {
                let severity_icon = match regression.severity {
                    RegressionSeverity::Minor => "🟡",
                    RegressionSeverity::Major => "🟠", 
                    RegressionSeverity::Critical => "🔴",
                };
                println!("   {} {}: {:.1} vs {:.1} ({:.1}% regression)", 
                    severity_icon, regression.metric, regression.current_value, 
                    regression.baseline_value, regression.regression_percent);
            }
        } else {
            println!("\n✅ No performance regressions detected!");
        }
    }

    /// Save benchmark report to file
    pub fn save_report(&self, report: &BenchmarkReport, output_path: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let json_content = serde_json::to_string_pretty(report)?;
        fs::write(output_path, json_content)?;
        println!("📄 Benchmark report saved to: {}", output_path.display());
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_benchmark_creation() {
        let temp_dir = TempDir::new().unwrap();
        let config = BenchmarkConfig {
            component_count: 10,
            iterations: 1,
            ..Default::default()
        };
        
        let benchmark = CompilationBenchmark::new(temp_dir.path(), config);
        assert_eq!(benchmark.config.component_count, 10);
        assert_eq!(benchmark.results.len(), 0);
    }

    #[test]
    fn test_component_generation() -> Result<(), Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let config = BenchmarkConfig {
            component_count: 5,
            dependencies_per_component: 2,
            ..Default::default()
        };
        
        let benchmark = CompilationBenchmark::new(temp_dir.path(), config);
        let content = benchmark.generate_component_content("TestComponent", 1)?;
        
        assert!(content.contains("<template>"));
        assert!(content.contains("<script>"));
        assert!(content.contains("<style>"));
        assert!(content.contains("TestComponent"));
        
        Ok(())
    }

    #[test]
    fn test_performance_regression_detection() {
        let config = BenchmarkConfig {
            target_build_time_ms: 1000,
            target_incremental_time_ms: 100,
            ..Default::default()
        };
        
        let mut benchmark = CompilationBenchmark::new("/tmp", config);
        
        // Add results that exceed targets
        benchmark.results.push(BenchmarkResult {
            test_name: "test".to_string(),
            full_build_time_ms: 1500, // 50% over target
            incremental_build_time_ms: 150, // 50% over target
            memory_usage_mb: 100.0,
            files_compiled: 100,
            files_cached: 50,
            cache_hit_rate: 33.3,
            bundle_size_kb: 1000.0,
            timestamp: 0,
            commit_hash: None,
        });

        let regressions = benchmark.detect_regressions().unwrap();
        assert_eq!(regressions.len(), 2);
        
        assert!(regressions.iter().any(|r| r.metric == "Full Build Time"));
        assert!(regressions.iter().any(|r| r.metric == "Incremental Build Time"));
    }
}
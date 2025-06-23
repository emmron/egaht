//! Usage pattern analyzer
//! 
//! Analyzes component usage patterns to identify optimization opportunities.

use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use std::time::{Duration, SystemTime};

use tokio::sync::RwLock;
use serde::{Serialize, Deserialize};
use ndarray::{Array1, Array2};
use statrs::statistics::Statistics;

use crate::{ComponentId, ComponentMetrics, AdaptiveConfig, AdaptiveError};

/// Usage analyzer
pub struct UsageAnalyzer {
    /// Pattern storage
    patterns: Arc<RwLock<HashMap<ComponentId, UsagePattern>>>,
    
    /// Time series data
    time_series: Arc<RwLock<HashMap<ComponentId, TimeSeries>>>,
    
    /// Anomaly detector
    anomaly_detector: AnomalyDetector,
    
    /// Configuration
    config: AdaptiveConfig,
}

/// Usage pattern for a component
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsagePattern {
    pub component_id: ComponentId,
    pub avg_load_time: Duration,
    pub load_time_variance: f64,
    pub peak_usage_times: Vec<TimeWindow>,
    pub interaction_frequency: f32,
    pub dependency_graph: DependencyGraph,
    pub render_criticality: f32,
    pub user_segments: Vec<UserSegment>,
    pub seasonal_patterns: SeasonalPattern,
}

/// Time window
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeWindow {
    pub start_hour: u8,
    pub end_hour: u8,
    pub days_of_week: Vec<u8>,
    pub usage_intensity: f32,
}

/// Dependency graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyGraph {
    pub direct_deps: Vec<ComponentId>,
    pub transitive_deps: Vec<ComponentId>,
    pub dependent_components: Vec<ComponentId>,
    pub coupling_score: f32,
}

/// User segment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSegment {
    pub segment_id: String,
    pub characteristics: SegmentCharacteristics,
    pub usage_probability: f32,
    pub performance_sensitivity: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SegmentCharacteristics {
    pub device_types: Vec<String>,
    pub network_speeds: Vec<String>,
    pub geographic_regions: Vec<String>,
    pub behavior_patterns: Vec<String>,
}

/// Seasonal pattern
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeasonalPattern {
    pub daily_pattern: Vec<f32>,    // 24 hours
    pub weekly_pattern: Vec<f32>,   // 7 days
    pub monthly_pattern: Vec<f32>,  // 30 days
    pub yearly_pattern: Vec<f32>,   // 12 months
}

/// Time series data
struct TimeSeries {
    load_times: VecDeque<(SystemTime, Duration)>,
    memory_usage: VecDeque<(SystemTime, usize)>,
    interaction_counts: VecDeque<(SystemTime, u32)>,
    max_points: usize,
}

/// Anomaly detector
struct AnomalyDetector {
    isolation_forest: IsolationForest,
    z_score_threshold: f64,
}

/// Isolation Forest for anomaly detection
struct IsolationForest {
    trees: Vec<IsolationTree>,
    n_trees: usize,
    sample_size: usize,
}

struct IsolationTree {
    root: Option<Box<IsolationNode>>,
}

struct IsolationNode {
    split_feature: usize,
    split_value: f64,
    left: Option<Box<IsolationNode>>,
    right: Option<Box<IsolationNode>>,
}

impl UsageAnalyzer {
    /// Create a new usage analyzer
    pub async fn new(config: &AdaptiveConfig) -> Result<Self, AdaptiveError> {
        let patterns = Arc::new(RwLock::new(HashMap::new()));
        let time_series = Arc::new(RwLock::new(HashMap::new()));
        
        let anomaly_detector = AnomalyDetector::new();
        
        Ok(Self {
            patterns,
            time_series,
            anomaly_detector,
            config: config.clone(),
        })
    }
    
    /// Analyze component metrics
    pub async fn analyze_component(
        &self,
        metrics: &ComponentMetrics,
    ) -> Result<(), AdaptiveError> {
        // Update time series
        self.update_time_series(metrics).await?;
        
        // Update patterns
        self.update_patterns(metrics).await?;
        
        // Detect anomalies
        if self.is_anomaly(metrics).await? {
            self.handle_anomaly(metrics).await?;
        }
        
        Ok(())
    }
    
    /// Batch analyze metrics
    pub async fn batch_analyze(
        &self,
        component_id: &ComponentId,
        metrics_list: &[ComponentMetrics],
    ) -> Result<(), AdaptiveError> {
        // Perform batch analysis for efficiency
        let pattern = self.compute_usage_pattern(component_id, metrics_list)?;
        
        self.patterns.write().await.insert(component_id.clone(), pattern);
        
        Ok(())
    }
    
    /// Get usage patterns for a component
    pub async fn get_usage_patterns(
        &self,
        component_id: &ComponentId,
    ) -> Result<UsagePattern, AdaptiveError> {
        self.patterns
            .read()
            .await
            .get(component_id)
            .cloned()
            .ok_or(AdaptiveError::ComponentNotFound)
    }
    
    /// Update time series data
    async fn update_time_series(&self, metrics: &ComponentMetrics) -> Result<(), AdaptiveError> {
        let mut series_map = self.time_series.write().await;
        
        let series = series_map
            .entry(metrics.component_id.clone())
            .or_insert_with(|| TimeSeries::new(1000));
        
        series.add_load_time(metrics.timestamp, metrics.load_time);
        series.add_memory_usage(metrics.timestamp, metrics.memory_usage);
        series.add_interaction_count(metrics.timestamp, metrics.interaction_count);
        
        Ok(())
    }
    
    /// Update usage patterns
    async fn update_patterns(&self, metrics: &ComponentMetrics) -> Result<(), AdaptiveError> {
        let mut patterns = self.patterns.write().await;
        
        let pattern = patterns
            .entry(metrics.component_id.clone())
            .or_insert_with(|| UsagePattern::default(metrics.component_id.clone()));
        
        // Update moving averages
        pattern.update_averages(metrics);
        
        // Update dependency graph
        pattern.update_dependencies(&metrics.dependencies);
        
        // Detect peak usage
        pattern.update_peak_times(metrics.timestamp);
        
        Ok(())
    }
    
    /// Check if metrics are anomalous
    async fn is_anomaly(&self, metrics: &ComponentMetrics) -> Result<bool, AdaptiveError> {
        let series_map = self.time_series.read().await;
        
        if let Some(series) = series_map.get(&metrics.component_id) {
            // Z-score test for load time
            if let Some(z_score) = series.calculate_load_time_zscore(metrics.load_time) {
                if z_score.abs() > self.anomaly_detector.z_score_threshold {
                    return Ok(true);
                }
            }
            
            // Isolation forest for multivariate anomaly
            let features = self.extract_features(metrics);
            if self.anomaly_detector.is_anomaly(&features) {
                return Ok(true);
            }
        }
        
        Ok(false)
    }
    
    /// Handle detected anomaly
    async fn handle_anomaly(&self, metrics: &ComponentMetrics) -> Result<(), AdaptiveError> {
        tracing::warn!(
            "Anomaly detected for component {}: load_time={:?}",
            metrics.component_id.0,
            metrics.load_time
        );
        
        // Could trigger alerts, adjustments, or investigations
        
        Ok(())
    }
    
    /// Compute usage pattern from metrics
    fn compute_usage_pattern(
        &self,
        component_id: &ComponentId,
        metrics_list: &[ComponentMetrics],
    ) -> Result<UsagePattern, AdaptiveError> {
        if metrics_list.is_empty() {
            return Err(AdaptiveError::AnalysisError("No metrics available".to_string()));
        }
        
        // Calculate statistics
        let load_times: Vec<f64> = metrics_list
            .iter()
            .map(|m| m.load_time.as_millis() as f64)
            .collect();
        
        let avg_load_time = load_times.mean();
        let load_time_variance = load_times.variance();
        
        // Analyze time patterns
        let peak_usage_times = self.detect_peak_usage(metrics_list);
        
        // Calculate interaction frequency
        let total_interactions: u32 = metrics_list
            .iter()
            .map(|m| m.interaction_count)
            .sum();
        
        let time_span = metrics_list.last().unwrap().timestamp
            .duration_since(metrics_list.first().unwrap().timestamp)
            .unwrap_or_default();
        
        let interaction_frequency = if time_span.as_secs() > 0 {
            total_interactions as f32 / time_span.as_secs() as f32
        } else {
            0.0
        };
        
        // Build dependency graph
        let dependency_graph = self.build_dependency_graph(metrics_list);
        
        // Calculate render criticality
        let render_criticality = self.calculate_render_criticality(metrics_list);
        
        // Detect user segments
        let user_segments = self.detect_user_segments(metrics_list);
        
        // Analyze seasonal patterns
        let seasonal_patterns = self.analyze_seasonal_patterns(metrics_list);
        
        Ok(UsagePattern {
            component_id: component_id.clone(),
            avg_load_time: Duration::from_millis(avg_load_time as u64),
            load_time_variance,
            peak_usage_times,
            interaction_frequency,
            dependency_graph,
            render_criticality,
            user_segments,
            seasonal_patterns,
        })
    }
    
    /// Detect peak usage times
    fn detect_peak_usage(&self, metrics_list: &[ComponentMetrics]) -> Vec<TimeWindow> {
        use chrono::{DateTime, Utc, Datelike, Timelike};
        
        // Group by hour and day of week
        let mut usage_by_hour_day: HashMap<(u8, u8), Vec<f64>> = HashMap::new();
        
        for metrics in metrics_list {
            let datetime: DateTime<Utc> = metrics.timestamp.into();
            let hour = datetime.hour() as u8;
            let day = datetime.weekday().num_days_from_monday() as u8;
            
            usage_by_hour_day
                .entry((hour, day))
                .or_insert_with(Vec::new)
                .push(metrics.load_time.as_millis() as f64);
        }
        
        // Find peaks (top 20% usage times)
        let mut usage_scores: Vec<((u8, u8), f64)> = usage_by_hour_day
            .iter()
            .map(|((hour, day), loads)| {
                let score = loads.len() as f64 * loads.mean();
                ((*hour, *day), score)
            })
            .collect();
        
        usage_scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        
        let threshold_idx = (usage_scores.len() as f64 * 0.2) as usize;
        let threshold_score = usage_scores.get(threshold_idx).map(|x| x.1).unwrap_or(0.0);
        
        // Group contiguous peak hours
        let mut peak_windows = Vec::new();
        let mut current_window: Option<TimeWindow> = None;
        
        for ((hour, day), score) in usage_scores {
            if score >= threshold_score {
                if let Some(ref mut window) = current_window {
                    if window.days_of_week.contains(&day) && 
                       (hour == window.end_hour || hour == window.end_hour + 1) {
                        window.end_hour = hour;
                    } else {
                        peak_windows.push(window.clone());
                        current_window = Some(TimeWindow {
                            start_hour: hour,
                            end_hour: hour,
                            days_of_week: vec![day],
                            usage_intensity: score as f32,
                        });
                    }
                } else {
                    current_window = Some(TimeWindow {
                        start_hour: hour,
                        end_hour: hour,
                        days_of_week: vec![day],
                        usage_intensity: score as f32,
                    });
                }
            }
        }
        
        if let Some(window) = current_window {
            peak_windows.push(window);
        }
        
        peak_windows
    }
    
    /// Build dependency graph
    fn build_dependency_graph(&self, metrics_list: &[ComponentMetrics]) -> DependencyGraph {
        let mut all_deps = HashSet::new();
        let mut dep_frequency = HashMap::new();
        
        for metrics in metrics_list {
            for dep in &metrics.dependencies {
                all_deps.insert(dep.clone());
                *dep_frequency.entry(dep.clone()).or_insert(0) += 1;
            }
        }
        
        let direct_deps: Vec<_> = all_deps.into_iter().collect();
        
        // Calculate coupling score based on dependency frequency
        let total_loads = metrics_list.len();
        let coupling_score = if total_loads > 0 {
            dep_frequency.values().map(|&f| f as f32 / total_loads as f32).sum::<f32>() 
            / dep_frequency.len().max(1) as f32
        } else {
            0.0
        };
        
        DependencyGraph {
            direct_deps: direct_deps.clone(),
            transitive_deps: vec![], // Would need full dep tree to calculate
            dependent_components: vec![], // Would need reverse dep lookup
            coupling_score,
        }
    }
    
    /// Calculate render criticality
    fn calculate_render_criticality(&self, metrics_list: &[ComponentMetrics]) -> f32 {
        // Factors: viewport time, interaction count, render time
        let avg_viewport_time = metrics_list
            .iter()
            .map(|m| m.viewport_time.as_secs_f32())
            .sum::<f32>() / metrics_list.len() as f32;
        
        let avg_interactions = metrics_list
            .iter()
            .map(|m| m.interaction_count as f32)
            .sum::<f32>() / metrics_list.len() as f32;
        
        let avg_render_time = metrics_list
            .iter()
            .map(|m| m.render_time.as_millis() as f32)
            .sum::<f32>() / metrics_list.len() as f32;
        
        // Normalize and combine
        let viewport_score = (avg_viewport_time / 10.0).min(1.0);
        let interaction_score = (avg_interactions / 100.0).min(1.0);
        let render_score = (50.0 / avg_render_time).min(1.0);
        
        (viewport_score * 0.4 + interaction_score * 0.4 + render_score * 0.2).min(1.0)
    }
    
    /// Detect user segments
    fn detect_user_segments(&self, _metrics_list: &[ComponentMetrics]) -> Vec<UserSegment> {
        // In a real implementation, this would use clustering algorithms
        // For now, return default segments
        vec![
            UserSegment {
                segment_id: "mobile_users".to_string(),
                characteristics: SegmentCharacteristics {
                    device_types: vec!["mobile".to_string()],
                    network_speeds: vec!["3g".to_string(), "4g".to_string()],
                    geographic_regions: vec![],
                    behavior_patterns: vec!["quick_interactions".to_string()],
                },
                usage_probability: 0.4,
                performance_sensitivity: 0.8,
            },
            UserSegment {
                segment_id: "desktop_power_users".to_string(),
                characteristics: SegmentCharacteristics {
                    device_types: vec!["desktop".to_string()],
                    network_speeds: vec!["broadband".to_string()],
                    geographic_regions: vec![],
                    behavior_patterns: vec!["long_sessions".to_string()],
                },
                usage_probability: 0.6,
                performance_sensitivity: 0.6,
            },
        ]
    }
    
    /// Analyze seasonal patterns
    fn analyze_seasonal_patterns(&self, metrics_list: &[ComponentMetrics]) -> SeasonalPattern {
        use chrono::{DateTime, Utc, Datelike, Timelike};
        
        let mut hourly_usage = vec![0.0; 24];
        let mut daily_usage = vec![0.0; 7];
        let mut monthly_usage = vec![0.0; 30];
        let mut yearly_usage = vec![0.0; 12];
        
        for metrics in metrics_list {
            let datetime: DateTime<Utc> = metrics.timestamp.into();
            
            hourly_usage[datetime.hour() as usize] += 1.0;
            daily_usage[datetime.weekday().num_days_from_monday() as usize] += 1.0;
            monthly_usage[(datetime.day() - 1) as usize] += 1.0;
            yearly_usage[(datetime.month() - 1) as usize] += 1.0;
        }
        
        // Normalize
        let normalize = |v: &mut Vec<f32>| {
            let max = v.iter().copied().fold(0.0, f32::max);
            if max > 0.0 {
                for x in v {
                    *x /= max;
                }
            }
        };
        
        normalize(&mut hourly_usage);
        normalize(&mut daily_usage);
        normalize(&mut monthly_usage);
        normalize(&mut yearly_usage);
        
        SeasonalPattern {
            daily_pattern: hourly_usage,
            weekly_pattern: daily_usage,
            monthly_pattern: monthly_usage,
            yearly_pattern: yearly_usage,
        }
    }
    
    /// Extract features for anomaly detection
    fn extract_features(&self, metrics: &ComponentMetrics) -> Array1<f64> {
        Array1::from_vec(vec![
            metrics.load_time.as_millis() as f64,
            metrics.render_time.as_millis() as f64,
            metrics.memory_usage as f64,
            metrics.bundle_size as f64,
            metrics.interaction_count as f64,
            metrics.viewport_time.as_secs_f64(),
            metrics.dependencies.len() as f64,
        ])
    }
}

impl UsagePattern {
    fn default(component_id: ComponentId) -> Self {
        Self {
            component_id,
            avg_load_time: Duration::from_millis(0),
            load_time_variance: 0.0,
            peak_usage_times: vec![],
            interaction_frequency: 0.0,
            dependency_graph: DependencyGraph {
                direct_deps: vec![],
                transitive_deps: vec![],
                dependent_components: vec![],
                coupling_score: 0.0,
            },
            render_criticality: 0.0,
            user_segments: vec![],
            seasonal_patterns: SeasonalPattern {
                daily_pattern: vec![0.0; 24],
                weekly_pattern: vec![0.0; 7],
                monthly_pattern: vec![0.0; 30],
                yearly_pattern: vec![0.0; 12],
            },
        }
    }
    
    fn update_averages(&mut self, metrics: &ComponentMetrics) {
        // Exponential moving average
        let alpha = 0.1;
        let new_load_time = metrics.load_time.as_millis() as f64;
        let current_avg = self.avg_load_time.as_millis() as f64;
        
        let updated_avg = alpha * new_load_time + (1.0 - alpha) * current_avg;
        self.avg_load_time = Duration::from_millis(updated_avg as u64);
        
        // Update variance
        let diff = new_load_time - updated_avg;
        self.load_time_variance = alpha * diff * diff + (1.0 - alpha) * self.load_time_variance;
    }
    
    fn update_dependencies(&mut self, dependencies: &[ComponentId]) {
        // Update dependency graph
        for dep in dependencies {
            if !self.dependency_graph.direct_deps.contains(dep) {
                self.dependency_graph.direct_deps.push(dep.clone());
            }
        }
    }
    
    fn update_peak_times(&mut self, _timestamp: SystemTime) {
        // Update peak usage detection
        // This would be more sophisticated in production
    }
}

impl TimeSeries {
    fn new(max_points: usize) -> Self {
        Self {
            load_times: VecDeque::with_capacity(max_points),
            memory_usage: VecDeque::with_capacity(max_points),
            interaction_counts: VecDeque::with_capacity(max_points),
            max_points,
        }
    }
    
    fn add_load_time(&mut self, timestamp: SystemTime, load_time: Duration) {
        if self.load_times.len() >= self.max_points {
            self.load_times.pop_front();
        }
        self.load_times.push_back((timestamp, load_time));
    }
    
    fn add_memory_usage(&mut self, timestamp: SystemTime, memory: usize) {
        if self.memory_usage.len() >= self.max_points {
            self.memory_usage.pop_front();
        }
        self.memory_usage.push_back((timestamp, memory));
    }
    
    fn add_interaction_count(&mut self, timestamp: SystemTime, count: u32) {
        if self.interaction_counts.len() >= self.max_points {
            self.interaction_counts.pop_front();
        }
        self.interaction_counts.push_back((timestamp, count));
    }
    
    fn calculate_load_time_zscore(&self, load_time: Duration) -> Option<f64> {
        if self.load_times.len() < 10 {
            return None;
        }
        
        let values: Vec<f64> = self.load_times
            .iter()
            .map(|(_, d)| d.as_millis() as f64)
            .collect();
        
        let mean = values.mean();
        let std_dev = values.std_dev();
        
        if std_dev > 0.0 {
            Some((load_time.as_millis() as f64 - mean) / std_dev)
        } else {
            None
        }
    }
}

impl AnomalyDetector {
    fn new() -> Self {
        Self {
            isolation_forest: IsolationForest::new(100, 256),
            z_score_threshold: 3.0,
        }
    }
    
    fn is_anomaly(&self, features: &Array1<f64>) -> bool {
        self.isolation_forest.anomaly_score(features) > 0.7
    }
}

impl IsolationForest {
    fn new(n_trees: usize, sample_size: usize) -> Self {
        Self {
            trees: Vec::with_capacity(n_trees),
            n_trees,
            sample_size,
        }
    }
    
    fn anomaly_score(&self, _features: &Array1<f64>) -> f64 {
        // Simplified implementation
        // In production, this would calculate path lengths through all trees
        0.5
    }
}

use std::collections::HashSet;
/**
 * Eghact Performance Profiler Type Definitions
 */

export interface RenderMetric {
  componentName: string;
  props: string;
  duration: number;
  wasmDuration: number | null;
  memoryDelta: number;
  timestamp: number;
  renderCount: number;
}

export interface ComponentMetrics {
  totalRenders: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  memoryImpact: number;
  renderHistory: RenderMetric[];
}

export interface MemorySnapshot {
  label: string;
  timestamp: number;
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface BundleInfo {
  size: number;
  gzipSize: number;
  dependencies: string[];
  treeShaking: boolean;
  timestamp: number;
}

export interface PerformanceMetrics {
  renderMetrics: Record<string, ComponentMetrics>;
  memorySnapshots: MemorySnapshot[];
  bundleImpact: Record<string, BundleInfo>;
  wasmStats: any | null;
}

export interface PerformanceEvent {
  type: 'render' | 'memory' | 'bundle';
  componentName?: string;
  metric?: RenderMetric;
  snapshot?: MemorySnapshot;
  bundleInfo?: BundleInfo;
}

export type PerformanceSubscriber = (event: PerformanceEvent) => void;

export class PerformanceStore {
  startComponentRender(componentName: string, props: any): string;
  endComponentRender(id: string): RenderMetric | null;
  captureMemorySnapshot(label?: string): MemorySnapshot | null;
  analyzeBundleImpact(componentName: string, bundleInfo: Omit<BundleInfo, 'timestamp'>): void;
  getMetrics(): PerformanceMetrics;
  getComponentMetrics(componentName: string): ComponentMetrics | undefined;
  clearMetrics(): void;
  subscribe(callback: PerformanceSubscriber): () => void;
}

export const performanceStore: PerformanceStore;

export function withPerformanceMonitoring<T extends { new(...args: any[]): any }>(
  Component: T
): T;

export interface UsePerformanceReturn {
  startTimer: (label: string) => string;
  endTimer: (id: string) => RenderMetric | null;
  captureMemory: (label?: string) => MemorySnapshot | null;
  getMetrics: () => PerformanceMetrics;
}

export function usePerformance(): UsePerformanceReturn;

export function startMemoryMonitoring(intervalMs?: number): void;
export function stopMemoryMonitoring(): void;

declare const _default: {
  performanceStore: PerformanceStore;
  withPerformanceMonitoring: typeof withPerformanceMonitoring;
  usePerformance: typeof usePerformance;
  startMemoryMonitoring: typeof startMemoryMonitoring;
  stopMemoryMonitoring: typeof stopMemoryMonitoring;
};

export default _default;
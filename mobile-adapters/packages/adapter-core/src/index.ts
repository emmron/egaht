/**
 * Core Mobile Adapter API for Eghact Framework
 * Provides platform-agnostic interfaces for rendering components
 * and handling gestures across mobile platforms
 */

export interface IViewStyle {
  backgroundColor?: string;
  padding?: number | string;
  margin?: number | string;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  flex?: number;
  flexDirection?: 'row' | 'column';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  width?: number | string;
  height?: number | string;
  position?: 'relative' | 'absolute';
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
}

export interface ITextStyle {
  color?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  letterSpacing?: number;
}

export interface IGestureEvent {
  type: string;
  x: number;
  y: number;
  timestamp: number;
  velocityX?: number;
  velocityY?: number;
  scale?: number;
  rotation?: number;
}

export interface IAnimation {
  from: any;
  to: any;
  duration: number;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  delay?: number;
  onComplete?: () => void;
}

export interface IPlatformComponent {
  type: string;
  props: Record<string, any>;
  children?: IPlatformComponent[];
  key?: string | number;
}

export interface IMobileAdapter {
  // Component creation
  createView(props: { style?: IViewStyle; children?: IPlatformComponent[] }): IPlatformComponent;
  createText(props: { style?: ITextStyle; children: string }): IPlatformComponent;
  createImage(props: { source: string; style?: IViewStyle }): IPlatformComponent;
  createButton(props: { title: string; onPress: () => void; style?: IViewStyle }): IPlatformComponent;
  createTextInput(props: { value: string; onChangeText: (text: string) => void; placeholder?: string; style?: IViewStyle }): IPlatformComponent;
  createScrollView(props: { style?: IViewStyle; children?: IPlatformComponent[] }): IPlatformComponent;
  
  // Gesture handling
  onTap(handler: (event: IGestureEvent) => void): { attach: (component: IPlatformComponent) => void };
  onPan(handler: (event: IGestureEvent) => void): { attach: (component: IPlatformComponent) => void };
  onPinch(handler: (event: IGestureEvent) => void): { attach: (component: IPlatformComponent) => void };
  onLongPress(handler: (event: IGestureEvent) => void): { attach: (component: IPlatformComponent) => void };
  
  // Animation
  createTimingAnimation(config: IAnimation): { start: () => void; stop: () => void };
  createSpringAnimation(config: { from: any; to: any; tension?: number; friction?: number }): { start: () => void; stop: () => void };
  
  // Platform-specific features
  getPlatformInfo(): { os: string; version: string; deviceType: string };
  requestPermission(permission: string): Promise<boolean>;
  openNativeModal(options: { title: string; message: string; buttons: Array<{ text: string; onPress: () => void }> }): void;
  
  // Lifecycle
  onMount(component: IPlatformComponent, callback: () => void): void;
  onUnmount(component: IPlatformComponent, callback: () => void): void;
  
  // Performance optimization
  enableVirtualization(listComponent: IPlatformComponent, options?: { itemHeight?: number }): void;
  preloadImages(urls: string[]): Promise<void>;
}

// Base adapter implementation with common functionality
export abstract class BaseAdapter implements IMobileAdapter {
  protected platform: string;
  
  constructor(platform: string) {
    this.platform = platform;
  }
  
  abstract createView(props: { style?: IViewStyle; children?: IPlatformComponent[] }): IPlatformComponent;
  abstract createText(props: { style?: ITextStyle; children: string }): IPlatformComponent;
  abstract createImage(props: { source: string; style?: IViewStyle }): IPlatformComponent;
  abstract createButton(props: { title: string; onPress: () => void; style?: IViewStyle }): IPlatformComponent;
  abstract createTextInput(props: { value: string; onChangeText: (text: string) => void; placeholder?: string; style?: IViewStyle }): IPlatformComponent;
  abstract createScrollView(props: { style?: IViewStyle; children?: IPlatformComponent[] }): IPlatformComponent;
  
  abstract onTap(handler: (event: IGestureEvent) => void): { attach: (component: IPlatformComponent) => void };
  abstract onPan(handler: (event: IGestureEvent) => void): { attach: (component: IPlatformComponent) => void };
  abstract onPinch(handler: (event: IGestureEvent) => void): { attach: (component: IPlatformComponent) => void };
  abstract onLongPress(handler: (event: IGestureEvent) => void): { attach: (component: IPlatformComponent) => void };
  
  abstract createTimingAnimation(config: IAnimation): { start: () => void; stop: () => void };
  abstract createSpringAnimation(config: { from: any; to: any; tension?: number; friction?: number }): { start: () => void; stop: () => void };
  
  abstract requestPermission(permission: string): Promise<boolean>;
  abstract openNativeModal(options: { title: string; message: string; buttons: Array<{ text: string; onPress: () => void }> }): void;
  
  abstract onMount(component: IPlatformComponent, callback: () => void): void;
  abstract onUnmount(component: IPlatformComponent, callback: () => void): void;
  
  abstract enableVirtualization(listComponent: IPlatformComponent, options?: { itemHeight?: number }): void;
  abstract preloadImages(urls: string[]): Promise<void>;
  
  getPlatformInfo(): { os: string; version: string; deviceType: string } {
    return {
      os: this.platform,
      version: '1.0.0',
      deviceType: 'unknown'
    };
  }
}

// Adapter factory
export class AdapterFactory {
  private static adapters: Map<string, IMobileAdapter> = new Map();
  
  static register(platform: string, adapter: IMobileAdapter): void {
    this.adapters.set(platform, adapter);
  }
  
  static get(platform: string): IMobileAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new Error(`No adapter registered for platform: ${platform}`);
    }
    return adapter;
  }
}

// Component compiler interface
export interface IComponentCompiler {
  compile(eghComponent: any): IPlatformComponent;
  compileWithOptimizations(eghComponent: any, optimizations: string[]): IPlatformComponent;
}

// Export utility types
export type GestureHandler = (event: IGestureEvent) => void;
export type AnimationConfig = IAnimation | { from: any; to: any; tension?: number; friction?: number };
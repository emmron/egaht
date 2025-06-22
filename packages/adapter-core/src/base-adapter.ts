/**
 * Base adapter implementation
 */

import {
  IEghactAdapter,
  IComponentFactory,
  IRenderer,
  IStateManager,
  INavigator,
  IStorage,
  INetwork,
  IDevice
} from './interfaces';

import {
  PlatformType,
  ComponentProps,
  TextProps,
  ImageProps,
  ButtonProps,
  InputProps,
  ScrollViewProps,
  ListProps
} from './types';

import { BaseGestureHandler } from './gestures';
import { BaseAnimationEngine } from './animations';
import { BasePlatformBridge } from './platform';

/**
 * Base adapter class that provides common functionality
 */
export abstract class BaseEghactAdapter implements IEghactAdapter {
  abstract platform: PlatformType;
  
  protected componentFactory: IComponentFactory;
  protected renderer: IRenderer;
  protected gestureHandler: BaseGestureHandler;
  protected animationEngine: BaseAnimationEngine;
  protected platformBridge: BasePlatformBridge;
  
  constructor() {
    this.componentFactory = this.createComponentFactory();
    this.renderer = this.createRenderer();
    this.gestureHandler = this.createGestureHandler();
    this.animationEngine = this.createAnimationEngine();
    this.platformBridge = this.createPlatformBridge();
  }
  
  // Abstract methods that must be implemented by platform adapters
  abstract createComponentFactory(): IComponentFactory;
  abstract createRenderer(): IRenderer;
  abstract createGestureHandler(): BaseGestureHandler;
  abstract createAnimationEngine(): BaseAnimationEngine;
  abstract createPlatformBridge(): BasePlatformBridge;
  
  // Component creation methods
  createView(props: ComponentProps): any {
    return this.componentFactory.create('view', props);
  }
  
  createText(props: TextProps): any {
    return this.componentFactory.create('text', props);
  }
  
  createImage(props: ImageProps): any {
    return this.componentFactory.create('image', props);
  }
  
  createButton(props: ButtonProps): any {
    return this.componentFactory.create('button', props);
  }
  
  createInput(props: InputProps): any {
    return this.componentFactory.create('input', props);
  }
  
  createScrollView(props: ScrollViewProps): any {
    return this.componentFactory.create('scroll', props);
  }
  
  createList(props: ListProps): any {
    return this.componentFactory.create('list', props);
  }
  
  // Component lifecycle
  mount(component: any, container: any): void {
    this.renderer.render(component, container);
  }
  
  unmount(component: any): void {
    const container = this.renderer.findDOMNode(component)?.parentNode;
    if (container) {
      this.renderer.unmountComponentAtNode(container);
    }
  }
  
  update(component: any, newProps: any): void {
    this.componentFactory.update(component, newProps);
  }
  
  // Layout management
  async measureLayout(component: any): Promise<{
    x: number;
    y: number;
    width: number;
    height: number;
  }> {
    // Platform-specific implementation
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  
  // Event handling
  addEventListener(component: any, event: string, handler: Function): void {
    // Map to platform-specific event system
    const node = this.renderer.findDOMNode(component);
    if (node && node.addEventListener) {
      node.addEventListener(event, handler as EventListener);
    }
  }
  
  removeEventListener(component: any, event: string, handler: Function): void {
    // Map to platform-specific event system
    const node = this.renderer.findDOMNode(component);
    if (node && node.removeEventListener) {
      node.removeEventListener(event, handler as EventListener);
    }
  }
  
  // Platform features
  getGestureHandler(): BaseGestureHandler {
    return this.gestureHandler;
  }
  
  getAnimationEngine(): BaseAnimationEngine {
    return this.animationEngine;
  }
  
  getPlatformBridge(): BasePlatformBridge {
    return this.platformBridge;
  }
}

/**
 * Adapter registry for managing multiple adapters
 */
export class AdapterRegistry {
  private static adapters = new Map<PlatformType, IEghactAdapter>();
  
  static register(platform: PlatformType, adapter: IEghactAdapter): void {
    this.adapters.set(platform, adapter);
  }
  
  static get(platform: PlatformType): IEghactAdapter | undefined {
    return this.adapters.get(platform);
  }
  
  static getOrThrow(platform: PlatformType): IEghactAdapter {
    const adapter = this.get(platform);
    if (!adapter) {
      throw new Error(`No adapter registered for platform: ${platform}`);
    }
    return adapter;
  }
  
  static has(platform: PlatformType): boolean {
    return this.adapters.has(platform);
  }
  
  static list(): PlatformType[] {
    return Array.from(this.adapters.keys());
  }
  
  static clear(): void {
    this.adapters.clear();
  }
}

/**
 * Adapter configuration
 */
export interface AdapterConfig {
  platform: PlatformType;
  debug?: boolean;
  performance?: {
    trackRenders?: boolean;
    trackGestures?: boolean;
    trackAnimations?: boolean;
  };
  features?: {
    gestures?: boolean;
    animations?: boolean;
    nativeDriver?: boolean;
    accessibility?: boolean;
  };
}

/**
 * Create and configure an adapter
 */
export function createAdapter(
  AdapterClass: new (config: AdapterConfig) => IEghactAdapter,
  config: AdapterConfig
): IEghactAdapter {
  const adapter = new AdapterClass(config);
  AdapterRegistry.register(config.platform, adapter);
  return adapter;
}

/**
 * Helper to detect current platform
 */
export function detectPlatform(): PlatformType {
  // Check for React Native
  if (typeof global !== 'undefined' && global.__fbBatchedBridge) {
    return 'react-native';
  }
  
  // Check for Flutter (would need to be injected by Flutter bridge)
  if (typeof window !== 'undefined' && (window as any).__FLUTTER_WEB_AUTO_DETECT) {
    return 'flutter';
  }
  
  // Default to PWA for web environments
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return 'pwa';
  }
  
  // Could add more platform detection logic here
  throw new Error('Unable to detect platform');
}
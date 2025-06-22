/**
 * Core interfaces for Eghact mobile adapters
 */

import {
  ComponentType,
  ComponentProps,
  TextProps,
  ImageProps,
  ButtonProps,
  InputProps,
  ScrollViewProps,
  ListProps,
  PlatformType
} from './types';

import { GestureHandler } from './gestures';
import { AnimationEngine } from './animations';
import { PlatformBridge } from './platform';

/**
 * Main adapter interface that all platform adapters must implement
 */
export interface IEghactAdapter {
  platform: PlatformType;
  
  // Component creation
  createView(props: ComponentProps): any;
  createText(props: TextProps): any;
  createImage(props: ImageProps): any;
  createButton(props: ButtonProps): any;
  createInput(props: InputProps): any;
  createScrollView(props: ScrollViewProps): any;
  createList(props: ListProps): any;
  
  // Component lifecycle
  mount(component: any, container: any): void;
  unmount(component: any): void;
  update(component: any, newProps: any): void;
  
  // Layout management
  measureLayout(component: any): Promise<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  
  // Event handling
  addEventListener(component: any, event: string, handler: Function): void;
  removeEventListener(component: any, event: string, handler: Function): void;
  
  // Platform features
  getGestureHandler(): GestureHandler;
  getAnimationEngine(): AnimationEngine;
  getPlatformBridge(): PlatformBridge;
}

/**
 * Component factory for creating platform-specific components
 */
export interface IComponentFactory {
  create(type: ComponentType, props: any): any;
  update(component: any, props: any): void;
  destroy(component: any): void;
}

/**
 * Renderer interface for managing component rendering
 */
export interface IRenderer {
  render(component: any, container: any): void;
  hydrate(component: any, container: any): void;
  unmountComponentAtNode(container: any): void;
  findDOMNode(component: any): any;
}

/**
 * State management interface for component state
 */
export interface IStateManager {
  useState<T>(initialValue: T): [T, (newValue: T) => void];
  useEffect(effect: () => void | (() => void), deps?: any[]): void;
  useMemo<T>(factory: () => T, deps?: any[]): T;
  useCallback<T extends Function>(callback: T, deps?: any[]): T;
  useRef<T>(initialValue: T): { current: T };
}

/**
 * Navigation interface for mobile navigation
 */
export interface INavigator {
  navigate(screen: string, params?: any): void;
  goBack(): void;
  push(screen: string, params?: any): void;
  pop(): void;
  popToTop(): void;
  replace(screen: string, params?: any): void;
  reset(routes: Array<{ name: string; params?: any }>): void;
  canGoBack(): boolean;
  getCurrentRoute(): string;
  getCurrentParams(): any;
}

/**
 * Storage interface for persistent data
 */
export interface IStorage {
  setItem(key: string, value: any): Promise<void>;
  getItem(key: string): Promise<any>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
  getAllKeys(): Promise<string[]>;
  multiGet(keys: string[]): Promise<Array<[string, any]>>;
  multiSet(keyValuePairs: Array<[string, any]>): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
}

/**
 * Network interface for HTTP requests
 */
export interface INetwork {
  fetch(url: string, options?: RequestInit): Promise<Response>;
  upload(url: string, file: File, options?: any): Promise<any>;
  download(url: string, options?: any): Promise<Blob>;
  isConnected(): Promise<boolean>;
  getConnectionType(): Promise<'wifi' | 'cellular' | 'none' | 'unknown'>;
}

/**
 * Device interface for accessing device features
 */
export interface IDevice {
  getDeviceInfo(): {
    platform: PlatformType;
    version: string;
    model: string;
    manufacturer: string;
    isTablet: boolean;
  };
  
  getDimensions(): {
    window: { width: number; height: number };
    screen: { width: number; height: number };
  };
  
  getOrientation(): 'portrait' | 'landscape';
  
  vibrate(pattern?: number | number[]): void;
  
  requestPermission(permission: string): Promise<boolean>;
  checkPermission(permission: string): Promise<boolean>;
}

/**
 * Context provider for dependency injection
 */
export interface IAdapterContext {
  adapter: IEghactAdapter;
  renderer: IRenderer;
  stateManager: IStateManager;
  navigator: INavigator;
  storage: IStorage;
  network: INetwork;
  device: IDevice;
}
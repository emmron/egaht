/**
 * Platform bridge for accessing native features
 */

import { PlatformType } from './types';

export interface PlatformCapabilities {
  hasTouch: boolean;
  hasGestures: boolean;
  hasCamera: boolean;
  hasBiometrics: boolean;
  hasNotifications: boolean;
  hasFileSystem: boolean;
  hasGeolocation: boolean;
  hasAccelerometer: boolean;
  hasGyroscope: boolean;
  hasMagnetometer: boolean;
  hasProximity: boolean;
  hasAmbientLight: boolean;
  hasBluetooth: boolean;
  hasNFC: boolean;
  hasVibration: boolean;
  hasSpeechRecognition: boolean;
  hasBackgroundTasks: boolean;
}

export interface SystemInfo {
  platform: PlatformType;
  version: string;
  buildNumber: string;
  isEmulator: boolean;
  isTablet: boolean;
  isTV: boolean;
  locale: string;
  country: string;
  timezone: string;
  is24Hour: boolean;
  fontScale: number;
  screenScale: number;
  screenDensity: number;
}

export interface CameraOptions {
  quality?: number;
  sourceType?: 'camera' | 'library';
  mediaType?: 'photo' | 'video';
  allowsEditing?: boolean;
  saveToPhotos?: boolean;
  cameraDirection?: 'front' | 'back';
  videoMaxDuration?: number;
}

export interface BiometricOptions {
  title: string;
  subtitle?: string;
  description?: string;
  fallbackLabel?: string;
  cancelLabel?: string;
}

export interface NotificationOptions {
  title: string;
  body: string;
  badge?: number;
  sound?: string;
  data?: any;
  actions?: Array<{
    id: string;
    title: string;
    icon?: string;
  }>;
  schedule?: {
    time: Date;
    repeat?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  };
}

export interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

export interface GeolocationPosition {
  coords: {
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy: number;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
}

export interface FileSystemOptions {
  directory?: 'documents' | 'cache' | 'temp' | 'bundle';
  encoding?: 'utf8' | 'base64' | 'binary';
}

export interface PlatformBridge {
  /**
   * Get platform capabilities
   */
  getCapabilities(): PlatformCapabilities;
  
  /**
   * Get system information
   */
  getSystemInfo(): SystemInfo;
  
  /**
   * Camera access
   */
  camera: {
    isAvailable(): boolean;
    takePicture(options?: CameraOptions): Promise<string>;
    recordVideo(options?: CameraOptions): Promise<string>;
    pickFromLibrary(options?: CameraOptions): Promise<string>;
  };
  
  /**
   * Biometric authentication
   */
  biometrics: {
    isAvailable(): Promise<boolean>;
    getSupportedTypes(): Promise<Array<'touchID' | 'faceID' | 'fingerprint' | 'face' | 'iris'>>;
    authenticate(options: BiometricOptions): Promise<boolean>;
  };
  
  /**
   * Push notifications
   */
  notifications: {
    requestPermission(): Promise<boolean>;
    schedule(notification: NotificationOptions): Promise<string>;
    cancel(id: string): Promise<void>;
    cancelAll(): Promise<void>;
    getScheduled(): Promise<NotificationOptions[]>;
    addListener(event: 'notification', callback: (notification: any) => void): void;
    removeListener(event: 'notification', callback: (notification: any) => void): void;
  };
  
  /**
   * File system access
   */
  fileSystem: {
    readFile(path: string, options?: FileSystemOptions): Promise<string>;
    writeFile(path: string, content: string, options?: FileSystemOptions): Promise<void>;
    deleteFile(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    mkdir(path: string): Promise<void>;
    readdir(path: string): Promise<string[]>;
    stat(path: string): Promise<{
      size: number;
      isDirectory: boolean;
      modificationTime: Date;
    }>;
  };
  
  /**
   * Geolocation
   */
  geolocation: {
    getCurrentPosition(options?: GeolocationOptions): Promise<GeolocationPosition>;
    watchPosition(
      success: (position: GeolocationPosition) => void,
      error?: (error: any) => void,
      options?: GeolocationOptions
    ): number;
    clearWatch(watchId: number): void;
  };
  
  /**
   * Device sensors
   */
  sensors: {
    accelerometer: {
      isAvailable(): boolean;
      start(callback: (data: { x: number; y: number; z: number }) => void): void;
      stop(): void;
    };
    gyroscope: {
      isAvailable(): boolean;
      start(callback: (data: { x: number; y: number; z: number }) => void): void;
      stop(): void;
    };
    magnetometer: {
      isAvailable(): boolean;
      start(callback: (data: { x: number; y: number; z: number }) => void): void;
      stop(): void;
    };
  };
  
  /**
   * Clipboard
   */
  clipboard: {
    getString(): Promise<string>;
    setString(content: string): Promise<void>;
    hasString(): Promise<boolean>;
    clear(): Promise<void>;
  };
  
  /**
   * Share
   */
  share: {
    isAvailable(): boolean;
    share(options: {
      title?: string;
      message?: string;
      url?: string;
      files?: string[];
    }): Promise<void>;
  };
  
  /**
   * App lifecycle
   */
  lifecycle: {
    addListener(event: 'active' | 'background' | 'inactive', callback: () => void): void;
    removeListener(event: 'active' | 'background' | 'inactive', callback: () => void): void;
    getState(): 'active' | 'background' | 'inactive';
    openURL(url: string): Promise<void>;
    canOpenURL(url: string): Promise<boolean>;
  };
  
  /**
   * Haptic feedback
   */
  haptics: {
    impact(style: 'light' | 'medium' | 'heavy'): void;
    notification(type: 'success' | 'warning' | 'error'): void;
    selection(): void;
  };
}

/**
 * Base implementation for platform bridges
 */
export abstract class BasePlatformBridge implements PlatformBridge {
  protected platform: PlatformType;
  
  constructor(platform: PlatformType) {
    this.platform = platform;
  }
  
  abstract getCapabilities(): PlatformCapabilities;
  abstract getSystemInfo(): SystemInfo;
  
  // Default implementations that can be overridden
  
  camera = {
    isAvailable: () => false,
    takePicture: async () => { throw new Error('Camera not available'); },
    recordVideo: async () => { throw new Error('Camera not available'); },
    pickFromLibrary: async () => { throw new Error('Camera not available'); }
  };
  
  biometrics = {
    isAvailable: async () => false,
    getSupportedTypes: async () => [],
    authenticate: async () => false
  };
  
  notifications = {
    requestPermission: async () => false,
    schedule: async () => '',
    cancel: async () => {},
    cancelAll: async () => {},
    getScheduled: async () => [],
    addListener: () => {},
    removeListener: () => {}
  };
  
  fileSystem = {
    readFile: async () => { throw new Error('FileSystem not available'); },
    writeFile: async () => { throw new Error('FileSystem not available'); },
    deleteFile: async () => { throw new Error('FileSystem not available'); },
    exists: async () => false,
    mkdir: async () => { throw new Error('FileSystem not available'); },
    readdir: async () => [],
    stat: async () => { throw new Error('FileSystem not available'); }
  };
  
  geolocation = {
    getCurrentPosition: async () => { throw new Error('Geolocation not available'); },
    watchPosition: () => 0,
    clearWatch: () => {}
  };
  
  sensors = {
    accelerometer: {
      isAvailable: () => false,
      start: () => {},
      stop: () => {}
    },
    gyroscope: {
      isAvailable: () => false,
      start: () => {},
      stop: () => {}
    },
    magnetometer: {
      isAvailable: () => false,
      start: () => {},
      stop: () => {}
    }
  };
  
  clipboard = {
    getString: async () => '',
    setString: async () => {},
    hasString: async () => false,
    clear: async () => {}
  };
  
  share = {
    isAvailable: () => false,
    share: async () => { throw new Error('Share not available'); }
  };
  
  lifecycle = {
    addListener: () => {},
    removeListener: () => {},
    getState: () => 'active' as const,
    openURL: async () => { throw new Error('Cannot open URL'); },
    canOpenURL: async () => false
  };
  
  haptics = {
    impact: () => {},
    notification: () => {},
    selection: () => {}
  };
}
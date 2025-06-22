/**
 * Gesture handling system for Eghact mobile adapters
 */

export interface Point {
  x: number;
  y: number;
}

export interface GestureEvent {
  type: GestureType;
  timestamp: number;
  touches: Touch[];
  changedTouches: Touch[];
  center: Point;
  deltaX: number;
  deltaY: number;
  deltaTime: number;
  distance: number;
  angle: number;
  velocity: Point;
  scale: number;
  rotation: number;
  target: any;
}

export interface Touch {
  identifier: number;
  target: any;
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
  screenX: number;
  screenY: number;
}

export type GestureType = 
  | 'tap'
  | 'doubleTap'
  | 'longPress'
  | 'pan'
  | 'panStart'
  | 'panMove'
  | 'panEnd'
  | 'swipe'
  | 'swipeLeft'
  | 'swipeRight'
  | 'swipeUp'
  | 'swipeDown'
  | 'pinch'
  | 'pinchStart'
  | 'pinchMove'
  | 'pinchEnd'
  | 'rotate'
  | 'rotateStart'
  | 'rotateMove'
  | 'rotateEnd';

export interface GestureConfig {
  // Tap
  tapThreshold?: number;        // Max movement allowed for tap (default: 10px)
  tapTimeout?: number;          // Max time for tap (default: 250ms)
  doubleTapTimeout?: number;    // Max time between taps (default: 300ms)
  
  // Long press
  longPressTimeout?: number;    // Min time for long press (default: 500ms)
  
  // Pan
  panThreshold?: number;        // Min movement to start pan (default: 10px)
  
  // Swipe
  swipeThreshold?: number;      // Min velocity for swipe (default: 0.3)
  swipeDistance?: number;       // Min distance for swipe (default: 80px)
  
  // Pinch
  pinchThreshold?: number;      // Min scale change (default: 0.01)
  
  // Rotate
  rotateThreshold?: number;     // Min rotation in degrees (default: 1)
  
  // General
  preventDefault?: boolean;
  stopPropagation?: boolean;
}

export interface GestureHandler {
  /**
   * Attach gesture recognition to a component
   */
  attach(component: any, config?: GestureConfig): void;
  
  /**
   * Detach gesture recognition from a component
   */
  detach(component: any): void;
  
  /**
   * Register a gesture callback
   */
  on(component: any, gesture: GestureType, callback: (event: GestureEvent) => void): void;
  
  /**
   * Unregister a gesture callback
   */
  off(component: any, gesture: GestureType, callback?: (event: GestureEvent) => void): void;
  
  /**
   * Enable/disable specific gestures
   */
  enable(component: any, gestures: GestureType[]): void;
  disable(component: any, gestures: GestureType[]): void;
  
  /**
   * Check if a gesture is supported on the current platform
   */
  isSupported(gesture: GestureType): boolean;
  
  /**
   * Create a custom gesture recognizer
   */
  createRecognizer(options: CustomGestureOptions): GestureRecognizer;
}

export interface CustomGestureOptions {
  name: string;
  threshold?: number;
  pointers?: number;
  direction?: 'all' | 'horizontal' | 'vertical';
  recognize: (event: TouchEvent, state: GestureState) => boolean;
}

export interface GestureState {
  startTime: number;
  startTouches: Touch[];
  previousTouches: Touch[];
  currentTouches: Touch[];
  recognized: boolean;
  data: any;
}

export interface GestureRecognizer {
  name: string;
  recognize(event: TouchEvent, state: GestureState): boolean;
  reset(): void;
}

/**
 * Gesture composition helpers
 */
export class GestureComposer {
  /**
   * Create a simultaneous gesture (multiple gestures at once)
   */
  static simultaneous(...gestures: GestureType[]): ComposedGesture {
    return {
      type: 'simultaneous',
      gestures
    };
  }
  
  /**
   * Create a sequence gesture (gestures in order)
   */
  static sequence(...gestures: GestureType[]): ComposedGesture {
    return {
      type: 'sequence',
      gestures,
      timeout: 1000 // Default timeout between gestures
    };
  }
  
  /**
   * Create an exclusive gesture (only one can be active)
   */
  static exclusive(...gestures: GestureType[]): ComposedGesture {
    return {
      type: 'exclusive',
      gestures
    };
  }
}

export interface ComposedGesture {
  type: 'simultaneous' | 'sequence' | 'exclusive';
  gestures: GestureType[];
  timeout?: number;
}

/**
 * Platform-specific gesture implementations
 */
export abstract class BaseGestureHandler implements GestureHandler {
  protected components: Map<any, GestureConfig> = new Map();
  protected listeners: Map<any, Map<GestureType, Set<Function>>> = new Map();
  protected recognizers: Map<string, GestureRecognizer> = new Map();
  
  abstract attach(component: any, config?: GestureConfig): void;
  abstract detach(component: any): void;
  abstract isSupported(gesture: GestureType): boolean;
  
  on(component: any, gesture: GestureType, callback: (event: GestureEvent) => void): void {
    if (!this.listeners.has(component)) {
      this.listeners.set(component, new Map());
    }
    
    const componentListeners = this.listeners.get(component)!;
    if (!componentListeners.has(gesture)) {
      componentListeners.set(gesture, new Set());
    }
    
    componentListeners.get(gesture)!.add(callback);
  }
  
  off(component: any, gesture: GestureType, callback?: (event: GestureEvent) => void): void {
    const componentListeners = this.listeners.get(component);
    if (!componentListeners) return;
    
    const gestureListeners = componentListeners.get(gesture);
    if (!gestureListeners) return;
    
    if (callback) {
      gestureListeners.delete(callback);
    } else {
      gestureListeners.clear();
    }
  }
  
  enable(component: any, gestures: GestureType[]): void {
    // Platform-specific implementation
  }
  
  disable(component: any, gestures: GestureType[]): void {
    // Platform-specific implementation
  }
  
  createRecognizer(options: CustomGestureOptions): GestureRecognizer {
    const recognizer: GestureRecognizer = {
      name: options.name,
      recognize: options.recognize,
      reset: () => {
        // Reset recognizer state
      }
    };
    
    this.recognizers.set(options.name, recognizer);
    return recognizer;
  }
  
  protected emit(component: any, event: GestureEvent): void {
    const componentListeners = this.listeners.get(component);
    if (!componentListeners) return;
    
    const gestureListeners = componentListeners.get(event.type);
    if (!gestureListeners) return;
    
    gestureListeners.forEach(callback => callback(event));
  }
}
/**
 * Animation system for Eghact mobile adapters
 */

export type AnimationType = 'timing' | 'spring' | 'decay';
export type Easing = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | ((t: number) => number);

export interface AnimationConfig {
  duration?: number;
  delay?: number;
  easing?: Easing;
  useNativeDriver?: boolean;
  isInteraction?: boolean;
}

export interface TimingAnimationConfig extends AnimationConfig {
  type: 'timing';
  toValue: number | AnimationValue;
  duration: number;
  easing?: Easing;
}

export interface SpringAnimationConfig extends AnimationConfig {
  type: 'spring';
  toValue: number | AnimationValue;
  velocity?: number;
  tension?: number;
  friction?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
}

export interface DecayAnimationConfig extends AnimationConfig {
  type: 'decay';
  velocity: number;
  deceleration?: number;
}

export type AnimationConfigType = TimingAnimationConfig | SpringAnimationConfig | DecayAnimationConfig;

export interface AnimationValue {
  value: number;
  setValue(value: number): void;
  addListener(callback: (value: { value: number }) => void): string;
  removeListener(id: string): void;
  removeAllListeners(): void;
  interpolate(config: InterpolationConfig): AnimationValue;
}

export interface InterpolationConfig {
  inputRange: number[];
  outputRange: number[] | string[];
  extrapolate?: 'extend' | 'identity' | 'clamp';
  extrapolateLeft?: 'extend' | 'identity' | 'clamp';
  extrapolateRight?: 'extend' | 'identity' | 'clamp';
}

export interface Animation {
  start(callback?: (result: AnimationResult) => void): void;
  stop(): void;
  reset(): void;
}

export interface AnimationResult {
  finished: boolean;
}

export interface AnimationEngine {
  /**
   * Create an animated value
   */
  createValue(initialValue: number): AnimationValue;
  
  /**
   * Create an animated value from X,Y coordinates
   */
  createValueXY(initialValue: { x: number; y: number }): {
    x: AnimationValue;
    y: AnimationValue;
    setValue(value: { x: number; y: number }): void;
    getLayout(): { left: AnimationValue; top: AnimationValue };
  };
  
  /**
   * Create a timing animation
   */
  timing(value: AnimationValue, config: Omit<TimingAnimationConfig, 'type'>): Animation;
  
  /**
   * Create a spring animation
   */
  spring(value: AnimationValue, config: Omit<SpringAnimationConfig, 'type'>): Animation;
  
  /**
   * Create a decay animation
   */
  decay(value: AnimationValue, config: Omit<DecayAnimationConfig, 'type'>): Animation;
  
  /**
   * Run animations in parallel
   */
  parallel(animations: Animation[], config?: { stopTogether?: boolean }): Animation;
  
  /**
   * Run animations in sequence
   */
  sequence(animations: Animation[]): Animation;
  
  /**
   * Stagger animations with delay
   */
  stagger(delayTime: number, animations: Animation[]): Animation;
  
  /**
   * Create a looped animation
   */
  loop(animation: Animation, config?: { iterations?: number; resetBeforeIteration?: boolean }): Animation;
  
  /**
   * Batch animations for performance
   */
  batch(animations: Animation[]): Animation;
  
  /**
   * Platform-specific features
   */
  isNativeDriverSupported(): boolean;
  setUseNativeDriver(useNativeDriver: boolean): void;
}

/**
 * Animation presets for common use cases
 */
export class AnimationPresets {
  static fadeIn(engine: AnimationEngine, value: AnimationValue, duration = 300): Animation {
    return engine.timing(value, {
      toValue: 1,
      duration,
      easing: 'ease-out',
      useNativeDriver: true
    });
  }
  
  static fadeOut(engine: AnimationEngine, value: AnimationValue, duration = 300): Animation {
    return engine.timing(value, {
      toValue: 0,
      duration,
      easing: 'ease-in',
      useNativeDriver: true
    });
  }
  
  static slideIn(
    engine: AnimationEngine,
    value: AnimationValue,
    from: 'left' | 'right' | 'top' | 'bottom',
    distance = 100,
    duration = 300
  ): Animation {
    const toValue = 0;
    const fromValue = from === 'left' || from === 'top' ? -distance : distance;
    
    value.setValue(fromValue);
    
    return engine.timing(value, {
      toValue,
      duration,
      easing: 'ease-out',
      useNativeDriver: true
    });
  }
  
  static bounce(engine: AnimationEngine, value: AnimationValue, height = 100): Animation {
    return engine.sequence([
      engine.timing(value, {
        toValue: -height,
        duration: 300,
        easing: 'ease-out'
      }),
      engine.timing(value, {
        toValue: 0,
        duration: 300,
        easing: (t: number) => {
          // Custom bounce easing
          const n1 = 7.5625;
          const d1 = 2.75;
          
          if (t < 1 / d1) {
            return n1 * t * t;
          } else if (t < 2 / d1) {
            return n1 * (t -= 1.5 / d1) * t + 0.75;
          } else if (t < 2.5 / d1) {
            return n1 * (t -= 2.25 / d1) * t + 0.9375;
          } else {
            return n1 * (t -= 2.625 / d1) * t + 0.984375;
          }
        }
      })
    ]);
  }
  
  static shake(engine: AnimationEngine, value: AnimationValue, intensity = 10, duration = 500): Animation {
    const animations = [];
    const steps = 10;
    const stepDuration = duration / steps;
    
    for (let i = 0; i < steps; i++) {
      const toValue = i % 2 === 0 ? intensity : -intensity;
      animations.push(
        engine.timing(value, {
          toValue: toValue * (1 - i / steps), // Decay intensity
          duration: stepDuration,
          easing: 'linear'
        })
      );
    }
    
    animations.push(
      engine.timing(value, {
        toValue: 0,
        duration: stepDuration,
        easing: 'ease-out'
      })
    );
    
    return engine.sequence(animations);
  }
  
  static pulse(engine: AnimationEngine, value: AnimationValue, scale = 1.1, duration = 1000): Animation {
    return engine.loop(
      engine.sequence([
        engine.timing(value, {
          toValue: scale,
          duration: duration / 2,
          easing: 'ease-in-out'
        }),
        engine.timing(value, {
          toValue: 1,
          duration: duration / 2,
          easing: 'ease-in-out'
        })
      ])
    );
  }
}

/**
 * Base implementation for animation engines
 */
export abstract class BaseAnimationEngine implements AnimationEngine {
  protected useNativeDriver = true;
  
  abstract createValue(initialValue: number): AnimationValue;
  abstract createValueXY(initialValue: { x: number; y: number }): any;
  abstract timing(value: AnimationValue, config: Omit<TimingAnimationConfig, 'type'>): Animation;
  abstract spring(value: AnimationValue, config: Omit<SpringAnimationConfig, 'type'>): Animation;
  abstract decay(value: AnimationValue, config: Omit<DecayAnimationConfig, 'type'>): Animation;
  abstract parallel(animations: Animation[], config?: { stopTogether?: boolean }): Animation;
  abstract sequence(animations: Animation[]): Animation;
  abstract stagger(delayTime: number, animations: Animation[]): Animation;
  abstract loop(animation: Animation, config?: { iterations?: number; resetBeforeIteration?: boolean }): Animation;
  abstract batch(animations: Animation[]): Animation;
  abstract isNativeDriverSupported(): boolean;
  
  setUseNativeDriver(useNativeDriver: boolean): void {
    this.useNativeDriver = useNativeDriver;
  }
  
  protected getEasingFunction(easing: Easing): (t: number) => number {
    if (typeof easing === 'function') return easing;
    
    switch (easing) {
      case 'linear':
        return (t: number) => t;
      case 'ease':
        return (t: number) => t * t * (3 - 2 * t);
      case 'ease-in':
        return (t: number) => t * t;
      case 'ease-out':
        return (t: number) => t * (2 - t);
      case 'ease-in-out':
        return (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      default:
        return (t: number) => t;
    }
  }
}
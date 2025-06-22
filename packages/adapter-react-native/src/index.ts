/**
 * React Native Adapter for Eghact
 * Task #23.3 - React Native implementation
 */

import {
  View,
  Text,
  Image,
  Button,
  TextInput,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Animated,
  PanResponder,
  Platform
} from 'react-native';

import {
  GestureHandlerRootView,
  PanGestureHandler,
  TapGestureHandler,
  PinchGestureHandler,
  RotationGestureHandler,
  LongPressGestureHandler,
  State
} from 'react-native-gesture-handler';

import {
  BaseEghactAdapter,
  IComponentFactory,
  IRenderer,
  ComponentProps,
  TextProps,
  ImageProps,
  ButtonProps,
  InputProps,
  ScrollViewProps,
  ListProps,
  PlatformType
} from '@eghact/adapter-core';

import { ReactNativeGestureHandler } from './gestures';
import { ReactNativeAnimationEngine } from './animations';
import { ReactNativePlatformBridge } from './platform';
import { ReactNativeRenderer } from './renderer';
import { ReactNativeComponentFactory } from './components';

/**
 * React Native implementation of Eghact adapter
 */
export class ReactNativeAdapter extends BaseEghactAdapter {
  platform: PlatformType = 'react-native';
  
  createComponentFactory(): IComponentFactory {
    return new ReactNativeComponentFactory();
  }
  
  createRenderer(): IRenderer {
    return new ReactNativeRenderer();
  }
  
  createGestureHandler(): ReactNativeGestureHandler {
    return new ReactNativeGestureHandler();
  }
  
  createAnimationEngine(): ReactNativeAnimationEngine {
    return new ReactNativeAnimationEngine();
  }
  
  createPlatformBridge(): ReactNativePlatformBridge {
    return new ReactNativePlatformBridge();
  }
  
  // Override measureLayout for React Native
  async measureLayout(component: any): Promise<{
    x: number;
    y: number;
    width: number;
    height: number;
  }> {
    return new Promise((resolve) => {
      if (component && component.measure) {
        component.measure((x: number, y: number, width: number, height: number) => {
          resolve({ x, y, width, height });
        });
      } else {
        resolve({ x: 0, y: 0, width: 0, height: 0 });
      }
    });
  }
}

// Export all React Native specific implementations
export * from './components';
export * from './gestures';
export * from './animations';
export * from './platform';
export * from './renderer';

// Create and export default adapter instance
export const adapter = new ReactNativeAdapter();
export default adapter;
/**
 * React Native Adapter for Eghact Framework
 * Compiles Eghact components to React Native components
 */

import {
  BaseAdapter,
  IViewStyle,
  ITextStyle,
  IPlatformComponent,
  IGestureEvent,
  IAnimation,
  AdapterFactory
} from '@eghact/adapter-core';

import {
  View,
  Text,
  Image,
  Button,
  TextInput,
  ScrollView,
  FlatList,
  Alert,
  Platform,
  PermissionsAndroid,
  Dimensions
} from 'react-native';

import {
  GestureHandlerRootView,
  TapGestureHandler,
  PanGestureHandler,
  PinchGestureHandler,
  LongPressGestureHandler,
  State
} from 'react-native-gesture-handler';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  runOnJS
} from 'react-native-reanimated';

export class ReactNativeAdapter extends BaseAdapter {
  constructor() {
    super('react-native');
  }

  createView(props: { style?: IViewStyle; children?: IPlatformComponent[] }): IPlatformComponent {
    return {
      type: 'View',
      props: {
        style: this.convertViewStyle(props.style),
        children: props.children
      }
    };
  }

  createText(props: { style?: ITextStyle; children: string }): IPlatformComponent {
    return {
      type: 'Text',
      props: {
        style: this.convertTextStyle(props.style),
        children: props.children
      }
    };
  }

  createImage(props: { source: string; style?: IViewStyle }): IPlatformComponent {
    return {
      type: 'Image',
      props: {
        source: { uri: props.source },
        style: this.convertViewStyle(props.style),
        resizeMode: 'cover'
      }
    };
  }

  createButton(props: { title: string; onPress: () => void; style?: IViewStyle }): IPlatformComponent {
    return {
      type: 'TouchableOpacity',
      props: {
        onPress: props.onPress,
        style: this.convertViewStyle(props.style)
      },
      children: [{
        type: 'Text',
        props: {
          style: { color: '#fff', fontSize: 16, textAlign: 'center' },
          children: props.title
        }
      }]
    };
  }

  createTextInput(props: { 
    value: string; 
    onChangeText: (text: string) => void; 
    placeholder?: string; 
    style?: IViewStyle 
  }): IPlatformComponent {
    return {
      type: 'TextInput',
      props: {
        value: props.value,
        onChangeText: props.onChangeText,
        placeholder: props.placeholder,
        style: this.convertViewStyle(props.style)
      }
    };
  }

  createScrollView(props: { style?: IViewStyle; children?: IPlatformComponent[] }): IPlatformComponent {
    return {
      type: 'ScrollView',
      props: {
        style: this.convertViewStyle(props.style),
        contentContainerStyle: { flexGrow: 1 },
        children: props.children
      }
    };
  }

  onTap(handler: (event: IGestureEvent) => void) {
    return {
      attach: (component: IPlatformComponent) => {
        const wrappedComponent = {
          type: 'TapGestureHandler',
          props: {
            onHandlerStateChange: ({ nativeEvent }: any) => {
              if (nativeEvent.state === State.ACTIVE) {
                handler({
                  type: 'tap',
                  x: nativeEvent.x,
                  y: nativeEvent.y,
                  timestamp: Date.now()
                });
              }
            }
          },
          children: [component]
        };
        return wrappedComponent;
      }
    };
  }

  onPan(handler: (event: IGestureEvent) => void) {
    return {
      attach: (component: IPlatformComponent) => {
        const wrappedComponent = {
          type: 'PanGestureHandler',
          props: {
            onGestureEvent: ({ nativeEvent }: any) => {
              handler({
                type: 'pan',
                x: nativeEvent.x,
                y: nativeEvent.y,
                timestamp: Date.now(),
                velocityX: nativeEvent.velocityX,
                velocityY: nativeEvent.velocityY
              });
            }
          },
          children: [component]
        };
        return wrappedComponent;
      }
    };
  }

  onPinch(handler: (event: IGestureEvent) => void) {
    return {
      attach: (component: IPlatformComponent) => {
        const wrappedComponent = {
          type: 'PinchGestureHandler',
          props: {
            onGestureEvent: ({ nativeEvent }: any) => {
              handler({
                type: 'pinch',
                x: nativeEvent.focalX,
                y: nativeEvent.focalY,
                timestamp: Date.now(),
                scale: nativeEvent.scale
              });
            }
          },
          children: [component]
        };
        return wrappedComponent;
      }
    };
  }

  onLongPress(handler: (event: IGestureEvent) => void) {
    return {
      attach: (component: IPlatformComponent) => {
        const wrappedComponent = {
          type: 'LongPressGestureHandler',
          props: {
            minDurationMs: 500,
            onHandlerStateChange: ({ nativeEvent }: any) => {
              if (nativeEvent.state === State.ACTIVE) {
                handler({
                  type: 'longpress',
                  x: nativeEvent.x,
                  y: nativeEvent.y,
                  timestamp: Date.now()
                });
              }
            }
          },
          children: [component]
        };
        return wrappedComponent;
      }
    };
  }

  createTimingAnimation(config: IAnimation) {
    const animatedValue = useSharedValue(config.from);
    
    return {
      start: () => {
        animatedValue.value = withTiming(config.to, {
          duration: config.duration,
          easing: this.getEasing(config.easing)
        }, () => {
          if (config.onComplete) {
            runOnJS(config.onComplete)();
          }
        });
      },
      stop: () => {
        // Cancel animation by setting to current value
        animatedValue.value = animatedValue.value;
      }
    };
  }

  createSpringAnimation(config: { from: any; to: any; tension?: number; friction?: number }) {
    const animatedValue = useSharedValue(config.from);
    
    return {
      start: () => {
        animatedValue.value = withSpring(config.to, {
          damping: config.friction || 10,
          stiffness: config.tension || 100
        });
      },
      stop: () => {
        animatedValue.value = animatedValue.value;
      }
    };
  }

  async requestPermission(permission: string): Promise<boolean> {
    if (Platform.OS === 'android') {
      const androidPermission = this.mapToAndroidPermission(permission);
      const granted = await PermissionsAndroid.request(androidPermission);
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    // iOS permissions are handled differently, usually through Info.plist
    return true;
  }

  openNativeModal(options: { 
    title: string; 
    message: string; 
    buttons: Array<{ text: string; onPress: () => void }> 
  }): void {
    Alert.alert(
      options.title,
      options.message,
      options.buttons.map(btn => ({
        text: btn.text,
        onPress: btn.onPress
      }))
    );
  }

  onMount(component: IPlatformComponent, callback: () => void): void {
    // React Native doesn't have direct mount/unmount hooks in this context
    // This would be handled by the component lifecycle in the actual implementation
    setTimeout(callback, 0);
  }

  onUnmount(component: IPlatformComponent, callback: () => void): void {
    // Similar to onMount, this would be handled in the component lifecycle
  }

  enableVirtualization(listComponent: IPlatformComponent, options?: { itemHeight?: number }): void {
    // Convert ScrollView to FlatList for virtualization
    if (listComponent.type === 'ScrollView') {
      listComponent.type = 'FlatList';
      listComponent.props = {
        ...listComponent.props,
        data: listComponent.children,
        renderItem: ({ item }: any) => item,
        keyExtractor: (_: any, index: number) => index.toString(),
        getItemLayout: options?.itemHeight ? 
          (_: any, index: number) => ({
            length: options.itemHeight!,
            offset: options.itemHeight! * index,
            index
          }) : undefined
      };
    }
  }

  async preloadImages(urls: string[]): Promise<void> {
    const imagePromises = urls.map(url => 
      Image.prefetch(url).catch(err => console.warn(`Failed to preload image: ${url}`, err))
    );
    await Promise.all(imagePromises);
  }

  getPlatformInfo() {
    const { width, height } = Dimensions.get('window');
    return {
      os: Platform.OS,
      version: Platform.Version.toString(),
      deviceType: width > 768 ? 'tablet' : 'phone'
    };
  }

  // Helper methods
  private convertViewStyle(style?: IViewStyle): any {
    if (!style) return {};
    
    return {
      ...style,
      // React Native specific conversions
      paddingHorizontal: typeof style.padding === 'number' ? style.padding : undefined,
      paddingVertical: typeof style.padding === 'number' ? style.padding : undefined
    };
  }

  private convertTextStyle(style?: ITextStyle): any {
    if (!style) return {};
    
    return {
      ...style,
      // React Native specific text style properties
      includeFontPadding: false
    };
  }

  private getEasing(easing?: string): any {
    switch (easing) {
      case 'ease-in':
        return Easing.in(Easing.ease);
      case 'ease-out':
        return Easing.out(Easing.ease);
      case 'ease-in-out':
        return Easing.inOut(Easing.ease);
      default:
        return Easing.linear;
    }
  }

  private mapToAndroidPermission(permission: string): string {
    const permissionMap: Record<string, string> = {
      'camera': PermissionsAndroid.PERMISSIONS.CAMERA,
      'location': PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      'storage': PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      'microphone': PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
    };
    
    return permissionMap[permission] || permission;
  }
}

// Register the adapter
AdapterFactory.register('react-native', new ReactNativeAdapter());

// Export for convenience
export { AdapterFactory } from '@eghact/adapter-core';
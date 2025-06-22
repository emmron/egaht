/**
 * Flutter Adapter for Eghact Framework
 * Uses WebView bridge to communicate between Eghact and Flutter
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

interface FlutterBridge {
  sendMessage(channel: string, data: any): void;
  onMessage(channel: string, handler: (data: any) => void): void;
}

export class FlutterAdapter extends BaseAdapter {
  private bridge: FlutterBridge;
  private componentIdCounter = 0;
  private gestureHandlers = new Map<string, (event: IGestureEvent) => void>();
  private animationHandlers = new Map<string, any>();

  constructor() {
    super('flutter');
    this.bridge = this.initializeBridge();
  }

  private initializeBridge(): FlutterBridge {
    // This would be injected by the Flutter WebView
    if (typeof window !== 'undefined' && (window as any).flutterBridge) {
      return (window as any).flutterBridge;
    }
    
    // Mock implementation for development
    return {
      sendMessage: (channel: string, data: any) => {
        console.log(`Flutter bridge: ${channel}`, data);
      },
      onMessage: (channel: string, handler: (data: any) => void) => {
        // Register message handler
      }
    };
  }

  private generateComponentId(): string {
    return `flutter_component_${++this.componentIdCounter}`;
  }

  createView(props: { style?: IViewStyle; children?: IPlatformComponent[] }): IPlatformComponent {
    const componentId = this.generateComponentId();
    
    this.bridge.sendMessage('createComponent', {
      id: componentId,
      type: 'Container',
      props: {
        decoration: this.convertToFlutterDecoration(props.style),
        constraints: this.convertToFlutterConstraints(props.style),
        padding: this.convertToFlutterPadding(props.style),
        margin: this.convertToFlutterMargin(props.style),
        alignment: this.convertToFlutterAlignment(props.style)
      }
    });

    return {
      type: 'FlutterContainer',
      props: { id: componentId, style: props.style },
      children: props.children,
      key: componentId
    };
  }

  createText(props: { style?: ITextStyle; children: string }): IPlatformComponent {
    const componentId = this.generateComponentId();
    
    this.bridge.sendMessage('createComponent', {
      id: componentId,
      type: 'Text',
      props: {
        text: props.children,
        style: this.convertToFlutterTextStyle(props.style)
      }
    });

    return {
      type: 'FlutterText',
      props: { id: componentId, style: props.style, text: props.children },
      key: componentId
    };
  }

  createImage(props: { source: string; style?: IViewStyle }): IPlatformComponent {
    const componentId = this.generateComponentId();
    
    this.bridge.sendMessage('createComponent', {
      id: componentId,
      type: 'Image',
      props: {
        source: props.source,
        fit: 'cover',
        width: props.style?.width,
        height: props.style?.height
      }
    });

    return {
      type: 'FlutterImage',
      props: { id: componentId, source: props.source, style: props.style },
      key: componentId
    };
  }

  createButton(props: { title: string; onPress: () => void; style?: IViewStyle }): IPlatformComponent {
    const componentId = this.generateComponentId();
    
    this.bridge.sendMessage('createComponent', {
      id: componentId,
      type: 'ElevatedButton',
      props: {
        child: {
          type: 'Text',
          text: props.title
        },
        style: this.convertToFlutterButtonStyle(props.style)
      }
    });

    // Register the onPress handler
    this.bridge.onMessage(`button_press_${componentId}`, () => {
      props.onPress();
    });

    return {
      type: 'FlutterButton',
      props: { id: componentId, title: props.title, style: props.style },
      key: componentId
    };
  }

  createTextInput(props: { 
    value: string; 
    onChangeText: (text: string) => void; 
    placeholder?: string; 
    style?: IViewStyle 
  }): IPlatformComponent {
    const componentId = this.generateComponentId();
    
    this.bridge.sendMessage('createComponent', {
      id: componentId,
      type: 'TextField',
      props: {
        value: props.value,
        decoration: {
          hintText: props.placeholder
        },
        style: this.convertToFlutterTextStyle({})
      }
    });

    // Register text change handler
    this.bridge.onMessage(`text_change_${componentId}`, (data: { text: string }) => {
      props.onChangeText(data.text);
    });

    return {
      type: 'FlutterTextField',
      props: { id: componentId, value: props.value, placeholder: props.placeholder },
      key: componentId
    };
  }

  createScrollView(props: { style?: IViewStyle; children?: IPlatformComponent[] }): IPlatformComponent {
    const componentId = this.generateComponentId();
    
    this.bridge.sendMessage('createComponent', {
      id: componentId,
      type: 'SingleChildScrollView',
      props: {
        scrollDirection: 'vertical',
        padding: this.convertToFlutterPadding(props.style)
      }
    });

    return {
      type: 'FlutterScrollView',
      props: { id: componentId, style: props.style },
      children: props.children,
      key: componentId
    };
  }

  onTap(handler: (event: IGestureEvent) => void) {
    const handlerId = `gesture_${this.generateComponentId()}`;
    this.gestureHandlers.set(handlerId, handler);

    return {
      attach: (component: IPlatformComponent) => {
        this.bridge.sendMessage('addGestureDetector', {
          componentId: component.key,
          type: 'tap',
          handlerId: handlerId
        });

        this.bridge.onMessage(`gesture_${handlerId}`, (data: any) => {
          handler({
            type: 'tap',
            x: data.localPosition.x,
            y: data.localPosition.y,
            timestamp: Date.now()
          });
        });

        return component;
      }
    };
  }

  onPan(handler: (event: IGestureEvent) => void) {
    const handlerId = `gesture_${this.generateComponentId()}`;
    this.gestureHandlers.set(handlerId, handler);

    return {
      attach: (component: IPlatformComponent) => {
        this.bridge.sendMessage('addGestureDetector', {
          componentId: component.key,
          type: 'pan',
          handlerId: handlerId
        });

        this.bridge.onMessage(`gesture_${handlerId}`, (data: any) => {
          handler({
            type: 'pan',
            x: data.localPosition.x,
            y: data.localPosition.y,
            timestamp: Date.now(),
            velocityX: data.velocity.x,
            velocityY: data.velocity.y
          });
        });

        return component;
      }
    };
  }

  onPinch(handler: (event: IGestureEvent) => void) {
    const handlerId = `gesture_${this.generateComponentId()}`;
    this.gestureHandlers.set(handlerId, handler);

    return {
      attach: (component: IPlatformComponent) => {
        this.bridge.sendMessage('addGestureDetector', {
          componentId: component.key,
          type: 'scale',
          handlerId: handlerId
        });

        this.bridge.onMessage(`gesture_${handlerId}`, (data: any) => {
          handler({
            type: 'pinch',
            x: data.focalPoint.x,
            y: data.focalPoint.y,
            timestamp: Date.now(),
            scale: data.scale
          });
        });

        return component;
      }
    };
  }

  onLongPress(handler: (event: IGestureEvent) => void) {
    const handlerId = `gesture_${this.generateComponentId()}`;
    this.gestureHandlers.set(handlerId, handler);

    return {
      attach: (component: IPlatformComponent) => {
        this.bridge.sendMessage('addGestureDetector', {
          componentId: component.key,
          type: 'longPress',
          handlerId: handlerId
        });

        this.bridge.onMessage(`gesture_${handlerId}`, (data: any) => {
          handler({
            type: 'longpress',
            x: data.localPosition.x,
            y: data.localPosition.y,
            timestamp: Date.now()
          });
        });

        return component;
      }
    };
  }

  createTimingAnimation(config: IAnimation) {
    const animationId = `animation_${this.generateComponentId()}`;
    
    this.bridge.sendMessage('createAnimation', {
      id: animationId,
      type: 'tween',
      from: config.from,
      to: config.to,
      duration: config.duration,
      curve: this.convertToFlutterCurve(config.easing)
    });

    if (config.onComplete) {
      this.bridge.onMessage(`animation_complete_${animationId}`, config.onComplete);
    }

    return {
      start: () => {
        this.bridge.sendMessage('startAnimation', { id: animationId });
      },
      stop: () => {
        this.bridge.sendMessage('stopAnimation', { id: animationId });
      }
    };
  }

  createSpringAnimation(config: { from: any; to: any; tension?: number; friction?: number }) {
    const animationId = `animation_${this.generateComponentId()}`;
    
    this.bridge.sendMessage('createAnimation', {
      id: animationId,
      type: 'spring',
      from: config.from,
      to: config.to,
      stiffness: config.tension || 100,
      damping: config.friction || 10
    });

    return {
      start: () => {
        this.bridge.sendMessage('startAnimation', { id: animationId });
      },
      stop: () => {
        this.bridge.sendMessage('stopAnimation', { id: animationId });
      }
    };
  }

  async requestPermission(permission: string): Promise<boolean> {
    return new Promise((resolve) => {
      const requestId = `permission_${this.generateComponentId()}`;
      
      this.bridge.sendMessage('requestPermission', {
        requestId: requestId,
        permission: this.mapToFlutterPermission(permission)
      });

      this.bridge.onMessage(`permission_result_${requestId}`, (data: { granted: boolean }) => {
        resolve(data.granted);
      });
    });
  }

  openNativeModal(options: { 
    title: string; 
    message: string; 
    buttons: Array<{ text: string; onPress: () => void }> 
  }): void {
    const modalId = `modal_${this.generateComponentId()}`;
    
    this.bridge.sendMessage('showDialog', {
      id: modalId,
      title: options.title,
      content: options.message,
      actions: options.buttons.map((btn, index) => ({
        text: btn.text,
        actionId: `${modalId}_action_${index}`
      }))
    });

    options.buttons.forEach((btn, index) => {
      this.bridge.onMessage(`${modalId}_action_${index}`, btn.onPress);
    });
  }

  onMount(component: IPlatformComponent, callback: () => void): void {
    this.bridge.sendMessage('componentMounted', { id: component.key });
    callback();
  }

  onUnmount(component: IPlatformComponent, callback: () => void): void {
    this.bridge.sendMessage('componentUnmounted', { id: component.key });
    callback();
  }

  enableVirtualization(listComponent: IPlatformComponent, options?: { itemHeight?: number }): void {
    if (listComponent.type === 'FlutterScrollView') {
      this.bridge.sendMessage('convertToListView', {
        componentId: listComponent.key,
        itemExtent: options?.itemHeight
      });
    }
  }

  async preloadImages(urls: string[]): Promise<void> {
    return new Promise((resolve) => {
      const requestId = `preload_${this.generateComponentId()}`;
      
      this.bridge.sendMessage('preloadImages', {
        requestId: requestId,
        urls: urls
      });

      this.bridge.onMessage(`preload_complete_${requestId}`, () => {
        resolve();
      });
    });
  }

  getPlatformInfo() {
    // This would be populated by Flutter on initialization
    return {
      os: 'flutter',
      version: '3.0.0',
      deviceType: 'mobile'
    };
  }

  // Helper methods for Flutter-specific conversions
  private convertToFlutterDecoration(style?: IViewStyle): any {
    if (!style) return null;
    
    return {
      color: style.backgroundColor,
      borderRadius: style.borderRadius ? {
        circular: style.borderRadius
      } : null,
      border: style.borderWidth ? {
        width: style.borderWidth,
        color: style.borderColor
      } : null
    };
  }

  private convertToFlutterConstraints(style?: IViewStyle): any {
    if (!style) return null;
    
    return {
      minWidth: style.width,
      maxWidth: style.width,
      minHeight: style.height,
      maxHeight: style.height
    };
  }

  private convertToFlutterPadding(style?: IViewStyle): any {
    if (!style?.padding) return null;
    
    const padding = typeof style.padding === 'number' ? style.padding : 0;
    return {
      left: padding,
      right: padding,
      top: padding,
      bottom: padding
    };
  }

  private convertToFlutterMargin(style?: IViewStyle): any {
    if (!style?.margin) return null;
    
    const margin = typeof style.margin === 'number' ? style.margin : 0;
    return {
      left: margin,
      right: margin,
      top: margin,
      bottom: margin
    };
  }

  private convertToFlutterAlignment(style?: IViewStyle): any {
    if (!style) return null;
    
    const alignMap: Record<string, string> = {
      'flex-start': 'topLeft',
      'center': 'center',
      'flex-end': 'bottomRight'
    };
    
    return alignMap[style.alignItems || 'flex-start'];
  }

  private convertToFlutterTextStyle(style?: ITextStyle): any {
    if (!style) return {};
    
    return {
      color: style.color,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      fontFamily: style.fontFamily,
      height: style.lineHeight,
      letterSpacing: style.letterSpacing
    };
  }

  private convertToFlutterButtonStyle(style?: IViewStyle): any {
    return {
      backgroundColor: style?.backgroundColor,
      padding: this.convertToFlutterPadding(style),
      shape: style?.borderRadius ? {
        type: 'rounded',
        borderRadius: style.borderRadius
      } : null
    };
  }

  private convertToFlutterCurve(easing?: string): string {
    const curveMap: Record<string, string> = {
      'linear': 'linear',
      'ease-in': 'easeIn',
      'ease-out': 'easeOut',
      'ease-in-out': 'easeInOut'
    };
    
    return curveMap[easing || 'linear'] || 'linear';
  }

  private mapToFlutterPermission(permission: string): string {
    const permissionMap: Record<string, string> = {
      'camera': 'camera',
      'location': 'location',
      'storage': 'storage',
      'microphone': 'microphone'
    };
    
    return permissionMap[permission] || permission;
  }
}

// Register the adapter
AdapterFactory.register('flutter', new FlutterAdapter());

export { AdapterFactory } from '@eghact/adapter-core';
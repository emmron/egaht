/**
 * PWA Adapter for Eghact Framework
 * Uses standard web APIs to create mobile-optimized Progressive Web Apps
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

export class PWAAdapter extends BaseAdapter {
  private componentRegistry = new Map<string, HTMLElement>();
  private animationRegistry = new Map<string, Animation>();
  private intersectionObserver: IntersectionObserver;

  constructor() {
    super('pwa');
    this.initializeIntersectionObserver();
    this.registerServiceWorker();
  }

  private initializeIntersectionObserver(): void {
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1 }
    );
  }

  private async registerServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered for PWA');
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  createView(props: { style?: IViewStyle; children?: IPlatformComponent[] }): IPlatformComponent {
    const element = document.createElement('div');
    this.applyViewStyle(element, props.style);
    
    const componentId = this.generateId();
    this.componentRegistry.set(componentId, element);
    
    return {
      type: 'div',
      props: {
        ...props,
        id: componentId,
        element
      },
      children: props.children,
      key: componentId
    };
  }

  createText(props: { style?: ITextStyle; children: string }): IPlatformComponent {
    const element = document.createElement('span');
    element.textContent = props.children;
    this.applyTextStyle(element, props.style);
    
    const componentId = this.generateId();
    this.componentRegistry.set(componentId, element);
    
    return {
      type: 'span',
      props: {
        ...props,
        id: componentId,
        element
      },
      key: componentId
    };
  }

  createImage(props: { source: string; style?: IViewStyle }): IPlatformComponent {
    const element = document.createElement('img');
    element.src = props.source;
    element.loading = 'lazy';
    this.applyViewStyle(element, props.style);
    
    const componentId = this.generateId();
    this.componentRegistry.set(componentId, element);
    
    return {
      type: 'img',
      props: {
        ...props,
        id: componentId,
        element
      },
      key: componentId
    };
  }

  createButton(props: { title: string; onPress: () => void; style?: IViewStyle }): IPlatformComponent {
    const element = document.createElement('button');
    element.textContent = props.title;
    element.addEventListener('click', props.onPress);
    
    // Apply default mobile-friendly styles
    element.style.touchAction = 'manipulation';
    element.style.userSelect = 'none';
    element.style.cursor = 'pointer';
    element.style.minHeight = '44px'; // iOS touch target size
    element.style.minWidth = '44px';
    
    this.applyViewStyle(element, props.style);
    
    const componentId = this.generateId();
    this.componentRegistry.set(componentId, element);
    
    return {
      type: 'button',
      props: {
        ...props,
        id: componentId,
        element
      },
      key: componentId
    };
  }

  createTextInput(props: { 
    value: string; 
    onChangeText: (text: string) => void; 
    placeholder?: string; 
    style?: IViewStyle 
  }): IPlatformComponent {
    const element = document.createElement('input');
    element.type = 'text';
    element.value = props.value;
    element.placeholder = props.placeholder || '';
    
    element.addEventListener('input', (e) => {
      props.onChangeText((e.target as HTMLInputElement).value);
    });
    
    // Mobile optimizations
    element.style.fontSize = '16px'; // Prevent zoom on iOS
    element.style.touchAction = 'manipulation';
    
    this.applyViewStyle(element, props.style);
    
    const componentId = this.generateId();
    this.componentRegistry.set(componentId, element);
    
    return {
      type: 'input',
      props: {
        ...props,
        id: componentId,
        element
      },
      key: componentId
    };
  }

  createScrollView(props: { style?: IViewStyle; children?: IPlatformComponent[] }): IPlatformComponent {
    const element = document.createElement('div');
    
    // Enable smooth scrolling and momentum scrolling on iOS
    element.style.overflowY = 'auto';
    element.style.webkitOverflowScrolling = 'touch';
    element.style.scrollBehavior = 'smooth';
    
    this.applyViewStyle(element, props.style);
    
    const componentId = this.generateId();
    this.componentRegistry.set(componentId, element);
    
    return {
      type: 'scrollview',
      props: {
        ...props,
        id: componentId,
        element
      },
      children: props.children,
      key: componentId
    };
  }

  onTap(handler: (event: IGestureEvent) => void) {
    return {
      attach: (component: IPlatformComponent) => {
        const element = this.getElement(component);
        if (!element) return component;
        
        // Use pointer events for unified touch/mouse handling
        element.addEventListener('pointerup', (e) => {
          handler({
            type: 'tap',
            x: e.clientX,
            y: e.clientY,
            timestamp: Date.now()
          });
        });
        
        return component;
      }
    };
  }

  onPan(handler: (event: IGestureEvent) => void) {
    return {
      attach: (component: IPlatformComponent) => {
        const element = this.getElement(component);
        if (!element) return component;
        
        let startX = 0;
        let startY = 0;
        let lastX = 0;
        let lastY = 0;
        let lastTime = 0;
        
        element.addEventListener('pointerdown', (e) => {
          startX = e.clientX;
          startY = e.clientY;
          lastX = e.clientX;
          lastY = e.clientY;
          lastTime = Date.now();
          element.setPointerCapture(e.pointerId);
        });
        
        element.addEventListener('pointermove', (e) => {
          if (!element.hasPointerCapture(e.pointerId)) return;
          
          const currentTime = Date.now();
          const deltaTime = currentTime - lastTime;
          const velocityX = deltaTime > 0 ? (e.clientX - lastX) / deltaTime * 1000 : 0;
          const velocityY = deltaTime > 0 ? (e.clientY - lastY) / deltaTime * 1000 : 0;
          
          handler({
            type: 'pan',
            x: e.clientX,
            y: e.clientY,
            timestamp: currentTime,
            velocityX,
            velocityY
          });
          
          lastX = e.clientX;
          lastY = e.clientY;
          lastTime = currentTime;
        });
        
        element.addEventListener('pointerup', (e) => {
          element.releasePointerCapture(e.pointerId);
        });
        
        return component;
      }
    };
  }

  onPinch(handler: (event: IGestureEvent) => void) {
    return {
      attach: (component: IPlatformComponent) => {
        const element = this.getElement(component);
        if (!element) return component;
        
        let initialDistance = 0;
        const touches = new Map<number, Touch>();
        
        element.addEventListener('touchstart', (e) => {
          Array.from(e.touches).forEach(touch => {
            touches.set(touch.identifier, touch);
          });
          
          if (touches.size === 2) {
            const touchArray = Array.from(touches.values());
            initialDistance = this.getDistance(touchArray[0], touchArray[1]);
          }
        });
        
        element.addEventListener('touchmove', (e) => {
          e.preventDefault();
          
          Array.from(e.touches).forEach(touch => {
            touches.set(touch.identifier, touch);
          });
          
          if (touches.size === 2) {
            const touchArray = Array.from(touches.values());
            const currentDistance = this.getDistance(touchArray[0], touchArray[1]);
            const scale = currentDistance / initialDistance;
            
            const centerX = (touchArray[0].clientX + touchArray[1].clientX) / 2;
            const centerY = (touchArray[0].clientY + touchArray[1].clientY) / 2;
            
            handler({
              type: 'pinch',
              x: centerX,
              y: centerY,
              timestamp: Date.now(),
              scale
            });
          }
        });
        
        element.addEventListener('touchend', (e) => {
          Array.from(e.changedTouches).forEach(touch => {
            touches.delete(touch.identifier);
          });
        });
        
        return component;
      }
    };
  }

  onLongPress(handler: (event: IGestureEvent) => void) {
    return {
      attach: (component: IPlatformComponent) => {
        const element = this.getElement(component);
        if (!element) return component;
        
        let longPressTimer: number;
        
        element.addEventListener('pointerdown', (e) => {
          longPressTimer = window.setTimeout(() => {
            handler({
              type: 'longpress',
              x: e.clientX,
              y: e.clientY,
              timestamp: Date.now()
            });
          }, 500);
        });
        
        element.addEventListener('pointerup', () => {
          clearTimeout(longPressTimer);
        });
        
        element.addEventListener('pointercancel', () => {
          clearTimeout(longPressTimer);
        });
        
        return component;
      }
    };
  }

  createTimingAnimation(config: IAnimation) {
    const animationId = this.generateId();
    
    return {
      start: () => {
        const keyframes = [
          { transform: this.valueToTransform(config.from) },
          { transform: this.valueToTransform(config.to) }
        ];
        
        const options: KeyframeAnimationOptions = {
          duration: config.duration,
          easing: config.easing || 'linear',
          delay: config.delay || 0,
          fill: 'forwards'
        };
        
        // Find element to animate (would be passed in real implementation)
        const element = document.body; // Placeholder
        
        const animation = element.animate(keyframes, options);
        this.animationRegistry.set(animationId, animation);
        
        if (config.onComplete) {
          animation.onfinish = config.onComplete;
        }
      },
      stop: () => {
        const animation = this.animationRegistry.get(animationId);
        if (animation) {
          animation.cancel();
          this.animationRegistry.delete(animationId);
        }
      }
    };
  }

  createSpringAnimation(config: { from: any; to: any; tension?: number; friction?: number }) {
    // Web Animations API doesn't have native spring support
    // Using a cubic-bezier approximation
    const springEasing = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    
    return this.createTimingAnimation({
      from: config.from,
      to: config.to,
      duration: 300,
      easing: springEasing as any
    });
  }

  async requestPermission(permission: string): Promise<boolean> {
    try {
      switch (permission) {
        case 'camera':
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(track => track.stop());
          return true;
          
        case 'location':
          return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              () => resolve(true),
              () => resolve(false)
            );
          });
          
        case 'notification':
          const result = await Notification.requestPermission();
          return result === 'granted';
          
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  openNativeModal(options: { 
    title: string; 
    message: string; 
    buttons: Array<{ text: string; onPress: () => void }> 
  }): void {
    // Create a custom modal for PWA
    const modal = document.createElement('div');
    modal.className = 'pwa-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      max-width: 80%;
      max-height: 80%;
      overflow: auto;
    `;
    
    const title = document.createElement('h3');
    title.textContent = options.title;
    dialog.appendChild(title);
    
    const message = document.createElement('p');
    message.textContent = options.message;
    dialog.appendChild(message);
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 10px; margin-top: 20px;';
    
    options.buttons.forEach(btn => {
      const button = document.createElement('button');
      button.textContent = btn.text;
      button.style.cssText = 'padding: 8px 16px; border-radius: 4px; border: none; background: #007AFF; color: white;';
      button.onclick = () => {
        document.body.removeChild(modal);
        btn.onPress();
      };
      buttonContainer.appendChild(button);
    });
    
    dialog.appendChild(buttonContainer);
    modal.appendChild(dialog);
    document.body.appendChild(modal);
  }

  onMount(component: IPlatformComponent, callback: () => void): void {
    const element = this.getElement(component);
    if (element) {
      // Use intersection observer for lazy loading
      this.intersectionObserver.observe(element);
    }
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(callback);
  }

  onUnmount(component: IPlatformComponent, callback: () => void): void {
    const element = this.getElement(component);
    if (element) {
      this.intersectionObserver.unobserve(element);
      this.componentRegistry.delete(component.key as string);
    }
    callback();
  }

  enableVirtualization(listComponent: IPlatformComponent, options?: { itemHeight?: number }): void {
    const element = this.getElement(listComponent);
    if (!element) return;
    
    // Implement virtual scrolling
    const itemHeight = options?.itemHeight || 50;
    const visibleItems = Math.ceil(element.clientHeight / itemHeight) + 2;
    
    // This is a simplified implementation
    // In production, you'd implement a full virtual scrolling solution
    element.style.cssText += `
      overflow-y: auto;
      position: relative;
    `;
    
    // Add scroll event listener for virtual scrolling
    element.addEventListener('scroll', () => {
      const scrollTop = element.scrollTop;
      const startIndex = Math.floor(scrollTop / itemHeight);
      // Update visible items based on scroll position
    });
  }

  async preloadImages(urls: string[]): Promise<void> {
    const promises = urls.map(url => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to preload: ${url}`));
        img.src = url;
      });
    });
    
    await Promise.all(promises);
  }

  getPlatformInfo() {
    const ua = navigator.userAgent;
    const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
    
    return {
      os: 'web',
      version: navigator.appVersion,
      deviceType: isMobile ? 'mobile' : 'desktop'
    };
  }

  // Helper methods
  private generateId(): string {
    return `pwa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getElement(component: IPlatformComponent): HTMLElement | null {
    if (component.props?.element) {
      return component.props.element;
    }
    if (component.key) {
      return this.componentRegistry.get(component.key as string) || null;
    }
    return null;
  }

  private applyViewStyle(element: HTMLElement, style?: IViewStyle): void {
    if (!style) return;
    
    Object.assign(element.style, {
      backgroundColor: style.backgroundColor,
      padding: this.convertSpacing(style.padding),
      margin: this.convertSpacing(style.margin),
      borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
      borderWidth: style.borderWidth ? `${style.borderWidth}px` : undefined,
      borderColor: style.borderColor,
      borderStyle: style.borderWidth ? 'solid' : undefined,
      display: 'flex',
      flexDirection: style.flexDirection || 'column',
      justifyContent: style.justifyContent,
      alignItems: style.alignItems,
      width: this.convertSize(style.width),
      height: this.convertSize(style.height),
      position: style.position,
      top: this.convertSize(style.top),
      left: this.convertSize(style.left),
      right: this.convertSize(style.right),
      bottom: this.convertSize(style.bottom),
      flex: style.flex?.toString()
    });
  }

  private applyTextStyle(element: HTMLElement, style?: ITextStyle): void {
    if (!style) return;
    
    Object.assign(element.style, {
      color: style.color,
      fontSize: style.fontSize ? `${style.fontSize}px` : undefined,
      fontWeight: style.fontWeight,
      fontFamily: style.fontFamily,
      textAlign: style.textAlign,
      lineHeight: style.lineHeight?.toString(),
      letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined
    });
  }

  private convertSpacing(value?: number | string): string | undefined {
    if (value === undefined) return undefined;
    return typeof value === 'number' ? `${value}px` : value;
  }

  private convertSize(value?: number | string): string | undefined {
    if (value === undefined) return undefined;
    return typeof value === 'number' ? `${value}px` : value;
  }

  private valueToTransform(value: any): string {
    if (typeof value === 'number') {
      return `translateX(${value}px)`;
    }
    if (typeof value === 'object') {
      const transforms: string[] = [];
      if (value.x !== undefined) transforms.push(`translateX(${value.x}px)`);
      if (value.y !== undefined) transforms.push(`translateY(${value.y}px)`);
      if (value.scale !== undefined) transforms.push(`scale(${value.scale})`);
      if (value.rotation !== undefined) transforms.push(`rotate(${value.rotation}deg)`);
      return transforms.join(' ');
    }
    return value;
  }

  private getDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

// Register the adapter
AdapterFactory.register('pwa', new PWAAdapter());

export { AdapterFactory } from '@eghact/adapter-core';
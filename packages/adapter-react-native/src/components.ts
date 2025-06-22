/**
 * React Native Component Factory
 */

import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  RefreshControl,
  StyleSheet
} from 'react-native';

import {
  IComponentFactory,
  ComponentType,
  ComponentProps,
  TextProps,
  ImageProps,
  ButtonProps,
  InputProps,
  ScrollViewProps,
  ListProps,
  StyleProps
} from '@eghact/adapter-core';

export class ReactNativeComponentFactory implements IComponentFactory {
  private components = new Map<any, { type: ComponentType; props: any }>();
  
  create(type: ComponentType, props: any): any {
    let component: any;
    
    switch (type) {
      case 'view':
        component = this.createView(props);
        break;
      case 'text':
        component = this.createText(props);
        break;
      case 'image':
        component = this.createImage(props);
        break;
      case 'button':
        component = this.createButton(props);
        break;
      case 'input':
        component = this.createInput(props);
        break;
      case 'scroll':
        component = this.createScrollView(props);
        break;
      case 'list':
        component = this.createList(props);
        break;
      default:
        throw new Error(`Unknown component type: ${type}`);
    }
    
    this.components.set(component, { type, props });
    return component;
  }
  
  update(component: any, props: any): void {
    const componentInfo = this.components.get(component);
    if (componentInfo) {
      componentInfo.props = props;
      // In a real implementation, would trigger re-render
    }
  }
  
  destroy(component: any): void {
    this.components.delete(component);
  }
  
  private createView(props: ComponentProps): React.ReactElement {
    const style = this.convertStyle(props.style);
    
    return React.createElement(View, {
      style,
      testID: props.testID,
      accessible: props.accessible,
      accessibilityLabel: props.accessibilityLabel,
      accessibilityRole: props.accessibilityRole as any
    }, props.children);
  }
  
  private createText(props: TextProps): React.ReactElement {
    const style = this.convertStyle(props.style);
    
    return React.createElement(Text, {
      style,
      numberOfLines: props.numberOfLines,
      ellipsizeMode: props.ellipsizeMode,
      testID: props.testID,
      accessible: props.accessible,
      accessibilityLabel: props.accessibilityLabel
    }, props.text);
  }
  
  private createImage(props: ImageProps): React.ReactElement {
    const style = this.convertStyle(props.style);
    const source = typeof props.source === 'string' 
      ? { uri: props.source } 
      : props.source;
    
    return React.createElement(Image, {
      source,
      style,
      resizeMode: props.resizeMode as any,
      onLoad: props.onLoad,
      onError: props.onError,
      testID: props.testID,
      accessible: props.accessible,
      accessibilityLabel: props.accessibilityLabel
    });
  }
  
  private createButton(props: ButtonProps): React.ReactElement {
    const style = this.convertStyle(props.style);
    
    // Use TouchableOpacity for better styling control
    return React.createElement(
      TouchableOpacity,
      {
        onPress: props.onPress,
        disabled: props.disabled,
        style: [
          {
            backgroundColor: '#007ACC',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 4,
            opacity: props.disabled ? 0.5 : 1
          },
          style
        ],
        testID: props.testID,
        accessible: props.accessible,
        accessibilityLabel: props.accessibilityLabel,
        accessibilityRole: 'button'
      },
      React.createElement(
        Text,
        {
          style: {
            color: 'white',
            fontSize: 16,
            textAlign: 'center'
          }
        },
        props.title
      )
    );
  }
  
  private createInput(props: InputProps): React.ReactElement {
    const style = this.convertStyle(props.style);
    
    return React.createElement(TextInput, {
      value: props.value,
      onChangeText: props.onChangeText,
      placeholder: props.placeholder,
      keyboardType: props.keyboardType as any,
      secureTextEntry: props.secureTextEntry,
      autoFocus: props.autoFocus,
      maxLength: props.maxLength,
      style: [
        {
          borderWidth: 1,
          borderColor: '#ddd',
          padding: 8,
          borderRadius: 4
        },
        style
      ],
      testID: props.testID,
      accessible: props.accessible,
      accessibilityLabel: props.accessibilityLabel
    });
  }
  
  private createScrollView(props: ScrollViewProps): React.ReactElement {
    const style = this.convertStyle(props.style);
    
    const refreshControl = props.refreshControl
      ? React.createElement(RefreshControl, {
          refreshing: props.refreshControl.refreshing,
          onRefresh: props.refreshControl.onRefresh,
          tintColor: props.refreshControl.tintColor,
          title: props.refreshControl.title
        })
      : undefined;
    
    return React.createElement(ScrollView, {
      style,
      horizontal: props.horizontal,
      showsVerticalScrollIndicator: props.showsVerticalScrollIndicator,
      showsHorizontalScrollIndicator: props.showsHorizontalScrollIndicator,
      scrollEnabled: props.scrollEnabled,
      onScroll: props.onScroll,
      refreshControl,
      testID: props.testID,
      accessible: props.accessible,
      accessibilityLabel: props.accessibilityLabel
    }, props.children);
  }
  
  private createList(props: ListProps): React.ReactElement {
    const style = this.convertStyle(props.style);
    
    return React.createElement(FlatList, {
      data: props.data,
      renderItem: ({ item, index }) => props.renderItem(item, index),
      keyExtractor: props.keyExtractor || ((item, index) => String(index)),
      horizontal: props.horizontal,
      numColumns: props.numColumns,
      onEndReached: props.onEndReached,
      onEndReachedThreshold: props.onEndReachedThreshold,
      refreshing: props.refreshing,
      onRefresh: props.onRefresh,
      style,
      testID: props.testID,
      accessible: props.accessible,
      accessibilityLabel: props.accessibilityLabel
    });
  }
  
  private convertStyle(style?: StyleProps): any {
    if (!style) return undefined;
    
    // Convert Eghact style to React Native style
    const rnStyle: any = {};
    
    // Layout
    if (style.width !== undefined) rnStyle.width = style.width;
    if (style.height !== undefined) rnStyle.height = style.height;
    if (style.minWidth !== undefined) rnStyle.minWidth = style.minWidth;
    if (style.minHeight !== undefined) rnStyle.minHeight = style.minHeight;
    if (style.maxWidth !== undefined) rnStyle.maxWidth = style.maxWidth;
    if (style.maxHeight !== undefined) rnStyle.maxHeight = style.maxHeight;
    
    // Positioning
    if (style.position !== undefined) rnStyle.position = style.position;
    if (style.top !== undefined) rnStyle.top = style.top;
    if (style.right !== undefined) rnStyle.right = style.right;
    if (style.bottom !== undefined) rnStyle.bottom = style.bottom;
    if (style.left !== undefined) rnStyle.left = style.left;
    if (style.zIndex !== undefined) rnStyle.zIndex = style.zIndex;
    
    // Flexbox
    if (style.flex !== undefined) rnStyle.flex = style.flex;
    if (style.flexDirection !== undefined) rnStyle.flexDirection = style.flexDirection;
    if (style.justifyContent !== undefined) rnStyle.justifyContent = style.justifyContent;
    if (style.alignItems !== undefined) rnStyle.alignItems = style.alignItems;
    if (style.alignSelf !== undefined) rnStyle.alignSelf = style.alignSelf;
    if (style.flexWrap !== undefined) rnStyle.flexWrap = style.flexWrap;
    
    // Spacing
    if (style.margin !== undefined) rnStyle.margin = style.margin;
    if (style.marginTop !== undefined) rnStyle.marginTop = style.marginTop;
    if (style.marginRight !== undefined) rnStyle.marginRight = style.marginRight;
    if (style.marginBottom !== undefined) rnStyle.marginBottom = style.marginBottom;
    if (style.marginLeft !== undefined) rnStyle.marginLeft = style.marginLeft;
    if (style.padding !== undefined) rnStyle.padding = style.padding;
    if (style.paddingTop !== undefined) rnStyle.paddingTop = style.paddingTop;
    if (style.paddingRight !== undefined) rnStyle.paddingRight = style.paddingRight;
    if (style.paddingBottom !== undefined) rnStyle.paddingBottom = style.paddingBottom;
    if (style.paddingLeft !== undefined) rnStyle.paddingLeft = style.paddingLeft;
    
    // Visual
    if (style.backgroundColor !== undefined) {
      rnStyle.backgroundColor = this.convertColor(style.backgroundColor);
    }
    if (style.borderRadius !== undefined) rnStyle.borderRadius = style.borderRadius;
    if (style.borderWidth !== undefined) rnStyle.borderWidth = style.borderWidth;
    if (style.borderColor !== undefined) {
      rnStyle.borderColor = this.convertColor(style.borderColor);
    }
    if (style.opacity !== undefined) rnStyle.opacity = style.opacity;
    
    // Typography
    if (style.fontSize !== undefined) rnStyle.fontSize = style.fontSize;
    if (style.fontWeight !== undefined) rnStyle.fontWeight = style.fontWeight;
    if (style.fontFamily !== undefined) rnStyle.fontFamily = style.fontFamily;
    if (style.color !== undefined) rnStyle.color = this.convertColor(style.color);
    if (style.textAlign !== undefined) rnStyle.textAlign = style.textAlign;
    if (style.lineHeight !== undefined) rnStyle.lineHeight = style.lineHeight;
    
    // Shadows (iOS)
    if (style.shadowColor !== undefined) {
      rnStyle.shadowColor = this.convertColor(style.shadowColor);
    }
    if (style.shadowOffset !== undefined) rnStyle.shadowOffset = style.shadowOffset;
    if (style.shadowOpacity !== undefined) rnStyle.shadowOpacity = style.shadowOpacity;
    if (style.shadowRadius !== undefined) rnStyle.shadowRadius = style.shadowRadius;
    
    // Elevation (Android)
    if (style.elevation !== undefined) rnStyle.elevation = style.elevation;
    
    return rnStyle;
  }
  
  private convertColor(color: any): string {
    if (typeof color === 'string') return color;
    
    if (color && typeof color === 'object' && 'r' in color) {
      const { r, g, b, a = 1 } = color;
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    
    return 'transparent';
  }
}
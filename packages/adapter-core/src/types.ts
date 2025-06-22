/**
 * Core type definitions for Eghact mobile adapters
 */

export type ComponentType = 'view' | 'text' | 'image' | 'button' | 'input' | 'scroll' | 'list';

export type PlatformType = 'react-native' | 'flutter' | 'pwa' | 'native-ios' | 'native-android';

export interface Dimensions {
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Color {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface StyleProps {
  // Layout
  width?: number | string;
  height?: number | string;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  
  // Positioning
  position?: 'relative' | 'absolute' | 'fixed';
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  zIndex?: number;
  
  // Flexbox
  flex?: number;
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  alignSelf?: 'auto' | 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  
  // Spacing
  margin?: number | string;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  padding?: number | string;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  
  // Visual
  backgroundColor?: string | Color;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string | Color;
  opacity?: number;
  
  // Typography (for text components)
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  fontFamily?: string;
  color?: string | Color;
  textAlign?: 'left' | 'right' | 'center' | 'justify';
  lineHeight?: number;
  
  // Shadows
  shadowColor?: string | Color;
  shadowOffset?: { width: number; height: number };
  shadowOpacity?: number;
  shadowRadius?: number;
  elevation?: number; // Android-specific
}

export interface ComponentProps {
  id?: string;
  style?: StyleProps;
  className?: string;
  testID?: string;
  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: string;
  children?: any;
}

export interface TextProps extends ComponentProps {
  text: string;
  numberOfLines?: number;
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
}

export interface ImageProps extends ComponentProps {
  source: string | { uri: string };
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  onLoad?: () => void;
  onError?: (error: any) => void;
}

export interface ButtonProps extends ComponentProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}

export interface InputProps extends ComponentProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  secureTextEntry?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
}

export interface ScrollViewProps extends ComponentProps {
  horizontal?: boolean;
  showsVerticalScrollIndicator?: boolean;
  showsHorizontalScrollIndicator?: boolean;
  scrollEnabled?: boolean;
  onScroll?: (event: ScrollEvent) => void;
  refreshControl?: RefreshControlProps;
}

export interface ListProps extends ComponentProps {
  data: any[];
  renderItem: (item: any, index: number) => any;
  keyExtractor?: (item: any, index: number) => string;
  horizontal?: boolean;
  numColumns?: number;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export interface ScrollEvent {
  contentOffset: Position;
  contentSize: Dimensions;
  layoutMeasurement: Dimensions;
}

export interface RefreshControlProps {
  refreshing: boolean;
  onRefresh: () => void;
  tintColor?: string;
  title?: string;
}
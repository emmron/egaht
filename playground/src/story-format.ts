export interface StoryMeta {
  title: string;
  component: any;
  argTypes?: Record<string, ArgType>;
  parameters?: StoryParameters;
  decorators?: Decorator[];
}

export interface ArgType {
  control: ControlType | ControlConfig;
  description?: string;
  defaultValue?: any;
  options?: any[];
  action?: string;
}

export type ControlType = 
  | 'text'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multi-select'
  | 'radio'
  | 'inline-radio'
  | 'check'
  | 'inline-check'
  | 'range'
  | 'color'
  | 'date'
  | 'object'
  | 'array';

export interface ControlConfig {
  type: ControlType;
  min?: number;
  max?: number;
  step?: number;
  options?: any[];
  labels?: Record<string, string>;
}

export interface Story {
  name?: string;
  args?: Record<string, any>;
  argTypes?: Record<string, ArgType>;
  parameters?: StoryParameters;
  play?: (context: StoryContext) => Promise<void> | void;
}

export interface StoryParameters {
  layout?: 'centered' | 'fullscreen' | 'padded';
  backgrounds?: {
    default?: string;
    values?: Array<{
      name: string;
      value: string;
    }>;
  };
  viewport?: {
    defaultViewport?: string;
    viewports?: Record<string, Viewport>;
  };
  docs?: {
    description?: {
      story?: string;
      component?: string;
    };
  };
}

export interface Viewport {
  name: string;
  styles: {
    width: string;
    height: string;
  };
  type?: 'desktop' | 'mobile' | 'tablet';
}

export interface StoryContext {
  args: Record<string, any>;
  globals: Record<string, any>;
  parameters: StoryParameters;
  viewMode: 'story' | 'docs';
  id: string;
  title: string;
  name: string;
}

export type Decorator = (
  Story: any,
  context: StoryContext
) => any;

export interface StoryFile {
  path: string;
  meta: StoryMeta;
  stories: Record<string, Story>;
  component: any;
}

// Story discovery pattern
export const STORY_GLOB = '**/*.story.egh';
export const STORY_REGEX = /\.story\.egh$/;
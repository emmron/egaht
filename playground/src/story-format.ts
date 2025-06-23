/**
 * Story Format Type Definitions
 * Defines the structure of .story.egh files
 */

export interface StoryFile {
  // Metadata from frontmatter
  meta: StoryMeta;
  // Individual stories in the file
  stories: Story[];
  // Raw source code
  source: string;
  // File path
  path: string;
}

export interface StoryMeta {
  // Component being demonstrated
  component: string;
  // Display title in sidebar
  title: string;
  // Category for grouping (e.g., "Forms", "Layout", "Data Display")
  category?: string;
  // Brief description
  description?: string;
  // Tags for search/filtering
  tags?: string[];
  // Component status
  status?: 'stable' | 'beta' | 'experimental' | 'deprecated';
  // Related documentation links
  docs?: {
    url: string;
    label: string;
  }[];
}

export interface Story {
  // Unique story ID (from markdown header ID)
  id: string;
  // Story name
  name: string;
  // Story-specific description
  description?: string;
  // Component render function or template
  render: () => any;
  // Interactive controls configuration
  controls?: Controls;
  // Default prop values
  args?: Record<string, any>;
  // Story-specific parameters
  parameters?: StoryParameters;
  // Decorators to wrap the story
  decorators?: ((Story: any) => any)[];
}

export interface Controls {
  [propName: string]: Control;
}

export type Control = 
  | SelectControl
  | BooleanControl
  | NumberControl
  | TextControl
  | ColorControl
  | DateControl
  | ObjectControl
  | ArrayControl;

export interface SelectControl {
  type: 'select';
  options: string[] | { label: string; value: any }[];
  defaultValue?: any;
}

export interface BooleanControl {
  type: 'boolean';
  defaultValue?: boolean;
}

export interface NumberControl {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
}

export interface TextControl {
  type: 'text';
  placeholder?: string;
  defaultValue?: string;
}

export interface ColorControl {
  type: 'color';
  presets?: string[];
  defaultValue?: string;
}

export interface DateControl {
  type: 'date';
  min?: string;
  max?: string;
  defaultValue?: string;
}

export interface ObjectControl {
  type: 'object';
  schema?: Record<string, Control>;
  defaultValue?: Record<string, any>;
}

export interface ArrayControl {
  type: 'array';
  itemType?: Control;
  defaultValue?: any[];
}

export interface StoryParameters {
  // Viewport configuration
  viewport?: ViewportConfig;
  // Background color
  background?: string;
  // Layout padding
  padding?: string | number;
  // Disable specific addons
  disableAddons?: string[];
  // Custom theme
  theme?: string;
  // A11y configuration
  a11y?: {
    disable?: boolean;
    config?: any;
  };
}

export interface ViewportConfig {
  defaultViewport?: string;
  viewports?: Record<string, Viewport>;
}

export interface Viewport {
  name: string;
  width: number;
  height: number;
  scale?: number;
}

// Control builder functions
export const controls = {
  select: (options: string[] | { label: string; value: any }[], defaultValue?: any): SelectControl => ({
    type: 'select',
    options,
    defaultValue
  }),
  
  boolean: (defaultValue = false): BooleanControl => ({
    type: 'boolean',
    defaultValue
  }),
  
  number: (min = 0, max = 100, step = 1, defaultValue?: number): NumberControl => ({
    type: 'number',
    min,
    max,
    step,
    defaultValue: defaultValue ?? min
  }),
  
  text: (placeholder = '', defaultValue = ''): TextControl => ({
    type: 'text',
    placeholder,
    defaultValue
  }),
  
  color: (defaultValue = '#000000', presets?: string[]): ColorControl => ({
    type: 'color',
    defaultValue,
    presets
  }),
  
  date: (defaultValue?: string, min?: string, max?: string): DateControl => ({
    type: 'date',
    defaultValue: defaultValue ?? new Date().toISOString().split('T')[0],
    min,
    max
  }),
  
  object: (schema: Record<string, Control>, defaultValue?: Record<string, any>): ObjectControl => ({
    type: 'object',
    schema,
    defaultValue
  }),
  
  array: (itemType: Control, defaultValue: any[] = []): ArrayControl => ({
    type: 'array',
    itemType,
    defaultValue
  })
};

// Story format parser
export function parseStoryFile(content: string, path: string): StoryFile {
  // Parse frontmatter and markdown content
  const [, frontmatter, markdown] = content.split('---');
  const meta = parseFrontmatter(frontmatter);
  const stories = parseStories(markdown);
  
  return {
    meta,
    stories,
    source: content,
    path
  };
}

function parseFrontmatter(frontmatter: string): StoryMeta {
  // Simple YAML parser for story metadata
  const lines = frontmatter.trim().split('\n');
  const meta: any = {};
  
  for (const line of lines) {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length) {
      const value = valueParts.join(':').trim();
      meta[key.trim()] = value.startsWith('[') 
        ? JSON.parse(value.replace(/'/g, '"'))
        : value.replace(/^["']|["']$/g, '');
    }
  }
  
  return meta as StoryMeta;
}

function parseStories(markdown: string): Story[] {
  const stories: Story[] = [];
  const storyRegex = /##\s+(.+?)\s*\{\.story\s+#(\w+)(?:\s+(.+?))?\}/g;
  
  let match;
  while ((match = storyRegex.exec(markdown)) !== null) {
    const [, name, id, params] = match;
    
    // Extract story content until next story or end
    const startIndex = match.index + match[0].length;
    const nextMatch = storyRegex.exec(markdown);
    const endIndex = nextMatch ? nextMatch.index : markdown.length;
    storyRegex.lastIndex = match.index + match[0].length;
    
    const content = markdown.slice(startIndex, endIndex).trim();
    
    stories.push({
      id,
      name: name.trim(),
      render: () => content, // In real implementation, this would compile to render function
      parameters: params ? parseParameters(params) : undefined
    });
  }
  
  return stories;
}

function parseParameters(params: string): StoryParameters {
  // Parse inline parameters like viewport="mobile"
  const parameters: any = {};
  const paramRegex = /(\w+)="([^"]+)"/g;
  
  let match;
  while ((match = paramRegex.exec(params)) !== null) {
    const [, key, value] = match;
    parameters[key] = value;
  }
  
  return parameters;
}

// Default viewports
export const defaultViewports: Record<string, Viewport> = {
  mobile: {
    name: 'Mobile',
    width: 375,
    height: 667,
    scale: 1
  },
  tablet: {
    name: 'Tablet', 
    width: 768,
    height: 1024,
    scale: 1
  },
  desktop: {
    name: 'Desktop',
    width: 1920,
    height: 1080,
    scale: 0.5
  }
};
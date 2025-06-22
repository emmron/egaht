/**
 * Type definitions for Eghact CLI scaffolding system
 */

export interface TemplateConfig {
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Template version */
  version: string;
  /** Template author */
  author?: string;
  /** Template category */
  category: TemplateCategory;
  /** Minimum Eghact version required */
  eghactVersion?: string;
  /** Template tags for filtering */
  tags: string[];
  /** Template repository URL */
  repository?: string;
  /** Whether this is an official template */
  official: boolean;
  /** Template variables for customization */
  variables: TemplateVariable[];
  /** Files to ignore during template processing */
  ignore?: string[];
  /** Post-creation scripts to run */
  scripts?: PostCreationScript[];
  /** Dependencies to install */
  dependencies?: string[];
  /** Dev dependencies to install */
  devDependencies?: string[];
}

export interface TemplateVariable {
  /** Variable name */
  name: string;
  /** Variable description */
  description: string;
  /** Variable type */
  type: 'string' | 'boolean' | 'number' | 'choice' | 'multiselect';
  /** Default value */
  default?: any;
  /** Required variable */
  required?: boolean;
  /** Validation pattern (for string types) */
  pattern?: string;
  /** Choices for choice/multiselect types */
  choices?: string[];
  /** Custom validation function */
  validate?: (value: any) => boolean | string;
}

export interface PostCreationScript {
  /** Script name */
  name: string;
  /** Script description */
  description: string;
  /** Command to run */
  command: string;
  /** Working directory for command */
  cwd?: string;
  /** Whether script is optional */
  optional?: boolean;
  /** Platform-specific commands */
  platforms?: {
    win32?: string;
    darwin?: string;
    linux?: string;
  };
}

export type TemplateCategory = 
  | 'basic'
  | 'typescript'
  | 'ssr'
  | 'ssg'
  | 'pwa'
  | 'realtime'
  | 'ecommerce'
  | 'blog'
  | 'dashboard'
  | 'library'
  | 'plugin';

export interface CreateProjectOptions {
  /** Project name */
  name: string;
  /** Target directory */
  directory?: string;
  /** Template to use */
  template?: string;
  /** Skip prompts and use defaults */
  yes?: boolean;
  /** Template variables */
  variables?: Record<string, any>;
  /** Skip dependency installation */
  skipInstall?: boolean;
  /** Skip git initialization */
  skipGit?: boolean;
  /** Package manager to use */
  packageManager?: 'npm' | 'yarn' | 'pnpm';
  /** Verbose output */
  verbose?: boolean;
}

export interface TemplateSource {
  /** Source type */
  type: 'github' | 'gitlab' | 'bitbucket' | 'npm' | 'local' | 'url';
  /** Source URL or path */
  url: string;
  /** Branch or tag to use */
  ref?: string;
  /** Subdirectory within repository */
  directory?: string;
  /** Authentication token */
  token?: string;
}

export interface TemplateRegistry {
  /** Registry name */
  name: string;
  /** Registry URL */
  url: string;
  /** Registry authentication */
  auth?: {
    type: 'token' | 'basic';
    token?: string;
    username?: string;
    password?: string;
  };
  /** Whether registry is official */
  official: boolean;
  /** Registry priority */
  priority: number;
}

export interface ComponentGeneratorOptions {
  /** Component name */
  name: string;
  /** Target directory */
  directory?: string;
  /** Component type */
  type: 'page' | 'component' | 'layout' | 'store' | 'utility';
  /** Include TypeScript */
  typescript?: boolean;
  /** Include tests */
  tests?: boolean;
  /** Include stories (Storybook) */
  stories?: boolean;
  /** Component props */
  props?: ComponentProp[];
  /** Component events */
  events?: ComponentEvent[];
  /** Include styling */
  styling?: 'css' | 'scss' | 'css-modules' | 'styled-components' | 'tailwind';
}

export interface ComponentProp {
  /** Prop name */
  name: string;
  /** Prop type */
  type: string;
  /** Prop description */
  description?: string;
  /** Default value */
  default?: any;
  /** Whether prop is required */
  required?: boolean;
}

export interface ComponentEvent {
  /** Event name */
  name: string;
  /** Event payload type */
  payload?: string;
  /** Event description */
  description?: string;
}

export interface TemplateValidationResult {
  /** Whether template is valid */
  valid: boolean;
  /** Validation errors */
  errors: TemplateValidationError[];
  /** Validation warnings */
  warnings: TemplateValidationWarning[];
}

export interface TemplateValidationError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** File path (if applicable) */
  file?: string;
  /** Line number (if applicable) */
  line?: number;
}

export interface TemplateValidationWarning {
  /** Warning code */
  code: string;
  /** Warning message */
  message: string;
  /** File path (if applicable) */
  file?: string;
  /** Line number (if applicable) */
  line?: number;
}

export interface ProgressCallback {
  (step: string, current: number, total: number): void;
}

export interface LogLevel {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  context?: any;
}

export interface CLIConfig {
  /** Default template registry */
  defaultRegistry?: string;
  /** Custom template registries */
  registries: TemplateRegistry[];
  /** Default package manager */
  packageManager: 'npm' | 'yarn' | 'pnpm';
  /** Whether to check for updates */
  checkUpdates: boolean;
  /** Template cache directory */
  cacheDir?: string;
  /** Default project directory */
  defaultProjectDir?: string;
  /** User preferences */
  preferences: {
    skipPrompts?: boolean;
    autoInstall?: boolean;
    autoGit?: boolean;
    verbose?: boolean;
  };
}

export interface InstallationResult {
  /** Whether installation succeeded */
  success: boolean;
  /** Installation time in ms */
  duration: number;
  /** Installed packages */
  packages: string[];
  /** Installation errors */
  errors: string[];
  /** Package manager used */
  packageManager: string;
}
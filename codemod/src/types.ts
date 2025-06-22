export interface TransformContext {
  // Component metadata
  componentName: string;
  componentType: 'functional' | 'class';
  
  // State tracking
  componentState: Set<string>;
  stateSetters: Map<string, string>; // setter name -> state name
  
  // Props tracking
  props: Set<string>;
  propTypes: Map<string, string>;
  
  // Imports to add
  imports: Set<string>;
  
  // Reactive statements to insert
  reactiveStatements: Array<{
    statement: any;
    dependencies: string[];
  }>;
  
  // Warnings and errors
  warnings: TransformWarning[];
  errors: TransformError[];
}

export interface TransformWarning {
  line: number;
  message: string;
}

export interface TransformError {
  line: number;
  message: string;
}

export interface MigrationResult {
  success: boolean;
  outputPath: string;
  warnings: TransformWarning[];
  errors: TransformError[];
  manualSteps: string[];
}

export interface MigrationOptions {
  input: string;
  output?: string;
  analyze?: boolean;
  verbose?: boolean;
  preserveComments?: boolean;
}
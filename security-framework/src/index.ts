// Export main XSS protection classes
export { 
  XSSProtection, 
  UnsafeHTML, 
  TemplateCompilerXSS,
  type XSSProtectionOptions,
  type EscapingContext 
} from './XSSProtection';

// Export compiler integration
export { 
  SecureTemplateCompiler,
  SecurityAnalyzer,
  type CompilerNode,
  type CompilerOptions 
} from './CompilerIntegration';

// Export CSRF protection (to be implemented)
export { CSRFProtection } from './CSRFProtection';

// Re-export for convenience
export default XSSProtection;
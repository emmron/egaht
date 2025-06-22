import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

/**
 * Security validator for Eghact build process
 * Provides comprehensive security checks during compilation and bundling
 */
export class SecurityValidator {
  constructor(options = {}) {
    this.options = {
      enableXssValidation: true,
      enableCspValidation: true,
      enableDependencyScanning: true,
      enableFileIntegrityChecks: true,
      enableContentValidation: true,
      strictMode: false, // Production should set to true
      ...options
    };

    // Security patterns for validation
    this.xssPatterns = [
      // Script tags
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      // JavaScript protocols
      /javascript\s*:/gi,
      /vbscript\s*:/gi,
      // Event handlers
      /on\w+\s*=\s*["'][^"']*["']/gi,
      // Expression patterns
      /expression\s*\(/gi,
      // Data URLs with scripts
      /data\s*:\s*[^,]*script/gi,
      // Import statements in CSS
      /@import\s+url\s*\(\s*["']?[^"')]*javascript/gi
    ];

    // CSP violation patterns
    this.cspViolationPatterns = [
      // Inline event handlers
      /\bon\w+\s*=/gi,
      // eval() usage
      /\beval\s*\(/gi,
      // Function constructor
      /new\s+Function\s*\(/gi,
      // setTimeout/setInterval with string
      /set(?:Timeout|Interval)\s*\(\s*["']/gi,
      // document.write
      /document\.write/gi
    ];

    // File integrity tracking
    this.fileHashes = new Map();
    this.securityReport = {
      scannedFiles: 0,
      issues: [],
      warnings: [],
      recommendations: [],
      timestamp: null
    };
  }

  /**
   * Validate a single file during build process
   */
  async validateFile(filePath, content) {
    const validation = {
      valid: true,
      issues: [],
      warnings: [],
      fileHash: this.generateFileHash(content)
    };

    try {
      // Update file hash tracking
      this.fileHashes.set(filePath, validation.fileHash);
      this.securityReport.scannedFiles++;

      // XSS validation
      if (this.options.enableXssValidation) {
        const xssIssues = this.validateXss(content, filePath);
        validation.issues.push(...xssIssues);
      }

      // CSP validation
      if (this.options.enableCspValidation) {
        const cspIssues = this.validateCsp(content, filePath);
        validation.issues.push(...cspIssues);
      }

      // Content validation based on file type
      if (this.options.enableContentValidation) {
        const contentIssues = await this.validateContent(content, filePath);
        validation.issues.push(...contentIssues);
      }

      // Mark as invalid if critical issues found
      validation.valid = !validation.issues.some(issue => 
        issue.severity === 'critical' || 
        (this.options.strictMode && issue.severity === 'high')
      );

      // Add to security report
      if (validation.issues.length > 0) {
        this.securityReport.issues.push(...validation.issues);
      }

      return validation;
    } catch (error) {
      console.error(`Security validation error for ${filePath}:`, error);
      validation.valid = false;
      validation.issues.push({
        type: 'VALIDATION_ERROR',
        severity: 'high',
        message: `Failed to validate file: ${error.message}`,
        file: filePath
      });
      return validation;
    }
  }

  /**
   * Validate for XSS vulnerabilities
   */
  validateXss(content, filePath) {
    const issues = [];
    
    for (const pattern of this.xssPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          issues.push({
            type: 'XSS_RISK',
            severity: this.getXssSeverity(match),
            message: `Potential XSS vulnerability detected: ${match.substring(0, 100)}...`,
            file: filePath,
            pattern: pattern.source,
            match: match.substring(0, 200)
          });
        }
      }
    }

    return issues;
  }

  /**
   * Validate for CSP violations
   */
  validateCsp(content, filePath) {
    const issues = [];
    
    for (const pattern of this.cspViolationPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          issues.push({
            type: 'CSP_VIOLATION',
            severity: this.getCspSeverity(match),
            message: `Potential CSP violation: ${match}`,
            file: filePath,
            pattern: pattern.source,
            match: match,
            recommendation: this.getCspRecommendation(match)
          });
        }
      }
    }

    return issues;
  }

  /**
   * Validate content based on file type
   */
  async validateContent(content, filePath) {
    const issues = [];
    const ext = path.extname(filePath).toLowerCase();

    try {
      switch (ext) {
        case '.js':
        case '.ts':
          issues.push(...this.validateJavaScriptContent(content, filePath));
          break;
        case '.egh':
          issues.push(...this.validateEghactContent(content, filePath));
          break;
        case '.css':
          issues.push(...this.validateCssContent(content, filePath));
          break;
        case '.json':
          issues.push(...this.validateJsonContent(content, filePath));
          break;
        case '.html':
          issues.push(...this.validateHtmlContent(content, filePath));
          break;
      }
    } catch (error) {
      issues.push({
        type: 'CONTENT_VALIDATION_ERROR',
        severity: 'medium',
        message: `Failed to validate content type: ${error.message}`,
        file: filePath
      });
    }

    return issues;
  }

  /**
   * Validate JavaScript content
   */
  validateJavaScriptContent(content, filePath) {
    const issues = [];

    // Check for dangerous functions
    const dangerousFunctions = [
      'eval',
      'Function',
      'execScript',
      'setInterval',
      'setTimeout'
    ];

    for (const func of dangerousFunctions) {
      const regex = new RegExp(`\\b${func}\\s*\\(`, 'gi');
      if (regex.test(content)) {
        issues.push({
          type: 'DANGEROUS_FUNCTION',
          severity: func === 'eval' ? 'high' : 'medium',
          message: `Usage of potentially dangerous function: ${func}()`,
          file: filePath,
          function: func,
          recommendation: this.getFunctionRecommendation(func)
        });
      }
    }

    // Check for external script sources
    const externalScriptPattern = /(?:src|href)\s*=\s*["']https?:\/\/[^"']+["']/gi;
    const externalMatches = content.match(externalScriptPattern);
    if (externalMatches) {
      for (const match of externalMatches) {
        issues.push({
          type: 'EXTERNAL_RESOURCE',
          severity: 'low',
          message: `External resource detected: ${match}`,
          file: filePath,
          match,
          recommendation: 'Verify the security and integrity of external resources'
        });
      }
    }

    return issues;
  }

  /**
   * Validate Eghact component content
   */
  validateEghactContent(content, filePath) {
    const issues = [];

    // Extract template, script, and style sections
    const sections = this.parseEghactSections(content);

    // Validate template section
    if (sections.template) {
      // Check for unescaped interpolations
      const interpolationPattern = /\{[^}]*\}/g;
      const interpolations = sections.template.match(interpolationPattern);
      
      if (interpolations) {
        for (const interpolation of interpolations) {
          if (!interpolation.includes('|') && !interpolation.includes('escape')) {
            issues.push({
              type: 'UNESCAPED_INTERPOLATION',
              severity: 'medium',
              message: `Potentially unescaped interpolation: ${interpolation}`,
              file: filePath,
              interpolation,
              recommendation: 'Consider using escape filters for user content'
            });
          }
        }
      }
    }

    // Validate script section
    if (sections.script) {
      issues.push(...this.validateJavaScriptContent(sections.script, filePath));
    }

    // Validate style section
    if (sections.style) {
      issues.push(...this.validateCssContent(sections.style, filePath));
    }

    return issues;
  }

  /**
   * Validate CSS content
   */
  validateCssContent(content, filePath) {
    const issues = [];

    // Check for CSS expressions (IE-specific but still risky)
    if (/expression\s*\(/gi.test(content)) {
      issues.push({
        type: 'CSS_EXPRESSION',
        severity: 'high',
        message: 'CSS expression() detected - potential security risk',
        file: filePath,
        recommendation: 'Remove CSS expressions and use standard CSS properties'
      });
    }

    // Check for javascript: URLs in CSS
    if (/javascript\s*:/gi.test(content)) {
      issues.push({
        type: 'CSS_JAVASCRIPT_URL',
        severity: 'high',
        message: 'JavaScript URL in CSS detected',
        file: filePath,
        recommendation: 'Remove javascript: URLs from CSS'
      });
    }

    // Check for external imports
    const importPattern = /@import\s+(?:url\s*\()?\s*["']?([^"')]+)["']?\s*\)?/gi;
    let match;
    while ((match = importPattern.exec(content)) !== null) {
      if (match[1].startsWith('http')) {
        issues.push({
          type: 'EXTERNAL_CSS_IMPORT',
          severity: 'low',
          message: `External CSS import: ${match[1]}`,
          file: filePath,
          url: match[1],
          recommendation: 'Verify the security of external CSS resources'
        });
      }
    }

    return issues;
  }

  /**
   * Validate JSON content
   */
  validateJsonContent(content, filePath) {
    const issues = [];

    try {
      const parsed = JSON.parse(content);
      
      // Check for potentially sensitive data
      const sensitiveKeys = ['password', 'secret', 'token', 'key', 'api_key'];
      this.checkForSensitiveData(parsed, sensitiveKeys, filePath, issues);
      
    } catch (error) {
      issues.push({
        type: 'INVALID_JSON',
        severity: 'high',
        message: `Invalid JSON syntax: ${error.message}`,
        file: filePath
      });
    }

    return issues;
  }

  /**
   * Validate HTML content
   */
  validateHtmlContent(content, filePath) {
    const issues = [];

    // Check for inline event handlers
    const eventHandlers = ['onclick', 'onload', 'onerror', 'onmouseover'];
    for (const handler of eventHandlers) {
      const regex = new RegExp(`\\b${handler}\\s*=`, 'gi');
      if (regex.test(content)) {
        issues.push({
          type: 'INLINE_EVENT_HANDLER',
          severity: 'medium',
          message: `Inline event handler detected: ${handler}`,
          file: filePath,
          handler,
          recommendation: 'Use external event listeners instead of inline handlers'
        });
      }
    }

    return issues;
  }

  /**
   * Parse Eghact component sections
   */
  parseEghactSections(content) {
    const sections = {};
    
    // Simple regex-based parsing (in real implementation, use proper parser)
    const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/i);
    const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    
    if (templateMatch) sections.template = templateMatch[1];
    if (scriptMatch) sections.script = scriptMatch[1];
    if (styleMatch) sections.style = styleMatch[1];
    
    return sections;
  }

  /**
   * Check for sensitive data in objects
   */
  checkForSensitiveData(obj, sensitiveKeys, filePath, issues, path = '') {
    if (typeof obj !== 'object' || obj === null) return;

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      // Check if key name suggests sensitive data
      if (sensitiveKeys.some(sensitive => 
        key.toLowerCase().includes(sensitive.toLowerCase())
      )) {
        issues.push({
          type: 'SENSITIVE_DATA',
          severity: 'medium',
          message: `Potential sensitive data in JSON: ${currentPath}`,
          file: filePath,
          path: currentPath,
          recommendation: 'Avoid storing sensitive data in configuration files'
        });
      }

      // Recursively check nested objects
      if (typeof value === 'object') {
        this.checkForSensitiveData(value, sensitiveKeys, filePath, issues, currentPath);
      }
    }
  }

  /**
   * Get XSS severity based on match content
   */
  getXssSeverity(match) {
    if (match.includes('<script')) return 'critical';
    if (match.includes('javascript:')) return 'high';
    if (match.includes('onload') || match.includes('onerror')) return 'high';
    return 'medium';
  }

  /**
   * Get CSP severity based on match content
   */
  getCspSeverity(match) {
    if (match.includes('eval')) return 'high';
    if (match.includes('Function')) return 'high';
    if (match.includes('document.write')) return 'medium';
    return 'low';
  }

  /**
   * Get CSP recommendation based on violation
   */
  getCspRecommendation(match) {
    if (match.includes('eval')) {
      return 'Replace eval() with safer alternatives like JSON.parse()';
    }
    if (match.includes('Function')) {
      return 'Avoid Function constructor, use regular functions instead';
    }
    if (match.includes('document.write')) {
      return 'Use DOM manipulation methods instead of document.write()';
    }
    return 'Review code for CSP compliance';
  }

  /**
   * Get function recommendation
   */
  getFunctionRecommendation(functionName) {
    const recommendations = {
      eval: 'Use JSON.parse() for JSON data or safer alternatives',
      Function: 'Use regular function declarations or expressions',
      setTimeout: 'Pass function reference instead of string',
      setInterval: 'Pass function reference instead of string'
    };
    return recommendations[functionName] || 'Review usage for security implications';
  }

  /**
   * Generate file hash for integrity checking
   */
  generateFileHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Validate build dependencies for security issues
   */
  async validateDependencies(packageJsonPath) {
    if (!this.options.enableDependencyScanning) return { valid: true, issues: [] };

    try {
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageContent);
      const issues = [];

      // Check for known vulnerable packages (simplified check)
      const vulnerablePackages = [
        'event-stream', // Known malicious package
        'eslint-scope', // Had malicious version
        'flatmap-stream' // Part of event-stream attack
      ];

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      for (const [pkg, version] of Object.entries(allDeps)) {
        if (vulnerablePackages.includes(pkg)) {
          issues.push({
            type: 'VULNERABLE_DEPENDENCY',
            severity: 'critical',
            message: `Known vulnerable package detected: ${pkg}@${version}`,
            package: pkg,
            version,
            recommendation: `Remove ${pkg} or find secure alternative`
          });
        }
      }

      return { valid: issues.length === 0, issues };
    } catch (error) {
      return {
        valid: false,
        issues: [{
          type: 'DEPENDENCY_SCAN_ERROR',
          severity: 'medium',
          message: `Failed to scan dependencies: ${error.message}`
        }]
      };
    }
  }

  /**
   * Generate comprehensive security report
   */
  generateSecurityReport() {
    this.securityReport.timestamp = new Date().toISOString();
    
    // Calculate statistics
    const stats = {
      totalFiles: this.securityReport.scannedFiles,
      totalIssues: this.securityReport.issues.length,
      criticalIssues: this.securityReport.issues.filter(i => i.severity === 'critical').length,
      highIssues: this.securityReport.issues.filter(i => i.severity === 'high').length,
      mediumIssues: this.securityReport.issues.filter(i => i.severity === 'medium').length,
      lowIssues: this.securityReport.issues.filter(i => i.severity === 'low').length
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations(stats);

    return {
      ...this.securityReport,
      statistics: stats,
      recommendations,
      buildValid: stats.criticalIssues === 0 && 
                  (!this.options.strictMode || stats.highIssues === 0)
    };
  }

  /**
   * Generate security recommendations
   */
  generateRecommendations(stats) {
    const recommendations = [];

    if (stats.criticalIssues > 0) {
      recommendations.push({
        priority: 'critical',
        message: `${stats.criticalIssues} critical security issues must be fixed before deployment`,
        action: 'Fix critical issues immediately'
      });
    }

    if (stats.highIssues > 0) {
      recommendations.push({
        priority: 'high',
        message: `${stats.highIssues} high-severity security issues should be addressed`,
        action: 'Review and fix high-severity issues'
      });
    }

    if (stats.mediumIssues > 5) {
      recommendations.push({
        priority: 'medium',
        message: `${stats.mediumIssues} medium-severity issues detected`,
        action: 'Consider implementing additional security measures'
      });
    }

    // General recommendations
    recommendations.push({
      priority: 'info',
      message: 'Implement Content Security Policy headers',
      action: 'Configure CSP headers for production deployment'
    });

    recommendations.push({
      priority: 'info',
      message: 'Enable dependency vulnerability scanning',
      action: 'Use tools like npm audit or Snyk for dependency scanning'
    });

    return recommendations;
  }

  /**
   * Clear validation state for new build
   */
  reset() {
    this.fileHashes.clear();
    this.securityReport = {
      scannedFiles: 0,
      issues: [],
      warnings: [],
      recommendations: [],
      timestamp: null
    };
  }

  /**
   * Get validation statistics
   */
  getStats() {
    return {
      scannedFiles: this.securityReport.scannedFiles,
      totalIssues: this.securityReport.issues.length,
      fileHashes: this.fileHashes.size,
      lastValidation: this.securityReport.timestamp
    };
  }
}
# Eghact Security Policy & Architecture

## Table of Contents
- [Security Architecture](#security-architecture)
- [Security Features](#security-features)
- [Best Practices](#best-practices)
- [Vulnerability Reporting](#vulnerability-reporting)
- [Security Checklist](#security-checklist)
- [Threat Model](#threat-model)

## Security Architecture

Eghact implements defense-in-depth with multiple security layers:

### 1. Compile-Time Security
- **Template Sanitization**: All templates are sanitized during compilation
- **CSP Generation**: Automatic Content Security Policy based on actual usage
- **Static Analysis**: Security vulnerabilities detected before runtime
- **Type Safety**: Full TypeScript integration prevents type-related vulnerabilities

### 2. Runtime Protection
- **XSS Prevention**: Automatic escaping of all dynamic content
- **CSRF Protection**: Built-in token generation and validation
- **Injection Prevention**: Parameterized queries in EghQL
- **Sandboxed Execution**: Native code runs in isolated environment

### 3. Framework Security
- **No eval()**: Framework never uses eval or Function constructor
- **Trusted Types**: Support for browser Trusted Types API
- **SRI Support**: Subresource Integrity for all external resources
- **Secure Defaults**: Security features enabled by default

## Security Features

### XSS Protection

All dynamic content is automatically escaped:

```egh
<!-- Safe by default -->
<div>{userInput}</div>  <!-- HTML entities are escaped -->

<!-- Explicit unsafe content (requires security review) -->
<div dangerously-set-inner-html={trustedHTML}></div>
```

### CSRF Protection

Automatic CSRF tokens for all forms:

```egh
[!Form @submit={handleSubmit}]
  <!-- CSRF token automatically included -->
  [!Input name="email" type="email"]
[/Form]
```

### Content Security Policy

Automatic CSP generation based on your app:

```javascript
// eghact.config.js
export default {
  security: {
    csp: {
      reportUri: 'https://your-app.com/csp-report',
      upgradeInsecureRequests: true,
      blockAllMixedContent: true
    }
  }
}
```

Generated CSP example:
```
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' 'nonce-{generated}';
  style-src 'self' 'nonce-{generated}';
  img-src 'self' data: https:;
  connect-src 'self' https://api.your-app.com;
  font-src 'self';
  object-src 'none';
  media-src 'self';
  frame-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
  block-all-mixed-content;
  report-uri https://your-app.com/csp-report;
```

### Input Validation

Built-in validation with security in mind:

```egh
[!Input 
  type="email" 
  pattern="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
  required
  maxlength="255"
  @validate={customValidator}
]
```

### Secure State Management

State mutations are tracked and validated:

```rust
// Logic section in .eg files
fn updateUserRole(userId: String, role: String) {
    // Automatic permission check based on current user
    if !can_modify_roles(current_user) {
        throw SecurityError("Insufficient permissions");
    }
    
    // Validate role against whitelist
    if !VALID_ROLES.contains(&role) {
        throw ValidationError("Invalid role");
    }
    
    state.users[userId].role = role;
}
```

## Best Practices

### 1. Never Trust User Input
- Always validate on the server, even with client validation
- Use allowlists instead of denylists
- Sanitize data before storage and display

### 2. Use Security Headers
```javascript
// server.js
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});
```

### 3. Secure Component Patterns

#### ❌ Insecure Pattern
```egh
<!-- Never directly insert HTML -->
<div>{userBio}</div>  <!-- If userBio contains HTML, it will be displayed as text -->
```

#### ✅ Secure Pattern
```egh
<!-- For rich text, use a sanitization library -->
[!RichText content={sanitizeHtml(userBio, allowedTags)} /]
```

### 4. API Security
- Use HTTPS everywhere
- Implement rate limiting
- Validate all API inputs
- Use proper authentication (JWT, OAuth2)
- Never expose sensitive data in URLs

### 5. Dependency Security
- Regular dependency audits: `npm audit` / `epkg audit`
- Use lock files for reproducible builds
- Review third-party components for vulnerabilities

## Vulnerability Reporting

We take security seriously. If you discover a vulnerability:

### 1. Do NOT Create a Public Issue
Security vulnerabilities should be reported privately to prevent exploitation.

### 2. Email Security Team
Send details to: **security@eghact.dev**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### 3. Response Timeline
- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: 24-48 hours
  - High: 7 days
  - Medium: 30 days
  - Low: Next release

### 4. Responsible Disclosure
- Allow 90 days before public disclosure
- Coordinate disclosure timing with our team
- Credit will be given to reporters (unless anonymity requested)

## Security Checklist

### Pre-Deployment Checklist

- [ ] All dependencies updated and audited
- [ ] CSP headers configured and tested
- [ ] HTTPS enforced on all endpoints
- [ ] Authentication properly implemented
- [ ] Authorization checks on all routes
- [ ] Input validation on all forms
- [ ] Rate limiting configured
- [ ] Security headers set
- [ ] Error messages don't leak sensitive info
- [ ] Logging doesn't contain sensitive data
- [ ] Secrets stored securely (not in code)
- [ ] CORS properly configured
- [ ] File upload restrictions in place
- [ ] SQL injection prevention verified
- [ ] XSS prevention tested

### Code Review Security Checklist

- [ ] No hardcoded secrets or API keys
- [ ] No use of `eval()` or `Function()`
- [ ] No use of `dangerously-set-inner-html` without sanitization
- [ ] All user inputs validated
- [ ] Proper error handling (no stack traces to users)
- [ ] Secure random number generation for tokens
- [ ] Time-constant comparison for secrets
- [ ] No sensitive data in URLs
- [ ] Proper session management
- [ ] Secure cookie flags set

## Threat Model

### STRIDE Analysis

#### 1. Spoofing
- **Threat**: Attacker impersonates legitimate user
- **Mitigation**: Strong authentication, secure session management

#### 2. Tampering
- **Threat**: Data modification in transit or storage
- **Mitigation**: HTTPS, integrity checks, secure storage

#### 3. Repudiation
- **Threat**: User denies performing action
- **Mitigation**: Comprehensive audit logging, digital signatures

#### 4. Information Disclosure
- **Threat**: Sensitive data exposed
- **Mitigation**: Encryption, access controls, minimal data exposure

#### 5. Denial of Service
- **Threat**: Service made unavailable
- **Mitigation**: Rate limiting, resource quotas, CDN

#### 6. Elevation of Privilege
- **Threat**: User gains unauthorized permissions
- **Mitigation**: Principle of least privilege, regular permission audits

### Attack Vectors

1. **Client-Side**
   - XSS through user content
   - CSRF on state-changing operations
   - Clickjacking
   - Open redirects

2. **Server-Side**
   - Injection attacks (SQL, NoSQL, Command)
   - XXE (XML External Entity)
   - SSRF (Server-Side Request Forgery)
   - Path traversal

3. **API**
   - Broken authentication
   - Excessive data exposure
   - Lack of rate limiting
   - Security misconfiguration

4. **Dependencies**
   - Vulnerable packages
   - Supply chain attacks
   - Prototype pollution

## Security Tools Integration

### Automated Security Scanning

```yaml
# .github/workflows/security.yml
name: Security Scan

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Snyk Security Scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
          
      - name: Run CodeQL Analysis
        uses: github/codeql-action/analyze@v2
        
      - name: OWASP Dependency Check
        uses: dependency-check/Dependency-Check_Action@main
        
      - name: Run Semgrep
        uses: returntocorp/semgrep-action@v1
```

### Development Security Tools

```bash
# Install security tools
npm install --save-dev \
  eslint-plugin-security \
  npm-audit-html \
  snyk

# Add to package.json scripts
{
  "scripts": {
    "security:check": "npm audit && snyk test",
    "security:fix": "npm audit fix && snyk wizard",
    "lint:security": "eslint --ext .js,.ts,.egh src/ --plugin security"
  }
}
```

## Compliance & Standards

Eghact is designed to help you meet common security standards:

- **OWASP Top 10**: Built-in protections against all OWASP Top 10
- **PCI DSS**: Secure by default configurations
- **GDPR**: Privacy-focused features, data minimization
- **SOC 2**: Comprehensive audit logging capabilities
- **ISO 27001**: Security controls and documentation

## Security Resources

- [OWASP Cheat Sheets](https://cheatsheetseries.owasp.org/)
- [Security Headers](https://securityheaders.com/)
- [Mozilla Web Security](https://infosec.mozilla.org/guidelines/web_security)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

## Version History

- v2.0.0 - Complete security overhaul with native runtime
- v1.5.0 - Added CSP generation and CSRF protection
- v1.0.0 - Initial security implementation

---

*Last Updated: 2025-06-23*
*Security Team: security@eghact.dev*
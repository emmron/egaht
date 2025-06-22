# Content Security Policy (CSP) Guide

## Overview

Eghact automatically generates and manages Content Security Policy (CSP) headers to enhance application security by preventing XSS attacks, data injection, and other code execution vulnerabilities.

## Features

- **Automatic CSP Generation**: Build-time analysis of assets and code
- **SHA-256 Hash Generation**: Secure inline script and style allowlisting  
- **Nonce Support**: Dynamic nonce generation for development
- **Development Mode**: Relaxed policies for HMR and debugging
- **Production Optimization**: Strict policies for enhanced security
- **Custom Directives**: Configurable CSP directives per environment

## How It Works

### Build-Time Analysis

The CSP generator analyzes your application during the build process:

1. **Asset Discovery**: Identifies all scripts, styles, images, and fonts
2. **Inline Content**: Generates hashes for inline scripts and styles
3. **External Resources**: Catalogs CDN and third-party sources
4. **Directive Creation**: Builds appropriate CSP directives
5. **Header Generation**: Outputs CSP headers for deployment

### Development vs Production

**Development Mode:**
- Relaxed `script-src` for HMR and debugging
- `unsafe-eval` allowed for development tools
- Nonce-based inline script execution
- WebSocket connections for dev server

**Production Mode:**
- Strict `script-src` with SHA-256 hashes only
- No `unsafe-eval` or `unsafe-inline`
- Hash-based inline content allowlisting
- Minimal external sources

## Configuration

### Basic Setup

**eghact.config.js:**
```javascript
export default {
  security: {
    csp: {
      enabled: true,
      mode: 'auto', // 'auto', 'strict', 'relaxed'
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", "data:", "https:"],
        'font-src': ["'self'", "https://fonts.gstatic.com"],
        'connect-src': ["'self'"]
      },
      reportUri: '/api/csp-violations',
      reportOnly: false
    }
  }
};
```

### Advanced Configuration

```javascript
export default {
  security: {
    csp: {
      enabled: true,
      
      // Environment-specific policies
      development: {
        directives: {
          'script-src': ["'self'", "'unsafe-eval'", "'nonce-{nonce}'"],
          'connect-src': ["'self'", "ws:", "wss:"]
        }
      },
      
      production: {
        directives: {
          'script-src': ["'self'"],
          'style-src': ["'self'"],
          'object-src': ["'none'"],
          'base-uri': ["'self'"]
        },
        reportOnly: false
      },
      
      // Custom nonce generation
      nonce: {
        enabled: true,
        algorithm: 'sha256',
        length: 32
      },
      
      // Hash generation settings
      hashes: {
        algorithms: ['sha256', 'sha384'],
        inline: true,
        external: false
      }
    }
  }
};
```

## Generated CSP Examples

### Basic Application

**Input (index.html):**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; font-family: Arial; }
  </style>
  <script>
    console.log('App initializing...');
  </script>
</head>
<body>
  <script src="/app.js"></script>
</body>
</html>
```

**Generated CSP Header:**
```
Content-Security-Policy: 
  default-src 'self'; 
  script-src 'self' 'sha256-abc123...'; 
  style-src 'self' 'sha256-def456...'; 
  img-src 'self' data: https:; 
  font-src 'self'
```

### Complex Application with CDN

**Input:**
```html
<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<img src="https://via.placeholder.com/150" alt="placeholder">
```

**Generated CSP Header:**
```
Content-Security-Policy: 
  default-src 'self'; 
  script-src 'self' https://cdn.jsdelivr.net; 
  style-src 'self' https://fonts.googleapis.com; 
  font-src 'self' https://fonts.gstatic.com; 
  img-src 'self' data: https: https://via.placeholder.com
```

## Development Integration

### Dev Server CSP Headers

The development server automatically applies CSP headers:

```typescript
// Automatic nonce injection
<script nonce="{{CSP_NONCE}}">
  // HMR and development code
</script>

// Relaxed policy for development
Content-Security-Policy: 
  default-src 'self'; 
  script-src 'self' 'unsafe-eval' 'nonce-abc123'; 
  connect-src 'self' ws: wss:;
```

### HMR Compatibility

Hot Module Replacement works seamlessly with CSP:

```javascript
// webpack.config.js (generated automatically)
module.exports = {
  devServer: {
    headers: {
      'Content-Security-Policy': getCspHeader('development')
    }
  }
};
```

## Production Deployment

### Server Configuration

**Apache (.htaccess):**
```apache
<IfModule mod_headers.c>
  Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'sha256-abc123...'; style-src 'self' 'sha256-def456...'"
</IfModule>
```

**Nginx:**
```nginx
location / {
  add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'sha256-abc123...'; style-src 'self' 'sha256-def456...'" always;
}
```

**Express.js:**
```javascript
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', getCspHeader());
  next();
});
```

### Platform-Specific Headers

**Vercel (vercel.json):**
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'sha256-abc123...'"
        }
      ]
    }
  ]
}
```

**Netlify (_headers):**
```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-abc123...'
```

## CLI Usage

### Generate CSP

```bash
# Analyze current build and generate CSP
npx eghact csp generate

# Output CSP header only
npx eghact csp header

# Validate existing CSP
npx eghact csp validate

# Test CSP with local server
npx eghact csp test --port 3000
```

### Build Integration

```bash
# Build with CSP generation
npx eghact build --csp

# Generate production CSP
npx eghact build --mode production --security
```

## Violation Reporting

### Report URI Setup

**API Endpoint (Node.js):**
```javascript
app.post('/api/csp-violations', express.json(), (req, res) => {
  const violation = req.body['csp-report'];
  
  console.error('CSP Violation:', {
    blockedUri: violation['blocked-uri'],
    violatedDirective: violation['violated-directive'],
    originalPolicy: violation['original-policy'],
    documentUri: violation['document-uri']
  });
  
  // Log to monitoring service
  analytics.track('csp_violation', violation);
  
  res.status(204).send();
});
```

### Report-Only Mode

For testing without blocking content:

```javascript
// eghact.config.js
export default {
  security: {
    csp: {
      reportOnly: true, // Only report violations, don't block
      reportUri: '/api/csp-violations'
    }
  }
};
```

## Common Patterns

### Third-Party Integrations

**Google Analytics:**
```javascript
// CSP-compliant analytics setup
export default {
  security: {
    csp: {
      directives: {
        'script-src': [
          "'self'",
          'https://www.googletagmanager.com',
          'https://www.google-analytics.com'
        ],
        'connect-src': [
          "'self'",
          'https://www.google-analytics.com'
        ]
      }
    }
  }
};
```

**Stripe Payments:**
```javascript
export default {
  security: {
    csp: {
      directives: {
        'script-src': ["'self'", 'https://js.stripe.com'],
        'frame-src': ["'self'", 'https://js.stripe.com'],
        'connect-src': ["'self'", 'https://api.stripe.com']
      }
    }
  }
};
```

### Image Sources

```javascript
// Allow images from multiple sources
export default {
  security: {
    csp: {
      directives: {
        'img-src': [
          "'self'",
          'data:',
          'https:',
          'https://images.unsplash.com',
          'https://via.placeholder.com',
          'https://picsum.photos'
        ]
      }
    }
  }
};
```

## Troubleshooting

### Common Issues

**Inline Script Blocked:**
```
Refused to execute inline script because it violates CSP directive
```
**Solution:** Use nonces or move scripts to external files

**Style Not Applied:**
```
Refused to apply inline style because it violates CSP directive
```
**Solution:** Extract styles to CSS files or use SHA-256 hashes

**XHR/Fetch Blocked:**
```
Refused to connect to 'https://api.example.com' because it violates CSP
```
**Solution:** Add the domain to `connect-src` directive

### Debug Mode

Enable CSP debugging in development:

```javascript
export default {
  security: {
    csp: {
      debug: true, // Log policy generation details
      reportOnly: true, // Don't block during development
      verbose: true // Detailed violation logging
    }
  }
};
```

### Testing CSP

**Browser Console:**
```javascript
// Test CSP compliance
fetch('https://external-api.com/data')
  .then(response => console.log('API call allowed'))
  .catch(error => console.error('API call blocked by CSP'));
```

**CSP Analyzer Tools:**
- Google CSP Evaluator
- Mozilla Observatory
- Security Headers Scanner

## Best Practices

1. **Start Strict**: Begin with restrictive policies and gradually relax
2. **Use Hashes**: Prefer SHA-256 hashes over `unsafe-inline`
3. **Monitor Violations**: Set up proper violation reporting
4. **Test Thoroughly**: Verify all functionality works with CSP enabled
5. **Regular Updates**: Review and update CSP as your app evolves
6. **Environment-Specific**: Use different policies for dev/staging/production
7. **Documentation**: Document any CSP exceptions and their reasoning

## Security Benefits

- **XSS Prevention**: Blocks malicious script injection
- **Data Injection Protection**: Prevents unauthorized resource loading
- **Clickjacking Protection**: Controls frame embedding
- **Mixed Content Prevention**: Enforces HTTPS-only resources
- **Attack Surface Reduction**: Limits allowed resource sources
- **Compliance**: Helps meet security standards and regulations
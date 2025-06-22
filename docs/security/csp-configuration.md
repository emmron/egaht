# Content Security Policy (CSP) Configuration

Eghact provides automatic CSP generation during the build process to enhance application security.

## Basic Usage

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import { eghactCSP } from 'eghact/security';

export default defineConfig({
  plugins: [
    eghactCSP({
      // Basic configuration
      reportUri: '/csp-report',
      upgradeInsecureRequests: true,
    })
  ]
});
```

## Configuration Options

### Core Options

- `enabled` (boolean, default: true) - Enable/disable CSP generation
- `outputFile` (string, default: 'csp-headers.json') - Output file for CSP headers
- `injectMeta` (boolean, default: true) - Inject CSP meta tag into HTML files
- `reportUri` (string) - URL for CSP violation reports
- `upgradeInsecureRequests` (boolean) - Upgrade HTTP requests to HTTPS
- `blockAllMixedContent` (boolean) - Block all mixed content

### Development Options

```javascript
eghactCSP({
  development: {
    enabled: false, // Disable in development by default
    allowUnsafeInline: true, // Allow inline scripts/styles in dev
    allowUnsafeEval: true, // Allow eval() in development
  }
})
```

### Custom Directives

```javascript
eghactCSP({
  customDirectives: {
    'script-src': ['https://trusted-cdn.com'],
    'img-src': ['https://images.example.com', 'data:'],
    'connect-src': ['https://api.example.com'],
    'frame-ancestors': ["'none'"],
  }
})
```

## How It Works

1. **Build Analysis**: During production build, the plugin scans all generated assets
2. **Hash Generation**: Creates SHA-256 hashes for inline scripts and styles
3. **Domain Detection**: Identifies external resources and their domains
4. **Policy Generation**: Builds a restrictive CSP based on actual usage
5. **Output**: Generates both HTTP headers and HTML meta tags

## Example Output

```json
{
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'sha256-abc123...'; style-src 'self' 'sha256-def456...'; img-src 'self' data: blob:; font-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  "nonces": {},
  "hashes": {
    "script-1234567890": "abc123...",
    "style-1234567891": "def456..."
  }
}
```

## Server Configuration

### Nginx
```nginx
add_header Content-Security-Policy "...generated CSP...";
```

### Express
```javascript
app.use((req, res, next) => {
  const csp = require('./dist/csp-headers.json');
  res.setHeader('Content-Security-Policy', csp['Content-Security-Policy']);
  next();
});
```

## Testing CSP

1. Use Chrome DevTools Security tab
2. Check for CSP violations in console
3. Use online CSP evaluators
4. Monitor reportUri endpoint for violations

## Common Patterns

### CDN Resources
```javascript
customDirectives: {
  'script-src': ['https://cdn.jsdelivr.net'],
  'style-src': ['https://fonts.googleapis.com'],
  'font-src': ['https://fonts.gstatic.com'],
}
```

### Analytics
```javascript
customDirectives: {
  'script-src': ['https://www.google-analytics.com'],
  'img-src': ['https://www.google-analytics.com'],
  'connect-src': ['https://www.google-analytics.com'],
}
```

### Webpack/Vite HMR
```javascript
development: {
  enabled: true,
  customDirectives: {
    'connect-src': ['ws://localhost:*', 'wss://localhost:*'],
  }
}
```
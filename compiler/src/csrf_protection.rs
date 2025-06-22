use anyhow::Result;
use rand::Rng;
use sha2::{Sha256, Digest};
use std::time::{SystemTime, UNIX_EPOCH};

/// CSRF Protection Implementation
/// Uses double-submit cookie strategy for stateless CSRF protection
pub struct CsrfProtection {
    secret_key: String,
    token_length: usize,
    cookie_name: String,
    header_name: String,
}

impl CsrfProtection {
    /// Create new CSRF protection instance
    pub fn new(secret_key: String) -> Self {
        Self {
            secret_key,
            token_length: 32,
            cookie_name: "_eghact_csrf".to_string(),
            header_name: "X-CSRF-Token".to_string(),
        }
    }

    /// Generate a cryptographically secure CSRF token
    pub fn generate_token(&self) -> Result<CsrfToken> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)?
            .as_secs();
        
        // Generate random bytes
        let mut rng = rand::thread_rng();
        let random_bytes: Vec<u8> = (0..self.token_length)
            .map(|_| rng.gen())
            .collect();
        
        // Create token data
        let token_data = format!("{}:{}", timestamp, hex::encode(&random_bytes));
        
        // Generate HMAC signature
        let signature = self.generate_hmac(&token_data)?;
        let full_token = format!("{}:{}", token_data, signature);
        
        // Encode as base64 for safe transmission
        let encoded_token = base64::encode(full_token);
        
        Ok(CsrfToken {
            value: encoded_token,
            timestamp,
            expires_in: 3600, // 1 hour default
        })
    }

    /// Validate CSRF token from double-submit cookie
    pub fn validate_token(&self, cookie_token: &str, submitted_token: &str) -> Result<bool> {
        // Tokens must match (double-submit check)
        if cookie_token != submitted_token {
            return Ok(false);
        }

        // Decode and validate token structure
        let decoded = base64::decode(submitted_token)
            .map_err(|_| anyhow::anyhow!("Invalid token encoding"))?;
        
        let token_str = String::from_utf8(decoded)
            .map_err(|_| anyhow::anyhow!("Invalid token format"))?;
        
        let parts: Vec<&str> = token_str.split(':').collect();
        if parts.len() != 3 {
            return Ok(false);
        }

        let timestamp: u64 = parts[0].parse()
            .map_err(|_| anyhow::anyhow!("Invalid timestamp"))?;
        let random_part = parts[1];
        let signature = parts[2];

        // Check token expiration
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)?
            .as_secs();
        
        if current_time - timestamp > 3600 { // 1 hour expiration
            return Ok(false);
        }

        // Verify HMAC signature
        let token_data = format!("{}:{}", timestamp, random_part);
        let expected_signature = self.generate_hmac(&token_data)?;
        
        // Constant-time comparison to prevent timing attacks
        Ok(constant_time_eq(signature.as_bytes(), expected_signature.as_bytes()))
    }

    /// Generate JavaScript for client-side CSRF handling
    pub fn generate_client_code(&self) -> String {
        format!(r#"
// Eghact CSRF Protection Client Library
(function() {{
    const CSRF_COOKIE_NAME = '{}';
    const CSRF_HEADER_NAME = '{}';
    
    // Get CSRF token from cookie
    function getCsrfToken() {{
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {{
            const [name, value] = cookie.trim().split('=');
            if (name === CSRF_COOKIE_NAME) {{
                return decodeURIComponent(value);
            }}
        }}
        return null;
    }}
    
    // Set CSRF token in form
    function setCsrfTokenInForm(form) {{
        const token = getCsrfToken();
        if (!token) {{
            console.warn('CSRF token not found');
            return false;
        }}
        
        // Remove existing CSRF input
        const existingInput = form.querySelector('input[name="_csrf"]');
        if (existingInput) {{
            existingInput.remove();
        }}
        
        // Add CSRF token as hidden input
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = '_csrf';
        input.value = token;
        form.appendChild(input);
        
        return true;
    }}
    
    // Intercept form submissions
    function protectForms() {{
        document.addEventListener('submit', function(event) {{
            const form = event.target;
            if (form.method && form.method.toLowerCase() === 'post') {{
                if (!setCsrfTokenInForm(form)) {{
                    event.preventDefault();
                    console.error('CSRF protection failed: token not available');
                    return false;
                }}
            }}
        }});
    }}
    
    // Protect fetch requests
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {{}}) {{
        const token = getCsrfToken();
        
        // Add CSRF header for POST, PUT, DELETE, PATCH requests
        if (options.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method.toUpperCase())) {{
            if (token) {{
                options.headers = options.headers || {{}};
                options.headers[CSRF_HEADER_NAME] = token;
            }} else {{
                console.warn('CSRF token not found for fetch request');
            }}
        }}
        
        return originalFetch.call(this, url, options);
    }};
    
    // Initialize CSRF protection
    if (document.readyState === 'loading') {{
        document.addEventListener('DOMContentLoaded', protectForms);
    }} else {{
        protectForms();
    }}
    
    // Export functions for manual use
    window.EghactCSRF = {{
        getToken: getCsrfToken,
        protectForm: setCsrfTokenInForm,
        headerName: CSRF_HEADER_NAME,
        cookieName: CSRF_COOKIE_NAME
    }};
}})();
"#, self.cookie_name, self.header_name)
    }

    /// Generate middleware for development server
    pub fn generate_middleware_code(&self) -> String {
        format!(r#"
// Eghact CSRF Protection Middleware
const crypto = require('crypto');
const {{ parse: parseCookies }} = require('cookie');

const CSRF_COOKIE_NAME = '{}';
const CSRF_HEADER_NAME = '{}';
const SECRET_KEY = process.env.EGHACT_CSRF_SECRET || 'dev-secret-change-in-production';

function generateToken() {{
    const timestamp = Math.floor(Date.now() / 1000);
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const tokenData = `${{timestamp}}:${{randomBytes}}`;
    
    const hmac = crypto.createHmac('sha256', SECRET_KEY);
    hmac.update(tokenData);
    const signature = hmac.digest('hex');
    
    const fullToken = `${{tokenData}}:${{signature}}`;
    return Buffer.from(fullToken).toString('base64');
}}

function validateToken(cookieToken, submittedToken) {{
    // Double-submit check
    if (cookieToken !== submittedToken) {{
        return false;
    }}
    
    try {{
        const decoded = Buffer.from(submittedToken, 'base64').toString('utf8');
        const parts = decoded.split(':');
        
        if (parts.length !== 3) {{
            return false;
        }}
        
        const [timestamp, randomPart, signature] = parts;
        const currentTime = Math.floor(Date.now() / 1000);
        
        // Check expiration (1 hour)
        if (currentTime - parseInt(timestamp) > 3600) {{
            return false;
        }}
        
        // Verify signature
        const tokenData = `${{timestamp}}:${{randomPart}}`;
        const hmac = crypto.createHmac('sha256', SECRET_KEY);
        hmac.update(tokenData);
        const expectedSignature = hmac.digest('hex');
        
        return crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        );
    }} catch (error) {{
        return false;
    }}
}}

function csrfMiddleware(req, res, next) {{
    // Generate and set CSRF token for all requests
    const cookies = parseCookies(req.headers.cookie || '');
    let csrfToken = cookies[CSRF_COOKIE_NAME];
    
    if (!csrfToken) {{
        csrfToken = generateToken();
        res.setHeader('Set-Cookie', 
            `${{CSRF_COOKIE_NAME}}=${{csrfToken}}; HttpOnly; SameSite=Strict; Path=/`
        );
    }}
    
    // Validate CSRF for state-changing methods
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {{
        const submittedToken = req.headers[CSRF_HEADER_NAME.toLowerCase()] || req.body._csrf;
        
        if (!validateToken(csrfToken, submittedToken)) {{
            res.status(403).json({{
                error: 'CSRF token validation failed',
                code: 'CSRF_INVALID'
            }});
            return;
        }}
    }}
    
    // Make token available to templates
    req.csrfToken = csrfToken;
    next();
}}

module.exports = {{
    csrfMiddleware,
    generateToken,
    validateToken,
    CSRF_COOKIE_NAME,
    CSRF_HEADER_NAME
}};
"#, self.cookie_name, self.header_name)
    }

    /// Generate HMAC signature for token
    fn generate_hmac(&self, data: &str) -> Result<String> {
        let mut hasher = Sha256::new();
        hasher.update(format!("{}:{}", self.secret_key, data));
        Ok(hex::encode(hasher.finalize()))
    }
}

/// CSRF Token structure
#[derive(Debug, Clone)]
pub struct CsrfToken {
    pub value: String,
    pub timestamp: u64,
    pub expires_in: u64,
}

impl CsrfToken {
    /// Check if token is expired
    pub fn is_expired(&self) -> Result<bool> {
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)?
            .as_secs();
        
        Ok(current_time - self.timestamp > self.expires_in)
    }
    
    /// Get token value for use in forms/headers
    pub fn value(&self) -> &str {
        &self.value
    }
}

/// Constant-time string comparison to prevent timing attacks
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    
    let mut result = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        result |= x ^ y;
    }
    
    result == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_generation() {
        let csrf = CsrfProtection::new("test-secret".to_string());
        let token1 = csrf.generate_token().unwrap();
        let token2 = csrf.generate_token().unwrap();
        
        // Tokens should be different
        assert_ne!(token1.value, token2.value);
        
        // Tokens should be valid base64
        assert!(base64::decode(&token1.value).is_ok());
        assert!(base64::decode(&token2.value).is_ok());
    }

    #[test]
    fn test_token_validation() {
        let csrf = CsrfProtection::new("test-secret".to_string());
        let token = csrf.generate_token().unwrap();
        
        // Valid double-submit should pass
        assert!(csrf.validate_token(&token.value, &token.value).unwrap());
        
        // Different tokens should fail
        let token2 = csrf.generate_token().unwrap();
        assert!(!csrf.validate_token(&token.value, &token2.value).unwrap());
        
        // Malformed token should fail
        assert!(!csrf.validate_token(&token.value, "invalid").unwrap());
    }

    #[test]
    fn test_constant_time_eq() {
        assert!(constant_time_eq(b"hello", b"hello"));
        assert!(!constant_time_eq(b"hello", b"world"));
        assert!(!constant_time_eq(b"hello", b"hell"));
        assert!(!constant_time_eq(b"hell", b"hello"));
    }
}
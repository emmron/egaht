// Eghact CSRF Protection Middleware
import crypto from 'crypto';
import { parse as parseCookies } from 'cookie';

const CSRF_COOKIE_NAME = '_eghact_csrf';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const SECRET_KEY = process.env.EGHACT_CSRF_SECRET || 'dev-secret-change-in-production';

function generateToken() {
  const timestamp = Math.floor(Date.now() / 1000);
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const tokenData = `${timestamp}:${randomBytes}`;
  
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(tokenData);
  const signature = hmac.digest('hex');
  
  const fullToken = `${tokenData}:${signature}`;
  return Buffer.from(fullToken).toString('base64');
}

function validateToken(cookieToken, submittedToken) {
  // Double-submit check
  if (cookieToken !== submittedToken) {
    return false;
  }
  
  try {
    const decoded = Buffer.from(submittedToken, 'base64').toString('utf8');
    const parts = decoded.split(':');
    
    if (parts.length !== 3) {
      return false;
    }
    
    const [timestamp, randomPart, signature] = parts;
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Check expiration (1 hour)
    if (currentTime - parseInt(timestamp) > 3600) {
      return false;
    }
    
    // Verify signature
    const tokenData = `${timestamp}:${randomPart}`;
    const hmac = crypto.createHmac('sha256', SECRET_KEY);
    hmac.update(tokenData);
    const expectedSignature = hmac.digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    return false;
  }
}

export function createCsrfMiddleware() {
  return async function csrfMiddleware(request, reply) {
    // Generate and set CSRF token for all requests
    const cookies = parseCookies(request.headers.cookie || '');
    let csrfToken = cookies[CSRF_COOKIE_NAME];
    
    if (!csrfToken) {
      csrfToken = generateToken();
      reply.header('Set-Cookie', 
        `${CSRF_COOKIE_NAME}=${csrfToken}; HttpOnly; SameSite=Strict; Path=/`
      );
    }
    
    // Validate CSRF for state-changing methods
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      const submittedToken = request.headers[CSRF_HEADER_NAME.toLowerCase()] || request.body?._csrf;
      
      if (!validateToken(csrfToken, submittedToken)) {
        reply.status(403).send({
          error: 'CSRF token validation failed',
          code: 'CSRF_INVALID'
        });
        return;
      }
    }
    
    // Make token available to templates and handlers
    request.csrfToken = csrfToken;
    
    // Add CSRF token to route context for data loading
    if (request.body && typeof request.body === 'object') {
      request.body._csrfToken = csrfToken;
    }
  };
}

export function generateCsrfClientCode() {
  return `
// Eghact CSRF Protection Client Library
(function() {
  const CSRF_COOKIE_NAME = '${CSRF_COOKIE_NAME}';
  const CSRF_HEADER_NAME = '${CSRF_HEADER_NAME}';
  
  // Get CSRF token from cookie
  function getCsrfToken() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === CSRF_COOKIE_NAME) {
        return decodeURIComponent(value);
      }
    }
    return null;
  }
  
  // Set CSRF token in form
  function setCsrfTokenInForm(form) {
    const token = getCsrfToken();
    if (!token) {
      console.warn('CSRF token not found');
      return false;
    }
    
    // Remove existing CSRF input
    const existingInput = form.querySelector('input[name="_csrf"]');
    if (existingInput) {
      existingInput.remove();
    }
    
    // Add CSRF token as hidden input
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = '_csrf';
    input.value = token;
    form.appendChild(input);
    
    return true;
  }
  
  // Intercept form submissions
  function protectForms() {
    document.addEventListener('submit', function(event) {
      const form = event.target;
      if (form.method && form.method.toLowerCase() === 'post') {
        if (!setCsrfTokenInForm(form)) {
          event.preventDefault();
          console.error('CSRF protection failed: token not available');
          return false;
        }
      }
    });
  }
  
  // Protect fetch requests
  const originalFetch = window.fetch;
  window.fetch = function(url, options = {}) {
    const token = getCsrfToken();
    
    // Add CSRF header for POST, PUT, DELETE, PATCH requests
    if (options.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method.toUpperCase())) {
      if (token) {
        options.headers = options.headers || {};
        options.headers[CSRF_HEADER_NAME] = token;
      } else {
        console.warn('CSRF token not found for fetch request');
      }
    }
    
    return originalFetch.call(this, url, options);
  };
  
  // Initialize CSRF protection
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', protectForms);
  } else {
    protectForms();
  }
  
  // Export functions for manual use
  window.EghactCSRF = {
    getToken: getCsrfToken,
    protectForm: setCsrfTokenInForm,
    headerName: CSRF_HEADER_NAME,
    cookieName: CSRF_COOKIE_NAME
  };
})();
`;
}

export {
  generateToken,
  validateToken,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME
};
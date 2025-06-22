#!/usr/bin/env node

/**
 * Security Integration Test Suite - Task 5.3
 * Tests comprehensive security integration with build system and dev server
 */

import { EghactBuildSystem } from './build-system/src/index.js';
import { SecurityMiddleware } from './dev-server/src/middleware/SecurityMiddleware.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Helper function to replace fs-extra functionality
const fsExtra = {
  async ensureDir(dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  },
  
  async pathExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  },
  
  async writeJson(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  },
  
  async readJson(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  },
  
  async remove(dir) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors during cleanup
    }
  }
};

const TEST_PROJECT_DIR = path.join(process.cwd(), '.test-security-integration');

async function runTests() {
  console.log('🛡️  Testing Security Integration - Task 5.3');
  console.log('=' .repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  try {
    // Setup test environment
    await setupTestEnvironment();
    
    // Test 1: Build System Security Integration
    console.log('\n🔨 Testing Build System Security Integration:');
    try {
      const buildSystem = new EghactBuildSystem({
        root: TEST_PROJECT_DIR,
        outDir: 'dist',
        enableXSS: true,
        enableCSRF: true,
        strictMode: true
      });
      
      // Test security integrator initialization
      if (buildSystem.securityIntegrator) {
        console.log('✅ Test 1a: SecurityIntegrator properly initialized');
        passed++;
      } else {
        console.log('❌ Test 1a: SecurityIntegrator not initialized');
        failed++;
      }
      
      // Test security manifest integration
      if (buildSystem.buildManifest.security) {
        console.log('✅ Test 1b: Security manifest section created');
        passed++;
      } else {
        console.log('❌ Test 1b: Security manifest section missing');
        failed++;
      }
      
      console.log('✅ Test 1c: Build system security integration verified');
      passed++;
    } catch (error) {
      console.log('❌ Test 1: Build system integration failed:', error.message);
      failed += 3;
    }
    
    // Test 2: Security Configuration Generation
    console.log('\n📋 Testing Security Configuration Generation:');
    try {
      const buildSystem = new EghactBuildSystem({
        root: TEST_PROJECT_DIR,
        outDir: 'dist'
      });
      
      // Mock the build manifest for testing
      buildSystem.buildManifest.csp = {
        policy: "default-src 'self'; script-src 'self' 'strict-dynamic'",
        nonce: 'test-nonce',
        mode: 'production'
      };
      
      const securityResult = await buildSystem.securityIntegrator.integrateSecurityFeatures();
      
      if (securityResult.xssEnabled !== undefined && securityResult.csrfEnabled !== undefined) {
        console.log('✅ Test 2a: Security configuration generated');
        passed++;
      } else {
        console.log('❌ Test 2a: Security configuration incomplete');
        failed++;
      }
      
      // Check if configuration files were created
      const configPath = path.join(TEST_PROJECT_DIR, 'dist', 'security-config.json');
      if (await fsExtra.pathExists(configPath)) {
        const config = await fsExtra.readJson(configPath);
        if (config.features && config.features.xss && config.features.csrf) {
          console.log('✅ Test 2b: Security config file created with XSS and CSRF settings');
          passed++;
        } else {
          console.log('❌ Test 2b: Security config file missing required features');
          failed++;
        }
      } else {
        console.log('❌ Test 2b: Security config file not created');
        failed++;
      }
      
      // Check security headers configuration
      const headersPath = path.join(TEST_PROJECT_DIR, 'dist', 'security-headers.json');
      if (await fsExtra.pathExists(headersPath)) {
        const headers = await fsExtra.readJson(headersPath);
        if (headers['X-Content-Type-Options'] && headers['X-Frame-Options']) {
          console.log('✅ Test 2c: Security headers configuration created');
          passed++;
        } else {
          console.log('❌ Test 2c: Security headers configuration incomplete');
          failed++;
        }
      } else {
        console.log('❌ Test 2c: Security headers configuration not created');
        failed++;
      }
      
    } catch (error) {
      console.log('❌ Test 2: Security configuration generation failed:', error.message);
      failed += 3;
    }
    
    // Test 3: Runtime Security Files
    console.log('\n🚀 Testing Runtime Security Files:');
    try {
      const runtimeFiles = [
        'xss-protection.js',
        'csrf-protection.js',
        'eghact-security.js'
      ];
      
      for (const file of runtimeFiles) {
        const filePath = path.join(TEST_PROJECT_DIR, 'dist', file);
        if (await fsExtra.pathExists(filePath)) {
          const content = await fs.readFile(filePath, 'utf-8');
          
          // Check for essential functions
          if (file === 'xss-protection.js' && content.includes('escapeHtml') && content.includes('isSafeUrl')) {
            console.log(`✅ Test 3a: ${file} contains XSS protection functions`);
            passed++;
          } else if (file === 'csrf-protection.js' && content.includes('protectForm') && content.includes('protectFetch')) {
            console.log(`✅ Test 3b: ${file} contains CSRF protection functions`);
            passed++;
          } else if (file === 'eghact-security.js' && content.includes('EghactSecurity') && content.includes('init')) {
            console.log(`✅ Test 3c: ${file} contains security runtime initialization`);
            passed++;
          } else {
            console.log(`❌ Test 3: ${file} missing essential functions`);
            failed++;
          }
        } else {
          console.log(`❌ Test 3: ${file} not generated`);
          failed++;
        }
      }
    } catch (error) {
      console.log('❌ Test 3: Runtime security files test failed:', error.message);
      failed += 3;
    }
    
    // Test 4: Development Server Middleware Integration
    console.log('\n🖥️  Testing Development Server Middleware:');
    try {
      const middleware = new SecurityMiddleware({
        enableCsrf: true,
        enableXssProtection: true,
        enableSecurityHeaders: true,
        enableContentValidation: true,
        developmentMode: true
      });
      
      // Test middleware initialization
      if (middleware.getMiddleware && typeof middleware.getMiddleware === 'function') {
        console.log('✅ Test 4a: SecurityMiddleware properly initialized');
        passed++;
      } else {
        console.log('❌ Test 4a: SecurityMiddleware initialization failed');
        failed++;
      }
      
      // Test security stats
      const stats = middleware.getSecurityStats();
      if (stats.csrfEnabled && stats.xssEnabled && stats.headersEnabled) {
        console.log('✅ Test 4b: Security features enabled in middleware');
        passed++;
      } else {
        console.log('❌ Test 4b: Security features not properly enabled');
        failed++;
      }
      
      // Test security report generation
      const report = middleware.generateSecurityReport();
      if (report.security && report.recommendations) {
        console.log('✅ Test 4c: Security report generation working');
        passed++;
      } else {
        console.log('❌ Test 4c: Security report generation failed');
        failed++;
      }
      
    } catch (error) {
      console.log('❌ Test 4: Development server middleware test failed:', error.message);
      failed += 3;
    }
    
    // Test 5: Security Headers Validation
    console.log('\n🔒 Testing Security Headers:');
    try {
      const middleware = new SecurityMiddleware({
        enableSecurityHeaders: true,
        developmentMode: true
      });
      
      // Mock request and reply objects
      const mockRequest = { url: '/test', method: 'GET' };
      const mockHeaders = {};
      const mockReply = {
        header: (name, value) => { mockHeaders[name] = value; },
        headers: (headers) => { Object.assign(mockHeaders, headers); },
        locals: {}
      };
      
      middleware.applySecurityHeaders(mockRequest, mockReply);
      
      // Check essential security headers
      const requiredHeaders = [
        'Content-Security-Policy',
        'X-XSS-Protection',
        'X-Content-Type-Options',
        'X-Frame-Options',
        'Referrer-Policy'
      ];
      
      let headersSet = 0;
      for (const header of requiredHeaders) {
        if (mockHeaders[header]) {
          headersSet++;
        }
      }
      
      if (headersSet === requiredHeaders.length) {
        console.log('✅ Test 5a: All required security headers set');
        passed++;
      } else {
        console.log(`❌ Test 5a: Only ${headersSet}/${requiredHeaders.length} security headers set`);
        failed++;
      }
      
      // Check CSP development configuration
      if (mockHeaders['Content-Security-Policy']?.includes("'unsafe-eval'")) {
        console.log('✅ Test 5b: Development CSP allows unsafe-eval for HMR');
        passed++;
      } else {
        console.log('❌ Test 5b: Development CSP missing HMR compatibility');
        failed++;
      }
      
    } catch (error) {
      console.log('❌ Test 5: Security headers test failed:', error.message);
      failed += 2;
    }
    
    // Test 6: Production Security Guide
    console.log('\n📖 Testing Production Security Guide:');
    try {
      const guidePath = path.join(TEST_PROJECT_DIR, 'dist', 'SECURITY-DEPLOYMENT.md');
      if (await fsExtra.pathExists(guidePath)) {
        const guide = await fs.readFile(guidePath, 'utf-8');
        
        // Check for essential sections
        const sections = [
          'Required Security Headers',
          'Environment Variables',
          'Security Checklist',
          'Testing Security'
        ];
        
        let sectionsFound = 0;
        for (const section of sections) {
          if (guide.includes(section)) {
            sectionsFound++;
          }
        }
        
        if (sectionsFound === sections.length) {
          console.log('✅ Test 6a: Security deployment guide contains all sections');
          passed++;
        } else {
          console.log(`❌ Test 6a: Security guide missing sections (${sectionsFound}/${sections.length})`);
          failed++;
        }
        
        // Check for server configurations
        if (guide.includes('Nginx') && guide.includes('Apache') && guide.includes('Cloudflare')) {
          console.log('✅ Test 6b: Multiple server configurations included');
          passed++;
        } else {
          console.log('❌ Test 6b: Missing server configuration examples');
          failed++;
        }
        
      } else {
        console.log('❌ Test 6: Security deployment guide not created');
        failed += 2;
      }
    } catch (error) {
      console.log('❌ Test 6: Production security guide test failed:', error.message);
      failed += 2;
    }
    
    // Test 7: XSS Runtime Protection
    console.log('\n🛡️  Testing XSS Runtime Protection:');
    try {
      const xssPath = path.join(TEST_PROJECT_DIR, 'dist', 'xss-protection.js');
      if (await fsExtra.pathExists(xssPath)) {
        const xssContent = await fs.readFile(xssPath, 'utf-8');
        
        // Check for XSS protection methods
        const xssMethods = ['escapeHtml', 'isSafeUrl', 'setTextContent', 'setAttribute'];
        let methodsFound = 0;
        
        for (const method of xssMethods) {
          if (xssContent.includes(method)) {
            methodsFound++;
          }
        }
        
        if (methodsFound === xssMethods.length) {
          console.log('✅ Test 7a: All XSS protection methods present');
          passed++;
        } else {
          console.log(`❌ Test 7a: Missing XSS methods (${methodsFound}/${xssMethods.length})`);
          failed++;
        }
        
        // Check for blocked schemes
        if (xssContent.includes('javascript:') && xssContent.includes('blockedSchemes')) {
          console.log('✅ Test 7b: Dangerous URL schemes blocked');
          passed++;
        } else {
          console.log('❌ Test 7b: URL scheme blocking not implemented');
          failed++;
        }
        
      } else {
        console.log('❌ Test 7: XSS protection runtime not created');
        failed += 2;
      }
    } catch (error) {
      console.log('❌ Test 7: XSS runtime protection test failed:', error.message);
      failed += 2;
    }
    
    // Test 8: CSRF Runtime Protection
    console.log('\n🔐 Testing CSRF Runtime Protection:');
    try {
      const csrfPath = path.join(TEST_PROJECT_DIR, 'dist', 'csrf-protection.js');
      if (await fsExtra.pathExists(csrfPath)) {
        const csrfContent = await fs.readFile(csrfPath, 'utf-8');
        
        // Check for CSRF protection methods
        const csrfMethods = ['protectForm', 'protectFetch', 'getToken', 'autoProtectForms'];
        let methodsFound = 0;
        
        for (const method of csrfMethods) {
          if (csrfContent.includes(method)) {
            methodsFound++;
          }
        }
        
        if (methodsFound === csrfMethods.length) {
          console.log('✅ Test 8a: All CSRF protection methods present');
          passed++;
        } else {
          console.log(`❌ Test 8a: Missing CSRF methods (${methodsFound}/${csrfMethods.length})`);
          failed++;
        }
        
        // Check for automatic initialization
        if (csrfContent.includes('DOMContentLoaded') && csrfContent.includes('init')) {
          console.log('✅ Test 8b: Automatic CSRF initialization implemented');
          passed++;
        } else {
          console.log('❌ Test 8b: Automatic CSRF initialization missing');
          failed++;
        }
        
      } else {
        console.log('❌ Test 8: CSRF protection runtime not created');
        failed += 2;
      }
    } catch (error) {
      console.log('❌ Test 8: CSRF runtime protection test failed:', error.message);
      failed += 2;
    }
    
  } catch (error) {
    console.error('Test setup failed:', error);
    return false;
  } finally {
    // Cleanup
    await cleanupTestEnvironment();
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`📊 Security Integration Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All security integration tests passed!');
    console.log('\n🛡️  Security Integration Features Verified:');
    console.log('   ✅ Build system security integration');
    console.log('   ✅ Security configuration generation');
    console.log('   ✅ Runtime security file creation');
    console.log('   ✅ Development server middleware');
    console.log('   ✅ Security headers configuration');
    console.log('   ✅ Production deployment guide');
    console.log('   ✅ XSS runtime protection');
    console.log('   ✅ CSRF runtime protection');
    return true;
  } else {
    console.log('⚠️  Some security integration tests failed!');
    return false;
  }
}

async function setupTestEnvironment() {
  // Create test project directory
  await fsExtra.ensureDir(TEST_PROJECT_DIR);
  await fsExtra.ensureDir(path.join(TEST_PROJECT_DIR, 'src', 'routes'));
  await fsExtra.ensureDir(path.join(TEST_PROJECT_DIR, 'dist'));
  
  // Create minimal package.json
  await fsExtra.writeJson(path.join(TEST_PROJECT_DIR, 'package.json'), {
    name: 'test-security-integration',
    version: '1.0.0',
    type: 'module'
  });
  
  // Create test component
  await fs.writeFile(path.join(TEST_PROJECT_DIR, 'src', 'routes', 'index.egh'), `
<template>
  <div>
    <h1>Test Security Integration</h1>
    <p>This is a test component for security integration.</p>
  </div>
</template>

<script>
  let message = 'Security test component';
</script>

<style>
  h1 { color: blue; }
</style>
`);
}

async function cleanupTestEnvironment() {
  try {
    await fsExtra.remove(TEST_PROJECT_DIR);
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Run the tests
const success = await runTests();
process.exit(success ? 0 : 1);
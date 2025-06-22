import { describe, it, expect, beforeEach } from '@jest/globals';
import { CspGenerator } from '../CspGenerator.js';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

describe('CspGenerator', () => {
  let csp;
  const testOutputDir = '/tmp/test-output';
  
  beforeEach(() => {
    csp = new CspGenerator(testOutputDir);
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(csp.options.mode).toBe('production');
      expect(csp.options.strictInlineStyles).toBe(true);
      expect(csp.options.strictInlineScripts).toBe(true);
      expect(csp.options.reportUri).toBe(null);
    });

    it('should accept custom options', () => {
      const customCsp = new CspGenerator(testOutputDir, {
        mode: 'development',
        strictInlineStyles: false,
        strictInlineScripts: false,
        reportUri: '/csp-report'
      });
      
      expect(customCsp.options.mode).toBe('development');
      expect(customCsp.options.strictInlineStyles).toBe(false);
      expect(customCsp.options.strictInlineScripts).toBe(false);
      expect(customCsp.options.reportUri).toBe('/csp-report');
    });
  });

  describe('generateNonce', () => {
    it('should generate 16-byte base64 nonce', () => {
      const nonce = csp.generateNonce();
      const decoded = Buffer.from(nonce, 'base64');
      
      expect(decoded.length).toBe(16);
      expect(nonce).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it('should generate unique nonces', () => {
      const nonce1 = csp.generateNonce();
      const nonce2 = csp.generateNonce();
      
      expect(nonce1).not.toBe(nonce2);
    });
  });

  describe('calculateHash', () => {
    it('should calculate SHA-256 hash correctly', () => {
      const content = 'console.log("test");';
      const hash = csp.calculateHash(content);
      
      // Verify it's a valid base64 SHA-256 hash
      expect(hash).toMatch(/^[A-Za-z0-9+/=]{43,44}$/);
      
      // Verify against known hash
      const expectedHash = crypto
        .createHash('sha256')
        .update(content, 'utf8')
        .digest('base64');
      
      expect(hash).toBe(expectedHash);
    });

    it('should generate different hashes for different content', () => {
      const hash1 = csp.calculateHash('content1');
      const hash2 = csp.calculateHash('content2');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('processScriptTag', () => {
    it('should add nonce to script tags without src', () => {
      const html = '<script>console.log("test");</script>';
      const result = csp.processScriptTag(html);
      
      expect(result).toContain(`nonce="${csp.nonce}"`);
      expect(csp.scriptHashes.size).toBe(1);
    });

    it('should not add nonce to external scripts', () => {
      const html = '<script src="/app.js"></script>';
      const result = csp.processScriptTag(html);
      
      expect(result).toBe(html);
      expect(csp.scriptHashes.size).toBe(0);
    });

    it('should handle multiple inline scripts', () => {
      const html = `
        <script>console.log("1");</script>
        <script>console.log("2");</script>
      `;
      const result = csp.processScriptTag(html);
      
      expect((result.match(/nonce="/g) || []).length).toBe(2);
      expect(csp.scriptHashes.size).toBe(2);
    });
  });

  describe('processStyleTag', () => {
    it('should add nonce to inline style tags', () => {
      const html = '<style>body { color: red; }</style>';
      const result = csp.processStyleTag(html);
      
      expect(result).toContain(`nonce="${csp.nonce}"`);
      expect(csp.styleHashes.size).toBe(1);
    });

    it('should not add nonce to external stylesheets', () => {
      const html = '<link rel="stylesheet" href="/styles.css">';
      const result = csp.processStyleTag(html);
      
      expect(result).toBe(html);
      expect(csp.styleHashes.size).toBe(0);
    });
  });

  describe('generatePolicy', () => {
    it('should generate production policy with hashes', async () => {
      // Mock file system
      const mockFiles = {
        [`${testOutputDir}/index.html`]: `
          <script>console.log("app");</script>
          <style>body { margin: 0; }</style>
        `
      };
      
      jest.spyOn(fs, 'pathExists').mockResolvedValue(true);
      jest.spyOn(fs, 'readdir').mockResolvedValue(['index.html']);
      jest.spyOn(fs, 'readFile').mockImplementation(async (path) => {
        return mockFiles[path] || '';
      });
      
      const policy = await csp.generatePolicy();
      
      expect(policy.mode).toBe('production');
      expect(policy.nonce).toBeTruthy();
      expect(policy.scriptHashes.length).toBeGreaterThan(0);
      expect(policy.styleHashes.length).toBeGreaterThan(0);
      expect(policy.policy).toContain("default-src 'self'");
      expect(policy.policy).toContain('sha256-');
    });

    it('should generate development policy with relaxed rules', async () => {
      const devCsp = new CspGenerator(testOutputDir, { mode: 'development' });
      
      jest.spyOn(fs, 'pathExists').mockResolvedValue(true);
      jest.spyOn(fs, 'readdir').mockResolvedValue([]);
      
      const policy = await devCsp.generatePolicy();
      
      expect(policy.policy).toContain("'unsafe-inline'");
      expect(policy.policy).toContain("'unsafe-eval'");
    });

    it('should include report-uri when configured', async () => {
      const reportCsp = new CspGenerator(testOutputDir, {
        reportUri: '/csp-violations'
      });
      
      jest.spyOn(fs, 'pathExists').mockResolvedValue(true);
      jest.spyOn(fs, 'readdir').mockResolvedValue([]);
      
      const policy = await reportCsp.generatePolicy();
      
      expect(policy.policy).toContain('report-uri /csp-violations');
    });
  });

  describe('formatCSPHeader', () => {
    it('should format basic CSP header correctly', () => {
      const header = csp.formatCSPHeader();
      
      expect(header).toContain("default-src 'self'");
      expect(header).toContain("script-src 'self'");
      expect(header).toContain("style-src 'self'");
      expect(header).toContain("img-src 'self' data: https:");
    });

    it('should include nonces when not strict', () => {
      const relaxedCsp = new CspGenerator(testOutputDir, {
        strictInlineStyles: false,
        strictInlineScripts: false
      });
      
      const header = relaxedCsp.formatCSPHeader();
      
      expect(header).toContain(`'nonce-${relaxedCsp.nonce}'`);
    });

    it('should include hashes in strict mode', () => {
      csp.scriptHashes.add('abc123');
      csp.styleHashes.add('def456');
      
      const header = csp.formatCSPHeader();
      
      expect(header).toContain("'sha256-abc123'");
      expect(header).toContain("'sha256-def456'");
    });
  });

  describe('writeCspMetadata', () => {
    it('should write CSP metadata file', async () => {
      const metadata = {
        policy: "default-src 'self'",
        nonce: 'test-nonce',
        scriptHashes: ['hash1'],
        styleHashes: ['hash2'],
        mode: 'production'
      };
      
      const writeSpy = jest.spyOn(fs, 'writeFile').mockResolvedValue();
      
      await csp.writeCspMetadata(metadata);
      
      expect(writeSpy).toHaveBeenCalledWith(
        path.join(testOutputDir, 'csp-metadata.json'),
        expect.stringContaining('"policy"'),
        'utf-8'
      );
    });
  });
});
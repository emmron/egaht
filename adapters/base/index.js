/**
 * Base Adapter for Eghact Deployment
 * Provides common functionality for all platform-specific adapters
 */

import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';

export class BaseAdapter {
  constructor(options = {}) {
    this.name = 'base';
    this.buildDir = options.buildDir || 'dist';
    this.outputDir = options.outputDir || '.eghact-deploy';
    this.config = options.config || {};
    this.platform = options.platform || 'unknown';
  }

  /**
   * Validate the build output before deployment
   */
  async validate() {
    const buildPath = path.resolve(this.buildDir);
    
    if (!await fs.pathExists(buildPath)) {
      throw new Error(`Build directory "${this.buildDir}" does not exist. Run "eghact build" first.`);
    }

    const requiredFiles = ['index.html', 'manifest.json'];
    for (const file of requiredFiles) {
      const filePath = path.join(buildPath, file);
      if (!await fs.pathExists(filePath)) {
        throw new Error(`Required file "${file}" not found in build directory`);
      }
    }

    console.log('✅ Build validation passed');
    return true;
  }

  /**
   * Prepare the deployment directory
   */
  async prepare() {
    const outputPath = path.resolve(this.outputDir);
    
    // Clean and create output directory
    await fs.emptyDir(outputPath);
    console.log(`📁 Created deployment directory: ${this.outputDir}`);

    return outputPath;
  }

  /**
   * Copy static assets to deployment directory
   */
  async copyStaticAssets(targetDir) {
    const buildPath = path.resolve(this.buildDir);
    const staticFiles = await glob('**/*.{html,css,js,json,ico,png,jpg,jpeg,gif,svg,woff,woff2,ttf,eot}', {
      cwd: buildPath,
      nodir: true
    });

    for (const file of staticFiles) {
      const src = path.join(buildPath, file);
      const dest = path.join(targetDir, file);
      await fs.ensureDir(path.dirname(dest));
      await fs.copy(src, dest);
    }

    console.log(`📋 Copied ${staticFiles.length} static files`);
    return staticFiles;
  }

  /**
   * Extract SSR/API routes from the build
   */
  async extractServerRoutes() {
    const buildPath = path.resolve(this.buildDir);
    const routesFile = path.join(buildPath, 'ssr-manifest.json');
    
    if (await fs.pathExists(routesFile)) {
      const manifest = await fs.readJson(routesFile);
      return manifest.routes || [];
    }

    return [];
  }

  /**
   * Generate platform-specific configuration
   */
  async generateConfig() {
    throw new Error('generateConfig() must be implemented by platform-specific adapter');
  }

  /**
   * Transform the build output for the target platform
   */
  async transform() {
    throw new Error('transform() must be implemented by platform-specific adapter');
  }

  /**
   * Main adapter execution
   */
  async run() {
    console.log(`🚀 Running ${this.name} adapter...`);
    
    try {
      // Validate build
      await this.validate();
      
      // Prepare deployment directory
      const outputPath = await this.prepare();
      
      // Transform build for platform
      await this.transform(outputPath);
      
      // Generate platform config
      const config = await this.generateConfig(outputPath);
      
      console.log(`✨ ${this.name} adapter completed successfully!`);
      console.log(`📁 Output: ${this.outputDir}`);
      
      return { outputPath, config };
    } catch (error) {
      console.error(`❌ ${this.name} adapter failed:`, error.message);
      throw error;
    }
  }

  /**
   * Get deployment instructions
   */
  getInstructions() {
    return `
Deployment Instructions:
1. Review the generated files in ${this.outputDir}
2. Follow platform-specific deployment steps
3. Verify deployment at the platform's dashboard
    `.trim();
  }
}
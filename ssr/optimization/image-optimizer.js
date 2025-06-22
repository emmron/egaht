import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

export class ImageOptimizer {
  constructor(config = {}) {
    this.config = {
      formats: ['webp', 'avif', 'jpeg'],
      quality: 85,
      progressive: true,
      outputDir: 'optimized',
      lazy: true,
      responsive: true,
      placeholder: 'blur',
      ...config
    };
    this.cache = new Map();
  }

  async optimizeImage(imagePath, options = {}) {
    const config = { ...this.config, ...options };
    const cacheKey = this.generateCacheKey(imagePath, config);
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const imageBuffer = await readFile(imagePath);
      const metadata = await this.getImageMetadata(imageBuffer);
      
      const optimizedVersions = await this.generateOptimizedVersions(
        imageBuffer, 
        metadata, 
        config
      );
      
      const result = {
        original: {
          path: imagePath,
          size: imageBuffer.length,
          dimensions: { width: metadata.width, height: metadata.height }
        },
        optimized: optimizedVersions,
        html: this.generateOptimizedHTML(optimizedVersions, config),
        savings: this.calculateSavings(imageBuffer.length, optimizedVersions)
      };

      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Image optimization failed:', error);
      return {
        error: error.message,
        original: { path: imagePath, size: 0, dimensions: { width: 0, height: 0 } },
        optimized: [],
        html: `<img src="${imagePath}" alt="" loading="lazy">`,
        savings: 0
      };
    }
  }

  async generateOptimizedVersions(imageBuffer, metadata, config) {
    const versions = [];
    
    // Generate different formats
    for (const format of config.formats) {
      const formatVersions = await this.generateFormatVersions(
        imageBuffer, 
        metadata, 
        format, 
        config
      );
      versions.push(...formatVersions);
    }

    // Generate responsive sizes if enabled
    if (config.responsive) {
      const responsiveVersions = await this.generateResponsiveVersions(
        imageBuffer,
        metadata,
        config
      );
      versions.push(...responsiveVersions);
    }

    return versions;
  }

  async generateFormatVersions(imageBuffer, metadata, format, config) {
    // This is a simplified implementation
    // In a real system, you'd use sharp, imagemin, or similar libraries
    const versions = [];
    
    const optimized = await this.convertToFormat(imageBuffer, format, config);
    
    versions.push({
      format,
      quality: config.quality,
      size: optimized.length,
      savings: ((imageBuffer.length - optimized.length) / imageBuffer.length * 100).toFixed(1),
      path: this.generateOptimizedPath(metadata.name, format, config.quality),
      buffer: optimized,
      dimensions: metadata
    });

    return versions;
  }

  async generateResponsiveVersions(imageBuffer, metadata, config) {
    const versions = [];
    const breakpoints = config.breakpoints || [480, 768, 1024, 1200, 1920];
    
    for (const width of breakpoints) {
      if (width < metadata.width) {
        const height = Math.round((width / metadata.width) * metadata.height);
        const resized = await this.resizeImage(imageBuffer, width, height, config);
        
        versions.push({
          format: 'responsive',
          width,
          height,
          size: resized.length,
          path: this.generateResponsivePath(metadata.name, width, config.quality),
          buffer: resized,
          dimensions: { width, height }
        });
      }
    }

    return versions;
  }

  async convertToFormat(imageBuffer, format, config) {
    // Simplified format conversion - would use sharp or similar in reality
    switch (format) {
      case 'webp':
        return this.convertToWebP(imageBuffer, config);
      case 'avif':
        return this.convertToAVIF(imageBuffer, config);
      case 'jpeg':
        return this.optimizeJPEG(imageBuffer, config);
      case 'png':
        return this.optimizePNG(imageBuffer, config);
      default:
        return imageBuffer;
    }
  }

  async convertToWebP(imageBuffer, config) {
    // Placeholder - would use sharp: sharp(imageBuffer).webp({ quality: config.quality })
    console.log(`Converting to WebP with quality ${config.quality}`);
    return imageBuffer; // Simplified
  }

  async convertToAVIF(imageBuffer, config) {
    // Placeholder - would use sharp: sharp(imageBuffer).avif({ quality: config.quality })
    console.log(`Converting to AVIF with quality ${config.quality}`);
    return imageBuffer; // Simplified
  }

  async optimizeJPEG(imageBuffer, config) {
    // Placeholder - would use sharp or imagemin-mozjpeg
    console.log(`Optimizing JPEG with quality ${config.quality}, progressive: ${config.progressive}`);
    return imageBuffer; // Simplified
  }

  async optimizePNG(imageBuffer, config) {
    // Placeholder - would use imagemin-pngquant or similar
    console.log('Optimizing PNG');
    return imageBuffer; // Simplified
  }

  async resizeImage(imageBuffer, width, height, config) {
    // Placeholder - would use sharp: sharp(imageBuffer).resize(width, height)
    console.log(`Resizing image to ${width}x${height}`);
    return imageBuffer; // Simplified
  }

  async getImageMetadata(imageBuffer) {
    // Simplified metadata extraction - would use sharp or image-size
    return {
      name: 'image',
      width: 1920,
      height: 1080,
      format: 'jpeg',
      channels: 3,
      density: 72
    };
  }

  generateOptimizedHTML(versions, config) {
    if (versions.length === 0) {
      return '<img src="" alt="" loading="lazy">';
    }

    // Find the best fallback image
    const fallback = versions.find(v => v.format === 'jpeg') || versions[0];
    
    // Generate picture element with multiple sources
    let html = '<picture>';
    
    // Group by format and add source elements
    const formatGroups = this.groupByFormat(versions);
    
    Object.entries(formatGroups).forEach(([format, formatVersions]) => {
      if (format !== 'jpeg') { // Skip fallback format
        const srcset = formatVersions
          .map(v => `${v.path} ${v.dimensions.width}w`)
          .join(', ');
        
        html += `\n  <source type="image/${format}" srcset="${srcset}">`;
      }
    });

    // Add fallback img element
    html += `\n  <img src="${fallback.path}"`;
    
    if (config.lazy) {
      html += ' loading="lazy"';
    }
    
    if (config.responsive && formatGroups.responsive) {
      const srcset = formatGroups.responsive
        .map(v => `${v.path} ${v.dimensions.width}w`)
        .join(', ');
      html += ` srcset="${srcset}"`;
      html += ' sizes="(max-width: 768px) 100vw, (max-width: 1024px) 80vw, 60vw"';
    }
    
    html += ` alt="" width="${fallback.dimensions.width}" height="${fallback.dimensions.height}">`;
    html += '\n</picture>';

    return html;
  }

  groupByFormat(versions) {
    return versions.reduce((groups, version) => {
      const format = version.format;
      if (!groups[format]) groups[format] = [];
      groups[format].push(version);
      return groups;
    }, {});
  }

  generateOptimizedPath(name, format, quality) {
    return `/optimized/${name}.${quality}.${format}`;
  }

  generateResponsivePath(name, width, quality) {
    return `/optimized/${name}.${width}w.${quality}.jpg`;
  }

  calculateSavings(originalSize, versions) {
    if (versions.length === 0) return 0;
    
    const bestVersion = versions.reduce((best, current) => 
      current.size < best.size ? current : best
    );
    
    return ((originalSize - bestVersion.size) / originalSize * 100).toFixed(1);
  }

  generateCacheKey(imagePath, config) {
    return `${imagePath}:${JSON.stringify(config)}`;
  }

  async saveOptimizedVersions(versions, outputDir) {
    await mkdir(outputDir, { recursive: true });
    
    const savedFiles = [];
    for (const version of versions) {
      const outputPath = path.join(outputDir, path.basename(version.path));
      await writeFile(outputPath, version.buffer);
      savedFiles.push(outputPath);
    }
    
    return savedFiles;
  }

  // Batch optimization for multiple images
  async optimizeDirectory(inputDir, outputDir, options = {}) {
    const config = { ...this.config, ...options };
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const results = [];

    try {
      const files = await this.getAllFiles(inputDir);
      const imageFiles = files.filter(file => 
        imageExtensions.includes(path.extname(file).toLowerCase())
      );

      console.log(`Found ${imageFiles.length} images to optimize`);

      for (const imagePath of imageFiles) {
        console.log(`Optimizing: ${path.basename(imagePath)}`);
        const result = await this.optimizeImage(imagePath, config);
        
        if (!result.error) {
          await this.saveOptimizedVersions(result.optimized, outputDir);
        }
        
        results.push({
          input: imagePath,
          ...result
        });
      }

      return {
        processed: results.length,
        successful: results.filter(r => !r.error).length,
        failed: results.filter(r => r.error).length,
        totalSavings: results.reduce((sum, r) => sum + parseFloat(r.savings || 0), 0),
        results
      };
    } catch (error) {
      console.error('Batch optimization failed:', error);
      return { error: error.message, results: [] };
    }
  }

  async getAllFiles(dir) {
    // Simplified file discovery - would use fs.readdir recursively
    return []; // Placeholder
  }

  // Generate progressive JPEG placeholder
  generatePlaceholder(metadata, type = 'blur') {
    switch (type) {
      case 'blur':
        return this.generateBlurPlaceholder(metadata);
      case 'solid':
        return this.generateSolidPlaceholder('#f0f0f0');
      case 'gradient':
        return this.generateGradientPlaceholder(['#f0f0f0', '#e0e0e0']);
      default:
        return '';
    }
  }

  generateBlurPlaceholder(metadata) {
    // Generate a tiny, blurred version of the image as base64
    const width = Math.max(20, Math.round(metadata.width / 50));
    const height = Math.max(20, Math.round(metadata.height / 50));
    
    // Placeholder - would generate actual tiny blurred image
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f0f0f0"/>
      </svg>
    `)}`;
  }

  generateSolidPlaceholder(color) {
    return `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="1" height="1">
        <rect width="1" height="1" fill="${color}"/>
      </svg>
    `)}`;
  }

  generateGradientPlaceholder(colors) {
    return `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="1" height="1">
        <defs>
          <linearGradient id="grad">
            <stop offset="0%" stop-color="${colors[0]}"/>
            <stop offset="100%" stop-color="${colors[1]}"/>
          </linearGradient>
        </defs>
        <rect width="1" height="1" fill="url(#grad)"/>
      </svg>
    `)}`;
  }

  // Performance monitoring
  getOptimizationStats() {
    const stats = {
      cacheSize: this.cache.size,
      totalOptimizations: this.cache.size,
      averageSavings: 0,
      formatDistribution: {},
      sizeDistribution: { small: 0, medium: 0, large: 0 }
    };

    let totalSavings = 0;
    for (const result of this.cache.values()) {
      if (result.savings) {
        totalSavings += parseFloat(result.savings);
      }
      
      result.optimized?.forEach(version => {
        stats.formatDistribution[version.format] = 
          (stats.formatDistribution[version.format] || 0) + 1;
        
        if (version.size < 50000) stats.sizeDistribution.small++;
        else if (version.size < 200000) stats.sizeDistribution.medium++;
        else stats.sizeDistribution.large++;
      });
    }

    stats.averageSavings = this.cache.size > 0 ? totalSavings / this.cache.size : 0;
    
    return stats;
  }

  clearCache() {
    this.cache.clear();
  }
}
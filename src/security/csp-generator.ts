import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface CSPConfig {
  reportUri?: string;
  upgradeInsecureRequests?: boolean;
  blockAllMixedContent?: boolean;
  customDirectives?: Record<string, string[]>;
}

export interface AssetInfo {
  type: 'script' | 'style' | 'image' | 'font' | 'media';
  source: 'inline' | 'local' | 'external';
  content?: string;
  url?: string;
}

export class CSPGenerator {
  private directives: Map<string, Set<string>>;
  private nonces: Map<string, string>;
  private hashes: Map<string, string>;
  private config: CSPConfig;

  constructor(config: CSPConfig = {}) {
    this.directives = new Map();
    this.nonces = new Map();
    this.hashes = new Map();
    this.config = config;
    
    // Initialize default directives
    this.initializeDefaults();
  }

  private initializeDefaults(): void {
    // Default secure CSP directives
    this.addDirective('default-src', ["'self'"]);
    this.addDirective('base-uri', ["'self'"]);
    this.addDirective('frame-ancestors', ["'none'"]);
    this.addDirective('form-action', ["'self'"]);
    
    if (this.config.upgradeInsecureRequests) {
      this.directives.set('upgrade-insecure-requests', new Set());
    }
    
    if (this.config.blockAllMixedContent) {
      this.directives.set('block-all-mixed-content', new Set());
    }
  }

  public analyzeAssets(buildDir: string): void {
    const assets = this.scanBuildDirectory(buildDir);
    
    for (const asset of assets) {
      this.processAsset(asset);
    }
  }

  private scanBuildDirectory(dir: string): AssetInfo[] {
    const assets: AssetInfo[] = [];
    
    const scanDir = (currentDir: string) => {
      const files = fs.readdirSync(currentDir);
      
      for (const file of files) {
        const filePath = path.join(currentDir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          scanDir(filePath);
        } else {
          const asset = this.identifyAsset(filePath);
          if (asset) {
            assets.push(asset);
          }
        }
      }
    };
    
    scanDir(dir);
    return assets;
  }

  private identifyAsset(filePath: string): AssetInfo | null {
    const ext = path.extname(filePath).toLowerCase();
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Check for inline scripts/styles in HTML files
    if (ext === '.html') {
      this.extractInlineAssets(content);
      return null;
    }
    
    // Identify asset type by extension
    const assetTypeMap: Record<string, AssetInfo['type']> = {
      '.js': 'script',
      '.mjs': 'script',
      '.css': 'style',
      '.png': 'image',
      '.jpg': 'image',
      '.jpeg': 'image',
      '.gif': 'image',
      '.svg': 'image',
      '.webp': 'image',
      '.woff': 'font',
      '.woff2': 'font',
      '.ttf': 'font',
      '.otf': 'font',
      '.mp4': 'media',
      '.webm': 'media',
      '.ogg': 'media',
    };
    
    const type = assetTypeMap[ext];
    if (!type) return null;
    
    return {
      type,
      source: 'local',
      url: filePath,
    };
  }

  private extractInlineAssets(htmlContent: string): void {
    // Extract inline scripts
    const scriptRegex = /<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    
    while ((match = scriptRegex.exec(htmlContent)) !== null) {
      const scriptContent = match[1].trim();
      if (scriptContent) {
        this.processAsset({
          type: 'script',
          source: 'inline',
          content: scriptContent,
        });
      }
    }
    
    // Extract inline styles
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    
    while ((match = styleRegex.exec(htmlContent)) !== null) {
      const styleContent = match[1].trim();
      if (styleContent) {
        this.processAsset({
          type: 'style',
          source: 'inline',
          content: styleContent,
        });
      }
    }
    
    // Extract external resources
    const linkRegex = /<link[^>]+href=["']([^"']+)["'][^>]*>/gi;
    
    while ((match = linkRegex.exec(htmlContent)) !== null) {
      const url = match[1];
      if (url.startsWith('http://') || url.startsWith('https://')) {
        this.processAsset({
          type: 'style',
          source: 'external',
          url: url,
        });
      }
    }
    
    const scriptSrcRegex = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
    
    while ((match = scriptSrcRegex.exec(htmlContent)) !== null) {
      const url = match[1];
      if (url.startsWith('http://') || url.startsWith('https://')) {
        this.processAsset({
          type: 'script',
          source: 'external',
          url: url,
        });
      }
    }
  }

  private processAsset(asset: AssetInfo): void {
    switch (asset.type) {
      case 'script':
        this.processScript(asset);
        break;
      case 'style':
        this.processStyle(asset);
        break;
      case 'image':
        this.processImage(asset);
        break;
      case 'font':
        this.processFont(asset);
        break;
      case 'media':
        this.processMedia(asset);
        break;
    }
  }

  private processScript(asset: AssetInfo): void {
    if (asset.source === 'inline' && asset.content) {
      // Generate hash for inline script
      const hash = this.generateHash(asset.content);
      this.hashes.set(`script-${Date.now()}`, hash);
      this.addDirective('script-src', [`'sha256-${hash}'`]);
    } else if (asset.source === 'external' && asset.url) {
      // Add external domain to script-src
      const domain = this.extractDomain(asset.url);
      if (domain) {
        this.addDirective('script-src', [domain]);
      }
    } else {
      // Local scripts
      this.addDirective('script-src', ["'self'"]);
    }
  }

  private processStyle(asset: AssetInfo): void {
    if (asset.source === 'inline' && asset.content) {
      // Generate hash for inline style
      const hash = this.generateHash(asset.content);
      this.hashes.set(`style-${Date.now()}`, hash);
      this.addDirective('style-src', [`'sha256-${hash}'`]);
    } else if (asset.source === 'external' && asset.url) {
      // Add external domain to style-src
      const domain = this.extractDomain(asset.url);
      if (domain) {
        this.addDirective('style-src', [domain]);
      }
    } else {
      // Local styles
      this.addDirective('style-src', ["'self'"]);
    }
  }

  private processImage(asset: AssetInfo): void {
    if (asset.source === 'external' && asset.url) {
      const domain = this.extractDomain(asset.url);
      if (domain) {
        this.addDirective('img-src', [domain]);
      }
    } else {
      this.addDirective('img-src', ["'self'", 'data:', 'blob:']);
    }
  }

  private processFont(asset: AssetInfo): void {
    if (asset.source === 'external' && asset.url) {
      const domain = this.extractDomain(asset.url);
      if (domain) {
        this.addDirective('font-src', [domain]);
      }
    } else {
      this.addDirective('font-src', ["'self'"]);
    }
  }

  private processMedia(asset: AssetInfo): void {
    if (asset.source === 'external' && asset.url) {
      const domain = this.extractDomain(asset.url);
      if (domain) {
        this.addDirective('media-src', [domain]);
      }
    } else {
      this.addDirective('media-src', ["'self'"]);
    }
  }

  private generateHash(content: string): string {
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('base64');
  }

  private generateNonce(): string {
    return crypto.randomBytes(16).toString('base64');
  }

  private extractDomain(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}`;
    } catch {
      return null;
    }
  }

  private addDirective(directive: string, values: string[]): void {
    if (!this.directives.has(directive)) {
      this.directives.set(directive, new Set());
    }
    
    const directiveSet = this.directives.get(directive)!;
    for (const value of values) {
      directiveSet.add(value);
    }
  }

  public generateCSPHeader(): string {
    const parts: string[] = [];
    
    // Add custom directives from config
    if (this.config.customDirectives) {
      for (const [directive, values] of Object.entries(this.config.customDirectives)) {
        this.addDirective(directive, values);
      }
    }
    
    // Build CSP string
    for (const [directive, values] of this.directives) {
      if (values.size === 0) {
        // Directives without values (like upgrade-insecure-requests)
        parts.push(directive);
      } else {
        const valueArray = Array.from(values);
        parts.push(`${directive} ${valueArray.join(' ')}`);
      }
    }
    
    // Add report-uri if configured
    if (this.config.reportUri) {
      parts.push(`report-uri ${this.config.reportUri}`);
    }
    
    return parts.join('; ');
  }

  public generateMetaTag(): string {
    const cspContent = this.generateCSPHeader();
    return `<meta http-equiv="Content-Security-Policy" content="${cspContent}">`;
  }

  public getNonces(): Map<string, string> {
    return new Map(this.nonces);
  }

  public getHashes(): Map<string, string> {
    return new Map(this.hashes);
  }
}
export class SitemapGenerator {
  constructor(config = {}) {
    this.config = {
      baseUrl: process.env.SITE_URL || 'https://example.com',
      defaultChangefreq: 'weekly',
      defaultPriority: 0.8,
      maxUrls: 50000,
      ...config
    };
  }

  async generateSitemap(routes, content = []) {
    const urls = [];
    
    // Add static routes
    routes.forEach(route => {
      urls.push(this.createUrlEntry(route));
    });

    // Add content-based URLs
    content.forEach(item => {
      const url = this.createContentUrlEntry(item);
      if (url) urls.push(url);
    });

    // Remove duplicates and sort
    const uniqueUrls = this.deduplicateUrls(urls);
    uniqueUrls.sort((a, b) => b.priority - a.priority);

    // Limit to max URLs
    const limitedUrls = uniqueUrls.slice(0, this.config.maxUrls);

    return this.generateXmlSitemap(limitedUrls);
  }

  createUrlEntry(route) {
    const url = this.normalizeUrl(route.path || route);
    const priority = this.calculatePriority(url);
    const changefreq = this.getChangeFrequency(url);
    
    return {
      loc: `${this.config.baseUrl}${url}`,
      lastmod: route.lastModified || new Date().toISOString().split('T')[0],
      changefreq,
      priority
    };
  }

  createContentUrlEntry(item) {
    if (!item.url && !item.slug) return null;
    
    const url = item.url || `/${item.contentType}/${item.slug}`;
    const normalizedUrl = this.normalizeUrl(url);
    
    return {
      loc: `${this.config.baseUrl}${normalizedUrl}`,
      lastmod: item.updatedAt ? new Date(item.updatedAt).toISOString().split('T')[0] : undefined,
      changefreq: this.getChangeFrequency(normalizedUrl, item.contentType),
      priority: this.calculatePriority(normalizedUrl, item.contentType)
    };
  }

  normalizeUrl(url) {
    if (!url.startsWith('/')) url = '/' + url;
    if (url.endsWith('/') && url !== '/') url = url.slice(0, -1);
    return url;
  }

  calculatePriority(url, contentType = null) {
    // Homepage gets highest priority
    if (url === '/') return 1.0;
    
    // Important pages
    if (url.match(/^\/(about|contact|pricing|services)$/)) return 0.9;
    
    // Content type specific priorities
    if (contentType) {
      switch (contentType) {
        case 'blog-post':
        case 'article': return 0.7;
        case 'product': return 0.8;
        case 'page': return 0.6;
        default: return 0.5;
      }
    }
    
    // URL depth-based priority
    const depth = url.split('/').length - 1;
    if (depth === 1) return 0.8;
    if (depth === 2) return 0.6;
    if (depth === 3) return 0.4;
    return 0.3;
  }

  getChangeFrequency(url, contentType = null) {
    // Homepage and main pages change frequently
    if (url === '/' || url.match(/^\/(blog|news|products)$/)) return 'daily';
    
    // Content type specific frequencies
    if (contentType) {
      switch (contentType) {
        case 'blog-post':
        case 'news': return 'weekly';
        case 'product': return 'monthly';
        case 'page': return 'monthly';
        default: return 'yearly';
      }
    }
    
    // Static pages change less frequently
    if (url.match(/^\/(about|contact|privacy|terms)$/)) return 'yearly';
    
    return this.config.defaultChangefreq;
  }

  deduplicateUrls(urls) {
    const seen = new Set();
    return urls.filter(url => {
      if (seen.has(url.loc)) return false;
      seen.add(url.loc);
      return true;
    });
  }

  generateXmlSitemap(urls) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => this.generateUrlXml(url)).join('\n')}
</urlset>`;

    return xml;
  }

  generateUrlXml(url) {
    let xml = `  <url>
    <loc>${this.escapeXml(url.loc)}</loc>`;
    
    if (url.lastmod) {
      xml += `\n    <lastmod>${url.lastmod}</lastmod>`;
    }
    
    if (url.changefreq) {
      xml += `\n    <changefreq>${url.changefreq}</changefreq>`;
    }
    
    if (url.priority !== undefined) {
      xml += `\n    <priority>${url.priority.toFixed(1)}</priority>`;
    }
    
    xml += '\n  </url>';
    return xml;
  }

  async generateImageSitemap(images) {
    const urls = images.map(image => ({
      loc: `${this.config.baseUrl}${image.url}`,
      image: {
        loc: `${this.config.baseUrl}${image.src}`,
        caption: image.caption,
        title: image.title,
        license: image.license
      }
    }));

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" 
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(url => this.generateImageUrlXml(url)).join('\n')}
</urlset>`;

    return xml;
  }

  generateImageUrlXml(url) {
    let xml = `  <url>
    <loc>${this.escapeXml(url.loc)}</loc>
    <image:image>
      <image:loc>${this.escapeXml(url.image.loc)}</image:loc>`;
    
    if (url.image.caption) {
      xml += `\n      <image:caption>${this.escapeXml(url.image.caption)}</image:caption>`;
    }
    
    if (url.image.title) {
      xml += `\n      <image:title>${this.escapeXml(url.image.title)}</image:title>`;
    }
    
    if (url.image.license) {
      xml += `\n      <image:license>${this.escapeXml(url.image.license)}</image:license>`;
    }
    
    xml += '\n    </image:image>\n  </url>';
    return xml;
  }

  generateRobotsTxt(options = {}) {
    const config = {
      allowAll: true,
      disallowPaths: ['/admin', '/api', '/private'],
      crawlDelay: null,
      ...options
    };

    let robots = '';
    
    // User-agent directive
    robots += 'User-agent: *\n';
    
    // Allow/Disallow directives
    if (config.allowAll) {
      robots += 'Allow: /\n';
    }
    
    config.disallowPaths.forEach(path => {
      robots += `Disallow: ${path}\n`;
    });
    
    // Crawl delay
    if (config.crawlDelay) {
      robots += `Crawl-delay: ${config.crawlDelay}\n`;
    }
    
    // Sitemap location
    robots += `\nSitemap: ${this.config.baseUrl}/sitemap.xml\n`;
    
    // Additional sitemaps
    if (options.imageSitemap) {
      robots += `Sitemap: ${this.config.baseUrl}/sitemap-images.xml\n`;
    }
    
    if (options.newsSitemap) {
      robots += `Sitemap: ${this.config.baseUrl}/sitemap-news.xml\n`;
    }

    return robots;
  }

  async generateNewsSitemap(articles) {
    // Google News sitemap (last 2 days only)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    const recentArticles = articles.filter(article => 
      new Date(article.publishedAt) > twoDaysAgo
    );

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${recentArticles.map(article => this.generateNewsUrlXml(article)).join('\n')}
</urlset>`;

    return xml;
  }

  generateNewsUrlXml(article) {
    const xml = `  <url>
    <loc>${this.escapeXml(`${this.config.baseUrl}${article.url}`)}</loc>
    <news:news>
      <news:publication>
        <news:name>${this.escapeXml(this.config.siteName || 'News Site')}</news:name>
        <news:language>${article.language || 'en'}</news:language>
      </news:publication>
      <news:publication_date>${new Date(article.publishedAt).toISOString()}</news:publication_date>
      <news:title>${this.escapeXml(article.title)}</news:title>
    </news:news>
  </url>`;

    return xml;
  }

  escapeXml(str) {
    if (typeof str !== 'string') return str;
    
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // Sitemap index for large sites
  generateSitemapIndex(sitemaps) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.map(sitemap => this.generateSitemapEntry(sitemap)).join('\n')}
</sitemapindex>`;

    return xml;
  }

  generateSitemapEntry(sitemap) {
    let xml = `  <sitemap>
    <loc>${this.escapeXml(sitemap.loc)}</loc>`;
    
    if (sitemap.lastmod) {
      xml += `\n    <lastmod>${sitemap.lastmod}</lastmod>`;
    }
    
    xml += '\n  </sitemap>';
    return xml;
  }

  // Validation
  validateSitemap(xml) {
    const errors = [];
    const warnings = [];

    // Check for required XML declaration
    if (!xml.startsWith('<?xml')) {
      errors.push('Missing XML declaration');
    }

    // Check for required namespace
    if (!xml.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')) {
      errors.push('Missing required sitemap namespace');
    }

    // Count URLs
    const urlMatches = xml.match(/<url>/g);
    const urlCount = urlMatches ? urlMatches.length : 0;
    
    if (urlCount === 0) {
      warnings.push('Sitemap contains no URLs');
    } else if (urlCount > 50000) {
      errors.push('Sitemap contains more than 50,000 URLs');
    }

    // Check file size (rough estimate)
    const sizeInBytes = new TextEncoder().encode(xml).length;
    const sizeInMB = sizeInBytes / (1024 * 1024);
    
    if (sizeInMB > 50) {
      errors.push('Sitemap exceeds 50MB size limit');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      stats: {
        urlCount,
        sizeInMB: parseFloat(sizeInMB.toFixed(2))
      }
    };
  }
}
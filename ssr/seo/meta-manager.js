export class SEOManager {
  constructor(config = {}) {
    this.config = {
      defaultTitle: 'Eghact App',
      titleTemplate: '%s | Eghact App',
      defaultDescription: 'Built with Eghact Framework',
      defaultLang: 'en',
      siteName: 'Eghact App',
      siteUrl: process.env.SITE_URL || 'https://example.com',
      twitterSite: config.twitterSite,
      facebookAppId: config.facebookAppId,
      ...config
    };
  }

  generateMetaTags(pageData = {}) {
    const meta = {
      ...this.getDefaultMeta(),
      ...pageData.meta
    };

    const tags = [];

    // Basic meta tags
    tags.push(...this.generateBasicMeta(meta));
    
    // Open Graph tags
    tags.push(...this.generateOpenGraphMeta(meta));
    
    // Twitter Card tags
    tags.push(...this.generateTwitterMeta(meta));
    
    // Additional SEO tags
    tags.push(...this.generateSEOMeta(meta));
    
    // Structured data
    if (meta.structuredData) {
      tags.push(this.generateStructuredData(meta.structuredData));
    }

    return tags.join('\n');
  }

  getDefaultMeta() {
    return {
      title: this.config.defaultTitle,
      description: this.config.defaultDescription,
      lang: this.config.defaultLang,
      url: this.config.siteUrl,
      siteName: this.config.siteName,
      type: 'website'
    };
  }

  generateBasicMeta(meta) {
    const tags = [];

    // Title
    const title = this.formatTitle(meta.title);
    tags.push(`<title>${this.escapeHTML(title)}</title>`);

    // Description
    if (meta.description) {
      tags.push(`<meta name="description" content="${this.escapeHTML(meta.description)}">`);
    }

    // Keywords
    if (meta.keywords) {
      const keywords = Array.isArray(meta.keywords) ? meta.keywords.join(', ') : meta.keywords;
      tags.push(`<meta name="keywords" content="${this.escapeHTML(keywords)}">`);
    }

    // Author
    if (meta.author) {
      tags.push(`<meta name="author" content="${this.escapeHTML(meta.author)}">`);
    }

    // Canonical URL
    if (meta.url) {
      tags.push(`<link rel="canonical" href="${this.escapeHTML(meta.url)}">`);
    }

    // Language
    if (meta.lang) {
      tags.push(`<meta name="language" content="${meta.lang}">`);
    }

    // Robots
    const robots = this.generateRobotsContent(meta);
    if (robots) {
      tags.push(`<meta name="robots" content="${robots}">`);
    }

    return tags;
  }

  generateOpenGraphMeta(meta) {
    const tags = [];

    // Basic OG tags
    tags.push(`<meta property="og:title" content="${this.escapeHTML(this.formatTitle(meta.title))}">`);
    tags.push(`<meta property="og:type" content="${meta.type || 'website'}">`);
    
    if (meta.description) {
      tags.push(`<meta property="og:description" content="${this.escapeHTML(meta.description)}">`);
    }

    if (meta.url) {
      tags.push(`<meta property="og:url" content="${this.escapeHTML(meta.url)}">`);
    }

    if (meta.siteName || this.config.siteName) {
      tags.push(`<meta property="og:site_name" content="${this.escapeHTML(meta.siteName || this.config.siteName)}">`);
    }

    // Images
    if (meta.image) {
      tags.push(`<meta property="og:image" content="${this.escapeHTML(meta.image)}">`);
      
      if (meta.imageAlt) {
        tags.push(`<meta property="og:image:alt" content="${this.escapeHTML(meta.imageAlt)}">`);
      }
      
      if (meta.imageWidth) {
        tags.push(`<meta property="og:image:width" content="${meta.imageWidth}">`);
      }
      
      if (meta.imageHeight) {
        tags.push(`<meta property="og:image:height" content="${meta.imageHeight}">`);
      }
    }

    // Locale
    if (meta.locale) {
      tags.push(`<meta property="og:locale" content="${meta.locale}">`);
    }

    // Article-specific tags
    if (meta.type === 'article') {
      if (meta.publishedAt) {
        tags.push(`<meta property="article:published_time" content="${meta.publishedAt}">`);
      }
      
      if (meta.modifiedAt) {
        tags.push(`<meta property="article:modified_time" content="${meta.modifiedAt}">`);
      }
      
      if (meta.author) {
        tags.push(`<meta property="article:author" content="${this.escapeHTML(meta.author)}">`);
      }
      
      if (meta.section) {
        tags.push(`<meta property="article:section" content="${this.escapeHTML(meta.section)}">`);
      }
      
      if (meta.tags && Array.isArray(meta.tags)) {
        meta.tags.forEach(tag => {
          tags.push(`<meta property="article:tag" content="${this.escapeHTML(tag)}">`);
        });
      }
    }

    // Facebook App ID
    if (this.config.facebookAppId) {
      tags.push(`<meta property="fb:app_id" content="${this.config.facebookAppId}">`);
    }

    return tags;
  }

  generateTwitterMeta(meta) {
    const tags = [];

    // Card type
    const cardType = meta.twitterCard || (meta.image ? 'summary_large_image' : 'summary');
    tags.push(`<meta name="twitter:card" content="${cardType}">`);

    // Site
    if (this.config.twitterSite) {
      tags.push(`<meta name="twitter:site" content="${this.config.twitterSite}">`);
    }

    // Creator
    if (meta.twitterCreator) {
      tags.push(`<meta name="twitter:creator" content="${meta.twitterCreator}">`);
    }

    // Title and description
    tags.push(`<meta name="twitter:title" content="${this.escapeHTML(this.formatTitle(meta.title))}">`);
    
    if (meta.description) {
      tags.push(`<meta name="twitter:description" content="${this.escapeHTML(meta.description)}">`);
    }

    // Image
    if (meta.image) {
      tags.push(`<meta name="twitter:image" content="${this.escapeHTML(meta.image)}">`);
      
      if (meta.imageAlt) {
        tags.push(`<meta name="twitter:image:alt" content="${this.escapeHTML(meta.imageAlt)}">`);
      }
    }

    return tags;
  }

  generateSEOMeta(meta) {
    const tags = [];

    // Theme color
    if (meta.themeColor) {
      tags.push(`<meta name="theme-color" content="${meta.themeColor}">`);
    }

    // Manifest
    if (meta.manifest) {
      tags.push(`<link rel="manifest" href="${meta.manifest}">`);
    }

    // Apple-specific
    if (meta.appleTouchIcon) {
      tags.push(`<link rel="apple-touch-icon" href="${meta.appleTouchIcon}">`);
    }

    // Favicon
    if (meta.favicon) {
      tags.push(`<link rel="icon" href="${meta.favicon}">`);
    }

    // Alternate languages
    if (meta.alternates && Array.isArray(meta.alternates)) {
      meta.alternates.forEach(alternate => {
        tags.push(`<link rel="alternate" hreflang="${alternate.lang}" href="${alternate.url}">`);
      });
    }

    // RSS feed
    if (meta.rss) {
      tags.push(`<link rel="alternate" type="application/rss+xml" title="RSS Feed" href="${meta.rss}">`);
    }

    // Preconnect to external domains
    if (meta.preconnect && Array.isArray(meta.preconnect)) {
      meta.preconnect.forEach(domain => {
        tags.push(`<link rel="preconnect" href="${domain}">`);
      });
    }

    return tags;
  }

  generateStructuredData(data) {
    const structuredData = {
      '@context': 'https://schema.org',
      ...data
    };

    return `<script type="application/ld+json">
${JSON.stringify(structuredData, null, 2)}
</script>`;
  }

  generateRobotsContent(meta) {
    const robots = [];

    if (meta.noindex) robots.push('noindex');
    if (meta.nofollow) robots.push('nofollow');
    if (meta.nosnippet) robots.push('nosnippet');
    if (meta.noarchive) robots.push('noarchive');
    if (meta.noimageindex) robots.push('noimageindex');

    // Default to index,follow if nothing specified and not in preview mode
    if (robots.length === 0 && !meta.preview) {
      robots.push('index', 'follow');
    }

    return robots.join(',');
  }

  formatTitle(title) {
    if (!title) return this.config.defaultTitle;
    
    if (title === this.config.defaultTitle) return title;
    
    if (this.config.titleTemplate && this.config.titleTemplate.includes('%s')) {
      return this.config.titleTemplate.replace('%s', title);
    }
    
    return title;
  }

  escapeHTML(str) {
    if (typeof str !== 'string') return str;
    
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Structured data helpers

  generateArticleStructuredData(article) {
    return {
      '@type': 'Article',
      headline: article.title,
      description: article.description || article.excerpt,
      image: article.image,
      author: {
        '@type': 'Person',
        name: article.author
      },
      publisher: {
        '@type': 'Organization',
        name: this.config.siteName,
        logo: {
          '@type': 'ImageObject',
          url: this.config.siteUrl + '/logo.png'
        }
      },
      datePublished: article.publishedAt,
      dateModified: article.modifiedAt || article.publishedAt,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': article.url
      }
    };
  }

  generateBreadcrumbStructuredData(breadcrumbs) {
    return {
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: crumb.url
      }))
    };
  }

  generateOrganizationStructuredData(org) {
    return {
      '@type': 'Organization',
      name: org.name,
      url: org.url,
      logo: org.logo,
      description: org.description,
      contactPoint: org.contactPoint ? {
        '@type': 'ContactPoint',
        telephone: org.contactPoint.telephone,
        contactType: org.contactPoint.type || 'customer service'
      } : undefined,
      sameAs: org.socialLinks
    };
  }

  generateProductStructuredData(product) {
    return {
      '@type': 'Product',
      name: product.name,
      description: product.description,
      image: product.image,
      brand: product.brand ? {
        '@type': 'Brand',
        name: product.brand
      } : undefined,
      offers: product.offers ? {
        '@type': 'Offer',
        price: product.offers.price,
        priceCurrency: product.offers.currency || 'USD',
        availability: `https://schema.org/${product.offers.availability || 'InStock'}`,
        seller: {
          '@type': 'Organization',
          name: this.config.siteName
        }
      } : undefined,
      aggregateRating: product.rating ? {
        '@type': 'AggregateRating',
        ratingValue: product.rating.value,
        reviewCount: product.rating.count
      } : undefined
    };
  }

  // Meta tag extraction for existing pages

  extractMetaFromHTML(html) {
    const meta = {};
    
    // Title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) {
      meta.title = titleMatch[1];
    }

    // Meta tags
    const metaMatches = html.matchAll(/<meta\s+([^>]+)>/gi);
    for (const match of metaMatches) {
      const attrs = this.parseAttributes(match[1]);
      
      if (attrs.name && attrs.content) {
        meta[attrs.name] = attrs.content;
      } else if (attrs.property && attrs.content) {
        meta[attrs.property.replace('og:', '')] = attrs.content;
      }
    }

    return meta;
  }

  parseAttributes(attrString) {
    const attrs = {};
    const matches = attrString.matchAll(/(\w+)=["']([^"']*)["']/g);
    
    for (const match of matches) {
      attrs[match[1]] = match[2];
    }
    
    return attrs;
  }

  // Validation

  validateMeta(meta) {
    const errors = [];
    const warnings = [];

    // Required fields
    if (!meta.title) {
      errors.push('Title is required');
    } else if (meta.title.length > 60) {
      warnings.push('Title should be under 60 characters for optimal display');
    }

    if (!meta.description) {
      warnings.push('Description is recommended for SEO');
    } else if (meta.description.length > 160) {
      warnings.push('Description should be under 160 characters for optimal display');
    }

    // URL validation
    if (meta.url && !this.isValidUrl(meta.url)) {
      errors.push('Invalid URL format');
    }

    // Image validation
    if (meta.image && !this.isValidUrl(meta.image)) {
      errors.push('Invalid image URL format');
    }

    return { errors, warnings, isValid: errors.length === 0 };
  }

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  }
}
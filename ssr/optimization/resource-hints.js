export class ResourceHintGenerator {
  constructor(config = {}) {
    this.config = {
      preloadCriticalAssets: true,
      prefetchNextPages: true,
      preconnectThreshold: 2, // Preconnect if used 2+ times
      dnsPrefetchThreshold: 1, // DNS prefetch if used 1+ times
      modulePreloadThreshold: 0.8, // Preload modules with 80%+ probability
      ...config
    };
    this.domainUsage = new Map();
    this.assetPriorities = new Map();
  }

  generateResourceHints(pageData, options = {}) {
    const config = { ...this.config, ...options };
    const hints = [];

    // Generate preload hints for critical resources
    if (config.preloadCriticalAssets) {
      hints.push(...this.generatePreloadHints(pageData));
    }

    // Generate prefetch hints for likely next resources
    if (config.prefetchNextPages) {
      hints.push(...this.generatePrefetchHints(pageData));
    }

    // Generate preconnect hints for external domains
    hints.push(...this.generatePreconnectHints(pageData, config));

    // Generate DNS prefetch hints
    hints.push(...this.generateDNSPrefetchHints(pageData, config));

    // Generate module preload hints
    hints.push(...this.generateModulePreloadHints(pageData, config));

    return this.deduplicateHints(hints);
  }

  generatePreloadHints(pageData) {
    const hints = [];
    
    // Preload critical CSS
    if (pageData.criticalCSS) {
      hints.push({
        rel: 'preload',
        href: pageData.criticalCSS,
        as: 'style',
        priority: 'high'
      });
    }

    // Preload critical fonts
    if (pageData.criticalFonts) {
      pageData.criticalFonts.forEach(font => {
        hints.push({
          rel: 'preload',
          href: font.url,
          as: 'font',
          type: font.type || 'font/woff2',
          crossorigin: 'anonymous',
          priority: 'high'
        });
      });
    }

    // Preload hero images
    if (pageData.heroImage) {
      hints.push({
        rel: 'preload',
        href: pageData.heroImage.url,
        as: 'image',
        media: pageData.heroImage.media,
        priority: 'high'
      });
    }

    // Preload critical scripts
    if (pageData.criticalScripts) {
      pageData.criticalScripts.forEach(script => {
        hints.push({
          rel: 'preload',
          href: script.url,
          as: 'script',
          crossorigin: script.crossorigin,
          priority: 'high'
        });
      });
    }

    // Preload API data for this page
    if (pageData.apiEndpoints) {
      pageData.apiEndpoints.forEach(endpoint => {
        if (endpoint.critical) {
          hints.push({
            rel: 'preload',
            href: endpoint.url,
            as: 'fetch',
            crossorigin: 'anonymous',
            priority: 'high'
          });
        }
      });
    }

    return hints;
  }

  generatePrefetchHints(pageData) {
    const hints = [];

    // Prefetch likely next pages based on navigation patterns
    if (pageData.likelyNextPages) {
      pageData.likelyNextPages.forEach(page => {
        hints.push({
          rel: 'prefetch',
          href: page.url,
          as: 'document',
          priority: 'low'
        });
      });
    }

    // Prefetch next page assets
    if (pageData.nextPageAssets) {
      pageData.nextPageAssets.forEach(asset => {
        hints.push({
          rel: 'prefetch',
          href: asset.url,
          as: asset.type,
          priority: 'low'
        });
      });
    }

    // Prefetch non-critical images that will likely be viewed
    if (pageData.belowFoldImages) {
      pageData.belowFoldImages.forEach(image => {
        if (image.probability > 0.7) {
          hints.push({
            rel: 'prefetch',
            href: image.url,
            as: 'image',
            priority: 'low'
          });
        }
      });
    }

    // Prefetch route chunks for SPA navigation
    if (pageData.routeChunks) {
      pageData.routeChunks.forEach(chunk => {
        hints.push({
          rel: 'prefetch',
          href: chunk.url,
          as: 'script',
          priority: 'low'
        });
      });
    }

    return hints;
  }

  generatePreconnectHints(pageData, config) {
    const hints = [];
    const domains = this.extractDomains(pageData);

    domains.forEach((usage, domain) => {
      if (usage.count >= config.preconnectThreshold && usage.critical) {
        hints.push({
          rel: 'preconnect',
          href: `https://${domain}`,
          crossorigin: usage.needsCORS ? 'anonymous' : undefined,
          priority: 'high'
        });
      }
    });

    return hints;
  }

  generateDNSPrefetchHints(pageData, config) {
    const hints = [];
    const domains = this.extractDomains(pageData);

    domains.forEach((usage, domain) => {
      if (usage.count >= config.dnsPrefetchThreshold && !usage.critical) {
        hints.push({
          rel: 'dns-prefetch',
          href: `https://${domain}`,
          priority: 'low'
        });
      }
    });

    return hints;
  }

  generateModulePreloadHints(pageData, config) {
    const hints = [];

    if (pageData.esModules) {
      pageData.esModules.forEach(module => {
        if (module.probability >= config.modulePreloadThreshold) {
          hints.push({
            rel: 'modulepreload',
            href: module.url,
            crossorigin: 'anonymous',
            priority: module.critical ? 'high' : 'medium'
          });
        }
      });
    }

    return hints;
  }

  extractDomains(pageData) {
    const domains = new Map();

    // Extract from images
    if (pageData.images) {
      pageData.images.forEach(image => {
        const domain = this.extractDomain(image.url);
        if (domain && !this.isLocalDomain(domain)) {
          this.updateDomainUsage(domains, domain, image.critical, false);
        }
      });
    }

    // Extract from scripts
    if (pageData.scripts) {
      pageData.scripts.forEach(script => {
        const domain = this.extractDomain(script.url);
        if (domain && !this.isLocalDomain(domain)) {
          this.updateDomainUsage(domains, domain, script.critical, true);
        }
      });
    }

    // Extract from stylesheets
    if (pageData.stylesheets) {
      pageData.stylesheets.forEach(stylesheet => {
        const domain = this.extractDomain(stylesheet.url);
        if (domain && !this.isLocalDomain(domain)) {
          this.updateDomainUsage(domains, domain, stylesheet.critical, true);
        }
      });
    }

    // Extract from API endpoints
    if (pageData.apiEndpoints) {
      pageData.apiEndpoints.forEach(endpoint => {
        const domain = this.extractDomain(endpoint.url);
        if (domain && !this.isLocalDomain(domain)) {
          this.updateDomainUsage(domains, domain, endpoint.critical, true);
        }
      });
    }

    return domains;
  }

  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return null;
    }
  }

  isLocalDomain(domain) {
    const localDomains = ['localhost', '127.0.0.1', '0.0.0.0'];
    return localDomains.includes(domain) || domain.startsWith('192.168.') || domain.startsWith('10.');
  }

  updateDomainUsage(domains, domain, critical = false, needsCORS = false) {
    if (!domains.has(domain)) {
      domains.set(domain, { count: 0, critical: false, needsCORS: false });
    }
    
    const usage = domains.get(domain);
    usage.count++;
    if (critical) usage.critical = true;
    if (needsCORS) usage.needsCORS = true;
  }

  deduplicateHints(hints) {
    const seen = new Set();
    return hints.filter(hint => {
      const key = `${hint.rel}:${hint.href}:${hint.as || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  generateHintHTML(hints) {
    return hints.map(hint => {
      let html = `<link rel="${hint.rel}" href="${hint.href}"`;
      
      if (hint.as) html += ` as="${hint.as}"`;
      if (hint.type) html += ` type="${hint.type}"`;
      if (hint.media) html += ` media="${hint.media}"`;
      if (hint.crossorigin) html += ` crossorigin="${hint.crossorigin}"`;
      if (hint.integrity) html += ` integrity="${hint.integrity}"`;
      
      html += '>';
      return html;
    }).join('\n');
  }

  // Analyze navigation patterns to improve prefetch hints
  analyzeNavigationPatterns(analyticsData) {
    const patterns = {
      commonPaths: new Map(),
      exitPages: new Map(),
      conversionFunnels: []
    };

    // Analyze user journeys
    analyticsData.sessions?.forEach(session => {
      for (let i = 0; i < session.pages.length - 1; i++) {
        const currentPage = session.pages[i];
        const nextPage = session.pages[i + 1];
        
        const pathKey = `${currentPage.path} -> ${nextPage.path}`;
        patterns.commonPaths.set(pathKey, (patterns.commonPaths.get(pathKey) || 0) + 1);
      }
    });

    return patterns;
  }

  // Generate smart prefetch based on user behavior
  generateSmartPrefetch(currentPage, navigationPatterns, userContext = {}) {
    const hints = [];
    const confidence = this.calculatePrefetchConfidence(currentPage, navigationPatterns, userContext);

    confidence.forEach((probability, nextPage) => {
      if (probability > 0.3) {
        hints.push({
          rel: 'prefetch',
          href: nextPage,
          as: 'document',
          priority: probability > 0.7 ? 'medium' : 'low',
          confidence: probability
        });
      }
    });

    return hints.sort((a, b) => b.confidence - a.confidence);
  }

  calculatePrefetchConfidence(currentPage, patterns, userContext) {
    const confidence = new Map();
    
    // Base probabilities from navigation patterns
    patterns.commonPaths.forEach((count, path) => {
      const [from, to] = path.split(' -> ');
      if (from === currentPage) {
        const probability = Math.min(count / 100, 0.9); // Cap at 90%
        confidence.set(to, probability);
      }
    });

    // Adjust based on user context
    if (userContext.userType) {
      this.adjustForUserType(confidence, userContext.userType);
    }

    if (userContext.timeOfDay) {
      this.adjustForTimeOfDay(confidence, userContext.timeOfDay);
    }

    return confidence;
  }

  adjustForUserType(confidence, userType) {
    const adjustments = {
      'new_user': { '/getting-started': 1.5, '/pricing': 1.3 },
      'returning_user': { '/dashboard': 1.4, '/account': 1.2 },
      'premium_user': { '/advanced-features': 1.6 }
    };

    const userAdjustments = adjustments[userType] || {};
    Object.entries(userAdjustments).forEach(([page, multiplier]) => {
      if (confidence.has(page)) {
        confidence.set(page, Math.min(confidence.get(page) * multiplier, 0.95));
      }
    });
  }

  adjustForTimeOfDay(confidence, timeOfDay) {
    // Business hours vs off-hours patterns
    const hour = new Date().getHours();
    const isBusinessHours = hour >= 9 && hour <= 17;

    if (isBusinessHours) {
      // Business content more likely during business hours
      if (confidence.has('/contact')) {
        confidence.set('/contact', confidence.get('/contact') * 1.3);
      }
    } else {
      // Entertainment/learning content more likely after hours
      if (confidence.has('/blog')) {
        confidence.set('/blog', confidence.get('/blog') * 1.2);
      }
    }
  }

  // Generate performance budget warnings
  validateResourceHints(hints, budgets = {}) {
    const warnings = [];
    const stats = this.analyzeHints(hints);

    if (budgets.maxPreloadBytes && stats.preloadBytes > budgets.maxPreloadBytes) {
      warnings.push(`Preload budget exceeded: ${stats.preloadBytes} > ${budgets.maxPreloadBytes} bytes`);
    }

    if (budgets.maxPrefetchCount && stats.prefetchCount > budgets.maxPrefetchCount) {
      warnings.push(`Too many prefetch hints: ${stats.prefetchCount} > ${budgets.maxPrefetchCount}`);
    }

    if (budgets.maxDomainConnections && stats.domainCount > budgets.maxDomainConnections) {
      warnings.push(`Too many domain connections: ${stats.domainCount} > ${budgets.maxDomainConnections}`);
    }

    return { warnings, stats };
  }

  analyzeHints(hints) {
    const stats = {
      preloadCount: 0,
      prefetchCount: 0,
      preconnectCount: 0,
      preloadBytes: 0,
      prefetchBytes: 0,
      domainCount: 0,
      domains: new Set()
    };

    hints.forEach(hint => {
      switch (hint.rel) {
        case 'preload':
          stats.preloadCount++;
          if (hint.estimatedSize) stats.preloadBytes += hint.estimatedSize;
          break;
        case 'prefetch':
          stats.prefetchCount++;
          if (hint.estimatedSize) stats.prefetchBytes += hint.estimatedSize;
          break;
        case 'preconnect':
          stats.preconnectCount++;
          break;
      }

      const domain = this.extractDomain(hint.href);
      if (domain) stats.domains.add(domain);
    });

    stats.domainCount = stats.domains.size;
    return stats;
  }
}
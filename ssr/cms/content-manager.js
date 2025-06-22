export class ContentManager {
  constructor(config = {}) {
    this.config = {
      provider: 'contentful',
      cache: true,
      cacheTTL: 300, // 5 minutes
      ...config
    };
    this.adapters = new Map();
    this.cache = new Map();
    this.previewMode = false;
    this.webhookHandlers = new Map();
  }

  registerAdapter(providerName, adapter) {
    this.adapters.set(providerName, adapter);
  }

  getAdapter(providerName = this.config.provider) {
    const adapter = this.adapters.get(providerName);
    if (!adapter) {
      throw new Error(`No adapter registered for provider: ${providerName}`);
    }
    return adapter;
  }

  async fetchContent(query, options = {}) {
    const provider = options.provider || this.config.provider;
    const cacheKey = this.generateCacheKey(provider, query, options);
    
    // Check cache first
    if (this.config.cache && !options.fresh) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const adapter = this.getAdapter(provider);
      const content = await adapter.fetchContent(query, {
        preview: this.previewMode || options.preview,
        ...options
      });

      // Transform content to common format
      const normalizedContent = this.normalizeContent(content, provider);

      // Cache the result
      if (this.config.cache) {
        this.setCache(cacheKey, normalizedContent);
      }

      return normalizedContent;
    } catch (error) {
      console.error(`Content fetch failed for ${provider}:`, error);
      throw new ContentFetchError(`Failed to fetch content: ${error.message}`, error);
    }
  }

  async fetchContentList(contentType, options = {}) {
    const query = {
      contentType,
      limit: options.limit || 50,
      offset: options.offset || 0,
      filters: options.filters || {},
      sort: options.sort || '-createdAt'
    };

    return this.fetchContent(query, options);
  }

  async fetchContentById(id, options = {}) {
    const query = { id };
    const result = await this.fetchContent(query, options);
    return result.items?.[0] || result;
  }

  async fetchContentBySlug(slug, contentType, options = {}) {
    const query = {
      contentType,
      filters: { slug }
    };
    const result = await this.fetchContent(query, options);
    return result.items?.[0] || null;
  }

  async searchContent(searchTerm, options = {}) {
    const query = {
      search: searchTerm,
      contentType: options.contentType,
      limit: options.limit || 20,
      filters: options.filters || {}
    };

    return this.fetchContent(query, options);
  }

  enablePreviewMode(previewToken = null) {
    this.previewMode = true;
    if (previewToken) {
      this.config.previewToken = previewToken;
    }
    console.log('🔍 Preview mode enabled');
  }

  disablePreviewMode() {
    this.previewMode = false;
    delete this.config.previewToken;
    console.log('📄 Preview mode disabled');
  }

  async previewContent(token, query, options = {}) {
    if (!token) {
      throw new Error('Preview token is required');
    }

    const provider = options.provider || this.config.provider;
    const adapter = this.getAdapter(provider);

    if (!adapter.previewContent) {
      throw new Error(`Provider ${provider} does not support content preview`);
    }

    try {
      const content = await adapter.previewContent(token, query, options);
      return this.normalizeContent(content, provider);
    } catch (error) {
      console.error('Preview content fetch failed:', error);
      throw new ContentPreviewError(`Failed to fetch preview content: ${error.message}`, error);
    }
  }

  registerWebhook(provider, eventType, handler) {
    const key = `${provider}:${eventType}`;
    if (!this.webhookHandlers.has(key)) {
      this.webhookHandlers.set(key, []);
    }
    this.webhookHandlers.get(key).push(handler);
  }

  async handleWebhook(provider, eventType, payload) {
    const key = `${provider}:${eventType}`;
    const handlers = this.webhookHandlers.get(key) || [];

    console.log(`📞 Webhook received: ${provider}:${eventType}`);

    // Clear relevant cache entries
    this.invalidateCache(provider, payload);

    // Execute all registered handlers
    const results = await Promise.allSettled(
      handlers.map(handler => handler(payload, { provider, eventType }))
    );

    const errors = results.filter(r => r.status === 'rejected').map(r => r.reason);
    if (errors.length > 0) {
      console.error('Webhook handler errors:', errors);
    }

    return {
      processed: handlers.length,
      errors: errors.length,
      timestamp: new Date().toISOString()
    };
  }

  normalizeContent(content, provider) {
    // Transform provider-specific format to common format
    const normalizer = this.getNormalizer(provider);
    return normalizer ? normalizer(content) : content;
  }

  getNormalizer(provider) {
    const normalizers = {
      contentful: this.normalizeContentfulContent,
      strapi: this.normalizeStrapiContent,
      sanity: this.normalizeSanityContent,
      ghost: this.normalizeGhostContent
    };

    return normalizers[provider];
  }

  normalizeContentfulContent(content) {
    if (content.items) {
      return {
        items: content.items.map(item => ({
          id: item.sys.id,
          contentType: item.sys.contentType.sys.id,
          createdAt: item.sys.createdAt,
          updatedAt: item.sys.updatedAt,
          fields: item.fields,
          meta: {
            provider: 'contentful',
            space: item.sys.space?.sys.id,
            locale: item.sys.locale
          }
        })),
        total: content.total,
        limit: content.limit,
        skip: content.skip
      };
    }

    return {
      id: content.sys.id,
      contentType: content.sys.contentType.sys.id,
      createdAt: content.sys.createdAt,
      updatedAt: content.sys.updatedAt,
      fields: content.fields,
      meta: {
        provider: 'contentful',
        space: content.sys.space?.sys.id,
        locale: content.sys.locale
      }
    };
  }

  normalizeStrapiContent(content) {
    if (Array.isArray(content.data)) {
      return {
        items: content.data.map(item => ({
          id: item.id,
          contentType: item.attributes.__contentType || 'unknown',
          createdAt: item.attributes.createdAt,
          updatedAt: item.attributes.updatedAt,
          fields: item.attributes,
          meta: {
            provider: 'strapi',
            publishedAt: item.attributes.publishedAt
          }
        })),
        total: content.meta?.pagination?.total || content.data.length,
        limit: content.meta?.pagination?.pageSize,
        skip: (content.meta?.pagination?.page - 1) * content.meta?.pagination?.pageSize || 0
      };
    }

    return {
      id: content.data.id,
      contentType: content.data.attributes.__contentType || 'unknown',
      createdAt: content.data.attributes.createdAt,
      updatedAt: content.data.attributes.updatedAt,
      fields: content.data.attributes,
      meta: {
        provider: 'strapi',
        publishedAt: content.data.attributes.publishedAt
      }
    };
  }

  normalizeSanityContent(content) {
    if (Array.isArray(content)) {
      return {
        items: content.map(item => ({
          id: item._id,
          contentType: item._type,
          createdAt: item._createdAt,
          updatedAt: item._updatedAt,
          fields: item,
          meta: {
            provider: 'sanity',
            rev: item._rev
          }
        })),
        total: content.length
      };
    }

    return {
      id: content._id,
      contentType: content._type,
      createdAt: content._createdAt,
      updatedAt: content._updatedAt,
      fields: content,
      meta: {
        provider: 'sanity',
        rev: content._rev
      }
    };
  }

  normalizeGhostContent(content) {
    const items = content.posts || content.pages || [content];
    
    if (Array.isArray(items)) {
      return {
        items: items.map(item => ({
          id: item.id,
          contentType: item.type || 'post',
          createdAt: item.created_at,
          updatedAt: item.updated_at,
          fields: {
            title: item.title,
            slug: item.slug,
            content: item.html || item.mobiledoc,
            excerpt: item.excerpt,
            featured: item.featured,
            status: item.status,
            tags: item.tags,
            authors: item.authors
          },
          meta: {
            provider: 'ghost',
            publishedAt: item.published_at,
            url: item.url
          }
        })),
        total: content.meta?.pagination?.total || items.length,
        limit: content.meta?.pagination?.limit,
        skip: (content.meta?.pagination?.page - 1) * content.meta?.pagination?.limit || 0
      };
    }

    return this.normalizeGhostContent({ posts: [content] }).items[0];
  }

  // Cache management

  generateCacheKey(provider, query, options) {
    const keyData = {
      provider,
      query: typeof query === 'object' ? JSON.stringify(query) : query,
      preview: options.preview || false,
      locale: options.locale
    };
    return btoa(JSON.stringify(keyData)).replace(/[^a-zA-Z0-9]/g, '');
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.config.cacheTTL * 1000) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Cleanup old cache entries periodically
    if (this.cache.size > 1000) {
      this.cleanupCache();
    }
  }

  invalidateCache(provider, payload = {}) {
    const keysToDelete = [];
    
    for (const [key, cached] of this.cache.entries()) {
      try {
        const keyData = JSON.parse(atob(key));
        if (keyData.provider === provider) {
          // More specific invalidation based on content type or ID
          if (payload.contentType && keyData.query.includes(payload.contentType)) {
            keysToDelete.push(key);
          } else if (payload.id && keyData.query.includes(payload.id)) {
            keysToDelete.push(key);
          } else {
            // Invalidate all cache for this provider
            keysToDelete.push(key);
          }
        }
      } catch (error) {
        // Invalid key, delete it
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    console.log(`🗑️  Invalidated ${keysToDelete.length} cache entries`);
  }

  cleanupCache() {
    const now = Date.now();
    const ttlMs = this.config.cacheTTL * 1000;
    
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > ttlMs) {
        this.cache.delete(key);
      }
    }
  }

  clearCache() {
    this.cache.clear();
    console.log('🗑️  Cache cleared');
  }

  // Utility methods

  async batchFetchContent(queries, options = {}) {
    const provider = options.provider || this.config.provider;
    const adapter = this.getAdapter(provider);

    if (adapter.batchFetch) {
      const results = await adapter.batchFetch(queries, options);
      return results.map(result => this.normalizeContent(result, provider));
    }

    // Fallback to individual fetches
    const results = await Promise.allSettled(
      queries.map(query => this.fetchContent(query, options))
    );

    return results.map(result => 
      result.status === 'fulfilled' ? result.value : null
    );
  }

  getCacheStats() {
    const now = Date.now();
    const ttlMs = this.config.cacheTTL * 1000;
    let expired = 0;
    
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > ttlMs) {
        expired++;
      }
    }

    return {
      total: this.cache.size,
      expired,
      active: this.cache.size - expired,
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0
    };
  }
}

// Custom error classes
export class ContentFetchError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'ContentFetchError';
    this.originalError = originalError;
  }
}

export class ContentPreviewError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'ContentPreviewError';
    this.originalError = originalError;
  }
}
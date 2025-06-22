export class StrapiAdapter {
  constructor(config) {
    this.config = {
      apiUrl: config.apiUrl,
      apiToken: config.apiToken,
      version: config.version || 'v4',
      ...config
    };
    
    if (!this.config.apiUrl) {
      throw new Error('Strapi API URL is required');
    }
  }

  async fetchContent(query, options = {}) {
    const url = this.buildUrl(query, options);
    
    try {
      const response = await fetch(url, {
        headers: this.buildHeaders(options)
      });

      if (!response.ok) {
        throw new Error(`Strapi API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Strapi fetch error:', error);
      throw error;
    }
  }

  async previewContent(token, query, options = {}) {
    return this.fetchContent(query, { 
      ...options, 
      preview: true,
      token 
    });
  }

  buildUrl(query, options) {
    const baseUrl = `${this.config.apiUrl}/api`;
    
    if (typeof query === 'string') {
      return `${baseUrl}/${query}`;
    }

    if (query.id) {
      return `${baseUrl}/${query.contentType || 'entries'}/${query.id}${this.buildQueryString(query, options)}`;
    }

    if (query.contentType) {
      return `${baseUrl}/${query.contentType}${this.buildQueryString(query, options)}`;
    }

    throw new Error('Invalid query format for Strapi');
  }

  buildQueryString(query, options) {
    const params = new URLSearchParams();

    // Pagination
    if (query.limit) {
      params.append('pagination[pageSize]', query.limit.toString());
    }
    if (query.offset) {
      const page = Math.floor(query.offset / (query.limit || 25)) + 1;
      params.append('pagination[page]', page.toString());
    }

    // Sorting
    if (query.sort) {
      const sortField = query.sort.startsWith('-') ? query.sort.slice(1) : query.sort;
      const sortOrder = query.sort.startsWith('-') ? 'desc' : 'asc';
      params.append('sort', `${sortField}:${sortOrder}`);
    }

    // Filters
    if (query.filters) {
      Object.entries(query.filters).forEach(([field, value]) => {
        params.append(`filters[${field}][$eq]`, value);
      });
    }

    // Search
    if (query.search) {
      params.append('filters[$or][0][title][$containsi]', query.search);
      params.append('filters[$or][1][content][$containsi]', query.search);
    }

    // Populate relations
    params.append('populate', '*');

    // Locale
    if (options.locale) {
      params.append('locale', options.locale);
    }

    // Publication state for preview
    if (options.preview) {
      params.append('publicationState', 'preview');
    }

    return params.toString() ? `?${params.toString()}` : '';
  }

  buildHeaders(options) {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.config.apiToken) {
      headers['Authorization'] = `Bearer ${this.config.apiToken}`;
    }

    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    return headers;
  }

  validateWebhook(payload, signature, secret) {
    // Strapi webhook validation (if configured)
    if (!secret) return true; // No validation if no secret

    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return signature === expectedSignature;
  }

  parseWebhookPayload(payload) {
    return {
      event: payload.event,
      contentType: payload.model,
      id: payload.entry?.id,
      data: payload.entry
    };
  }
}
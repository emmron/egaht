export class ContentfulAdapter {
  constructor(config) {
    this.config = {
      space: config.space,
      accessToken: config.accessToken,
      previewAccessToken: config.previewAccessToken,
      environment: config.environment || 'master',
      host: config.host || 'cdn.contentful.com',
      previewHost: config.previewHost || 'preview.contentful.com',
      ...config
    };
    
    if (!this.config.space || !this.config.accessToken) {
      throw new Error('Contentful space and accessToken are required');
    }
  }

  async fetchContent(query, options = {}) {
    const isPreview = options.preview && this.config.previewAccessToken;
    const host = isPreview ? this.config.previewHost : this.config.host;
    const token = isPreview ? this.config.previewAccessToken : this.config.accessToken;
    
    const params = this.buildQueryParams(query, options);
    const url = `https://${host}/spaces/${this.config.space}/environments/${this.config.environment}/entries?${params}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Contentful API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this.resolveLinks(data);
    } catch (error) {
      console.error('Contentful fetch error:', error);
      throw error;
    }
  }

  async previewContent(token, query, options = {}) {
    if (!this.config.previewAccessToken) {
      throw new Error('Preview access token not configured');
    }

    return this.fetchContent(query, { ...options, preview: true });
  }

  buildQueryParams(query, options) {
    const params = new URLSearchParams();

    // Handle different query types
    if (typeof query === 'string') {
      params.append('sys.id', query);
    } else if (query.id) {
      params.append('sys.id', query.id);
    } else if (query.contentType) {
      params.append('content_type', query.contentType);
      
      // Add filters
      if (query.filters) {
        Object.entries(query.filters).forEach(([field, value]) => {
          if (field === 'slug') {
            params.append('fields.slug', value);
          } else {
            params.append(`fields.${field}`, value);
          }
        });
      }

      // Add sorting
      if (query.sort) {
        params.append('order', query.sort);
      }

      // Add pagination
      if (query.limit) {
        params.append('limit', query.limit.toString());
      }
      if (query.offset) {
        params.append('skip', query.offset.toString());
      }
    }

    // Search
    if (query.search) {
      params.append('query', query.search);
    }

    // Locale
    if (options.locale) {
      params.append('locale', options.locale);
    }

    // Include linked assets and entries
    params.append('include', '2');

    return params.toString();
  }

  resolveLinks(data) {
    // Create lookup maps for assets and entries
    const assets = new Map();
    const entries = new Map();

    if (data.includes) {
      if (data.includes.Asset) {
        data.includes.Asset.forEach(asset => {
          assets.set(asset.sys.id, asset);
        });
      }
      if (data.includes.Entry) {
        data.includes.Entry.forEach(entry => {
          entries.set(entry.sys.id, entry);
        });
      }
    }

    // Resolve links in main items
    data.items = data.items.map(item => this.resolveItemLinks(item, assets, entries));

    return data;
  }

  resolveItemLinks(item, assets, entries) {
    if (!item.fields) return item;

    const resolvedFields = {};

    Object.entries(item.fields).forEach(([key, value]) => {
      resolvedFields[key] = this.resolveFieldLinks(value, assets, entries);
    });

    return {
      ...item,
      fields: resolvedFields
    };
  }

  resolveFieldLinks(value, assets, entries) {
    if (!value) return value;

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(item => this.resolveFieldLinks(item, assets, entries));
    }

    // Handle link objects
    if (value.sys && value.sys.type === 'Link') {
      if (value.sys.linkType === 'Asset') {
        const asset = assets.get(value.sys.id);
        return asset ? this.processAsset(asset) : null;
      } else if (value.sys.linkType === 'Entry') {
        const entry = entries.get(value.sys.id);
        return entry ? this.resolveItemLinks(entry, assets, entries) : null;
      }
    }

    // Handle rich text
    if (value.nodeType) {
      return this.resolveRichTextLinks(value, assets, entries);
    }

    return value;
  }

  processAsset(asset) {
    if (!asset.fields || !asset.fields.file) return asset;

    return {
      ...asset,
      fields: {
        ...asset.fields,
        file: {
          ...asset.fields.file,
          url: asset.fields.file.url.startsWith('//') 
            ? `https:${asset.fields.file.url}` 
            : asset.fields.file.url
        }
      }
    };
  }

  resolveRichTextLinks(richText, assets, entries) {
    // Recursively resolve links in rich text content
    if (richText.content) {
      richText.content = richText.content.map(node => {
        if (node.data && node.data.target) {
          const target = node.data.target;
          if (target.sys && target.sys.type === 'Link') {
            if (target.sys.linkType === 'Asset') {
              node.data.target = assets.get(target.sys.id);
            } else if (target.sys.linkType === 'Entry') {
              node.data.target = entries.get(target.sys.id);
            }
          }
        }
        
        if (node.content) {
          node = this.resolveRichTextLinks(node, assets, entries);
        }
        
        return node;
      });
    }

    return richText;
  }

  async batchFetch(queries, options = {}) {
    // Contentful doesn't have native batch API, so we'll do parallel requests
    const promises = queries.map(query => this.fetchContent(query, options));
    return Promise.all(promises);
  }

  // Webhook support
  validateWebhook(payload, signature, secret) {
    // Contentful webhook signature validation
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return signature === expectedSignature;
  }

  parseWebhookPayload(payload) {
    return {
      event: payload.sys.type,
      contentType: payload.sys.contentType?.sys.id,
      id: payload.sys.id,
      environment: payload.sys.environment?.sys.id,
      space: payload.sys.space?.sys.id,
      publishedAt: payload.sys.publishedAt,
      data: payload
    };
  }
}
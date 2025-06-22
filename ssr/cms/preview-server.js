import express from 'express';
import { SSRRenderer } from '../renderer/ssr-renderer.js';
import { ContentManager } from './content-manager.js';

export class PreviewServer {
  constructor(config = {}) {
    this.config = {
      port: 3001,
      secret: process.env.PREVIEW_SECRET || 'preview-secret',
      ...config
    };
    
    this.app = express();
    this.renderer = new SSRRenderer(config.runtime, config.compiler);
    this.contentManager = new ContentManager(config.cms);
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // CORS for preview iframe
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      next();
    });

    // Security middleware
    this.app.use((req, res, next) => {
      res.header('X-Frame-Options', 'SAMEORIGIN');
      res.header('X-Content-Type-Options', 'nosniff');
      next();
    });
  }

  setupRoutes() {
    // Preview route with authentication
    this.app.get('/preview', this.handlePreviewRequest.bind(this));
    
    // API route for preview content
    this.app.get('/api/preview/:contentType/:id', this.handlePreviewAPI.bind(this));
    
    // Webhook for real-time updates
    this.app.post('/webhook/content-update', this.handleContentWebhook.bind(this));
    
    // Preview session management
    this.app.post('/api/preview/enable', this.enablePreview.bind(this));
    this.app.post('/api/preview/disable', this.disablePreview.bind(this));
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Catch-all for preview pages
    this.app.get('*', this.handlePreviewPage.bind(this));
  }

  async handlePreviewRequest(req, res) {
    try {
      const { token, slug, contentType } = req.query;
      
      if (!this.validatePreviewToken(token)) {
        return res.status(401).json({ error: 'Invalid preview token' });
      }

      // Enable preview mode
      this.contentManager.enablePreviewMode(token);

      // Fetch preview content
      const content = await this.contentManager.fetchContentBySlug(
        slug, 
        contentType, 
        { preview: true }
      );

      if (!content) {
        return res.status(404).json({ error: 'Content not found' });
      }

      // Render preview page
      const component = this.findComponentForContentType(contentType);
      const renderResult = await this.renderer.renderToHTML(component, {
        content,
        preview: true
      }, {
        url: req.url,
        preview: true,
        meta: {
          title: `Preview: ${content.fields.title || content.fields.name}`,
          robots: 'noindex,nofollow'
        }
      });

      // Add preview banner
      const htmlWithBanner = this.addPreviewBanner(renderResult.html, {
        contentType,
        slug,
        lastModified: content.updatedAt
      });

      res.send(htmlWithBanner);

    } catch (error) {
      console.error('Preview request failed:', error);
      res.status(500).json({ error: 'Preview generation failed' });
    }
  }

  async handlePreviewAPI(req, res) {
    try {
      const { contentType, id } = req.params;
      const { token } = req.query;
      
      if (!this.validatePreviewToken(token)) {
        return res.status(401).json({ error: 'Invalid preview token' });
      }

      const content = await this.contentManager.previewContent(token, { id }, {
        contentType
      });

      res.json({
        content,
        preview: true,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Preview API failed:', error);
      res.status(500).json({ error: 'Failed to fetch preview content' });
    }
  }

  async handleContentWebhook(req, res) {
    try {
      const { provider, event, payload } = req.body;
      
      // Validate webhook signature if configured
      const signature = req.headers['x-webhook-signature'];
      if (this.config.webhookSecret) {
        const isValid = this.validateWebhookSignature(payload, signature);
        if (!isValid) {
          return res.status(401).json({ error: 'Invalid webhook signature' });
        }
      }

      console.log(`📞 Content webhook received: ${provider}:${event}`);

      // Handle the webhook
      await this.contentManager.handleWebhook(provider, event, payload);

      // Broadcast update to connected preview clients
      this.broadcastContentUpdate({
        provider,
        event,
        contentType: payload.contentType,
        id: payload.id,
        timestamp: new Date().toISOString()
      });

      res.json({ 
        success: true, 
        message: 'Webhook processed successfully' 
      });

    } catch (error) {
      console.error('Webhook processing failed:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  async enablePreview(req, res) {
    try {
      const { token, redirectUrl } = req.body;
      
      if (!this.validatePreviewToken(token)) {
        return res.status(401).json({ error: 'Invalid preview token' });
      }

      // Set preview cookie
      res.cookie('preview_mode', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      res.json({
        success: true,
        message: 'Preview mode enabled',
        redirectUrl: redirectUrl || '/'
      });

    } catch (error) {
      console.error('Enable preview failed:', error);
      res.status(500).json({ error: 'Failed to enable preview mode' });
    }
  }

  async disablePreview(req, res) {
    try {
      res.clearCookie('preview_mode');
      
      res.json({
        success: true,
        message: 'Preview mode disabled'
      });

    } catch (error) {
      console.error('Disable preview failed:', error);
      res.status(500).json({ error: 'Failed to disable preview mode' });
    }
  }

  async handlePreviewPage(req, res) {
    try {
      // Check for preview mode
      const previewToken = req.cookies.preview_mode || req.query.preview;
      const isPreview = previewToken && this.validatePreviewToken(previewToken);

      if (isPreview) {
        this.contentManager.enablePreviewMode(previewToken);
      }

      // Try to find matching route and render
      const component = await this.findComponentForRoute(req.path);
      if (!component) {
        return res.status(404).send('Page not found');
      }

      const renderResult = await this.renderer.renderToHTML(component, {}, {
        url: req.url,
        preview: isPreview,
        request: req
      });

      let html = renderResult.html;

      // Add preview banner if in preview mode
      if (isPreview) {
        html = this.addPreviewBanner(html, {
          route: req.path,
          previewMode: true
        });
      }

      res.send(html);

    } catch (error) {
      console.error('Preview page render failed:', error);
      res.status(500).send('Page render failed');
    }
  }

  validatePreviewToken(token) {
    if (!token) return false;
    
    // Simple validation - in production, use proper JWT validation
    return token === this.config.secret || 
           token.startsWith('preview_') || 
           this.isValidJWT(token);
  }

  isValidJWT(token) {
    try {
      // Basic JWT structure validation
      const parts = token.split('.');
      return parts.length === 3;
    } catch {
      return false;
    }
  }

  validateWebhookSignature(payload, signature) {
    if (!this.config.webhookSecret || !signature) return false;
    
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return signature === expectedSignature;
  }

  findComponentForContentType(contentType) {
    // Map content types to components
    const componentMap = {
      'blog-post': '/blog/[slug]',
      'page': '/[slug]',
      'product': '/products/[slug]',
      'article': '/articles/[slug]'
    };

    return componentMap[contentType] || '/[slug]';
  }

  async findComponentForRoute(route) {
    // Find component file for route
    const possiblePaths = [
      `src/routes${route}.egh`,
      `src/routes${route}/index.egh`,
      `src/routes${route}/+page.egh`
    ];

    for (const path of possiblePaths) {
      try {
        if (await this.fileExists(path)) {
          return path;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  async fileExists(path) {
    try {
      await import('fs').then(fs => fs.promises.access(path));
      return true;
    } catch {
      return false;
    }
  }

  addPreviewBanner(html, options = {}) {
    const banner = `
      <div id="preview-banner" style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #ff6b35;
        color: white;
        padding: 10px;
        text-align: center;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        font-weight: 600;
        z-index: 9999;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      ">
        🔍 Preview Mode Active
        ${options.contentType ? `• ${options.contentType}` : ''}
        ${options.lastModified ? `• Updated: ${new Date(options.lastModified).toLocaleString()}` : ''}
        <button onclick="fetch('/api/preview/disable', {method:'POST'}).then(() => location.reload())" 
                style="margin-left: 10px; background: rgba(255,255,255,0.2); border: none; color: white; padding: 5px 10px; border-radius: 3px; cursor: pointer;">
          Exit Preview
        </button>
      </div>
      <script>
        // Adjust body padding to account for banner
        document.body.style.paddingTop = '50px';
        
        // Listen for content updates
        if (typeof EventSource !== 'undefined') {
          const eventSource = new EventSource('/api/preview/updates');
          eventSource.onmessage = function(event) {
            const data = JSON.parse(event.data);
            if (data.type === 'content-update') {
              const banner = document.getElementById('preview-banner');
              banner.style.background = '#28a745';
              banner.innerHTML = '✅ Content Updated - <a href="#" onclick="location.reload()" style="color: white;">Refresh to see changes</a>';
            }
          };
        }
      </script>
    `;

    // Insert banner after <body> tag
    return html.replace('<body>', `<body>${banner}`);
  }

  broadcastContentUpdate(updateData) {
    // In a real implementation, use WebSockets or Server-Sent Events
    console.log('📡 Broadcasting content update:', updateData);
    
    // Store update for polling clients
    this.lastContentUpdate = updateData;
  }

  start() {
    return new Promise((resolve) => {
      const server = this.app.listen(this.config.port, () => {
        console.log(`🔍 Preview server running on port ${this.config.port}`);
        resolve(server);
      });
    });
  }
}
import { Readable } from 'stream';

export class SSRRenderer {
  constructor(runtime, compiler) {
    this.runtime = runtime;
    this.compiler = compiler;
    this.componentCache = new Map();
  }

  async renderToHTML(component, props = {}, context = {}) {
    try {
      const compiledComponent = await this.getCompiledComponent(component);
      const ssrContext = {
        isServer: true,
        url: context.url || '/',
        request: context.request,
        ...context
      };

      const renderResult = await this.executeServerRender(compiledComponent, props, ssrContext);
      
      const hydrationData = await this.extractHydrationData(renderResult);
      const html = this.generateHTMLDocument(renderResult.html, hydrationData, context);
      
      return {
        html,
        hydrationData,
        meta: renderResult.meta || {},
        statusCode: renderResult.statusCode || 200
      };
    } catch (error) {
      console.error('SSR rendering error:', error);
      return this.renderErrorPage(error, context);
    }
  }

  async renderToStream(component, props = {}, context = {}) {
    const stream = new Readable({
      read() {}
    });

    try {
      const compiledComponent = await this.getCompiledComponent(component);
      const ssrContext = {
        isServer: true,
        url: context.url || '/',
        request: context.request,
        stream: true,
        ...context
      };

      // Send HTML document start immediately
      const docStart = this.generateHTMLDocumentStart(context);
      stream.push(docStart);

      // Render above-the-fold content first
      const aboveFoldResult = await this.renderAboveFold(compiledComponent, props, ssrContext);
      stream.push(aboveFoldResult.html);

      // Stream remaining content progressively
      this.streamRemainingContent(compiledComponent, props, ssrContext, stream);

    } catch (error) {
      console.error('SSR streaming error:', error);
      stream.push(this.renderErrorHTML(error));
      stream.push(null);
    }

    return stream;
  }

  async getCompiledComponent(component) {
    const componentPath = typeof component === 'string' ? component : component.path;
    
    if (this.componentCache.has(componentPath)) {
      return this.componentCache.get(componentPath);
    }

    const compiled = await this.compiler.compile(component, { target: 'server' });
    this.componentCache.set(componentPath, compiled);
    return compiled;
  }

  async executeServerRender(compiledComponent, props, context) {
    const renderContext = {
      props,
      context,
      isServer: true,
      hydrationBoundaries: [],
      loadData: this.createServerDataLoader(context)
    };

    // Execute server-side data loading first
    let data = {};
    if (compiledComponent.load) {
      data = await compiledComponent.load({
        params: context.params || {},
        query: context.query || {},
        fetch: context.fetch || global.fetch,
        request: context.request,
        url: context.url
      });
    }

    // Render component with data
    const result = await compiledComponent.render({
      ...renderContext,
      data
    });

    return {
      html: result.html,
      hydrationData: {
        componentData: data,
        hydrationBoundaries: renderContext.hydrationBoundaries,
        initialProps: props
      },
      meta: data.meta || result.meta,
      statusCode: data.statusCode || result.statusCode
    };
  }

  async extractHydrationData(renderResult) {
    const hydrationData = {
      timestamp: Date.now(),
      ...renderResult.hydrationData,
      runtimeConfig: {
        hydrate: true,
        ssr: true
      }
    };

    // Serialize stores for client-side hydration
    try {
      const { serializeStores } = await import('@eghact/store');
      hydrationData.stores = serializeStores();
    } catch (error) {
      console.warn('Store serialization failed:', error);
      hydrationData.stores = {};
    }

    return hydrationData;
  }

  generateHTMLDocument(bodyHTML, hydrationData, context) {
    const meta = context.meta || {};
    const title = meta.title || 'Eghact App';
    const description = meta.description || '';
    
    return `<!DOCTYPE html>
<html lang="${meta.lang || 'en'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${this.escapeHTML(title)}</title>
  <meta name="description" content="${this.escapeHTML(description)}">
  ${this.generateMetaTags(meta)}
  ${this.generateCriticalCSS(context)}
  ${this.generatePreloadHints(context)}
</head>
<body>
  <div id="app">${bodyHTML}</div>
  <script type="application/json" id="__EGHACT_SSR_DATA__">
    ${JSON.stringify(hydrationData)}
  </script>
  ${this.generateRuntimeScripts(context)}
</body>
</html>`;
  }

  generateHTMLDocumentStart(context) {
    const meta = context.meta || {};
    const title = meta.title || 'Eghact App';
    
    return `<!DOCTYPE html>
<html lang="${meta.lang || 'en'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${this.escapeHTML(title)}</title>
  ${this.generateMetaTags(meta)}
  ${this.generateCriticalCSS(context)}
</head>
<body>
  <div id="app">`;
  }

  async renderAboveFold(compiledComponent, props, context) {
    // Render only critical above-the-fold content
    const result = await compiledComponent.renderPartial({
      ...context,
      props,
      aboveFold: true,
      viewport: { width: 1200, height: 800 }
    });

    return {
      html: result.html,
      hydrationData: result.hydrationData
    };
  }

  streamRemainingContent(compiledComponent, props, context, stream) {
    // Async render remaining content and stream chunks
    setImmediate(async () => {
      try {
        const result = await compiledComponent.renderPartial({
          ...context,
          props,
          belowFold: true
        });

        stream.push(result.html);
        
        // Add hydration script at the end
        const hydrationScript = this.generateHydrationScript(result.hydrationData);
        stream.push(hydrationScript);
        stream.push('</div></body></html>');
        stream.push(null);
      } catch (error) {
        console.error('Stream rendering error:', error);
        stream.push('</div></body></html>');
        stream.push(null);
      }
    });
  }

  createServerDataLoader(context) {
    return async (url, options = {}) => {
      // Server-side data loading with proper error handling
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'User-Agent': 'Eghact-SSR/1.0',
            ...options.headers,
            ...context.headers
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (error) {
        console.error('SSR data loading error:', error);
        throw error;
      }
    };
  }

  generateMetaTags(meta) {
    let tags = '';
    
    // Basic meta tags
    Object.entries(meta).forEach(([key, value]) => {
      if (key !== 'title' && key !== 'lang' && typeof value === 'string') {
        tags += `  <meta name="${key}" content="${this.escapeHTML(value)}">\n`;
      }
    });

    // Open Graph tags
    if (meta.ogTitle || meta['og:title']) {
      tags += `  <meta property="og:title" content="${this.escapeHTML(meta.ogTitle || meta['og:title'])}">\n`;
    }
    if (meta.ogDescription || meta['og:description']) {
      tags += `  <meta property="og:description" content="${this.escapeHTML(meta.ogDescription || meta['og:description'])}">\n`;
    }
    if (meta.ogImage || meta['og:image']) {
      tags += `  <meta property="og:image" content="${this.escapeHTML(meta.ogImage || meta['og:image'])}">\n`;
    }

    // Twitter Card tags
    if (meta.twitterCard) {
      tags += `  <meta name="twitter:card" content="${this.escapeHTML(meta.twitterCard)}">\n`;
    }

    return tags;
  }

  generateCriticalCSS(context) {
    // Inline critical CSS for instant first paint
    if (context.criticalCSS) {
      return `  <style data-critical>${context.criticalCSS}</style>\n`;
    }
    return '';
  }

  generatePreloadHints(context) {
    let hints = '';
    
    // Preload critical resources
    if (context.preloadFonts) {
      context.preloadFonts.forEach(font => {
        hints += `  <link rel="preload" href="${font}" as="font" type="font/woff2" crossorigin>\n`;
      });
    }

    if (context.preloadImages) {
      context.preloadImages.forEach(image => {
        hints += `  <link rel="preload" href="${image}" as="image">\n`;
      });
    }

    return hints;
  }

  generateRuntimeScripts(context) {
    let scripts = '';
    
    // Runtime initialization
    scripts += `  <script type="module" src="/runtime/eghact.js"></script>\n`;
    
    // Hydration script
    scripts += `  <script type="module">
    import { hydrate } from '/runtime/eghact.js';
    const ssrData = JSON.parse(document.getElementById('__EGHACT_SSR_DATA__').textContent);
    hydrate(document.getElementById('app'), ssrData);
  </script>\n`;

    return scripts;
  }

  generateHydrationScript(hydrationData) {
    return `
  <script type="application/json" id="__EGHACT_SSR_DATA__">
    ${JSON.stringify(hydrationData)}
  </script>
  <script type="module">
    import { hydrate } from '/runtime/eghact.js';
    const ssrData = JSON.parse(document.getElementById('__EGHACT_SSR_DATA__').textContent);
    hydrate(document.getElementById('app'), ssrData);
  </script>`;
  }

  renderErrorPage(error, context) {
    const statusCode = error.statusCode || 500;
    const message = process.env.NODE_ENV === 'production' 
      ? 'Internal Server Error' 
      : error.message;

    return {
      html: this.generateHTMLDocument(
        `<div class="error-page">
          <h1>Error ${statusCode}</h1>
          <p>${this.escapeHTML(message)}</p>
        </div>`,
        { error: true },
        { ...context, meta: { title: `Error ${statusCode}` } }
      ),
      statusCode,
      hydrationData: { error: true }
    };
  }

  renderErrorHTML(error) {
    return `<div class="error-page">
      <h1>Streaming Error</h1>
      <p>${this.escapeHTML(error.message)}</p>
    </div>`;
  }

  escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  clearCache() {
    this.componentCache.clear();
  }
}
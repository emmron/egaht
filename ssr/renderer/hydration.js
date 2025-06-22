export class HydrationManager {
  constructor(runtime) {
    this.runtime = runtime;
    this.hydrationQueue = [];
    this.hydratedComponents = new Set();
    this.hydrationErrors = new Map();
    this.isHydrating = false;
  }

  async hydrateApp(container = document.getElementById('app')) {
    if (this.isHydrating) {
      console.warn('Hydration already in progress');
      return;
    }

    this.isHydrating = true;
    const startTime = performance.now();

    try {
      // Get SSR data from the page
      const ssrData = this.extractSSRData();
      if (!ssrData) {
        console.warn('No SSR data found, falling back to client-side rendering');
        return await this.fallbackToCSR(container);
      }

      console.log('🔄 Starting hydration process...');

      // Validate SSR integrity
      const isValid = await this.validateSSRIntegrity(container, ssrData);
      if (!isValid) {
        console.warn('SSR integrity check failed, re-rendering');
        return await this.fallbackToCSR(container);
      }

      // Hydrate stores first
      await this.hydrateStores(ssrData);

      // Progressive hydration
      await this.performProgressiveHydration(container, ssrData);

      // Enable client-side routing
      this.enableClientSideRouting(ssrData);

      // Setup error boundaries
      this.setupErrorBoundaries();

      const duration = performance.now() - startTime;
      console.log(`✅ Hydration complete in ${duration.toFixed(2)}ms`);

      // Dispatch hydration complete event
      window.dispatchEvent(new CustomEvent('eghact:hydrated', {
        detail: { duration, ssrData }
      }));

    } catch (error) {
      console.error('❌ Hydration failed:', error);
      this.handleHydrationError(error, container);
    } finally {
      this.isHydrating = false;
    }
  }

  async hydrateComponent(element, componentData = {}) {
    const componentId = element.getAttribute('data-component-id');
    if (!componentId) {
      console.warn('Component missing hydration ID');
      return;
    }

    if (this.hydratedComponents.has(componentId)) {
      return; // Already hydrated
    }

    try {
      console.log(`🔄 Hydrating component: ${componentId}`);

      // Restore component state
      const state = componentData.state || {};
      await this.restoreComponentState(element, state);

      // Attach event listeners
      await this.attachEventListeners(element, componentData.events || []);

      // Enable reactivity
      await this.enableReactivity(element, componentData.reactive || []);

      // Mark as hydrated
      this.hydratedComponents.add(componentId);
      element.setAttribute('data-hydrated', 'true');

      console.log(`✅ Component ${componentId} hydrated successfully`);

    } catch (error) {
      console.error(`❌ Component hydration failed: ${componentId}`, error);
      this.hydrationErrors.set(componentId, error);
      
      // Attempt graceful fallback
      await this.fallbackComponentHydration(element, componentData);
    }
  }

  extractSSRData() {
    const scriptElement = document.getElementById('__EGHACT_SSR_DATA__');
    if (!scriptElement) return null;

    try {
      return JSON.parse(scriptElement.textContent);
    } catch (error) {
      console.error('Failed to parse SSR data:', error);
      return null;
    }
  }

  async validateSSRIntegrity(container, ssrData) {
    // Check if server-rendered content matches expected structure
    const expectedSignature = ssrData.contentSignature;
    if (!expectedSignature) return true; // Skip validation if no signature

    const currentSignature = this.generateContentSignature(container);
    
    if (currentSignature !== expectedSignature) {
      console.warn('SSR content signature mismatch', {
        expected: expectedSignature,
        current: currentSignature
      });
      return false;
    }

    return true;
  }

  generateContentSignature(container) {
    // Generate a simple signature based on DOM structure
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_ELEMENT,
      null,
      false
    );

    let signature = '';
    let node;
    
    while (node = walker.nextNode()) {
      signature += node.tagName + (node.className || '') + (node.id || '');
    }

    return this.simpleHash(signature);
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  async performProgressiveHydration(container, ssrData) {
    // Find all hydration boundaries
    const hydrationBoundaries = container.querySelectorAll('[data-hydration-boundary]');
    
    // Create hydration queue based on priority
    const queue = Array.from(hydrationBoundaries).map(element => ({
      element,
      priority: parseInt(element.getAttribute('data-hydration-priority') || '0'),
      componentId: element.getAttribute('data-component-id')
    }));

    // Sort by priority (higher numbers first)
    queue.sort((a, b) => b.priority - a.priority);

    // Hydrate components in batches to prevent blocking
    const batchSize = 3;
    for (let i = 0; i < queue.length; i += batchSize) {
      const batch = queue.slice(i, i + batchSize);
      
      // Process batch concurrently
      const batchPromises = batch.map(({ element, componentId }) => {
        const componentData = ssrData.components?.[componentId] || {};
        return this.hydrateComponent(element, componentData);
      });

      await Promise.allSettled(batchPromises);

      // Yield to browser to prevent blocking
      if (i + batchSize < queue.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }

  async restoreComponentState(element, state) {
    // Restore reactive state
    Object.entries(state).forEach(([key, value]) => {
      if (element._eghactState) {
        element._eghactState[key] = value;
      }
    });

    // Trigger state restoration event
    element.dispatchEvent(new CustomEvent('eghact:state-restored', {
      detail: { state }
    }));
  }

  async attachEventListeners(element, events) {
    events.forEach(({ selector, event, handler }) => {
      const targets = selector ? element.querySelectorAll(selector) : [element];
      
      targets.forEach(target => {
        if (typeof handler === 'string') {
          // Handler is a function name, look it up in component scope
          const handlerFn = element._eghactHandlers?.[handler];
          if (handlerFn) {
            target.addEventListener(event, handlerFn);
          }
        } else if (typeof handler === 'function') {
          target.addEventListener(event, handler);
        }
      });
    });
  }

  async enableReactivity(element, reactiveProps) {
    // Re-enable reactive properties that were serialized
    reactiveProps.forEach(prop => {
      if (element._eghactReactive && element._eghactReactive[prop]) {
        element._eghactReactive[prop].enable();
      }
    });
  }

  enableClientSideRouting(ssrData) {
    // Enable client-side navigation after hydration
    if (window.history && ssrData.routingEnabled !== false) {
      this.setupClientSideRouting();
    }
  }

  setupClientSideRouting() {
    // Intercept navigation and handle client-side
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a');
      if (!link || link.getAttribute('target') === '_blank') return;

      const href = link.getAttribute('href');
      if (href && href.startsWith('/') && !href.startsWith('//')) {
        event.preventDefault();
        this.navigateToRoute(href);
      }
    });

    // Handle browser back/forward
    window.addEventListener('popstate', (event) => {
      this.navigateToRoute(window.location.pathname, false);
    });
  }

  async navigateToRoute(path, pushState = true) {
    try {
      // Update URL
      if (pushState) {
        window.history.pushState({}, '', path);
      }

      // Load new page content
      const response = await fetch(path, {
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        await this.updatePageContent(data);
      } else {
        // Fallback to full page reload
        window.location.href = path;
      }
    } catch (error) {
      console.error('Client-side navigation failed:', error);
      window.location.href = path;
    }
  }

  async updatePageContent(data) {
    const container = document.getElementById('app');
    
    // Update page content
    container.innerHTML = data.html;
    
    // Update document title and meta
    if (data.meta) {
      this.updatePageMeta(data.meta);
    }

    // Re-hydrate new content
    await this.hydrateApp(container);
  }

  updatePageMeta(meta) {
    if (meta.title) {
      document.title = meta.title;
    }

    // Update meta tags
    Object.entries(meta).forEach(([name, content]) => {
      if (name === 'title') return;
      
      let metaTag = document.querySelector(`meta[name="${name}"]`);
      if (!metaTag) {
        metaTag = document.createElement('meta');
        metaTag.setAttribute('name', name);
        document.head.appendChild(metaTag);
      }
      metaTag.setAttribute('content', content);
    });
  }

  setupErrorBoundaries() {
    // Global error handler for hydration issues
    window.addEventListener('error', (event) => {
      if (event.error && event.error.name === 'HydrationError') {
        this.handleHydrationError(event.error, event.target);
      }
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason && event.reason.name === 'HydrationError') {
        this.handleHydrationError(event.reason);
      }
    });
  }

  async fallbackToCSR(container) {
    console.warn('Falling back to client-side rendering');
    
    // Clear server-rendered content
    container.innerHTML = '<div id="csr-loading">Loading...</div>';
    
    // Perform client-side render
    try {
      await this.runtime.render(container);
      console.log('✅ Client-side rendering complete');
    } catch (error) {
      console.error('❌ Client-side rendering failed:', error);
      container.innerHTML = '<div id="error">Application failed to load</div>';
    }
  }

  async fallbackComponentHydration(element, componentData) {
    // Attempt to re-render component client-side
    try {
      const componentId = element.getAttribute('data-component-id');
      console.log(`🔄 Attempting fallback for component: ${componentId}`);
      
      // Clear element and re-render
      const originalHTML = element.innerHTML;
      element.innerHTML = '<div class="component-loading">Loading...</div>';
      
      await this.runtime.renderComponent(element, componentData);
      
      console.log(`✅ Fallback hydration successful: ${componentId}`);
      this.hydratedComponents.add(componentId);
      
    } catch (fallbackError) {
      console.error('Fallback hydration also failed:', fallbackError);
      element.innerHTML = '<div class="component-error">Component failed to load</div>';
    }
  }

  handleHydrationError(error, element = null) {
    console.error('Hydration error detected:', error);
    
    // Track error for debugging
    this.hydrationErrors.set(Date.now(), {
      error: error.message,
      stack: error.stack,
      element: element?.tagName,
      timestamp: new Date().toISOString()
    });

    // Dispatch error event for monitoring
    window.dispatchEvent(new CustomEvent('eghact:hydration-error', {
      detail: { error, element }
    }));

    // In development, show detailed error
    if (process.env.NODE_ENV === 'development') {
      this.showHydrationErrorOverlay(error, element);
    }
  }

  showHydrationErrorOverlay(error, element) {
    // Create error overlay for development
    const overlay = document.createElement('div');
    overlay.id = 'eghact-hydration-error';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      font-family: monospace;
      padding: 20px;
      z-index: 9999;
      overflow: auto;
    `;
    
    overlay.innerHTML = `
      <h2>🚨 Hydration Error</h2>
      <p><strong>Error:</strong> ${error.message}</p>
      <p><strong>Element:</strong> ${element?.tagName || 'Unknown'}</p>
      <pre>${error.stack}</pre>
      <button onclick="this.parentElement.remove()">Close</button>
    `;

    document.body.appendChild(overlay);
  }

  // Public API methods

  isComponentHydrated(componentId) {
    return this.hydratedComponents.has(componentId);
  }

  getHydrationErrors() {
    return Array.from(this.hydrationErrors.entries()).map(([id, error]) => ({
      id,
      ...error
    }));
  }

  clearHydrationErrors() {
    this.hydrationErrors.clear();
  }

  // Selective hydration - hydrate only specific components
  async hydrateSelective(selectors) {
    const elements = document.querySelectorAll(selectors);
    const ssrData = this.extractSSRData();
    
    for (const element of elements) {
      const componentId = element.getAttribute('data-component-id');
      if (componentId && !this.hydratedComponents.has(componentId)) {
        const componentData = ssrData?.components?.[componentId] || {};
        await this.hydrateComponent(element, componentData);
      }
    }
  }

  // Lazy hydration - hydrate when component comes into view
  enableLazyHydration() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(async (entry) => {
        if (entry.isIntersecting) {
          const element = entry.target;
          const componentId = element.getAttribute('data-component-id');
          
          if (componentId && !this.hydratedComponents.has(componentId)) {
            const ssrData = this.extractSSRData();
            const componentData = ssrData?.components?.[componentId] || {};
            await this.hydrateComponent(element, componentData);
            observer.unobserve(element);
          }
        }
      });
    });

    // Observe all lazy hydration candidates
    document.querySelectorAll('[data-lazy-hydration]').forEach(element => {
      observer.observe(element);
    });
  }

  async hydrateStores(ssrData) {
    try {
      // Import store hydration utilities
      const { hydrateStores } = await import('@eghact/store');
      
      if (ssrData.stores) {
        console.log('🏪 Hydrating stores...', ssrData.stores);
        hydrateStores(ssrData.stores);
        console.log('✅ Store hydration complete');
      }
    } catch (error) {
      console.error('❌ Store hydration failed:', error);
      // Continue without stores if hydration fails
    }
  }
}

// Auto-initialize hydration when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.eghactHydrationManager = new HydrationManager();
    });
  } else {
    window.eghactHydrationManager = new HydrationManager();
  }
}
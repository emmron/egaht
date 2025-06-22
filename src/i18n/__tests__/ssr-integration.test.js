/**
 * SSR Integration Tests for Eghact I18n System
 */

import { 
  createI18nContext, 
  serializeI18nState, 
  hydrateI18nState,
  createStaticLoader 
} from '../index.js';

describe('I18n SSR Integration Tests', () => {
  const testMessages = {
    en: {
      common: { hello: 'Hello' },
      nav: { home: 'Home' }
    },
    es: {
      common: { hello: 'Hola' },
      nav: { home: 'Inicio' }
    }
  };

  test('should serialize i18n state for SSR', async () => {
    const loader = createStaticLoader(testMessages);
    const context = createI18nContext({
      defaultLocale: 'en',
      supportedLocales: ['en', 'es']
    }, loader);

    // Load English locale
    await context.changeLocale('en');
    
    // Serialize state
    const serialized = serializeI18nState();
    const state = JSON.parse(serialized);

    expect(state.currentLocale).toBe('en');
    expect(state.loadedLocales.en).toBeDefined();
    expect(state.loadedLocales.en.messages.common.hello).toBe('Hello');
  });

  test('should hydrate i18n state on client', async () => {
    const loader = createStaticLoader(testMessages);
    
    // Create server-side context
    const serverContext = createI18nContext({
      defaultLocale: 'en',
      supportedLocales: ['en', 'es']
    }, loader);

    await serverContext.changeLocale('es');
    const serializedState = serializeI18nState();

    // Create client-side context (fresh)
    const clientContext = createI18nContext({
      defaultLocale: 'en',
      supportedLocales: ['en', 'es']
    }, loader);

    // Before hydration - should be default
    expect(clientContext.state.currentLocale).toBe('en');

    // Hydrate from server state
    hydrateI18nState(serializedState);

    // After hydration - should match server
    expect(clientContext.state.currentLocale).toBe('es');
    expect(clientContext.t('common.hello')).toBe('Hola');
  });

  test('should handle partial hydration gracefully', async () => {
    const loader = createStaticLoader(testMessages);
    const context = createI18nContext({
      defaultLocale: 'en',
      supportedLocales: ['en', 'es']
    }, loader);

    // Simulate partial/corrupted state
    const partialState = JSON.stringify({
      currentLocale: 'es',
      loadedLocales: {
        es: {
          locale: 'es',
          messages: { common: { hello: 'Hola' } },
          loadedAt: Date.now()
        }
      }
      // Missing config
    });

    // Should not throw error
    expect(() => {
      hydrateI18nState(partialState);
    }).not.toThrow();

    // Should still work with available data
    expect(context.state.currentLocale).toBe('es');
  });

  test('should preserve server-rendered content during hydration', async () => {
    const loader = createStaticLoader(testMessages);
    
    // Server-side rendering scenario
    const serverContext = createI18nContext({
      defaultLocale: 'en',
      supportedLocales: ['en', 'es']
    }, loader);

    await serverContext.changeLocale('es');
    
    // Server renders: "Hola"
    const serverRendered = serverContext.t('common.hello');
    expect(serverRendered).toBe('Hola');

    // Client hydration
    const clientContext = createI18nContext({
      defaultLocale: 'en',  // Different default
      supportedLocales: ['en', 'es']
    }, loader);

    // Before hydration - client default
    expect(clientContext.state.currentLocale).toBe('en');

    // Hydrate with server state
    const serverState = JSON.stringify({
      currentLocale: 'es',
      loadedLocales: {
        es: {
          locale: 'es',
          messages: testMessages.es,
          loadedAt: Date.now()
        }
      },
      config: {
        defaultLocale: 'en',
        supportedLocales: ['en', 'es']
      }
    });

    hydrateI18nState(serverState);

    // After hydration should match server
    const clientRendered = clientContext.t('common.hello');
    expect(clientRendered).toBe('Hola');
    expect(clientRendered).toBe(serverRendered);
  });

  test('should handle SSR with multiple locales loaded', async () => {
    const loader = createStaticLoader(testMessages);
    const context = createI18nContext({
      defaultLocale: 'en',
      supportedLocales: ['en', 'es']
    }, loader);

    // Load both locales on server
    await context.changeLocale('en');
    await context.changeLocale('es');

    const serialized = serializeI18nState();
    const state = JSON.parse(serialized);

    // Both locales should be serialized
    expect(state.loadedLocales.en).toBeDefined();
    expect(state.loadedLocales.es).toBeDefined();
    expect(state.currentLocale).toBe('es');

    // Create new context and hydrate
    const newContext = createI18nContext({
      defaultLocale: 'en',
      supportedLocales: ['en', 'es']
    }, loader);

    hydrateI18nState(serialized);

    expect(newContext.state.currentLocale).toBe('es');
    expect(newContext.t('common.hello')).toBe('Hola');
  });

  test('should handle locale detection from request headers', () => {
    // Mock browser environment
    const mockNavigator = {
      language: 'es-ES',
      languages: ['es-ES', 'es', 'en-US', 'en']
    };

    // Utility function to detect locale from browser
    const detectLocale = (supportedLocales, fallback = 'en') => {
      if (typeof navigator === 'undefined') return fallback;
      
      const languages = navigator.languages || [navigator.language];
      
      for (const lang of languages) {
        // Try exact match first
        if (supportedLocales.includes(lang)) {
          return lang;
        }
        
        // Try language without region
        const langCode = lang.split('-')[0];
        if (supportedLocales.includes(langCode)) {
          return langCode;
        }
      }
      
      return fallback;
    };

    // Mock navigator globally
    const originalNavigator = globalThis.navigator;
    globalThis.navigator = mockNavigator;

    try {
      const detected = detectLocale(['en', 'es', 'fr'], 'en');
      expect(detected).toBe('es');
    } finally {
      globalThis.navigator = originalNavigator;
    }
  });

  test('should maintain locale consistency during page transitions', async () => {
    const loader = createStaticLoader(testMessages);
    
    // Page 1: Set Spanish
    const page1Context = createI18nContext({
      defaultLocale: 'en',
      supportedLocales: ['en', 'es']
    }, loader);

    await page1Context.changeLocale('es');
    const page1Serialized = serializeI18nState();

    // Page 2: Should inherit Spanish
    const page2Context = createI18nContext({
      defaultLocale: 'en',
      supportedLocales: ['en', 'es']
    }, loader);

    hydrateI18nState(page1Serialized);
    
    expect(page2Context.state.currentLocale).toBe('es');
    expect(page2Context.t('common.hello')).toBe('Hola');
  });
});
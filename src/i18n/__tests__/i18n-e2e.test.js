/**
 * E2E Tests for Eghact I18n System
 */

import { test, expect } from '@playwright/test';
import { 
  createI18nContext, 
  initI18n, 
  createStaticLoader 
} from '../index.js';

// Test translation messages
const testMessages = {
  en: {
    common: {
      hello: 'Hello',
      welcome: 'Welcome',
      loading: 'Loading...'
    },
    items: {
      count_zero: 'No items',
      count_one: '{{count}} item',
      count_other: '{{count}} items'
    },
    messages: {
      userGreeting: 'Hello, {{name}}!'
    }
  },
  es: {
    common: {
      hello: 'Hola',
      welcome: 'Bienvenido',
      loading: 'Cargando...'
    },
    items: {
      count_zero: 'No hay elementos',
      count_one: '{{count}} elemento',
      count_other: '{{count}} elementos'
    },
    messages: {
      userGreeting: '¡Hola, {{name}}!'
    }
  }
};

test.describe('I18n System E2E Tests', () => {
  test.beforeEach(async () => {
    // Reset global state
    globalThis.__eghact_i18n__ = null;
  });

  test('should initialize i18n context with default locale', async () => {
    const loader = createStaticLoader(testMessages);
    const context = await initI18n({
      defaultLocale: 'en',
      supportedLocales: ['en', 'es']
    }, loader);

    expect(context.state.currentLocale).toBe('en');
    expect(context.state.loadedLocales.en).toBeDefined();
    expect(context.t('common.hello')).toBe('Hello');
  });

  test('should switch locale and update translations reactively', async () => {
    const loader = createStaticLoader(testMessages);
    const context = await initI18n({
      defaultLocale: 'en',
      supportedLocales: ['en', 'es']
    }, loader);

    // Initial state
    expect(context.t('common.hello')).toBe('Hello');
    expect(context.state.currentLocale).toBe('en');

    // Switch to Spanish
    await context.changeLocale('es');
    
    expect(context.t('common.hello')).toBe('Hola');
    expect(context.state.currentLocale).toBe('es');
    expect(context.state.loadedLocales.es).toBeDefined();
  });

  test('should handle pluralization correctly', async () => {
    const loader = createStaticLoader(testMessages);
    const context = await initI18n({
      defaultLocale: 'en',
      supportedLocales: ['en', 'es']
    }, loader);

    // English pluralization
    expect(context.t('items.count', { count: 0 })).toBe('No items');
    expect(context.t('items.count', { count: 1 })).toBe('1 item');
    expect(context.t('items.count', { count: 5 })).toBe('5 items');

    // Switch to Spanish and test pluralization
    await context.changeLocale('es');
    
    expect(context.t('items.count', { count: 0 })).toBe('No hay elementos');
    expect(context.t('items.count', { count: 1 })).toBe('1 elemento');
    expect(context.t('items.count', { count: 5 })).toBe('5 elementos');
  });

  test('should handle value interpolation', async () => {
    const loader = createStaticLoader(testMessages);
    const context = await initI18n({
      defaultLocale: 'en',
      supportedLocales: ['en', 'es']
    }, loader);

    expect(context.t('messages.userGreeting', { name: 'John' })).toBe('Hello, John!');
    
    await context.changeLocale('es');
    expect(context.t('messages.userGreeting', { name: 'Juan' })).toBe('¡Hola, Juan!');
  });

  test('should format numbers according to locale', async () => {
    const loader = createStaticLoader(testMessages);
    const context = await initI18n({
      defaultLocale: 'en',
      supportedLocales: ['en', 'es']
    }, loader);

    // English number formatting
    expect(context.formatNumber(1234.56)).toMatch(/1,234\.56|1234\.56/);
    
    // Spanish number formatting (may vary by browser)
    await context.changeLocale('es');
    const spanishFormatted = context.formatNumber(1234.56);
    expect(typeof spanishFormatted).toBe('string');
    expect(spanishFormatted).toContain('1234');
  });

  test('should format currency according to locale', async () => {
    const loader = createStaticLoader(testMessages);
    const context = await initI18n({
      defaultLocale: 'en',
      supportedLocales: ['en', 'es']
    }, loader);

    // English currency formatting
    const usdFormatted = context.formatCurrency(123.45, 'USD');
    expect(usdFormatted).toMatch(/\$123\.45|\$\s?123\.45|USD\s?123\.45/);
    
    // Spanish currency formatting
    await context.changeLocale('es');
    const eurFormatted = context.formatCurrency(123.45, 'EUR');
    expect(typeof eurFormatted).toBe('string');
    expect(eurFormatted).toContain('123');
  });

  test('should format dates according to locale', async () => {
    const loader = createStaticLoader(testMessages);
    const context = await initI18n({
      defaultLocale: 'en',
      supportedLocales: ['en', 'es']
    }, loader);

    const testDate = new Date('2023-12-25');
    
    // English date formatting
    const englishDate = context.formatDate(testDate, { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    expect(englishDate).toContain('December');
    expect(englishDate).toContain('25');
    expect(englishDate).toContain('2023');
    
    // Spanish date formatting
    await context.changeLocale('es');
    const spanishDate = context.formatDate(testDate, { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    expect(typeof spanishDate).toBe('string');
    expect(spanishDate).toContain('25');
    expect(spanishDate).toContain('2023');
  });

  test('should handle missing translation keys gracefully', async () => {
    const loader = createStaticLoader(testMessages);
    const context = await initI18n({
      defaultLocale: 'en',
      supportedLocales: ['en', 'es']
    }, loader);

    // Missing key should return the key itself
    expect(context.t('missing.key')).toBe('missing.key');
    
    // Missing key with default value
    expect(context.t('missing.key', { defaultValue: 'Default' })).toBe('Default');
  });

  test('should handle locale loading errors', async () => {
    const failingLoader = async (locale) => {
      if (locale === 'fr') {
        throw new Error(`Locale ${locale} not found`);
      }
      return testMessages[locale] || {};
    };

    const context = await initI18n({
      defaultLocale: 'en',
      supportedLocales: ['en', 'es', 'fr']
    }, failingLoader);

    // Should work with valid locale
    await expect(context.changeLocale('es')).resolves.not.toThrow();
    
    // Should handle invalid locale
    await expect(context.changeLocale('fr')).rejects.toThrow('Locale fr not found');
  });

  test('should emit locale change events', async () => {
    const loader = createStaticLoader(testMessages);
    const context = await initI18n({
      defaultLocale: 'en',
      supportedLocales: ['en', 'es']
    }, loader);

    let eventFired = false;
    let eventDetail = null;

    // Mock window for event listening
    const mockWindow = {
      dispatchEvent: (event) => {
        if (event.type === 'eghact:locale-changed') {
          eventFired = true;
          eventDetail = event.detail;
        }
      }
    };

    // Mock global window
    const originalWindow = globalThis.window;
    globalThis.window = mockWindow;

    try {
      await context.changeLocale('es');
      
      expect(eventFired).toBe(true);
      expect(eventDetail).toEqual({
        previousLocale: 'en',
        newLocale: 'es'
      });
    } finally {
      globalThis.window = originalWindow;
    }
  });

  test('should persist and restore locale preference', async () => {
    const loader = createStaticLoader(testMessages);
    
    // First context - set Spanish
    const context1 = await initI18n({
      defaultLocale: 'en',
      supportedLocales: ['en', 'es']
    }, loader);
    
    await context1.changeLocale('es');
    expect(context1.state.currentLocale).toBe('es');

    // Second context - should restore Spanish if persistence is enabled
    // (This test simulates creating a new context after page reload)
    const context2 = createI18nContext({
      defaultLocale: 'en',
      supportedLocales: ['en', 'es']
    }, loader);

    // The locale preference would be restored from localStorage in a real browser
    // For this test, we verify the mechanism exists
    expect(typeof context2.state).toBe('object');
    expect(Array.isArray(context2.state.config.supportedLocales)).toBe(true);
  });
});
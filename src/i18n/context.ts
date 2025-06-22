/**
 * Eghact I18n Context Provider - Core i18n context system
 */

import { createI18nStore, createCurrentLocaleStore, createI18nActions } from './store.js';
import { createTranslator } from './translator.js';
import { createFormatter } from './formatter.js';
import { createLoader } from './loader.js';
import type { I18nConfig, I18nContext, I18nLoader, TranslationOptions } from './types.js';

/**
 * Global i18n context instance
 */
let globalI18nContext: I18nContext | null = null;

/**
 * Create and configure the i18n context
 */
export function createI18nContext(config: Partial<I18nConfig> = {}, loader?: I18nLoader): I18nContext {
  // Create stores
  const i18nStore = createI18nStore(config);
  const currentLocaleStore = createCurrentLocaleStore(i18nStore);
  const actions = createI18nActions(i18nStore);
  
  // Create utilities
  const localeLoader = loader || createLoader();
  const translator = createTranslator(currentLocaleStore);
  const formatter = createFormatter(currentLocaleStore);

  // Translation function
  const t = (key: string, options: TranslationOptions = {}) => {
    return translator.translate(key, options);
  };

  // Locale change handler
  const changeLocale = async (locale: string): Promise<void> => {
    const currentState = i18nStore.value;
    
    // Validate locale is supported
    if (!currentState.config.supportedLocales.includes(locale)) {
      throw new Error(`Locale "${locale}" is not supported. Supported locales: ${currentState.config.supportedLocales.join(', ')}`);
    }

    // If already current locale, do nothing
    if (currentState.currentLocale === locale) {
      return;
    }

    // Check if locale data is already loaded
    if (!currentState.loadedLocales[locale]) {
      actions.setLoading(true);
      actions.setError(null);

      try {
        const messages = await localeLoader(locale);
        actions.addLocaleData(locale, messages);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load locale';
        actions.setError(`Failed to load locale "${locale}": ${errorMessage}`);
        actions.setLoading(false);
        throw error;
      }
    }

    // Set the new locale
    actions.setCurrentLocale(locale);
    actions.setLoading(false);
    
    // Notify about locale change for reactive updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('eghact:locale-changed', {
        detail: { 
          previousLocale: currentState.currentLocale,
          newLocale: locale 
        }
      }));
    }
  };

  const context: I18nContext = {
    state: i18nStore.value,
    t,
    changeLocale,
    formatNumber: formatter.formatNumber.bind(formatter),
    formatCurrency: formatter.formatCurrency.bind(formatter),
    formatDate: formatter.formatDate.bind(formatter),
    formatRelativeTime: formatter.formatRelativeTime.bind(formatter)
  };

  // Store global reference
  globalI18nContext = context;

  // Auto-load default locale if not already loaded
  const defaultLocale = i18nStore.value.config.defaultLocale;
  if (!i18nStore.value.loadedLocales[defaultLocale]) {
    changeLocale(defaultLocale).catch(error => {
      console.error('Failed to load default locale:', error);
    });
  }

  return context;
}

/**
 * Get the global i18n context (must be created first)
 */
export function getI18nContext(): I18nContext {
  if (!globalI18nContext) {
    throw new Error('I18n context not initialized. Call createI18nContext() first.');
  }
  return globalI18nContext;
}

/**
 * Hook for reactive i18n usage in components
 */
export function useI18n(): I18nContext {
  return getI18nContext();
}

/**
 * Initialize i18n system with default configuration
 */
export function initI18n(config: Partial<I18nConfig> = {}, loader?: I18nLoader): Promise<I18nContext> {
  const context = createI18nContext(config, loader);
  
  // Return promise that resolves when default locale is loaded
  return new Promise((resolve, reject) => {
    const currentState = context.state;
    const defaultLocale = currentState.config.defaultLocale;
    
    if (currentState.loadedLocales[defaultLocale]) {
      resolve(context);
      return;
    }

    // Wait for default locale to load
    const checkLoaded = () => {
      const state = context.state;
      if (state.loadedLocales[defaultLocale]) {
        resolve(context);
      } else if (state.error) {
        reject(new Error(state.error));
      } else {
        setTimeout(checkLoaded, 10);
      }
    };
    
    checkLoaded();
  });
}

/**
 * Server-side rendering support
 */
export function serializeI18nState(): string {
  if (!globalI18nContext) {
    return '{}';
  }
  
  return JSON.stringify({
    currentLocale: globalI18nContext.state.currentLocale,
    loadedLocales: globalI18nContext.state.loadedLocales,
    config: globalI18nContext.state.config
  });
}

/**
 * Hydrate i18n state on client from SSR
 */
export function hydrateI18nState(serializedState: string): void {
  if (!globalI18nContext) {
    throw new Error('I18n context not initialized. Call createI18nContext() first.');
  }

  try {
    const state = JSON.parse(serializedState);
    const actions = createI18nActions(globalI18nContext.state as any);
    
    // Restore locale data
    for (const [locale, data] of Object.entries(state.loadedLocales)) {
      actions.addLocaleData(locale, (data as any).messages);
    }
    
    // Set current locale
    actions.setCurrentLocale(state.currentLocale);
    
    // Update config if provided
    if (state.config) {
      actions.updateConfig(state.config);
    }
  } catch (error) {
    console.error('Failed to hydrate i18n state:', error);
  }
}
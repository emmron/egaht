/**
 * Eghact I18n Store - Reactive internationalization state management
 */

import { createStore, derived } from '../../store/src/index.js';
import type { I18nState, I18nConfig, LocaleData, TranslationMessages } from './types.js';

const DEFAULT_CONFIG: I18nConfig = {
  defaultLocale: 'en',
  supportedLocales: ['en'],
  fallbackLocale: 'en',
  interpolation: {
    prefix: '{{',
    suffix: '}}'
  },
  pluralization: {
    suffixes: {
      zero: '_zero',
      one: '_one',
      two: '_two',
      few: '_few',
      many: '_many',
      other: '_other'
    }
  }
};

/**
 * Create the main i18n store
 */
export function createI18nStore(config: Partial<I18nConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  const initialState: I18nState = {
    currentLocale: finalConfig.defaultLocale,
    loadedLocales: {},
    config: finalConfig,
    isLoading: false,
    error: null
  };

  const store = createStore(initialState, {
    name: 'i18n',
    persist: true,
    middleware: [
      // Validation middleware to ensure locale is supported
      (nextValue: I18nState, prevValue: I18nState) => {
        if (!finalConfig.supportedLocales.includes(nextValue.currentLocale)) {
          console.warn(
            `Locale "${nextValue.currentLocale}" not supported. Falling back to "${finalConfig.fallbackLocale}"`
          );
          return {
            ...nextValue,
            currentLocale: finalConfig.fallbackLocale || finalConfig.defaultLocale
          };
        }
        return nextValue;
      }
    ]
  });

  return store;
}

/**
 * Derived store for current locale data
 */
export function createCurrentLocaleStore(i18nStore: ReturnType<typeof createI18nStore>) {
  return derived([i18nStore], (state: I18nState) => {
    const currentData = state.loadedLocales[state.currentLocale];
    const fallbackData = state.loadedLocales[state.config.fallbackLocale || state.config.defaultLocale];
    
    return {
      locale: state.currentLocale,
      messages: currentData?.messages || {},
      fallbackMessages: fallbackData?.messages || {},
      isLoaded: !!currentData,
      isLoading: state.isLoading
    };
  });
}

/**
 * Actions for i18n store
 */
export function createI18nActions(store: ReturnType<typeof createI18nStore>) {
  return {
    setLoading: (isLoading: boolean) => {
      store.update(state => ({ ...state, isLoading }));
    },

    setError: (error: string | null) => {
      store.update(state => ({ ...state, error }));
    },

    addLocaleData: (locale: string, messages: TranslationMessages) => {
      store.update(state => ({
        ...state,
        loadedLocales: {
          ...state.loadedLocales,
          [locale]: {
            locale,
            messages,
            loadedAt: Date.now()
          }
        }
      }));
    },

    setCurrentLocale: (locale: string) => {
      store.update(state => ({ ...state, currentLocale: locale }));
    },

    updateConfig: (configUpdate: Partial<I18nConfig>) => {
      store.update(state => ({
        ...state,
        config: { ...state.config, ...configUpdate }
      }));
    },

    reset: () => {
      store.update(state => ({
        ...state,
        currentLocale: state.config.defaultLocale,
        loadedLocales: {},
        isLoading: false,
        error: null
      }));
    }
  };
}
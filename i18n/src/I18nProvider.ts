import { createContext, writable, derived } from '@eghact/core';

export interface I18nConfig {
  defaultLocale: string;
  fallbackLocale?: string;
  supportedLocales: string[];
  loadPath: string; // e.g., '/locales/{{lng}}.json'
  interpolation?: {
    prefix?: string;
    suffix?: string;
  };
}

export interface Translation {
  [key: string]: string | Translation;
}

export interface I18nContext {
  locale: string;
  t: (key: string, params?: Record<string, any>) => string;
  changeLocale: (newLocale: string) => Promise<void>;
  isLoading: boolean;
  availableLocales: string[];
}

class I18nProvider {
  private config: I18nConfig;
  private translations = new Map<string, Translation>();
  private loadingPromises = new Map<string, Promise<Translation>>();
  
  // Reactive stores
  private _locale = writable<string>('');
  private _translations = writable<Map<string, Translation>>(new Map());
  private _isLoading = writable<boolean>(false);
  
  // Derived stores
  public locale = derived(this._locale, ($locale) => $locale);
  public isLoading = derived(this._isLoading, ($loading) => $loading);
  
  constructor(config: I18nConfig) {
    this.config = config;
    this._locale.set(config.defaultLocale);
    
    // Initialize with default locale
    this.loadTranslations(config.defaultLocale);
  }
  
  /**
   * Translation function with interpolation and pluralization
   */
  public t = (key: string, params?: Record<string, any>): string => {
    const currentLocale = this._locale.get();
    const currentTranslations = this.translations.get(currentLocale);
    
    if (!currentTranslations) {
      // Fallback to fallback locale if available
      const fallbackTranslations = this.config.fallbackLocale 
        ? this.translations.get(this.config.fallbackLocale)
        : null;
        
      if (fallbackTranslations) {
        return this.interpolate(this.getNestedValue(fallbackTranslations, key) || key, params);
      }
      
      return key; // Return key if no translation found
    }
    
    const value = this.getNestedValue(currentTranslations, key);
    
    if (!value) {
      // Try fallback locale
      const fallbackTranslations = this.config.fallbackLocale 
        ? this.translations.get(this.config.fallbackLocale)
        : null;
        
      if (fallbackTranslations) {
        const fallbackValue = this.getNestedValue(fallbackTranslations, key);
        if (fallbackValue) {
          return this.interpolate(fallbackValue, params);
        }
      }
      
      return key;
    }
    
    // Handle pluralization
    if (typeof value === 'object' && params?.count !== undefined) {
      return this.handlePluralization(value, params.count, params);
    }
    
    if (typeof value !== 'string') {
      return key;
    }
    
    return this.interpolate(value, params);
  };
  
  /**
   * Change current locale and load translations
   */
  public async changeLocale(newLocale: string): Promise<void> {
    if (!this.config.supportedLocales.includes(newLocale)) {
      throw new Error(`Unsupported locale: ${newLocale}`);
    }
    
    this._isLoading.set(true);
    
    try {
      await this.loadTranslations(newLocale);
      this._locale.set(newLocale);
    } finally {
      this._isLoading.set(false);
    }
  }
  
  /**
   * Preload translations for a locale
   */
  public async preloadLocale(locale: string): Promise<void> {
    if (!this.config.supportedLocales.includes(locale)) {
      throw new Error(`Unsupported locale: ${locale}`);
    }
    
    await this.loadTranslations(locale);
  }
  
  /**
   * Get current context for components
   */
  public getContext(): I18nContext {
    return {
      locale: this._locale.get(),
      t: this.t,
      changeLocale: this.changeLocale.bind(this),
      isLoading: this._isLoading.get(),
      availableLocales: this.config.supportedLocales
    };
  }
  
  /**
   * Load translations for a specific locale
   */
  private async loadTranslations(locale: string): Promise<Translation> {
    // Check if already loaded
    if (this.translations.has(locale)) {
      return this.translations.get(locale)!;
    }
    
    // Check if already loading
    if (this.loadingPromises.has(locale)) {
      return this.loadingPromises.get(locale)!;
    }
    
    // Start loading
    const loadingPromise = this.fetchTranslations(locale);
    this.loadingPromises.set(locale, loadingPromise);
    
    try {
      const translations = await loadingPromise;
      this.translations.set(locale, translations);
      this._translations.update(map => {
        map.set(locale, translations);
        return map;
      });
      
      return translations;
    } finally {
      this.loadingPromises.delete(locale);
    }
  }
  
  /**
   * Fetch translations from server
   */
  private async fetchTranslations(locale: string): Promise<Translation> {
    const url = this.config.loadPath.replace('{{lng}}', locale);
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to load translations for ${locale}: ${response.statusText}`);
      }
      
      const translations = await response.json();
      return translations;
    } catch (error) {
      console.error(`Failed to load translations for locale ${locale}:`, error);
      
      // Return empty translations to prevent blocking
      return {};
    }
  }
  
  /**
   * Get nested value from translation object using dot notation
   */
  private getNestedValue(obj: Translation, path: string): string | Translation | undefined {
    return path.split('.').reduce((current: any, key: string) => {
      return current?.[key];
    }, obj);
  }
  
  /**
   * Handle pluralization rules
   */
  private handlePluralization(
    pluralObject: Translation, 
    count: number, 
    params?: Record<string, any>
  ): string {
    let key: string;
    
    // Simple English pluralization rules
    if (count === 0 && pluralObject['zero']) {
      key = 'zero';
    } else if (count === 1 && pluralObject['one']) {
      key = 'one';
    } else if (pluralObject['other']) {
      key = 'other';
    } else {
      // Fallback to first available key
      key = Object.keys(pluralObject)[0];
    }
    
    const value = pluralObject[key];
    
    if (typeof value === 'string') {
      return this.interpolate(value, { ...params, count });
    }
    
    return String(count); // Fallback
  }
  
  /**
   * Interpolate parameters into translation string
   */
  private interpolate(template: string, params?: Record<string, any>): string {
    if (!params) return template;
    
    const prefix = this.config.interpolation?.prefix || '{{';
    const suffix = this.config.interpolation?.suffix || '}}';
    
    return template.replace(
      new RegExp(`${this.escapeRegExp(prefix)}([^}]+)${this.escapeRegExp(suffix)}`, 'g'),
      (match, key) => {
        const trimmedKey = key.trim();
        const value = params[trimmedKey];
        
        if (value === undefined || value === null) {
          return match; // Keep placeholder if no value
        }
        
        return String(value);
      }
    );
  }
  
  /**
   * Escape string for use in regex
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// Context for Eghact components
export const I18nContext = createContext<I18nContext>('i18n');

// Global provider instance
let globalProvider: I18nProvider | null = null;

/**
 * Initialize i18n system
 */
export function initI18n(config: I18nConfig): I18nProvider {
  globalProvider = new I18nProvider(config);
  return globalProvider;
}

/**
 * Get current i18n provider instance
 */
export function getI18nProvider(): I18nProvider | null {
  return globalProvider;
}

/**
 * Hook for components to access i18n context
 */
export function useI18n(): I18nContext {
  const context = I18nContext.get();
  
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider component');
  }
  
  return context;
}

export default I18nProvider;
/**
 * Eghact I18n Loader - Dynamic locale file loading system
 */

import type { TranslationMessages, I18nLoader } from './types.js';

/**
 * Default locale file loader
 * Supports both JSON files and dynamic imports
 */
export function createLoader(): I18nLoader {
  return async (locale: string): Promise<TranslationMessages> => {
    const baseUrl = getBaseUrl();
    
    // Try different loading strategies
    const strategies = [
      () => loadFromJson(baseUrl, locale),
      () => loadFromModule(baseUrl, locale),
      () => loadFromCDN(locale)
    ];

    let lastError: Error | null = null;

    for (const strategy of strategies) {
      try {
        const messages = await strategy();
        if (messages && typeof messages === 'object') {
          return messages;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Failed to load locale ${locale}:`, error);
      }
    }

    throw lastError || new Error(`Failed to load locale: ${locale}`);
  };
}

/**
 * Load from JSON file
 */
async function loadFromJson(baseUrl: string, locale: string): Promise<TranslationMessages> {
  const url = `${baseUrl}/locales/${locale}.json`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Load from ES module
 */
async function loadFromModule(baseUrl: string, locale: string): Promise<TranslationMessages> {
  const url = `${baseUrl}/locales/${locale}.js`;
  const module = await import(url);
  
  return module.default || module;
}

/**
 * Load from CDN (fallback)
 */
async function loadFromCDN(locale: string): Promise<TranslationMessages> {
  // This would be configured based on your CDN setup
  const cdnUrl = getCDNUrl();
  if (!cdnUrl) {
    throw new Error('No CDN configured');
  }
  
  const url = `${cdnUrl}/locales/${locale}.json`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`CDN load failed: HTTP ${response.status}`);
  }
  
  return await response.json();
}

/**
 * Create a custom loader with specific paths or URLs
 */
export function createCustomLoader(config: {
  baseUrl?: string;
  localesPath?: string;
  fileExtension?: 'json' | 'js';
  fallbackUrl?: string;
}): I18nLoader {
  const {
    baseUrl = getBaseUrl(),
    localesPath = '/locales',
    fileExtension = 'json',
    fallbackUrl
  } = config;

  return async (locale: string): Promise<TranslationMessages> => {
    const url = `${baseUrl}${localesPath}/${locale}.${fileExtension}`;
    
    try {
      if (fileExtension === 'js') {
        const module = await import(url);
        return module.default || module;
      } else {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
      }
    } catch (error) {
      // Try fallback URL if configured
      if (fallbackUrl) {
        const fallbackFullUrl = `${fallbackUrl}/${locale}.${fileExtension}`;
        const response = await fetch(fallbackFullUrl);
        if (response.ok) {
          return await response.json();
        }
      }
      
      throw error;
    }
  };
}

/**
 * Create a static loader from pre-loaded messages
 */
export function createStaticLoader(messages: Record<string, TranslationMessages>): I18nLoader {
  return async (locale: string): Promise<TranslationMessages> => {
    const localeMessages = messages[locale];
    if (!localeMessages) {
      throw new Error(`Locale "${locale}" not found in static messages`);
    }
    return localeMessages;
  };
}

/**
 * Utility functions
 */
function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // Server-side: try to get from environment or use default
  const baseUrl = process?.env?.EGHACT_BASE_URL || process?.env?.PUBLIC_URL;
  return baseUrl || '';
}

function getCDNUrl(): string | null {
  return process?.env?.EGHACT_I18N_CDN || null;
}

/**
 * Preload locale data for better performance
 */
export async function preloadLocales(locales: string[], loader: I18nLoader): Promise<Record<string, TranslationMessages>> {
  const results: Record<string, TranslationMessages> = {};
  
  const promises = locales.map(async (locale) => {
    try {
      const messages = await loader(locale);
      results[locale] = messages;
    } catch (error) {
      console.warn(`Failed to preload locale ${locale}:`, error);
    }
  });
  
  await Promise.all(promises);
  return results;
}
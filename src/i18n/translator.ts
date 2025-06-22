/**
 * Eghact I18n Translator - Translation functions with pluralization support
 */

import type { TranslationMessages, TranslationOptions } from './types.js';

/**
 * Create translator instance
 */
export function createTranslator(currentLocaleStore: any) {
  return {
    translate: (key: string, options: TranslationOptions = {}): string => {
      const localeData = currentLocaleStore.value;
      const { count, values = {}, defaultValue } = options;

      // Get the translation from current locale or fallback
      let translation = getNestedValue(localeData.messages, key) || 
                       getNestedValue(localeData.fallbackMessages, key) ||
                       defaultValue ||
                       key;

      // Handle pluralization
      if (typeof count === 'number') {
        translation = applyPluralization(translation, count, key, localeData);
      }

      // Handle interpolation
      if (typeof translation === 'string' && Object.keys(values).length > 0) {
        translation = interpolate(translation, values);
      }

      return String(translation);
    }
  };
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: TranslationMessages, path: string): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  
  const keys = path.split('.');
  let current: any = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  
  return typeof current === 'string' ? current : undefined;
}

/**
 * Apply pluralization rules
 */
function applyPluralization(
  translation: string, 
  count: number, 
  key: string, 
  localeData: any
): string {
  // If translation is already a string, look for pluralized versions
  if (typeof translation === 'string') {
    const pluralKey = getPluralKey(count, localeData.locale);
    const pluralizedKey = `${key}${pluralKey}`;
    
    const pluralTranslation = getNestedValue(localeData.messages, pluralizedKey) ||
                             getNestedValue(localeData.fallbackMessages, pluralizedKey);
    
    if (pluralTranslation) {
      return pluralTranslation;
    }
  }
  
  return translation;
}

/**
 * Get plural suffix based on locale rules
 */
function getPluralKey(count: number, locale: string): string {
  // Use Intl.PluralRules if available
  if (typeof Intl !== 'undefined' && Intl.PluralRules) {
    try {
      const pluralRules = new Intl.PluralRules(locale);
      const rule = pluralRules.select(count);
      return `_${rule}`;
    } catch (error) {
      console.warn('Failed to use Intl.PluralRules:', error);
    }
  }
  
  // Fallback to simple English rules
  return count === 1 ? '_one' : '_other';
}

/**
 * Interpolate values into translation string
 */
function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = values[key];
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Create translation function with bound context
 */
export function createBoundTranslator(
  messages: TranslationMessages,
  fallbackMessages: TranslationMessages = {},
  locale: string = 'en'
) {
  return (key: string, options: TranslationOptions = {}): string => {
    const { count, values = {}, defaultValue } = options;

    // Get the translation
    let translation = getNestedValue(messages, key) || 
                     getNestedValue(fallbackMessages, key) ||
                     defaultValue ||
                     key;

    // Handle pluralization
    if (typeof count === 'number') {
      const pluralKey = getPluralKey(count, locale);
      const pluralizedKey = `${key}${pluralKey}`;
      
      const pluralTranslation = getNestedValue(messages, pluralizedKey) ||
                               getNestedValue(fallbackMessages, pluralizedKey);
      
      if (pluralTranslation) {
        translation = pluralTranslation;
      }
    }

    // Handle interpolation
    if (typeof translation === 'string' && Object.keys(values).length > 0) {
      translation = interpolate(translation, values);
    }

    return String(translation);
  };
}

/**
 * Utilities for working with translation keys
 */
export const translationUtils = {
  /**
   * Check if a key exists in messages
   */
  hasKey: (messages: TranslationMessages, key: string): boolean => {
    return getNestedValue(messages, key) !== undefined;
  },

  /**
   * Get all keys from messages (flattened)
   */
  getAllKeys: (messages: TranslationMessages, prefix = ''): string[] => {
    const keys: string[] = [];
    
    for (const [key, value] of Object.entries(messages)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'string') {
        keys.push(fullKey);
      } else if (typeof value === 'object' && value !== null) {
        keys.push(...translationUtils.getAllKeys(value, fullKey));
      }
    }
    
    return keys;
  },

  /**
   * Find missing keys between two message sets
   */
  findMissingKeys: (
    sourceMessages: TranslationMessages,
    targetMessages: TranslationMessages
  ): string[] => {
    const sourceKeys = new Set(translationUtils.getAllKeys(sourceMessages));
    const targetKeys = new Set(translationUtils.getAllKeys(targetMessages));
    
    return Array.from(sourceKeys).filter(key => !targetKeys.has(key));
  },

  /**
   * Validate message interpolation
   */
  validateInterpolation: (template: string): string[] => {
    const matches = template.match(/\{\{(\w+)\}\}/g);
    return matches ? matches.map(match => match.slice(2, -2)) : [];
  }
};
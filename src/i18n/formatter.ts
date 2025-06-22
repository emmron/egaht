/**
 * Eghact I18n Formatter - Intl-based date/number/currency formatters
 */

import type { FormatOptions, DateFormatOptions } from './types.js';

/**
 * Create formatter instance
 */
export function createFormatter(currentLocaleStore: any) {
  return {
    formatNumber: (value: number, options: FormatOptions = {}): string => {
      const locale = options.locale || currentLocaleStore.value.locale;
      
      try {
        const formatOptions: Intl.NumberFormatOptions = {
          style: options.style || 'decimal',
          minimumFractionDigits: options.minimumFractionDigits,
          maximumFractionDigits: options.maximumFractionDigits
        };

        if (options.currency && options.style === 'currency') {
          formatOptions.currency = options.currency;
        }

        return new Intl.NumberFormat(locale, formatOptions).format(value);
      } catch (error) {
        console.warn('Number formatting failed:', error);
        return String(value);
      }
    },

    formatCurrency: (value: number, currency: string, options: FormatOptions = {}): string => {
      const locale = options.locale || currentLocaleStore.value.locale;
      
      try {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
          minimumFractionDigits: options.minimumFractionDigits,
          maximumFractionDigits: options.maximumFractionDigits
        }).format(value);
      } catch (error) {
        console.warn('Currency formatting failed:', error);
        return `${currency} ${value}`;
      }
    },

    formatDate: (date: Date | string | number, options: DateFormatOptions = {}): string => {
      const locale = options.locale || currentLocaleStore.value.locale;
      const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
      
      try {
        const formatOptions: Intl.DateTimeFormatOptions = { ...options };
        delete formatOptions.locale; // Remove our custom locale option
        
        return new Intl.DateTimeFormat(locale, formatOptions).format(dateObj);
      } catch (error) {
        console.warn('Date formatting failed:', error);
        return dateObj.toString();
      }
    },

    formatRelativeTime: (
      value: number, 
      unit: Intl.RelativeTimeFormatUnit, 
      options: { locale?: string } = {}
    ): string => {
      const locale = options.locale || currentLocaleStore.value.locale;
      
      try {
        return new Intl.RelativeTimeFormat(locale, {
          numeric: 'auto'
        }).format(value, unit);
      } catch (error) {
        console.warn('Relative time formatting failed:', error);
        return `${value} ${unit}${Math.abs(value) !== 1 ? 's' : ''} ${value < 0 ? 'ago' : 'from now'}`;
      }
    }
  };
}

/**
 * Standalone formatters that don't require store
 */
export const formatters = {
  /**
   * Format number with specific locale
   */
  number: (value: number, locale: string, options: Intl.NumberFormatOptions = {}): string => {
    try {
      return new Intl.NumberFormat(locale, options).format(value);
    } catch (error) {
      console.warn('Number formatting failed:', error);
      return String(value);
    }
  },

  /**
   * Format currency with specific locale
   */
  currency: (value: number, locale: string, currency: string, options: Intl.NumberFormatOptions = {}): string => {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        ...options
      }).format(value);
    } catch (error) {
      console.warn('Currency formatting failed:', error);
      return `${currency} ${value}`;
    }
  },

  /**
   * Format date with specific locale
   */
  date: (date: Date | string | number, locale: string, options: Intl.DateTimeFormatOptions = {}): string => {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    
    try {
      return new Intl.DateTimeFormat(locale, options).format(dateObj);
    } catch (error) {
      console.warn('Date formatting failed:', error);
      return dateObj.toString();
    }
  },

  /**
   * Format relative time with specific locale
   */
  relativeTime: (
    value: number, 
    unit: Intl.RelativeTimeFormatUnit, 
    locale: string, 
    options: Intl.RelativeTimeFormatOptions = {}
  ): string => {
    try {
      return new Intl.RelativeTimeFormat(locale, {
        numeric: 'auto',
        ...options
      }).format(value, unit);
    } catch (error) {
      console.warn('Relative time formatting failed:', error);
      return `${value} ${unit}${Math.abs(value) !== 1 ? 's' : ''} ${value < 0 ? 'ago' : 'from now'}`;
    }
  },

  /**
   * Format percentage
   */
  percent: (value: number, locale: string, options: Intl.NumberFormatOptions = {}): string => {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'percent',
        ...options
      }).format(value);
    } catch (error) {
      console.warn('Percentage formatting failed:', error);
      return `${(value * 100).toFixed(2)}%`;
    }
  },

  /**
   * Format list with specific locale
   */
  list: (items: string[], locale: string, options: Intl.ListFormatOptions = {}): string => {
    try {
      if (typeof Intl.ListFormat !== 'undefined') {
        return new Intl.ListFormat(locale, options).format(items);
      }
    } catch (error) {
      console.warn('List formatting failed:', error);
    }
    
    // Fallback for browsers without Intl.ListFormat
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    
    const lastItem = items[items.length - 1];
    const otherItems = items.slice(0, -1);
    return `${otherItems.join(', ')}, and ${lastItem}`;
  }
};

/**
 * Utility functions for formatting
 */
export const formatUtils = {
  /**
   * Get supported locales for specific Intl API
   */
  getSupportedLocales: (intlApi: 'NumberFormat' | 'DateTimeFormat' | 'RelativeTimeFormat' | 'ListFormat'): string[] => {
    try {
      const IntlConstructor = Intl[intlApi] as any;
      if (IntlConstructor && typeof IntlConstructor.supportedLocalesOf === 'function') {
        return IntlConstructor.supportedLocalesOf(['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh']);
      }
    } catch (error) {
      console.warn(`Failed to get supported locales for ${intlApi}:`, error);
    }
    return ['en'];
  },

  /**
   * Check if locale is supported by Intl API
   */
  isLocaleSupported: (locale: string, intlApi = 'NumberFormat'): boolean => {
    try {
      const IntlConstructor = Intl[intlApi as keyof typeof Intl] as any;
      if (IntlConstructor && typeof IntlConstructor.supportedLocalesOf === 'function') {
        return IntlConstructor.supportedLocalesOf([locale]).length > 0;
      }
    } catch (error) {
      console.warn(`Failed to check locale support for ${intlApi}:`, error);
    }
    return false;
  },

  /**
   * Get default formatting options for locale
   */
  getDefaultOptions: (locale: string): {
    number: Intl.NumberFormatOptions;
    currency: Intl.NumberFormatOptions;
    date: Intl.DateTimeFormatOptions;
  } => {
    return {
      number: {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3
      },
      currency: {
        style: 'currency',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      },
      date: {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }
    };
  }
};
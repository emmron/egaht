/**
 * Internationalization formatters using the Intl API
 */

import { useI18n } from './I18nProvider';

export interface NumberFormatOptions extends Intl.NumberFormatOptions {
  locale?: string;
}

export interface DateFormatOptions extends Intl.DateTimeFormatOptions {
  locale?: string;
}

export interface CurrencyFormatOptions extends Intl.NumberFormatOptions {
  locale?: string;
  currency: string;
}

/**
 * Format a number according to the current locale
 */
export function formatNumber(value: number, options: NumberFormatOptions = {}): string {
  const { locale: optionLocale, ...formatOptions } = options;
  
  // Get current locale from context if not provided
  let locale = optionLocale;
  if (!locale) {
    try {
      const i18n = useI18n();
      locale = i18n.locale;
    } catch {
      locale = 'en'; // Fallback
    }
  }
  
  return new Intl.NumberFormat(locale, formatOptions).format(value);
}

/**
 * Format a date according to the current locale
 */
export function formatDate(date: Date | string | number, options: DateFormatOptions = {}): string {
  const { locale: optionLocale, ...formatOptions } = options;
  
  // Get current locale from context if not provided
  let locale = optionLocale;
  if (!locale) {
    try {
      const i18n = useI18n();
      locale = i18n.locale;
    } catch {
      locale = 'en'; // Fallback
    }
  }
  
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat(locale, formatOptions).format(dateObj);
}

/**
 * Format currency according to the current locale
 */
export function formatCurrency(
  value: number, 
  options: CurrencyFormatOptions
): string {
  const { locale: optionLocale, currency, ...formatOptions } = options;
  
  // Get current locale from context if not provided
  let locale = optionLocale;
  if (!locale) {
    try {
      const i18n = useI18n();
      locale = i18n.locale;
    } catch {
      locale = 'en'; // Fallback
    }
  }
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    ...formatOptions
  }).format(value);
}

/**
 * Format a relative time (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  options: { locale?: string; numeric?: 'always' | 'auto'; style?: 'long' | 'short' | 'narrow' } = {}
): string {
  const { locale: optionLocale, ...formatOptions } = options;
  
  // Get current locale from context if not provided
  let locale = optionLocale;
  if (!locale) {
    try {
      const i18n = useI18n();
      locale = i18n.locale;
    } catch {
      locale = 'en'; // Fallback
    }
  }
  
  return new Intl.RelativeTimeFormat(locale, formatOptions).format(value, unit);
}

/**
 * Format a list of items according to locale conventions
 */
export function formatList(
  items: string[],
  options: { locale?: string; style?: 'long' | 'short' | 'narrow'; type?: 'conjunction' | 'disjunction' | 'unit' } = {}
): string {
  const { locale: optionLocale, ...formatOptions } = options;
  
  // Get current locale from context if not provided
  let locale = optionLocale;
  if (!locale) {
    try {
      const i18n = useI18n();
      locale = i18n.locale;
    } catch {
      locale = 'en'; // Fallback
    }
  }
  
  return new Intl.ListFormat(locale, formatOptions).format(items);
}

/**
 * Utility to get the current locale from context
 */
export function getCurrentLocale(): string {
  try {
    const i18n = useI18n();
    return i18n.locale;
  } catch {
    return 'en'; // Fallback if not in i18n context
  }
}

/**
 * Check if a locale is supported by the browser
 */
export function isLocaleSupported(locale: string): boolean {
  try {
    new Intl.NumberFormat(locale);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the user's preferred locale from browser
 */
export function getBrowserLocale(): string {
  if (typeof navigator === 'undefined') {
    return 'en'; // Server-side fallback
  }
  
  return navigator.language || 'en';
}

/**
 * Get all user's preferred locales from browser
 */
export function getBrowserLocales(): readonly string[] {
  if (typeof navigator === 'undefined') {
    return ['en']; // Server-side fallback
  }
  
  return navigator.languages || [navigator.language || 'en'];
}
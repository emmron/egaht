/**
 * Eghact I18n System - TypeScript Definitions
 */

export interface I18nConfig {
  defaultLocale: string;
  supportedLocales: string[];
  fallbackLocale?: string;
  interpolation?: {
    prefix?: string;
    suffix?: string;
  };
  pluralization?: {
    suffixes?: Record<string, string>;
  };
}

export interface TranslationMessages {
  [key: string]: string | TranslationMessages;
}

export interface LocaleData {
  locale: string;
  messages: TranslationMessages;
  loadedAt: number;
}

export interface I18nState {
  currentLocale: string;
  loadedLocales: Record<string, LocaleData>;
  config: I18nConfig;
  isLoading: boolean;
  error: string | null;
}

export interface TranslationOptions {
  count?: number;
  values?: Record<string, string | number>;
  defaultValue?: string;
}

export interface FormatOptions {
  locale?: string;
  style?: 'decimal' | 'currency' | 'percent';
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export interface DateFormatOptions extends Intl.DateTimeFormatOptions {
  locale?: string;
}

export interface I18nContext {
  state: I18nState;
  t: (key: string, options?: TranslationOptions) => string;
  changeLocale: (locale: string) => Promise<void>;
  formatNumber: (value: number, options?: FormatOptions) => string;
  formatCurrency: (value: number, currency: string, options?: FormatOptions) => string;
  formatDate: (date: Date | string | number, options?: DateFormatOptions) => string;
  formatRelativeTime: (value: number, unit: Intl.RelativeTimeFormatUnit, options?: { locale?: string }) => string;
}

export type I18nLoader = (locale: string) => Promise<TranslationMessages>;
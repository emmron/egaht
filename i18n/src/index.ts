// Main exports for Eghact i18n system
export {
  I18nProvider,
  I18nContext,
  initI18n,
  getI18nProvider,
  useI18n,
  type I18nConfig,
  type I18nContext as I18nContextType,
  type Translation
} from './I18nProvider';

export { default as I18nComponent } from './I18nComponent.egh';

// Utility functions
export { formatNumber, formatDate, formatCurrency } from './formatters';

// Default configurations
export const DEFAULT_CONFIG: Partial<I18nConfig> = {
  fallbackLocale: 'en',
  loadPath: '/locales/{{lng}}.json',
  interpolation: {
    prefix: '{{',
    suffix: '}}'
  }
};
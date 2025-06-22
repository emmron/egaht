/**
 * Eghact I18n System - Main exports
 */

// Types
export type {
  I18nConfig,
  I18nContext,
  I18nState,
  TranslationMessages,
  TranslationOptions,
  FormatOptions,
  DateFormatOptions,
  LocaleData,
  I18nLoader
} from './types.js';

// Context and hooks
export {
  createI18nContext,
  getI18nContext,
  useI18n,
  initI18n,
  serializeI18nState,
  hydrateI18nState
} from './context.js';

// Store system
export {
  createI18nStore,
  createCurrentLocaleStore,
  createI18nActions
} from './store.js';

// Translation system
export {
  createTranslator,
  createBoundTranslator,
  translationUtils
} from './translator.js';

// Formatting system
export {
  createFormatter,
  formatters,
  formatUtils
} from './formatter.js';

// Loading system
export {
  createLoader,
  createCustomLoader,
  createStaticLoader,
  preloadLocales
} from './loader.js';

// Convenience re-exports for common usage patterns
export { createStore, derived, useStore } from '../../store/src/index.js';
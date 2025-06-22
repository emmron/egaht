# Internationalization (i18n) Guide

## Overview

Eghact provides a comprehensive internationalization system with reactive language switching, lazy-loading translation files, and built-in formatting utilities using the JavaScript `Intl` API.

## Features

- **Context-based i18n Provider**: Centralized locale and translation management
- **Reactive Language Switching**: Update UI without page reload
- **Lazy Translation Loading**: Dynamic import of locale files
- **Pluralization Support**: ICU-style pluralization rules
- **Intl API Integration**: Date, number, and currency formatting
- **TypeScript Support**: Fully typed translation keys and parameters

## Quick Start

### 1. Set up Translation Files

Create locale files in your project:

```
src/
  locales/
    en.json
    es.json
    fr.json
```

**en.json:**
```json
{
  "app": {
    "title": "My App"
  },
  "welcome": {
    "greeting": "Hello, {{name}}!",
    "description": "Welcome to our application"
  },
  "items": {
    "count": {
      "zero": "No items",
      "one": "One item", 
      "other": "{{count}} items"
    }
  }
}
```

### 2. Initialize i18n Provider

**App.egh:**
```typescript
<template>
  <I18nProvider locale={defaultLocale} translations={translations}>
    <Router />
  </I18nProvider>
</template>

<script lang="ts">
  import { I18nProvider } from '@eghact/i18n';
  
  const defaultLocale = 'en';
  const translations = {
    en: () => import('./locales/en.json'),
    es: () => import('./locales/es.json'),
    fr: () => import('./locales/fr.json')
  };
</script>
```

### 3. Use Translations in Components

```typescript
<template>
  <div>
    <h1>{t('app.title')}</h1>
    <p>{t('welcome.greeting', { name: userName })}</p>
    <p>{t('items.count', { count: itemCount })}</p>
    
    <LanguageSwitcher />
  </div>
</template>

<script lang="ts">
  import { useI18n } from '@eghact/i18n';
  
  const { t, locale, changeLocale } = useI18n();
  
  export let userName: string = 'User';
  export let itemCount: number = 0;
</script>
```

## API Reference

### useI18n()

The main hook for accessing i18n functionality:

```typescript
const {
  t,              // Translation function
  locale,         // Current locale (readable store)
  changeLocale,   // Function to change locale
  availableLocales, // Array of available locales
  isLoading,      // Loading state for translations
  formatNumber,   // Number formatting
  formatDate,     // Date formatting
  formatCurrency  // Currency formatting
} = useI18n();
```

### Translation Function t()

```typescript
// Simple translation
t('app.title') // → "My App"

// With interpolation
t('welcome.greeting', { name: 'John' }) // → "Hello, John!"

// With pluralization
t('items.count', { count: 0 }) // → "No items"
t('items.count', { count: 1 }) // → "One item"
t('items.count', { count: 5 }) // → "5 items"

// With fallback
t('missing.key', {}, 'Fallback text') // → "Fallback text"
```

### Formatting Functions

```typescript
// Number formatting
formatNumber(1234.56) // → "1,234.56" (en) / "1.234,56" (de)

// Date formatting
formatDate(new Date(), {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
}) // → "January 15, 2024" (en) / "15 de enero de 2024" (es)

// Currency formatting
formatCurrency(99.99, 'USD') // → "$99.99" (en) / "99,99 $" (fr)
```

## Language Switching

### Basic Language Switcher

```typescript
<template>
  <select bind:value={selectedLocale} @change={handleChange}>
    {#each availableLocales as locale}
      <option value={locale}>{getLocaleName(locale)}</option>
    {/each}
  </select>
</template>

<script lang="ts">
  import { useI18n } from '@eghact/i18n';
  
  const { locale, changeLocale, availableLocales } = useI18n();
  
  let selectedLocale = locale;
  
  const localeNames = {
    'en': 'English',
    'es': 'Español',
    'fr': 'Français'
  };
  
  function getLocaleName(locale: string): string {
    return localeNames[locale] || locale;
  }
  
  async function handleChange() {
    try {
      await changeLocale(selectedLocale);
    } catch (error) {
      console.error('Failed to change locale:', error);
      selectedLocale = locale; // Revert on error
    }
  }
  
  // Sync with external locale changes
  $: selectedLocale = locale;
</script>
```

### Programmatic Language Changes

```typescript
// Change locale with loading state
async function switchToSpanish() {
  try {
    await changeLocale('es');
    console.log('Locale changed successfully');
  } catch (error) {
    console.error('Failed to load Spanish translations:', error);
  }
}

// Check if locale is loading
if (isLoading) {
  console.log('Loading translations...');
}
```

## Advanced Features

### Nested Translation Keys

```json
{
  "dashboard": {
    "user": {
      "profile": {
        "title": "User Profile",
        "actions": {
          "edit": "Edit Profile",
          "delete": "Delete Account"
        }
      }
    }
  }
}
```

```typescript
t('dashboard.user.profile.title') // → "User Profile"
t('dashboard.user.profile.actions.edit') // → "Edit Profile"
```

### Rich Text Interpolation

```json
{
  "message": "Welcome {{name}}, you have {{count}} new message{{count === 1 ? '' : 's'}}"
}
```

```typescript
t('message', { name: 'Alice', count: 3 })
// → "Welcome Alice, you have 3 new messages"
```

### Locale-specific Formatting

```typescript
// Custom formatting options per locale
const { formatNumber } = useI18n();

// Format with locale-specific options
formatNumber(1234.56, {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2
});
// → "€1,234.56" (en) / "1.234,56 €" (de)
```

## Configuration

### I18nProvider Props

```typescript
interface I18nProviderProps {
  locale: string;                    // Initial locale
  translations: TranslationMap;      // Translation loader functions
  fallbackLocale?: string;           // Fallback locale (default: 'en')
  loadingComponent?: Component;      // Loading component
  errorComponent?: Component;        // Error fallback component
  interpolationOptions?: {
    prefix?: string;                 // Interpolation prefix (default: '{{')
    suffix?: string;                 // Interpolation suffix (default: '}}')
  };
}
```

### Translation Loader

```typescript
type TranslationLoader = () => Promise<Record<string, any>>;

interface TranslationMap {
  [locale: string]: TranslationLoader;
}

// Example with dynamic imports
const translations: TranslationMap = {
  en: () => import('./locales/en.json'),
  es: () => import('./locales/es.json'),
  fr: () => import('./locales/fr.json'),
  // Load from API
  de: () => fetch('/api/translations/de').then(r => r.json())
};
```

## Best Practices

1. **Use nested keys**: Organize translations hierarchically
2. **Implement fallbacks**: Always provide fallback locale and text
3. **Lazy load**: Use dynamic imports for translation files
4. **Type safety**: Use TypeScript for translation key validation
5. **Cache translations**: Implement caching for better performance
6. **Handle errors**: Gracefully handle failed translation loads
7. **Test thoroughly**: Test all locales and edge cases

## Integration with Eghact Features

### SSR Support

Translations are automatically handled during server-side rendering:

```typescript
// Server-side rendering with locale detection
export async function load({ url, request }: LoadContext) {
  const locale = detectLocale(request); // Detect from headers/URL
  
  return {
    locale,
    translations: await loadTranslations(locale)
  };
}
```

### TypeScript Integration

```typescript
// Type-safe translation keys
interface TranslationKeys {
  'app.title': string;
  'welcome.greeting': { name: string };
  'items.count': { count: number };
}

// Usage with full type safety
const message: string = t('app.title');
const greeting: string = t('welcome.greeting', { name: 'John' });
```

### Build-time Optimization

The build system can optimize translations:

```javascript
// eghact.config.js
export default {
  i18n: {
    locales: ['en', 'es', 'fr'],
    defaultLocale: 'en',
    fallbackLocale: 'en',
    extractUnused: true,      // Remove unused translations
    inlineDefault: true,      // Inline default locale
    generateTypes: true       // Generate TypeScript types
  }
};
```

## Testing

### Unit Testing Translations

```typescript
import { render } from '@eghact/testing';
import { I18nProvider } from '@eghact/i18n';

test('renders translated content', async () => {
  const translations = {
    en: () => Promise.resolve({ 'app.title': 'Test App' })
  };
  
  const { getByText } = render(
    <I18nProvider locale="en" translations={translations}>
      <MyComponent />
    </I18nProvider>
  );
  
  expect(getByText('Test App')).toBeInTheDocument();
});
```

### E2E Testing Language Switching

```typescript
import { test, expect } from '@playwright/test';

test('language switching works', async ({ page }) => {
  await page.goto('/');
  
  // Check initial language
  await expect(page.locator('h1')).toHaveText('Welcome');
  
  // Switch to Spanish
  await page.selectOption('select[name="language"]', 'es');
  
  // Verify content changed
  await expect(page.locator('h1')).toHaveText('Bienvenido');
});
```
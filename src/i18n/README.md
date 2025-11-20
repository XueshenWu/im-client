# i18n Setup Guide

This project uses **react-i18next** for internationalization with support for English and French.

## File Structure

```
src/
  i18n/
    config.ts           # i18n configuration
    locales/
      en.json          # English translations
      fr.json          # French translations
  components/
    common/
      LanguageSwitcher.tsx  # Language switcher component
```

## Usage in Components

### 1. Import the useTranslation hook

```tsx
import { useTranslation } from 'react-i18next';
```

### 2. Use the hook in your component

```tsx
const MyComponent = () => {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('gallery.title')}</h1>
      <p>{t('gallery.noImages')}</p>
    </div>
  );
};
```

### 3. Translation keys

Access nested translations using dot notation:
- `t('gallery.title')` → "Gallery" (en) / "Galerie" (fr)
- `t('gallery.sortBy')` → "Sort by:" (en) / "Trier par:" (fr)
- `t('contextMenu.download')` → "Download" (en) / "Télécharger" (fr)

### 4. Dynamic translations with variables

```tsx
// In your translation file:
{
  "welcome": "Welcome, {{name}}!"
}

// In your component:
<p>{t('welcome', { name: 'John' })}</p>
// Output: "Welcome, John!"
```

## Language Switcher

Add the language switcher to any component:

```tsx
import LanguageSwitcher from '@/components/common/LanguageSwitcher';

const MyLayout = () => {
  return (
    <div>
      <LanguageSwitcher />
      {/* other content */}
    </div>
  );
};
```

## Adding New Languages

1. Create a new JSON file in `src/i18n/locales/` (e.g., `es.json` for Spanish)
2. Copy the structure from `en.json` and translate the values
3. Import and add it to `src/i18n/config.ts`:

```ts
import es from './locales/es.json';

const resources = {
  en: { translation: en },
  fr: { translation: fr },
  es: { translation: es }  // Add new language
};
```

4. Update `LanguageSwitcher.tsx` to include the new language:

```ts
const languages = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' }  // Add new language
];
```

## Example: CloudPhotoWall Component

See `src/components/gallery/CloudPhotoWall.tsx` for a complete example of how translations are integrated.

## API Reference

### useTranslation Hook

```tsx
const { t, i18n } = useTranslation();

// t - Translation function
t('key') // Get translation

// i18n - i18next instance
i18n.language // Current language code
i18n.changeLanguage('fr') // Change language programmatically
```

## Best Practices

1. **Keep keys organized**: Group related translations (e.g., all gallery-related under `gallery.*`)
2. **Use descriptive keys**: `gallery.sortBy` is better than `sort1`
3. **Maintain consistency**: Keep the same structure across all language files
4. **Test translations**: Check that all keys exist in all language files
5. **Avoid hardcoded strings**: Always use `t()` function for user-facing text

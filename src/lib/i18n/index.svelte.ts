import { translations, type Locale, type TranslationKey } from './translations';
import { browser } from '$app/env';

const STORAGE_KEY = 'proma_locale';

function detectLocale(): Locale {
  if (!browser) return 'de';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'de' || stored === 'en') return stored;
  return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
}

let currentLocale = $state<Locale>(detectLocale());

export const locale = {
  get: () => currentLocale,
  set(l: Locale) {
    currentLocale = l;
    if (browser) localStorage.setItem(STORAGE_KEY, l);
  }
};

export function t(key: TranslationKey): string {
  return translations[currentLocale][key];
}

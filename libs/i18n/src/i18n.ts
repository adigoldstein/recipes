import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import he from './he.json';

export const defaultNS = 'translation';

export const resources = { he: { [defaultNS]: he } } as const;

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)['he'];
  }
}

/** Starts i18next with the bundled Hebrew strings; safe to call more than once. */
export function initI18n() {
  if (!i18next.isInitialized) {
    void i18next.use(initReactI18next).init({
      lng: 'he',
      fallbackLng: 'he',
      defaultNS,
      resources,
      // Resources are bundled, so init finishes synchronously.
      initAsync: false,
      // React escapes on render; escaping here would print `&amp;`.
      interpolation: { escapeValue: false },
    });
  }
  return i18next;
}

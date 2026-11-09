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

/** Starts i18next with the Hebrew texts. Calling it more than once is safe. */
export function initI18n() {
  if (!i18next.isInitialized) {
    void i18next.use(initReactI18next).init({
      lng: 'he',
      fallbackLng: 'he',
      defaultNS,
      resources,
      // The texts are part of the bundle, so init finishes right away (not async).
      initAsync: false,
      // React already escapes text. Escaping here too would show `&amp;`.
      interpolation: { escapeValue: false },
    });
  }
  return i18next;
}

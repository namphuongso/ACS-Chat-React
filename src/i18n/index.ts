import i18next, { i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en';
import { vi } from './locales/vi';

// Create a custom i18n instance for the library
// so it doesn't conflict with the consuming app's i18next instance
export const chatI18n: i18n = i18next.createInstance();

chatI18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      vi: { translation: vi },
    },
    lng: 'en', // Default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

export default chatI18n;

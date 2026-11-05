import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import ne from './locales/ne.json';

// Until the user picks a language, follow the phone's language.
const deviceLang = getLocales()[0]?.languageCode === 'ne' ? 'ne' : 'en';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ne: { translation: ne } },
  lng: deviceLang,
  fallbackLng: 'en', // a missing Nepali string shows in English
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
});

export default i18n;

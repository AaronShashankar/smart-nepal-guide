import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Same structure as the mobile app's locale files; English is the fallback.
const en = {
  title: 'Bato · Admin',
  login: 'Log in',
  email: 'Email',
  password: 'Password',
  loginFailed: 'Could not log in.',
  notAdmin: 'This account is not an admin.',
  logout: 'Log out',
  welcome: 'Welcome, {{name}}',
  comingSoon:
    'Content management (places, treks, stages, photos, users, reviews) arrives in Phase 3. Until then, content is loaded from the seed files with `python -m app.seed`.',
  language: 'Language',
};
const ne: typeof en = {
  title: 'स्मार्ट नेपाल गाइड · एडमिन',
  login: 'लगइन',
  email: 'इमेल',
  password: 'पासवर्ड',
  loginFailed: 'लगइन हुन सकेन।',
  notAdmin: 'यो खाता एडमिन होइन।',
  logout: 'लगआउट',
  welcome: 'स्वागत छ, {{name}}',
  comingSoon:
    'सामग्री व्यवस्थापन (ठाउँ, पदयात्रा, चरण, फोटो, प्रयोगकर्ता, समीक्षा) तेस्रो चरणमा आउँछ। त्यसअघि सामग्री seed फाइलबाट लोड गरिन्छ।',
  language: 'भाषा',
};

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ne: { translation: ne } },
  lng: localStorage.getItem('snguide.admin.lang') ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => localStorage.setItem('snguide.admin.lang', lng));

export default i18n;

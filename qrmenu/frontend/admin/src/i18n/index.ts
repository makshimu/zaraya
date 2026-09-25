import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import ru from './locales/ru.json'
import vi from './locales/vi.json'

// Add a language: drop a JSON file into ./locales and register it here.
export const LANGUAGES = { vi, en, ru } as const
export type Language = keyof typeof LANGUAGES

const LANG_KEY = 'qrmenu_admin_lang'

function initialLanguage(): Language {
  const saved = localStorage.getItem(LANG_KEY)
  if (saved && saved in LANGUAGES) return saved as Language
  const browser = navigator.language.slice(0, 2)
  return browser in LANGUAGES ? (browser as Language) : 'vi'
}

i18n.use(initReactI18next).init({
  resources: Object.fromEntries(Object.entries(LANGUAGES).map(([k, v]) => [k, { translation: v }])),
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(LANG_KEY, lng)
  document.documentElement.lang = lng
})
document.documentElement.lang = i18n.language

export default i18n

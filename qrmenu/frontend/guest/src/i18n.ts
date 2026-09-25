import { createContext, useContext } from 'react'

import en from './locales/en.json'
import ru from './locales/ru.json'

// UI strings. Add a language: drop a JSON file into ./locales and register it here.
// Menu content languages come from the restaurant settings; UI falls back to English.
const DICTS: Record<string, Record<string, string>> = { ru, en }

export function translate(lang: string, key: string, vars?: Record<string, string | number>): string {
  let text = DICTS[lang]?.[key] ?? DICTS.en[key] ?? key
  for (const [k, v] of Object.entries(vars ?? {})) text = text.replaceAll(`{{${k}}}`, String(v))
  return text
}

export interface LangState {
  lang: string
  setLang: (lang: string) => void
}

export const LangContext = createContext<LangState>({ lang: 'en', setLang: () => {} })

export function useT() {
  const { lang } = useContext(LangContext)
  return (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars)
}

const LANG_KEY = 'qrmenu_guest_lang'

export function pickLanguage(available: string[], fallback: string): string {
  const saved = localStorage.getItem(LANG_KEY)
  if (saved && available.includes(saved)) return saved
  const browser = navigator.language.slice(0, 2)
  return available.includes(browser) ? browser : fallback
}

export function saveLanguage(lang: string) {
  localStorage.setItem(LANG_KEY, lang)
  document.documentElement.lang = lang
}

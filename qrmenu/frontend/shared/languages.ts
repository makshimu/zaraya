// Menu languages named in themselves, the way guests and staff look for them
export const LANGUAGE_NAMES: Record<string, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
  ru: 'Русский',
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
}

export const languageName = (code: string) => LANGUAGE_NAMES[code] ?? code.toUpperCase()

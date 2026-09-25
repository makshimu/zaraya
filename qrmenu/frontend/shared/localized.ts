export type Localized = Record<string, string>

/** Pick a translation: preferred language, then the restaurant default, then anything present. */
export function tr(value: Localized | undefined, lang: string, fallback?: string): string {
  if (!value) return ''
  return value[lang] || (fallback && value[fallback]) || Object.values(value).find(Boolean) || ''
}

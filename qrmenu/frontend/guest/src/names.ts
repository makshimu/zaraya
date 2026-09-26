import { tr, type Localized } from '../../shared/localized'

/**
 * A dish is shown under its own name (in the restaurant's main language, "Phở bò") with the
 * guest's translation underneath ("Beef noodle soup") — the way the dish is ordered and served.
 */
export function dishNames(name: Localized, lang: string, fallback: string): { primary: string; secondary: string } {
  const translated = tr(name, lang, fallback)
  const primary = name[fallback]?.trim() || translated
  return { primary, secondary: translated !== primary ? translated : '' }
}

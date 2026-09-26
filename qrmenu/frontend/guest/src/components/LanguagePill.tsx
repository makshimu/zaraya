import { useContext } from 'react'

import { LANGUAGE_NAMES, LangContext, useT } from '../i18n'
import { ChevronDownIcon, GlobeIcon } from './icons'

/** "🌐 EN ▾": a native select under a small pill, so every phone shows its own picker. */
export default function LanguagePill({ languages, tone }: { languages: string[]; tone: 'dark' | 'light' }) {
  const t = useT()
  const { lang, setLang } = useContext(LangContext)
  if (languages.length < 2) return null
  const look =
    tone === 'dark' ? 'border-white/30 bg-black/30 text-white backdrop-blur-sm' : 'border-line bg-paper text-ink'
  return (
    <label
      className={`relative flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${look}`}
    >
      <GlobeIcon className="size-4" />
      <span>{lang.toUpperCase()}</span>
      <ChevronDownIcon className="size-4 opacity-80" />
      <select
        aria-label={t('language')}
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {languages.map((l) => (
          <option key={l} value={l}>
            {LANGUAGE_NAMES[l] ?? l.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  )
}

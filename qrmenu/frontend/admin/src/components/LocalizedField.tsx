import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { languageName } from '../../../shared/languages'
import type { Localized } from '../api/types'
import { input, label as labelCls } from './ui'

/**
 * A text in every menu language: {"vi": "...", "en": "..."}.
 * The main language (first) is always shown and required; translations open one at a time
 * from the chips below, which mark the languages already filled in.
 */
export default function LocalizedField({
  id,
  label,
  value,
  onChange,
  languages,
  required = false,
  multiline = false,
}: {
  id: string
  label: string
  value: Localized
  onChange: (v: Localized) => void
  languages: string[]
  required?: boolean
  multiline?: boolean
}) {
  const { t } = useTranslation()
  const [main, ...others] = languages
  const [open, setOpen] = useState<string | null>(null)

  function field(lang: string, isMain: boolean) {
    const props = {
      id: `${id}-${lang}`,
      lang,
      className: `${input} pl-11`,
      value: value[lang] ?? '',
      required: required && isMain,
      'aria-label': `${label} (${languageName(lang)})`,
      onChange: (e: { target: { value: string } }) => onChange({ ...value, [lang]: e.target.value }),
    }
    return (
      <div className="relative">
        <span className="pointer-events-none absolute top-2 left-3 text-xs font-semibold text-slate-400 uppercase">
          {lang}
        </span>
        {multiline ? <textarea rows={2} {...props} /> : <input {...props} />}
      </div>
    )
  }

  return (
    <fieldset>
      <legend className={labelCls}>{label}</legend>
      <div className="space-y-2">
        {main && field(main, true)}
        {others.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500">{t('menu.translations')}:</span>
            {others.map((lang) => {
              const filled = !!value[lang]?.trim()
              return (
                <button
                  key={lang}
                  type="button"
                  aria-pressed={open === lang}
                  title={languageName(lang)}
                  onClick={() => setOpen(open === lang ? null : lang)}
                  className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium uppercase ${
                    open === lang
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className={`size-1.5 rounded-full ${filled ? 'bg-green-500' : 'bg-slate-300'}`} aria-hidden />
                  {lang}
                </button>
              )
            })}
          </div>
        )}
        {open && others.includes(open) && field(open, false)}
      </div>
    </fieldset>
  )
}

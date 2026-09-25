import type { Localized } from '../api/types'
import { input, label as labelCls } from './ui'

/** One input per content language: {"ru": "...", "en": "..."}. */
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
  return (
    <fieldset>
      <legend className={labelCls}>{label}</legend>
      <div className="space-y-2">
        {languages.map((lang, i) => {
          const common = {
            id: `${id}-${lang}`,
            className: `${input} pl-11`,
            value: value[lang] ?? '',
            // The first (default) language is the one that must be filled in
            required: required && i === 0,
            onChange: (e: { target: { value: string } }) => onChange({ ...value, [lang]: e.target.value }),
          }
          return (
            <div key={lang} className="relative">
              <span className="pointer-events-none absolute top-2 left-3 text-xs font-semibold text-slate-400 uppercase">
                {lang}
              </span>
              {multiline ? <textarea rows={2} {...common} /> : <input {...common} />}
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}

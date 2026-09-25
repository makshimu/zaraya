import { RotateCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { languageName } from '../../../../shared/languages'
import { useContentLocale } from './shared'

/** The guest menu exactly as guests see it, in a phone frame. It is the real guest app in
 * view-only mode, so it updates live with every change made here. */
export default function PhonePreview() {
  const { t } = useTranslation()
  const content = useContentLocale()
  const [lang, setLang] = useState(content.lang)
  const [reloads, setReloads] = useState(0)
  const shownLang = content.languages.includes(lang) ? lang : content.languages[0]

  return (
    <div className="sticky top-6 space-y-3" data-testid="phone-preview">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-600">{t('menu.preview')}</span>
        <div className="flex items-center gap-1">
          <select
            aria-label={t('menu.previewLanguage')}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
            value={shownLang}
            onChange={(e) => setLang(e.target.value)}
          >
            {content.languages.map((l) => (
              <option key={l} value={l}>
                {languageName(l)}
              </option>
            ))}
          </select>
          <button
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label={t('menu.previewReload')}
            title={t('menu.previewReload')}
            onClick={() => setReloads((n) => n + 1)}
          >
            <RotateCw className="size-4" />
          </button>
        </div>
      </div>
      <div className="mx-auto w-[350px] rounded-[2.75rem] border-[10px] border-sky-200 bg-white p-1 shadow-lg">
        <div className="mx-auto mb-1 h-5 w-24 rounded-b-2xl bg-sky-200" />
        <iframe
          key={`${shownLang}-${reloads}`}
          title={t('menu.preview')}
          src={`/?preview=1&lang=${encodeURIComponent(shownLang)}`}
          className="h-[560px] w-full rounded-[1.9rem]"
        />
      </div>
    </div>
  )
}

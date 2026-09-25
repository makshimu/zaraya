import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { LANGUAGES } from '../i18n'

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  return (
    <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
      <Languages className="size-4 text-slate-500" aria-hidden />
      <span className="sr-only">{t('lang.label')}</span>
      <select
        className="bg-transparent outline-none"
        value={i18n.resolvedLanguage}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
      >
        {Object.keys(LANGUAGES).map((lng) => (
          <option key={lng} value={lng}>
            {t(`lang.${lng}`)}
          </option>
        ))}
      </select>
    </label>
  )
}

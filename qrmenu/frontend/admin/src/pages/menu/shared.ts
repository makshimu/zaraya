import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { useSettings } from '../../api/settings'
import { tr } from '../../../../shared/localized'
import type { Localized } from '../../api/types'

export function useErrorText() {
  const { t } = useTranslation()
  return (err: unknown) => t(`errors.${err instanceof ApiError ? err.code : 'unknown_error'}`, t('errors.unknown_error'))
}

/** Content languages, currency and a translator for menu content in the current UI language. */
export function useContentLocale() {
  const { i18n } = useTranslation()
  const settings = useSettings().data
  const languages = settings?.languages ?? ['ru', 'en']
  const fallback = settings?.default_language ?? languages[0]
  const lang = i18n.resolvedLanguage ?? fallback
  return {
    languages,
    currency: settings?.currency ?? 'VND',
    lang,
    t: (value: Localized | undefined) => tr(value, lang, fallback),
  }
}

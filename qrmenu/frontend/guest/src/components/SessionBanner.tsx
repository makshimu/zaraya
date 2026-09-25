import { useT } from '../i18n'
import type { SessionStatus } from '../types'
import { AlertIcon } from './icons'

export const SESSION_MESSAGES: Record<string, string> = {
  none: 'noSession',
  expired: 'rescan',
  closed: 'tableClosed',
  table_inactive: 'tableInactive',
  table_not_open: 'tableNotOpen',
  invalid_qr: 'invalidQr',
}

/** Shown whenever ordering is not possible; the menu itself stays browsable. */
export default function SessionBanner({ reason }: { reason: SessionStatus | 'none' | 'invalid_qr' | 'loading' }) {
  const t = useT()
  if (reason === 'active' || reason === 'loading') return null
  return (
    <div
      role="status"
      className="mx-4 mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
    >
      <AlertIcon className="mt-0.5 size-4 shrink-0" />
      {t(SESSION_MESSAGES[reason] ?? 'rescan')}
    </div>
  )
}

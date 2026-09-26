import { useEffect, type ReactNode } from 'react'

import { useT } from '../i18n'
import { XIcon } from './icons'

// All open sheets share one history entry, so Back always closes what is on screen
let openSheets = 0

/** Bottom sheet: locks page scroll, closes on backdrop tap, Escape and the phone's Back button. */
export default function Sheet({
  label,
  title,
  onClose,
  footer,
  children,
}: {
  label: string
  title?: string
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
}) {
  const t = useT()

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    // Leaving the sheet's history entry means the Back button was pressed
    const onPop = () => !history.state?.sheet && onClose()
    window.addEventListener('popstate', onPop)
    if (openSheets++ === 0) history.pushState({ ...history.state, sheet: true }, '')
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('popstate', onPop)
      openSheets--
      // Deferred: when one sheet replaces another (cart -> my orders) the new one reuses the
      // entry. history.back() is async and would otherwise pop the entry of the new sheet.
      setTimeout(() => {
        if (openSheets === 0 && history.state?.sheet) history.back()
      })
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-label={label}
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-paper"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-xl font-bold">{title}</h2>
            <button
              onClick={onClose}
              aria-label={t('close')}
              className="flex size-9 items-center justify-center rounded-full bg-cream"
            >
              <XIcon className="size-5" />
            </button>
          </div>
        )}
        {!title && (
          <button
            onClick={onClose}
            aria-label={t('close')}
            className="absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full bg-paper/90 shadow"
          >
            <XIcon className="size-5" />
          </button>
        )}
        <div className="overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  )
}

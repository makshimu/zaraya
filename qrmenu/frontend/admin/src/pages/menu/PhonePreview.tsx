import { ExternalLink, RotateCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { languageName } from '../../../../shared/languages'
import { isGuestReady, PREVIEW_SOURCE, type PreviewCommand } from '../../../../shared/preview'
import { useContentLocale } from './shared'

export type PreviewTarget = { type: 'show-item'; itemId: number } | { type: 'show-category'; categoryId: number }

/** A request to point the preview somewhere; `seq` makes repeated clicks on the same dish count. */
export interface PreviewRequest {
  target: PreviewTarget
  seq: number
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(timer)
  }, [])
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

/**
 * The guest menu exactly as guests see it, in a phone. It is the real guest app in preview mode:
 * fully clickable (dishes, options, cart, waiter buttons) but nothing is sent, and it updates
 * live with every change made in the admin.
 */
export default function PhonePreview({ request }: { request: PreviewRequest | null }) {
  const { t } = useTranslation()
  const content = useContentLocale()
  const clock = useClock()
  const [lang, setLang] = useState(content.lang)
  const [reloads, setReloads] = useState(0)
  const shownLang = content.languages.includes(lang) ? lang : content.languages[0]
  const src = `/?preview=1&lang=${encodeURIComponent(shownLang)}`

  const frame = useRef<HTMLIFrameElement>(null)
  const ready = useRef(false)
  const pending = useRef<PreviewTarget | null>(null)

  const send = (target: PreviewTarget) => {
    const command: PreviewCommand = { source: PREVIEW_SOURCE, ...target }
    frame.current?.contentWindow?.postMessage(command, location.origin)
  }

  // The guest app says "ready" once its menu is on screen; commands wait for it
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow || !isGuestReady(e.data)) return
      ready.current = true
      if (pending.current) send(pending.current)
      pending.current = null
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    if (!request) return
    if (ready.current) send(request.target)
    else pending.current = request.target
  }, [request])

  const reload = () => {
    ready.current = false
    setReloads((n) => n + 1)
  }

  return (
    <div className="space-y-3" data-testid="phone-preview">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-600">{t('menu.preview')}</span>
        <div className="flex items-center gap-1">
          <select
            aria-label={t('menu.previewLanguage')}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
            value={shownLang}
            onChange={(e) => {
              ready.current = false
              setLang(e.target.value)
            }}
          >
            {content.languages.map((l) => (
              <option key={l} value={l}>
                {languageName(l)}
              </option>
            ))}
          </select>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label={t('menu.previewOpenTab')}
            title={t('menu.previewOpenTab')}
          >
            <ExternalLink className="size-4" />
          </a>
        </div>
      </div>

      {/* Phone body */}
      <div className="mx-auto w-full max-w-[370px] rounded-[3rem] border-[10px] border-sky-200 bg-sky-200 shadow-xl">
        <div className="overflow-hidden rounded-[2.4rem] bg-white">
          {/* status bar */}
          <div className="relative flex h-9 items-center justify-between bg-white px-6 text-[13px] font-semibold text-slate-900">
            <span className="tabular-nums">{clock}</span>
            <span className="absolute top-0 left-1/2 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-sky-200" aria-hidden />
            <span className="flex items-center gap-1.5" aria-hidden>
              <svg viewBox="0 0 18 12" className="h-3 w-4 fill-current">
                <rect x="0" y="8" width="3" height="4" rx="1" />
                <rect x="5" y="5" width="3" height="7" rx="1" />
                <rect x="10" y="2.5" width="3" height="9.5" rx="1" />
                <rect x="15" y="0" width="3" height="12" rx="1" />
              </svg>
              <svg viewBox="0 0 16 12" className="h-3 w-4 fill-current">
                <path d="M8 2.2c2.4 0 4.6.9 6.3 2.5l1.2-1.3A10.8 10.8 0 0 0 8 .4 10.8 10.8 0 0 0 .5 3.4l1.2 1.3A9 9 0 0 1 8 2.2Zm0 3.6c1.4 0 2.8.5 3.8 1.5L13 6a7.1 7.1 0 0 0-10 0l1.2 1.3c1-1 2.4-1.5 3.8-1.5Zm0 3.6c.5 0 1 .2 1.3.5L8 11.6 6.7 9.9c.3-.3.8-.5 1.3-.5Z" />
              </svg>
              <svg viewBox="0 0 26 12" className="h-3 w-6">
                <rect x="0.5" y="0.5" width="22" height="11" rx="3" fill="none" stroke="currentColor" opacity="0.4" />
                <rect x="2" y="2" width="17" height="8" rx="1.5" fill="currentColor" />
                <rect x="23.5" y="4" width="2" height="4" rx="1" fill="currentColor" opacity="0.4" />
              </svg>
            </span>
          </div>
          {/* browser bar */}
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5">
            <span className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-1 text-center text-xs text-slate-500">
              {location.host}
            </span>
            <button
              className="rounded-full p-1 text-slate-600 hover:bg-slate-200"
              aria-label={t('menu.previewReload')}
              title={t('menu.previewReload')}
              onClick={reload}
            >
              <RotateCw className="size-4" />
            </button>
          </div>
          <iframe
            ref={frame}
            key={`${shownLang}-${reloads}`}
            title={t('menu.preview')}
            src={src}
            className="block h-[min(680px,calc(100vh-15rem))] min-h-[420px] w-full"
          />
        </div>
      </div>
    </div>
  )
}

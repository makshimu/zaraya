import { AlertTriangle, Check, Copy, Download } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import type { RestaurantDraft } from '../../../shared/preview'
import { useSaveSettings, useSettings } from '../api/settings'
import { downloadMenuQr, useMenuLink, useMenuQrImage } from '../api/tables'
import type { DayHours, ImageUrls, RestaurantSettings } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import ImagePicker from '../components/ImagePicker'
import LocalizedField from '../components/LocalizedField'
import { btn, input, label } from '../components/ui'
import PhonePreview from './menu/PhonePreview'
import { useErrorText } from './menu/shared'

type Welcome = Pick<
  RestaurantSettings,
  'tagline' | 'logo' | 'logo_urls' | 'cover' | 'cover_urls' | 'wifi_name' | 'wifi_password' | 'opening_hours'
>

const DEFAULT_HOURS: DayHours = { open: '11:00', close: '23:00', closed: false }
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/**
 * The welcome screen the table QR opens: its settings, a live phone preview of them (unsaved
 * edits included) and the menu's own link and QR code.
 */
export default function WelcomeSection() {
  const { t } = useTranslation()
  const settings = useSettings()
  const { user } = useAuth()
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="welcome-section">
      <div className="mb-5">
        <h2 className="text-lg font-semibold">{t('welcome.title')}</h2>
        <p className="text-sm text-slate-500">{t('welcome.hint')}</p>
      </div>
      {settings.data ? (
        <WelcomeEditor initial={settings.data} canEdit={user?.role === 'admin'} />
      ) : (
        <p className="text-slate-500">{t('common.loading')}</p>
      )}
    </section>
  )
}

function WelcomeEditor({ initial, canEdit }: { initial: RestaurantSettings; canEdit: boolean }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const save = useSaveSettings()
  const pick = (s: RestaurantSettings): Welcome => ({
    tagline: s.tagline,
    logo: s.logo,
    logo_urls: s.logo_urls,
    cover: s.cover,
    cover_urls: s.cover_urls,
    wifi_name: s.wifi_name,
    wifi_password: s.wifi_password,
    opening_hours: s.opening_hours,
  })
  const [form, setForm] = useState<Welcome>(() => pick(initial))
  const [saved, setSaved] = useState(false)
  const set = (patch: Partial<Welcome>) => {
    setSaved(false)
    setForm((f) => ({ ...f, ...patch }))
  }
  const hours = form.opening_hours
  const setDay = (index: number, patch: Partial<DayHours>) =>
    set({ opening_hours: hours!.map((d, i) => (i === index ? { ...d, ...patch } : d)) })

  const draft = useMemo<RestaurantDraft>(
    () => ({
      tagline: form.tagline,
      logo_urls: form.logo_urls,
      cover_urls: form.cover_urls,
      wifi_name: form.wifi_name,
      wifi_password: form.wifi_password,
      opening_hours: form.opening_hours,
    }),
    [form],
  )

  function submit(e: FormEvent) {
    e.preventDefault()
    // The settings endpoint takes the whole record: everything else goes back as it is
    const { logo_urls, cover_urls, telegram_token_set, ...rest } = initial
    const { logo_urls: _l, cover_urls: _c, ...welcome } = form
    save.mutate(
      { ...rest, ...welcome },
      {
        onSuccess: (s) => {
          setForm(pick(s))
          setSaved(true)
        },
      },
    )
  }

  const imageUrls = (urls: ImageUrls | null | undefined, url: string | null): ImageUrls | null =>
    urls ?? (url ? { w400: url, w1200: url } : null)

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_370px]">
      <div className="space-y-6">
        {canEdit && (
          <form onSubmit={submit} className="space-y-4">
            <LocalizedField
              id="welcome-tagline"
              label={t('welcome.tagline')}
              value={form.tagline}
              onChange={(tagline) => set({ tagline })}
              languages={initial.languages}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className={label}>{t('welcome.cover')}</span>
                <ImagePicker
                  value={{ key: form.cover, url: form.cover_urls?.w400 ?? null }}
                  onChange={({ key, url, urls }) => set({ cover: key, cover_urls: imageUrls(urls, url) })}
                />
              </div>
              <div>
                <span className={label}>{t('welcome.logo')}</span>
                <ImagePicker
                  value={{ key: form.logo, url: form.logo_urls?.w400 ?? null }}
                  onChange={({ key, url, urls }) => set({ logo: key, logo_urls: imageUrls(urls, url) })}
                />
              </div>
            </div>
            <p className="-mt-2 text-sm text-slate-500">{t('welcome.coverHint')}</p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="wifi-name">
                  {t('welcome.wifiName')}
                </label>
                <input
                  id="wifi-name"
                  className={input}
                  maxLength={64}
                  placeholder="MyCafe_Guest"
                  value={form.wifi_name ?? ''}
                  onChange={(e) => set({ wifi_name: e.target.value || null })}
                />
              </div>
              <div>
                <label className={label} htmlFor="wifi-password">
                  {t('welcome.wifiPassword')}
                </label>
                <input
                  id="wifi-password"
                  className={input}
                  maxLength={64}
                  autoComplete="off"
                  value={form.wifi_password ?? ''}
                  onChange={(e) => set({ wifi_password: e.target.value || null })}
                />
              </div>
            </div>
            <p className="-mt-2 text-sm text-slate-500">{t('welcome.wifiHint')}</p>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={!!hours}
                  onChange={(e) =>
                    set({ opening_hours: e.target.checked ? WEEKDAYS.map(() => ({ ...DEFAULT_HOURS })) : null })
                  }
                />
                {t('welcome.showHours')}
              </label>
              {hours && (
                <div className="space-y-2" data-testid="opening-hours">
                  {hours.map((day, i) => {
                    const name = t(`welcome.weekday.${WEEKDAYS[i]}`)
                    return (
                      <div key={WEEKDAYS[i]} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="w-28 font-medium">{name}</span>
                        <input
                          type="time"
                          aria-label={`${name} ${t('welcome.opens')}`}
                          className={input.replace('w-full', 'w-32')}
                          disabled={day.closed}
                          required
                          value={day.open.slice(0, 5)}
                          onChange={(e) => setDay(i, { open: e.target.value })}
                        />
                        <span className="text-slate-400">–</span>
                        <input
                          type="time"
                          aria-label={`${name} ${t('welcome.closes')}`}
                          className={input.replace('w-full', 'w-32')}
                          disabled={day.closed}
                          required
                          value={day.close.slice(0, 5)}
                          onChange={(e) => setDay(i, { close: e.target.value })}
                        />
                        <label className="flex items-center gap-1.5 pl-2">
                          <input
                            type="checkbox"
                            checked={day.closed}
                            onChange={(e) => setDay(i, { closed: e.target.checked })}
                          />
                          {t('welcome.dayOff')}
                        </label>
                      </div>
                    )
                  })}
                  <button
                    type="button"
                    className={btn.secondary}
                    onClick={() => set({ opening_hours: hours.map(() => ({ ...hours[0] })) })}
                  >
                    {t('welcome.sameEveryDay')}
                  </button>
                </div>
              )}
            </div>

            {save.error && <p className="text-sm text-red-600">{errorText(save.error)}</p>}
            <div className="flex items-center gap-3">
              <button type="submit" className={btn.primary} disabled={save.isPending}>
                {t('common.save')}
              </button>
              {saved && (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <Check className="size-4" /> {t('welcome.saved')}
                </span>
              )}
            </div>
          </form>
        )}

        <MenuLink />
      </div>

      <PhonePreview view="home" draft={draft} />
    </div>
  )
}

/** The menu's own link and QR, without a table: guests can browse, ordering needs a table QR. */
function MenuLink() {
  const { t } = useTranslation()
  const link = useMenuLink().data
  const qr = useMenuQrImage()
  const [copied, setCopied] = useState(false)

  async function copy() {
    if (!link) return
    await navigator.clipboard.writeText(link.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-wrap items-start gap-5 rounded-xl border border-slate-200 p-4" data-testid="menu-link">
      <div className="size-36 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-white">
        {qr && <img src={qr} alt={t('welcome.menuQr')} className="size-full" />}
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <div className="font-medium">{t('welcome.menuQr')}</div>
          <p className="text-sm text-slate-500">{t('welcome.menuQrHint')}</p>
        </div>
        {link && (
          <div className="flex items-center gap-2">
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 truncate text-sm text-blue-600 hover:underline"
            >
              {link.url}
            </a>
            <button type="button" className={btn.icon} onClick={copy} aria-label={t('tables.copyLink')}>
              {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn.secondary} onClick={() => downloadMenuQr('png')}>
            <Download className="size-4" /> PNG
          </button>
          <button type="button" className={btn.secondary} onClick={() => downloadMenuQr('svg')}>
            <Download className="size-4" /> SVG
          </button>
        </div>
      </div>
    </div>
  )
}

/** QR codes that lead to localhost only work on this computer: say so before they get printed. */
export function LocalUrlWarning() {
  const { t } = useTranslation()
  const link = useMenuLink().data
  if (!link?.local) return null
  return (
    <div
      role="alert"
      className="mb-6 flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
      data-testid="local-url-warning"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0" />
      <div className="space-y-1">
        <p className="font-semibold">{t('welcome.localTitle', { url: link.url })}</p>
        <p>{t('welcome.localHint')}</p>
        <code className="block rounded bg-white/70 px-2 py-1">PUBLIC_BASE_URL=http://192.168.1.10</code>
      </div>
    </div>
  )
}

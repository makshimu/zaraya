import { Check, Send, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../api/client'
import { testTelegram, useSaveSettings, useSettings, type SettingsInput } from '../api/settings'
import type { DayHours, RestaurantSettings } from '../api/types'
import ImagePicker from '../components/ImagePicker'
import LocalizedField from '../components/LocalizedField'
import { btn, input, label } from '../components/ui'
import { languageName } from '../../../shared/languages'
import { useErrorText } from './menu/shared'

export default function SettingsPage() {
  const { t } = useTranslation()
  const settings = useSettings()
  if (!settings.data) return <p className="text-slate-500">{t('common.loading')}</p>
  return <SettingsForm initial={settings.data} />
}

const TIMEZONES: string[] =
  (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? []

function SettingsForm({ initial }: { initial: RestaurantSettings }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const save = useSaveSettings()
  const { logo_urls, cover_urls, telegram_token_set, ...rest } = initial
  const [form, setForm] = useState<SettingsInput>(rest)
  const [logoUrl, setLogoUrl] = useState(logo_urls?.w400 ?? null)
  const [coverUrl, setCoverUrl] = useState(cover_urls?.w400 ?? null)
  const [newLang, setNewLang] = useState('')
  const [saved, setSaved] = useState(false)

  const set = (patch: Partial<SettingsInput>) => {
    setSaved(false)
    setForm({ ...form, ...patch })
  }

  function addLanguage() {
    const code = newLang.trim().toLowerCase()
    if (/^[a-z]{2,8}$/.test(code) && !form.languages.includes(code)) set({ languages: [...form.languages, code] })
    setNewLang('')
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate(form, {
      onSuccess: () => {
        setSaved(true)
        setForm((f) => ({ ...f, telegram_bot_token: undefined }))
      },
    })
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold">{t('settings.title')}</h1>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">{t('settings.restaurant')}</h2>
        <LocalizedField
          id="rest-name"
          label={t('settings.name')}
          value={form.name}
          onChange={(name) => set({ name })}
          languages={form.languages}
          required
        />
        <div>
          <span className={label}>{t('settings.logo')}</span>
          <ImagePicker
            value={{ key: form.logo, url: logoUrl }}
            onChange={({ key, url }) => {
              set({ logo: key })
              setLogoUrl(url)
            }}
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className={label} htmlFor="currency">
              {t('settings.currency')}
            </label>
            <input
              id="currency"
              className={`${input.replace('w-full', 'w-28')} uppercase`}
              required
              pattern="[A-Za-z]{3}"
              maxLength={3}
              value={form.currency}
              onChange={(e) => set({ currency: e.target.value.toUpperCase() })}
            />
          </div>
          <div className="min-w-64 flex-1">
            <label className={label} htmlFor="tz">
              {t('settings.timezone')}
            </label>
            <input
              id="tz"
              list="tz-list"
              className={input}
              required
              value={form.timezone}
              onChange={(e) => set({ timezone: e.target.value })}
            />
            <datalist id="tz-list">
              {TIMEZONES.map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">{t('settings.languages')}</h2>
        <p className="text-sm text-slate-500">{t('settings.languagesHint')}</p>
        <div className="flex flex-wrap gap-2">
          {form.languages.map((lang) => (
            <span key={lang} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="default-lang"
                  checked={form.default_language === lang}
                  onChange={() => set({ default_language: lang })}
                />
                <span className="font-medium">{languageName(lang)}</span>
              </label>
              {form.languages.length > 1 && form.default_language !== lang && (
                <button
                  type="button"
                  aria-label={t('common.delete')}
                  className="text-slate-400 hover:text-slate-700"
                  onClick={() => set({ languages: form.languages.filter((l) => l !== lang) })}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </span>
          ))}
          <span className="flex gap-1">
            <input
              aria-label={t('settings.addLanguage')}
              placeholder="vi"
              className={input.replace('w-full', 'w-20')}
              value={newLang}
              onChange={(e) => setNewLang(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addLanguage()
                }
              }}
            />
            <button type="button" className={btn.secondary} onClick={addLanguage}>
              {t('settings.addLanguage')}
            </button>
          </span>
        </div>
      </section>

      <GuestHomeSection form={form} set={set} coverUrl={coverUrl} setCoverUrl={setCoverUrl} />

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">{t('settings.sessions')}</h2>
        <div>
          <label className={label} htmlFor="ttl">
            {t('settings.ttl')}
          </label>
          <input
            id="ttl"
            type="number"
            min={1}
            max={1440}
            required
            className={input.replace('w-full', 'w-32')}
            value={form.session_ttl_minutes}
            onChange={(e) => set({ session_ttl_minutes: Number(e.target.value) })}
          />
          <p className="mt-1 text-sm text-slate-500">{t('settings.ttlHint')}</p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={form.require_first_order_confirmation}
            onChange={(e) => set({ require_first_order_confirmation: e.target.checked })}
          />
          <span>
            {t('settings.confirmFirstOrder')}
            <span className="block text-slate-500">{t('settings.confirmFirstOrderHint')}</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={form.require_table_open}
            onChange={(e) => set({ require_table_open: e.target.checked })}
          />
          <span>
            {t('settings.requireOpen')}
            <span className="block text-slate-500">{t('settings.requireOpenHint')}</span>
          </span>
        </label>
      </section>

      <TelegramSection form={form} set={set} tokenSet={telegram_token_set} />

      {save.error && <p className="text-sm text-red-600">{errorText(save.error)}</p>}
      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <Check className="size-4" /> {t('settings.saved')}
          </span>
        )}
        <button type="submit" className={btn.primary} disabled={save.isPending}>
          {t('common.save')}
        </button>
      </div>
    </form>
  )
}

const DEFAULT_HOURS: DayHours = { open: '11:00', close: '23:00', closed: false }
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** What guests see right after scanning the QR: tagline, cover photo, Wi-Fi and opening hours. */
function GuestHomeSection({
  form,
  set,
  coverUrl,
  setCoverUrl,
}: {
  form: SettingsInput
  set: (patch: Partial<SettingsInput>) => void
  coverUrl: string | null
  setCoverUrl: (url: string | null) => void
}) {
  const { t } = useTranslation()
  const hours = form.opening_hours
  const setDay = (index: number, patch: Partial<DayHours>) =>
    set({ opening_hours: hours!.map((d, i) => (i === index ? { ...d, ...patch } : d)) })

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5" data-testid="guest-home-settings">
      <div>
        <h2 className="font-semibold">{t('settings.guestHome')}</h2>
        <p className="text-sm text-slate-500">{t('settings.guestHomeHint')}</p>
      </div>
      <LocalizedField
        id="rest-tagline"
        label={t('settings.tagline')}
        value={form.tagline}
        onChange={(tagline) => set({ tagline })}
        languages={form.languages}
      />
      <div>
        <span className={label}>{t('settings.cover')}</span>
        <ImagePicker
          value={{ key: form.cover, url: coverUrl }}
          onChange={({ key, url }) => {
            set({ cover: key })
            setCoverUrl(url)
          }}
        />
        <p className="mt-1 text-sm text-slate-500">{t('settings.coverHint')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className={label} htmlFor="wifi-name">
            {t('settings.wifiName')}
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
            {t('settings.wifiPassword')}
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
      <p className="-mt-2 text-sm text-slate-500">{t('settings.wifiHint')}</p>

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={!!hours}
            onChange={(e) =>
              set({ opening_hours: e.target.checked ? WEEKDAYS.map(() => ({ ...DEFAULT_HOURS })) : null })
            }
          />
          {t('settings.showHours')}
        </label>
        {hours && (
          <div className="space-y-2" data-testid="opening-hours">
            {hours.map((day, i) => (
              <div key={WEEKDAYS[i]} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-28 font-medium">{t(`settings.weekday.${WEEKDAYS[i]}`)}</span>
                <input
                  type="time"
                  aria-label={`${t(`settings.weekday.${WEEKDAYS[i]}`)} ${t('settings.opens')}`}
                  className={input.replace('w-full', 'w-32')}
                  disabled={day.closed}
                  required
                  value={day.open.slice(0, 5)}
                  onChange={(e) => setDay(i, { open: e.target.value })}
                />
                <span className="text-slate-400">–</span>
                <input
                  type="time"
                  aria-label={`${t(`settings.weekday.${WEEKDAYS[i]}`)} ${t('settings.closes')}`}
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
                  {t('settings.dayOff')}
                </label>
              </div>
            ))}
            <button
              type="button"
              className={btn.secondary}
              onClick={() => set({ opening_hours: hours.map(() => ({ ...hours[0] })) })}
            >
              {t('settings.sameEveryDay')}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

function TelegramSection({
  form,
  set,
  tokenSet,
}: {
  form: SettingsInput
  set: (patch: Partial<SettingsInput>) => void
  tokenSet: boolean
}) {
  const { t } = useTranslation()
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null)
  const [testing, setTesting] = useState(false)

  async function runTest() {
    setTesting(true)
    setTest(null)
    try {
      await testTelegram()
      setTest({ ok: true, text: t('settings.telegramTestOk') })
    } catch (err) {
      const message = err instanceof ApiError ? (err.detailMessage ?? t(`errors.${err.code}`, err.code)) : ''
      setTest({ ok: false, text: t('settings.telegramTestFailed', { error: message || t('errors.unknown_error') }) })
    } finally {
      setTesting(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">{t('settings.telegram')}</h2>
      <p className="text-sm text-slate-500">{t('settings.telegramHint')}</p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.telegram_enabled}
          onChange={(e) => set({ telegram_enabled: e.target.checked })}
        />
        {t('settings.telegramEnabled')}
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className={label} htmlFor="tg-token">
            {t('settings.telegramToken')}
          </label>
          <input
            id="tg-token"
            type="password"
            autoComplete="off"
            className={input}
            placeholder={tokenSet ? t('settings.telegramTokenSaved') : '123456789:AA…'}
            value={form.telegram_bot_token ?? ''}
            onChange={(e) => set({ telegram_bot_token: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className={label} htmlFor="tg-chat">
            {t('settings.telegramChat')}
          </label>
          <input
            id="tg-chat"
            className={input}
            placeholder="-1001234567890"
            value={form.telegram_chat_id ?? ''}
            onChange={(e) => set({ telegram_chat_id: e.target.value.trim() || null })}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btn.secondary} disabled={testing || !tokenSet} onClick={runTest}>
          <Send className="size-4" /> {t('settings.telegramTest')}
        </button>
        {!tokenSet && <span className="text-sm text-slate-500">{t('settings.telegramSaveFirst')}</span>}
        {test && <span className={`text-sm ${test.ok ? 'text-green-600' : 'text-red-600'}`}>{test.text}</span>}
      </div>
    </section>
  )
}

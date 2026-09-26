import { useContext, useMemo, useState } from 'react'

import { tr } from '../../../shared/localized'
import { formatMoney } from '../../../shared/money'
import { LangContext, useT } from '../i18n'
import { dishNames } from '../names'
import type { DayHours, GuestItem, GuestMenu } from '../types'
import {
  ArrowRightIcon,
  ChevronRightIcon,
  ClockIcon,
  CopyIcon,
  FlameIcon,
  LockIcon,
  MenuBookIcon,
  WifiIcon,
} from './icons'
import Img from './Img'
import LanguagePill from './LanguagePill'
import ServiceButtons from './ServiceButtons'

/** What a guest sees right after scanning the QR: the restaurant, the menu entry, the waiter and bill
 * buttons, Wi-Fi, opening hours and a few popular dishes. */
export default function HomeScreen({
  menu,
  tableNumber,
  blockedReason,
  banner,
  notify,
  onMenu,
  onItem,
}: {
  menu: GuestMenu
  tableNumber: string | null
  blockedReason: string | null
  banner: React.ReactNode
  notify: (text: string) => void
  onMenu: () => void
  onItem: (id: number) => void
}) {
  const t = useT()
  const { lang } = useContext(LangContext)
  const { restaurant } = menu
  const fallback = restaurant.default_language
  // The brand name is written as the restaurant writes it; the script font only has Latin letters
  const name = restaurant.name[fallback] || tr(restaurant.name, lang, fallback)
  const tagline = tr(restaurant.tagline, lang, fallback)

  const popular = useMemo(() => {
    const items = new Map(menu.categories.flatMap((c) => c.items).map((i) => [i.id, i]))
    return menu.popular_item_ids.map((id) => items.get(id)).filter((i): i is GuestItem => !!i)
  }, [menu])

  return (
    <div className="pb-36">
      <section className="relative isolate overflow-hidden bg-ink px-5 pt-4 pb-16 text-white">
        {restaurant.cover_urls && (
          <img
            src={restaurant.cover_urls.w1200}
            alt=""
            className="absolute inset-0 -z-10 size-full object-cover"
            decoding="async"
          />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/55 via-black/35 to-black/75" />

        <div className="flex items-center justify-between gap-3">
          {tableNumber ? (
            <span className="rounded-full border border-white/30 bg-black/30 px-3 py-1.5 text-sm font-medium backdrop-blur-sm">
              {t('table', { number: tableNumber })}
            </span>
          ) : (
            <span />
          )}
          <LanguagePill languages={restaurant.languages} tone="dark" />
        </div>

        <div className="flex flex-col items-center pt-10 pb-2 text-center">
          <div className="flex items-center gap-3">
            <h1 className="font-script text-6xl leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">{name}</h1>
            {restaurant.logo_urls && (
              <img
                src={restaurant.logo_urls.w400}
                alt=""
                className="size-12 rounded-lg object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]"
              />
            )}
          </div>
          {tagline && (
            <p className="mt-2 flex items-center gap-3 text-xs font-medium tracking-[0.3em] text-white/90 uppercase">
              <span className="h-px w-8 bg-white/50" aria-hidden />
              {tagline}
              <span className="h-px w-8 bg-white/50" aria-hidden />
            </p>
          )}
        </div>
      </section>

      <div className="relative -mt-10 space-y-3 px-4">
        <button
          onClick={onMenu}
          data-testid="open-menu"
          className="flex w-full items-center gap-4 rounded-3xl bg-gradient-to-br from-wine to-wine-dark p-5 text-left text-white shadow-xl shadow-wine/20 transition-transform active:scale-[0.99]"
        >
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <MenuBookIcon className="size-7" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-serif text-2xl font-bold">{t('menuTitle')}</span>
            <span className="block text-sm text-white/80">{t('menuSub')}</span>
          </span>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15">
            <ArrowRightIcon className="size-5" />
          </span>
        </button>

        <ServiceButtons variant="cards" blockedReason={blockedReason} notify={notify} />

        {banner}

        <InfoCard restaurant={restaurant} notify={notify} />
      </div>

      {popular.length > 0 && (
        <section className="pt-7">
          <div className="flex items-baseline justify-between px-4">
            <h2 className="font-serif text-2xl font-bold">{t('popular')}</h2>
            <button onClick={onMenu} className="flex items-center text-sm font-semibold text-wine">
              {t('seeAll')}
              <ChevronRightIcon className="size-4" />
            </button>
          </div>
          <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 pt-3 pb-2">
            {popular.map((item) => (
              <PopularCard
                key={item.id}
                item={item}
                currency={restaurant.currency}
                fallback={fallback}
                onOpen={() => onItem(item.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function PopularCard({
  item,
  currency,
  fallback,
  onOpen,
}: {
  item: GuestItem
  currency: string
  fallback: string
  onOpen: () => void
}) {
  const t = useT()
  const { lang } = useContext(LangContext)
  const { primary, secondary } = dishNames(item.name, lang, fallback)
  const from = Math.min(...item.prices.map((p) => p.amount))
  return (
    <button
      onClick={onOpen}
      data-testid="popular-item"
      className="w-40 shrink-0 snap-start overflow-hidden rounded-2xl bg-paper text-left shadow-sm ring-1 ring-line"
    >
      <div className="relative">
        <Img src={item.image_urls?.w400} className="aspect-[4/3] w-full" />
        {item.badges.includes('hit') && (
          <span
            className="absolute top-2 left-2 flex size-7 items-center justify-center rounded-full bg-price text-white shadow"
            title={t('badge.hit')}
          >
            <FlameIcon className="size-4" />
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="truncate font-serif text-base font-bold">{primary}</div>
        <div className="truncate text-xs text-muted">{secondary || ' '}</div>
        <div className="mt-1.5 text-sm font-semibold text-price">
          {item.prices.length > 1
            ? t('priceFrom', { price: formatMoney(from, currency, lang) })
            : formatMoney(from, currency, lang)}
        </div>
      </div>
    </button>
  )
}

const hhmm = (time: string) => time.slice(0, 5)

/** "11:00 – 23:00 · Every day" when the week is uniform, otherwise today's hours. */
function hoursSummary(days: DayHours[] | null, t: ReturnType<typeof useT>) {
  if (!days || days.length !== 7) return null
  const first = days[0]
  const uniform = days.every((d) => !d.closed && d.open === first.open && d.close === first.close)
  if (uniform) return { time: `${hhmm(first.open)} – ${hhmm(first.close)}`, note: t('everyDay') }
  const today = days[(new Date().getDay() + 6) % 7] // JS weeks start on Sunday, ours on Monday
  if (today.closed) return { time: t('closedToday'), note: '' }
  return { time: `${hhmm(today.open)} – ${hhmm(today.close)}`, note: t('today') }
}

function InfoCard({ restaurant, notify }: { restaurant: GuestMenu['restaurant']; notify: (text: string) => void }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const hours = hoursSummary(restaurant.opening_hours, t)
  const wifi = restaurant.wifi_name
  if (!wifi && !hours) return null

  async function copyPassword() {
    if (!restaurant.wifi_password) return
    try {
      await navigator.clipboard.writeText(restaurant.wifi_password)
      setCopied(true)
      notify(t('copied'))
    } catch {
      /* no clipboard over plain http: the password is on screen anyway */
    }
  }

  return (
    <div className="flex rounded-3xl bg-paper p-4 shadow-sm ring-1 ring-line" data-testid="info-card">
      {wifi && (
        <div className="min-w-0 flex-1 space-y-2 pr-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex size-8 items-center justify-center rounded-full bg-wine-soft text-wine">
              <WifiIcon className="size-4" />
            </span>
            {t('wifi')}
          </div>
          <div className="truncate rounded-lg bg-cream px-2.5 py-1 text-sm font-medium">{wifi}</div>
          {restaurant.wifi_password ? (
            <button
              onClick={copyPassword}
              className="flex max-w-full items-center gap-1.5 text-sm text-muted"
              aria-label={`${t('wifiPassword')}: ${restaurant.wifi_password}`}
            >
              <LockIcon className="size-4 shrink-0" />
              <span className="truncate font-medium text-ink">{restaurant.wifi_password}</span>
              <CopyIcon className={`size-3.5 shrink-0 ${copied ? 'text-jade' : ''}`} />
            </button>
          ) : (
            <div className="text-sm text-muted">{t('noPassword')}</div>
          )}
        </div>
      )}
      {wifi && hours && <div className="w-px bg-line" aria-hidden />}
      {hours && (
        <div className={`min-w-0 flex-1 space-y-2 ${wifi ? 'pl-3' : ''}`}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex size-8 items-center justify-center rounded-full bg-wine-soft text-wine">
              <ClockIcon className="size-4" />
            </span>
            {t('hours')}
          </div>
          <div className="font-serif text-lg font-bold lining-nums">{hours.time}</div>
          {hours.note && <div className="text-sm text-muted">{hours.note}</div>}
        </div>
      )}
    </div>
  )
}

import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { languageName } from '../../../shared/languages'
import { formatMoney } from '../../../shared/money'
import { useAnalytics, type Analytics, type ItemStat } from '../api/analytics'
import { input } from '../components/ui'
import { useContentLocale } from './menu/shared'

// One hue for every single-series chart; a light-to-dark ramp of the same hue for the heatmap.
// Colour never carries meaning alone: every mark has a label or a tooltip, and there is a table view.
const BAR = '#2a78d6'
const RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b']
const EMPTY_CELL = '#f1f5f9'

type Preset = '7' | '30' | '90' | 'custom'

function isoDaysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export default function AnalyticsPage() {
  const { t } = useTranslation()
  const [preset, setPreset] = useState<Preset>('30')
  const [custom, setCustom] = useState({ from: isoDaysAgo(13), to: isoDaysAgo(0) })
  // A preset sends only its start: the server ends the period "today" in the restaurant's time zone
  const analytics = useAnalytics(
    preset === 'custom' ? custom.from : isoDaysAgo(Number(preset) - 1),
    preset === 'custom' ? custom.to : null,
  )
  const data = analytics.data

  return (
    <div className="mx-auto max-w-7xl space-y-6" aria-busy={analytics.isFetching}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t('analytics.title')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm">
            {(['7', '30', '90', 'custom'] as Preset[]).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                aria-pressed={preset === p}
                className={`rounded-lg px-3 py-1.5 text-sm ${preset === p ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {t(`analytics.period.${p}`)}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              {t('analytics.from')}
              <input
                type="date"
                aria-label={t('analytics.from')}
                className={input.replace('w-full', 'w-auto')}
                value={custom.from}
                max={custom.to}
                onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })}
              />
              {t('analytics.to')}
              <input
                type="date"
                aria-label={t('analytics.to')}
                className={input.replace('w-full', 'w-auto')}
                value={custom.to}
                min={custom.from}
                onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>

      {!data ? (
        <p className="text-slate-500">{t('common.loading')}</p>
      ) : data.summary.orders === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
          {t('analytics.noData')}
        </div>
      ) : (
        <Report data={data} />
      )}
    </div>
  )
}

function Report({ data }: { data: Analytics }) {
  const { t } = useTranslation()
  const content = useContentLocale()
  const money = (v: number) => formatMoney(v, data.currency, content.lang)

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5" data-testid="kpis">
        <Kpi label={t('analytics.kpi.orders')} value={data.summary.orders.toLocaleString(content.lang)} />
        <Kpi label={t('analytics.kpi.revenue')} value={money(data.summary.revenue)} />
        <Kpi label={t('analytics.kpi.avgCheck')} value={money(data.summary.avg_check)} />
        <Kpi label={t('analytics.kpi.items')} value={data.summary.items.toLocaleString(content.lang)} />
        <Kpi label={t('analytics.kpi.visits')} value={data.summary.visits.toLocaleString(content.lang)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={t('analytics.byHour')} hint={t('analytics.byHourHint', { tz: data.timezone })}>
          <HourChart data={data} money={money} />
        </Card>
        <Card title={t('analytics.heatmap')} hint={t('analytics.heatmapHint')}>
          <Heatmap data={data} />
        </Card>
      </div>

      <Card title={t('analytics.dayparts')}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" data-testid="dayparts">
          {data.dayparts.map((part) => (
            <div key={part.key} className="rounded-xl bg-slate-50 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{t(`analytics.part.${part.key}`)}</span>
                <span className="text-xs text-slate-500 tabular-nums">
                  {String(part.from_hour).padStart(2, '0')}–{String(part.to_hour).padStart(2, '0')}
                </span>
              </div>
              <div className="mb-2 text-sm text-slate-500">{t('analytics.ordersN', { count: part.orders })}</div>
              <ItemBars items={part.top_items} compact />
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={t('analytics.topItems')}>
          <ItemBars items={data.top_items} money={money} />
        </Card>
        <Card title={t('analytics.languages')} hint={t('analytics.languagesHint')}>
          <Languages data={data} money={money} />
        </Card>
      </div>

      <Card title={t('analytics.byDay')}>
        <DayChart data={data} money={money} />
      </Card>
    </>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** Hover tooltip anchored above a mark. */
function Tip({ x, text }: { x: string; text: string }) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow"
      style={{ left: x }}
    >
      {text}
    </div>
  )
}

function HourChart({ data, money }: { data: Analytics; money: (v: number) => string }) {
  const { t } = useTranslation()
  const [hover, setHover] = useState<number | null>(null)
  const [asTable, setAsTable] = useState(false)
  // Show the working hours, trimmed to the first and last hour with orders
  const busy = data.by_hour.filter((h) => h.orders > 0)
  const first = busy[0]?.hour ?? 0
  const last = busy[busy.length - 1]?.hour ?? 23
  const hours = data.by_hour.filter((h) => h.hour >= first && h.hour <= last)
  const max = Math.max(...hours.map((h) => h.orders), 1)
  const peak = hours.reduce((a, b) => (b.orders > a.orders ? b : a), hours[0])
  const H = 180

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-600">
          {t('analytics.peak', {
            hour: String(peak.hour).padStart(2, '0'),
            next: String(peak.hour + 1).padStart(2, '0'),
          })}
        </span>
        <button className="text-blue-600 hover:underline" onClick={() => setAsTable(!asTable)}>
          {t(asTable ? 'analytics.showChart' : 'analytics.showTable')}
        </button>
      </div>
      {asTable ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-1 font-medium">{t('analytics.hour')}</th>
                <th className="py-1 text-right font-medium">{t('analytics.ordersCol')}</th>
                <th className="py-1 text-right font-medium">{t('analytics.revenueCol')}</th>
              </tr>
            </thead>
            <tbody>
              {hours.map((h) => (
                <tr key={h.hour} className="border-t border-slate-100">
                  <td className="py-1">{String(h.hour).padStart(2, '0')}:00</td>
                  <td className="py-1 text-right">{h.orders}</td>
                  <td className="py-1 text-right">{money(h.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative" data-testid="hour-chart" onMouseLeave={() => setHover(null)}>
          <div className="flex items-end gap-[2px] border-b border-slate-200" style={{ height: H }}>
            {hours.map((h) => (
              <button
                key={h.hour}
                type="button"
                className="group flex h-full flex-1 items-end focus:outline-none"
                onMouseEnter={() => setHover(h.hour)}
                onFocus={() => setHover(h.hour)}
                onBlur={() => setHover(null)}
                aria-label={t('analytics.tooltipHour', {
                  hour: String(h.hour).padStart(2, '0'),
                  orders: t('analytics.ordersN', { count: h.orders }),
                  revenue: money(h.revenue),
                })}
              >
                <span
                  className="w-full rounded-t-[4px] transition-opacity group-hover:opacity-80 group-focus-visible:ring-2 group-focus-visible:ring-blue-300"
                  style={{
                    height: `${(h.orders / max) * 100}%`,
                    minHeight: h.orders ? 2 : 0,
                    background: BAR,
                    opacity: hover === null || hover === h.hour ? 1 : 0.45,
                  }}
                />
              </button>
            ))}
          </div>
          <div className="mt-1 flex gap-[2px] text-[11px] text-slate-500 tabular-nums">
            {hours.map((h) => (
              <span key={h.hour} className="flex-1 text-center">
                {h.hour % 2 === first % 2 ? String(h.hour).padStart(2, '0') : ''}
              </span>
            ))}
          </div>
          {hover !== null && (
            <Tip
              x={`${((hours.findIndex((h) => h.hour === hover) + 0.5) / hours.length) * 100}%`}
              text={(() => {
                const h = data.by_hour[hover]
                return t('analytics.tooltipHour', {
                  hour: String(h.hour).padStart(2, '0'),
                  orders: t('analytics.ordersN', { count: h.orders }),
                  revenue: money(h.revenue),
                })
              })()}
            />
          )}
        </div>
      )}
    </div>
  )
}

function Heatmap({ data }: { data: Analytics }) {
  const { t } = useTranslation()
  const [hover, setHover] = useState<{ weekday: number; hour: number } | null>(null)
  const cells = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of data.heatmap) m.set(`${c.weekday}:${c.hour}`, c.orders)
    return m
  }, [data.heatmap])
  const hoursWithOrders = data.heatmap.map((c) => c.hour)
  const first = Math.min(...hoursWithOrders)
  const last = Math.max(...hoursWithOrders)
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i)
  const max = Math.max(...data.heatmap.map((c) => c.orders), 1)
  const color = (n: number) =>
    n === 0 ? EMPTY_CELL : RAMP[Math.min(RAMP.length - 1, Math.floor((n / max) * RAMP.length))]

  const hovered = hover && cells.get(`${hover.weekday}:${hover.hour}`)

  return (
    <div className="relative overflow-x-auto" data-testid="heatmap" onMouseLeave={() => setHover(null)}>
      <div
        className="grid min-w-[420px] gap-[2px]"
        style={{ gridTemplateColumns: `2.25rem repeat(${hours.length}, minmax(0, 1fr))` }}
      >
        {[1, 2, 3, 4, 5, 6, 7].map((weekday) => (
          <div key={weekday} className="contents">
            <div className="flex items-center text-xs text-slate-500">{t(`analytics.weekday.${weekday}`)}</div>
            {hours.map((hour) => {
              const n = cells.get(`${weekday}:${hour}`) ?? 0
              return (
                <div
                  key={hour}
                  className="aspect-square rounded-[3px]"
                  style={{
                    background: color(n),
                    outline: hover?.weekday === weekday && hover.hour === hour ? '2px solid #0f172a' : undefined,
                  }}
                  onMouseEnter={() => setHover({ weekday, hour })}
                  title={t('analytics.tooltipCell', {
                    day: t(`analytics.weekday.${weekday}`),
                    hour: String(hour).padStart(2, '0'),
                    orders: t('analytics.ordersN', { count: n }),
                  })}
                />
              )
            })}
          </div>
        ))}
        <div />
        {hours.map((hour) => (
          <div key={hour} className="text-center text-[11px] text-slate-500 tabular-nums">
            {hour % 3 === 0 ? String(hour).padStart(2, '0') : ''}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        0
        <div className="flex h-2.5 w-40 overflow-hidden rounded-full">
          {RAMP.map((c) => (
            <span key={c} className="flex-1" style={{ background: c }} />
          ))}
        </div>
        {max}
        {hover && (
          <span className="ml-auto text-slate-700">
            {t('analytics.tooltipCell', {
              day: t(`analytics.weekday.${hover.weekday}`),
              hour: String(hover.hour).padStart(2, '0'),
              orders: t('analytics.ordersN', { count: hovered ?? 0 }),
            })}
          </span>
        )}
      </div>
    </div>
  )
}

function ItemBars({
  items,
  money,
  compact = false,
}: {
  items: ItemStat[]
  money?: (v: number) => string
  compact?: boolean
}) {
  const { t } = useTranslation()
  const content = useContentLocale()
  const max = Math.max(...items.map((i) => i.quantity), 1)
  if (items.length === 0) return <p className="text-sm text-slate-400">—</p>

  return (
    <ol className={compact ? 'space-y-1.5' : 'space-y-2.5'}>
      {items.map((item, i) => (
        <li key={`${item.item_id}-${i}`} className="text-sm" data-testid="item-bar">
          <div className="flex items-baseline justify-between gap-2">
            <span className={`min-w-0 truncate ${compact ? 'text-xs' : ''}`} title={content.t(item.name)}>
              {content.t(item.name)}
            </span>
            <span className={`shrink-0 text-slate-500 tabular-nums ${compact ? 'text-xs' : ''}`}>
              {t('analytics.qty', { count: item.quantity })}
              {money && <span className="ml-2 text-slate-400">{money(item.revenue)}</span>}
            </span>
          </div>
          <div className={`mt-1 rounded-full bg-slate-100 ${compact ? 'h-1' : 'h-1.5'}`}>
            <div
              className="h-full rounded-full"
              style={{ width: `${(item.quantity / max) * 100}%`, background: BAR }}
            />
          </div>
        </li>
      ))}
    </ol>
  )
}

function Languages({ data, money }: { data: Analytics; money: (v: number) => string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState<string | null>(data.languages[0]?.language ?? null)

  return (
    <div className="space-y-2" data-testid="languages">
      {data.languages.map((lang) => {
        const code = lang.language ?? '—'
        const expanded = open === code
        return (
          <div key={code} className="rounded-xl border border-slate-100">
            <button
              className="w-full px-3 py-2.5 text-left"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : code)}
            >
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">
                  {lang.language ? languageName(lang.language) : t('analytics.unknownLanguage')}
                  {lang.language && <span className="ml-1.5 text-xs text-slate-400 uppercase">{lang.language}</span>}
                </span>
                <span className="text-slate-500 tabular-nums">
                  <b className="text-slate-900">{Math.round(lang.share * 100)}%</b> ·{' '}
                  {t('analytics.ordersN', { count: lang.orders })} · {money(lang.revenue)}
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-slate-100">
                <div className="h-full rounded-full" style={{ width: `${lang.share * 100}%`, background: BAR }} />
              </div>
            </button>
            {expanded && (
              <div className="border-t border-slate-100 px-3 py-2.5">
                <div className="mb-2 text-xs font-medium text-slate-500">{t('analytics.favorites')}</div>
                <ItemBars items={lang.top_items} compact />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function DayChart({ data, money }: { data: Analytics; money: (v: number) => string }) {
  const { t, i18n } = useTranslation()
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...data.by_day.map((d) => d.orders), 1)
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })
  const labelEvery = Math.ceil(data.by_day.length / 10)

  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <div className="flex h-36 items-end gap-[2px] border-b border-slate-200">
        {data.by_day.map((d, i) => (
          <button
            key={d.date}
            type="button"
            className="flex h-full flex-1 items-end focus:outline-none"
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            aria-label={t('analytics.tooltipDay', {
              date: fmt(d.date),
              orders: t('analytics.ordersN', { count: d.orders }),
              revenue: money(d.revenue),
            })}
          >
            <span
              className="w-full rounded-t-[4px]"
              style={{
                height: `${(d.orders / max) * 100}%`,
                minHeight: d.orders ? 2 : 0,
                background: BAR,
                opacity: hover === null || hover === i ? 1 : 0.45,
              }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] text-[11px] text-slate-500">
        {data.by_day.map((d, i) => (
          <span key={d.date} className="flex-1 overflow-visible text-center whitespace-nowrap">
            {i % labelEvery === 0 ? fmt(d.date) : ''}
          </span>
        ))}
      </div>
      {hover !== null && (
        <Tip
          x={`${((hover + 0.5) / data.by_day.length) * 100}%`}
          text={t('analytics.tooltipDay', {
            date: fmt(data.by_day[hover].date),
            orders: t('analytics.ordersN', { count: data.by_day[hover].orders }),
            revenue: money(data.by_day[hover].revenue),
          })}
        />
      )}
    </div>
  )
}

import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  ConciergeBell,
  Moon,
  MoonStar,
  ReceiptText,
  ShoppingBag,
  Sun,
  Sunrise,
  Table2,
  TrendingDown,
  TrendingUp,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { languageName } from '../../../shared/languages'
import { formatMoney } from '../../../shared/money'
import { useAnalytics, type Analytics, type ItemStat } from '../api/analytics'
import { input } from '../components/ui'
import { useContentLocale } from './menu/shared'

// One blue for every single-series chart (the peak hour a step darker); a light-to-dark ramp of
// the same hue for the heatmap. Colour never carries meaning alone: every mark has a label or a
// tooltip, and the hour chart has a table view.
const BAR = '#5d86f1'
const BAR_TOP = '#7fa0f6'
const PEAK = '#3461eb'
const RAMP = ['#dfe8fd', '#bccffb', '#94b1f7', '#6a8ff1', '#4570e6', '#2c55cc', '#1c3d9e']
const EMPTY_CELL = '#f1f5f9'

type Preset = '7' | '30' | '90' | 'custom'

const pad = (n: number) => String(n).padStart(2, '0')

function isoDaysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/** 0 and 3–4 round steps up to at least `max`: 0, 15, 30, 45, 60. */
function niceTicks(max: number, count = 4) {
  const raw = Math.max(max, 1) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = ([1, 1.5, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag
  const top = Math.ceil(Math.max(max, 1) / step) * step
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
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
    <div className="mx-auto max-w-7xl space-y-5" aria-busy={analytics.isFetching}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('analytics.title')}</h1>
          <p className="mt-1 text-slate-500">{t('analytics.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {(['7', '30', '90', 'custom'] as Preset[]).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                aria-pressed={preset === p}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  preset === p ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t(`analytics.period.${p}`)}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPreset('custom')}
            aria-label={t('analytics.chooseDates')}
            title={t('analytics.chooseDates')}
            className="flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <CalendarDays className="size-5" />
          </button>
        </div>
      </div>

      {preset === 'custom' && (
        <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-slate-600">
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

      {!data ? (
        <p className="text-slate-500">{t('common.loading')}</p>
      ) : data.summary.orders === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
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
  const num = (v: number) => v.toLocaleString(content.lang)
  const s = data.summary
  const p = data.previous
  const days = data.by_day.length

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5" data-testid="kpis">
        <Kpi
          icon={ShoppingBag}
          tone="bg-violet-50 text-violet-600"
          label={t('analytics.kpi.orders')}
          value={num(s.orders)}
          now={s.orders}
          before={p.orders}
          days={days}
        />
        <Kpi
          icon={CircleDollarSign}
          tone="bg-emerald-50 text-emerald-600"
          label={t('analytics.kpi.revenue')}
          value={money(s.revenue)}
          now={s.revenue}
          before={p.revenue}
          days={days}
        />
        <Kpi
          icon={ReceiptText}
          tone="bg-orange-50 text-orange-500"
          label={t('analytics.kpi.avgCheck')}
          value={money(s.avg_check)}
          now={s.avg_check}
          before={p.avg_check}
          days={days}
        />
        <Kpi
          icon={ConciergeBell}
          tone="bg-rose-50 text-rose-500"
          label={t('analytics.kpi.items')}
          value={num(s.items)}
          now={s.items}
          before={p.items}
          days={days}
        />
        <Kpi
          icon={Users}
          tone="bg-sky-50 text-sky-600"
          label={t('analytics.kpi.visits')}
          value={num(s.visits)}
          now={s.visits}
          before={p.visits}
          days={days}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
        <HourChart data={data} money={money} />
        <Card title={t('analytics.heatmap')} hint={t('analytics.heatmapHint')}>
          <Heatmap data={data} />
        </Card>
      </div>

      <Card title={t('analytics.dayparts')}>
        <Dayparts data={data} />
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title={t('analytics.topItems')}>
          <TopItems items={data.top_items} money={money} />
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

function Kpi({
  icon: Icon,
  tone,
  label,
  value,
  now,
  before,
  days,
}: {
  icon: LucideIcon
  tone: string
  label: string
  value: string
  now: number
  before: number
  days: number
}) {
  const { t } = useTranslation()
  const change = before > 0 ? Math.round(((now - before) / before) * 100) : null
  const up = (change ?? 0) >= 0
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="size-6" />
        </span>
        <div className="text-sm text-slate-500">{label}</div>
      </div>
      <div className="mt-3 text-2xl font-bold whitespace-nowrap tabular-nums" title={value}>
        {value}
      </div>
      {change !== null && (
        <div
          className={`mt-2 flex flex-wrap items-center gap-1 text-sm font-semibold ${up ? 'text-emerald-600' : 'text-rose-600'}`}
          title={t('analytics.vsPrevious', { count: days })}
          data-testid="kpi-change"
        >
          {up ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
          {Math.abs(change)}%
          <span className="font-normal text-slate-400">{t('analytics.vsPrevious', { count: days })}</span>
        </div>
      )}
    </div>
  )
}

function Card({
  title,
  hint,
  aside,
  children,
}: {
  title: string
  hint?: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}
        </div>
        {aside}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

/** Hover card anchored above a mark: a muted heading and the value next to the series dot. */
function Tip({ style, title, lines }: { style: React.CSSProperties; title: string; lines: string[] }) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs whitespace-nowrap shadow-lg"
      style={style}
    >
      <div className="text-slate-500">{title}</div>
      {lines.map((line, i) => (
        <div
          key={line}
          className={`flex items-center gap-1.5 ${i === 0 ? 'font-semibold text-slate-900' : 'text-slate-600'}`}
        >
          {i === 0 && <span className="size-2 rounded-full" style={{ background: PEAK }} />}
          {line}
        </div>
      ))}
    </div>
  )
}

/** Above a short bar; beside a tall one, so the card never runs into the title above the chart. */
function tipPosition(index: number, count: number, share: number): React.CSSProperties {
  const center = ((index + 0.5) / count) * 100
  if (share < 0.7) return { left: `${center}%`, bottom: `calc(${share * 100}% + 10px)`, transform: 'translateX(-50%)' }
  const half = 50 / count // half a bar, in %
  const bottom = `max(0px, calc(${share * 100}% - 64px))`
  return index < count / 2
    ? { left: `calc(${center + half}% + 6px)`, bottom }
    : { left: `calc(${center - half}% - 6px)`, bottom, transform: 'translateX(-100%)' }
}

/** Vertical bars with a light grid, y ticks and a hover card; shared by the hour and day charts. */
function BarChart({
  bars,
  height,
  label,
  highlight,
  tip,
  testId,
}: {
  bars: { key: string; value: number; label: string }[]
  height: number
  label: (i: number) => string // aria label of a bar
  highlight?: number // index drawn darker (the peak)
  tip: (i: number) => { title: string; lines: string[] }
  testId?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const ticks = niceTicks(Math.max(...bars.map((b) => b.value)))
  const top = ticks[ticks.length - 1]
  const shown = hover

  return (
    <div className="flex gap-2" data-testid={testId}>
      <div className="relative w-7 shrink-0 text-right text-[11px] text-slate-400 tabular-nums" style={{ height }}>
        {ticks.map((v) => (
          <span key={v} className="absolute right-0 translate-y-1/2" style={{ bottom: `${(v / top) * 100}%` }}>
            {v}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height }} onMouseLeave={() => setHover(null)}>
          {ticks.map((v) => (
            <div
              key={v}
              className={`absolute inset-x-0 border-t ${v === 0 ? 'border-slate-200' : 'border-dashed border-slate-100'}`}
              style={{ bottom: `${(v / top) * 100}%` }}
            />
          ))}
          <div className="absolute inset-0 flex items-end gap-[4px] px-0.5">
            {bars.map((b, i) => {
              const peak = i === highlight
              return (
                <button
                  key={b.key}
                  type="button"
                  className="group flex h-full flex-1 items-end focus:outline-none"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={label(i)}
                >
                  <span
                    className="w-full rounded-t-[5px] transition-opacity group-focus-visible:ring-2 group-focus-visible:ring-blue-300"
                    style={{
                      height: `${(b.value / top) * 100}%`,
                      minHeight: b.value ? 2 : 0,
                      background: peak
                        ? `linear-gradient(to top, ${PEAK}, #5b82f2)`
                        : `linear-gradient(to top, ${BAR}, ${BAR_TOP})`,
                      opacity: shown === null || shown === i ? 1 : 0.5,
                    }}
                  />
                </button>
              )
            })}
          </div>
          {shown !== null && <Tip style={tipPosition(shown, bars.length, bars[shown].value / top)} {...tip(shown)} />}
        </div>
        <div className="mt-2 flex gap-[4px] px-0.5 text-[11px] text-slate-500 tabular-nums">
          {bars.map((b) => (
            <span key={b.key} className="flex-1 overflow-visible text-center whitespace-nowrap">
              {b.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function HourChart({ data, money }: { data: Analytics; money: (v: number) => string }) {
  const { t } = useTranslation()
  const [asTable, setAsTable] = useState(false)
  // Show the working hours, trimmed to the first and last hour with orders
  const busy = data.by_hour.filter((h) => h.orders > 0)
  const first = busy[0]?.hour ?? 0
  const last = busy[busy.length - 1]?.hour ?? 23
  const hours = data.by_hour.filter((h) => h.hour >= first && h.hour <= last)
  const peakIndex = hours.reduce((best, h, i) => (h.orders > hours[best].orders ? i : best), 0)
  const peak = hours[peakIndex]
  const orders = (n: number) => t('analytics.ordersN', { count: n })

  return (
    <Card
      title={t('analytics.byHour')}
      hint={t('analytics.byHourHint', { tz: data.timezone })}
      aside={
        <div className="flex shrink-0 items-center gap-2 text-sm text-slate-600">
          {t('analytics.peak', { hour: pad(peak.hour), next: pad((peak.hour + 1) % 24) })}
          <button
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            onClick={() => setAsTable(!asTable)}
            aria-label={t(asTable ? 'analytics.showChart' : 'analytics.showTable')}
            title={t(asTable ? 'analytics.showChart' : 'analytics.showTable')}
          >
            {asTable ? <BarChart3 className="size-4" /> : <Table2 className="size-4" />}
          </button>
        </div>
      }
    >
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
                  <td className="py-1">{pad(h.hour)}:00</td>
                  <td className="py-1 text-right">{h.orders}</td>
                  <td className="py-1 text-right">{money(h.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <BarChart
          testId="hour-chart"
          height={190}
          highlight={peakIndex}
          bars={hours.map((h) => ({ key: String(h.hour), value: h.orders, label: pad(h.hour) }))}
          label={(i) =>
            t('analytics.tooltipHour', {
              hour: pad(hours[i].hour),
              orders: orders(hours[i].orders),
              revenue: money(hours[i].revenue),
            })
          }
          tip={(i) => ({
            title: `${pad(hours[i].hour)}:00`,
            lines: [orders(hours[i].orders), money(hours[i].revenue)],
          })}
        />
      )}
    </Card>
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
  const hovered = hover && (cells.get(`${hover.weekday}:${hover.hour}`) ?? 0)

  return (
    <div className="overflow-x-auto" data-testid="heatmap" onMouseLeave={() => setHover(null)}>
      <div
        className="grid min-w-[420px] gap-[3px]"
        style={{ gridTemplateColumns: `2rem repeat(${hours.length}, minmax(0, 1fr))` }}
      >
        {[1, 2, 3, 4, 5, 6, 7].map((weekday) => (
          <div key={weekday} className="contents">
            <div className="flex items-center text-xs text-slate-500">{t(`analytics.weekday.${weekday}`)}</div>
            {hours.map((hour) => {
              const n = cells.get(`${weekday}:${hour}`) ?? 0
              const active = hover?.weekday === weekday && hover.hour === hour
              return (
                <div
                  key={hour}
                  className="h-[22px] rounded-[4px] transition-transform"
                  style={{
                    background: color(n),
                    outline: active ? '2px solid #0f172a' : undefined,
                    outlineOffset: 1,
                  }}
                  onMouseEnter={() => setHover({ weekday, hour })}
                  title={t('analytics.tooltipCell', {
                    day: t(`analytics.weekday.${weekday}`),
                    hour: pad(hour),
                    orders: t('analytics.ordersN', { count: n }),
                  })}
                />
              )
            })}
          </div>
        ))}
        <div />
        {hours.map((hour) => (
          <div key={hour} className="pt-1 text-center text-[11px] text-slate-500 tabular-nums">
            {hour % 3 === 0 ? pad(hour) : ''}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        0
        <div className="flex h-2.5 w-44 gap-[2px] overflow-hidden rounded-full">
          {RAMP.map((c) => (
            <span key={c} className="flex-1" style={{ background: c }} />
          ))}
        </div>
        {max}
        {hover && (
          <span className="ml-auto font-medium text-slate-700">
            {t('analytics.tooltipCell', {
              day: t(`analytics.weekday.${hover.weekday}`),
              hour: pad(hover.hour),
              orders: t('analytics.ordersN', { count: hovered ?? 0 }),
            })}
          </span>
        )}
      </div>
    </div>
  )
}

const PART_ICONS: Record<string, { icon: LucideIcon; tone: string }> = {
  morning: { icon: Sunrise, tone: 'bg-amber-50 text-amber-500' },
  lunch: { icon: UtensilsCrossed, tone: 'bg-indigo-50 text-indigo-500' },
  afternoon: { icon: Sun, tone: 'bg-orange-50 text-orange-500' },
  evening: { icon: Moon, tone: 'bg-blue-50 text-blue-600' },
  night: { icon: MoonStar, tone: 'bg-slate-100 text-slate-600' },
}

function Dayparts({ data }: { data: Analytics }) {
  const { t } = useTranslation()
  const content = useContentLocale()
  // The night only when the restaurant actually serves at night
  const parts = data.dayparts.filter((p) => p.key !== 'night' || p.orders > 0)
  return (
    <div
      className={`grid gap-4 md:grid-cols-2 ${parts.length > 4 ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}
      data-testid="dayparts"
    >
      {parts.map((part) => {
        const { icon: Icon, tone } = PART_ICONS[part.key] ?? PART_ICONS.night
        const items = part.top_items.slice(0, 3)
        const max = Math.max(...items.map((i) => i.quantity), 1)
        return (
          <div key={part.key} className="rounded-2xl bg-slate-50/80 p-4">
            <div className="mb-4 flex items-start gap-3">
              <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                <Icon className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-bold">{t(`analytics.part.${part.key}`)}</div>
                <div className="text-sm text-slate-500 tabular-nums">
                  {pad(part.from_hour)}–{pad(part.to_hour)}
                </div>
              </div>
              <span className="shrink-0 text-sm text-slate-500">{t('analytics.ordersN', { count: part.orders })}</span>
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-slate-400">—</p>
            ) : (
              <ol className="space-y-3">
                {items.map((item, i) => (
                  <li key={`${item.item_id}-${i}`} className="flex items-center gap-3" data-testid="item-bar">
                    <Thumb url={item.image_url} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate" title={content.t(item.name)}>
                          {content.t(item.name)}
                        </span>
                        <span className="shrink-0 text-slate-500 tabular-nums">
                          {t('analytics.qty', { count: item.quantity })}
                        </span>
                      </div>
                      <Meter value={item.quantity / max} thin />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Thumb({ url }: { url: string | null }) {
  return (
    <span className="size-10 shrink-0 overflow-hidden rounded-lg bg-slate-200">
      {url && <img src={url} alt="" loading="lazy" className="size-full object-cover" />}
    </span>
  )
}

function Meter({ value, thin = false }: { value: number; thin?: boolean }) {
  return (
    <div className={`mt-1.5 rounded-full bg-slate-100 ${thin ? 'h-1.5' : 'h-2'}`}>
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(value * 100, 2)}%`, background: `linear-gradient(to right, ${PEAK}, ${BAR})` }}
      />
    </div>
  )
}

function TopItems({ items, money }: { items: ItemStat[]; money: (v: number) => string }) {
  const { t } = useTranslation()
  const content = useContentLocale()
  const max = Math.max(...items.map((i) => i.quantity), 1)
  if (items.length === 0) return <p className="text-sm text-slate-400">—</p>
  return (
    <ol className="divide-y divide-slate-100">
      {items.map((item, i) => (
        <li key={`${item.item_id}-${i}`} className="flex items-center gap-4 py-2.5" data-testid="item-bar">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-600 tabular-nums">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate" title={content.t(item.name)}>
              {content.t(item.name)}
            </div>
            <Meter value={item.quantity / max} />
          </div>
          <div className="w-32 shrink-0 text-right tabular-nums">
            <div className="font-semibold">{t('analytics.qty', { count: item.quantity })}</div>
            <div className="text-xs text-slate-400">{money(item.revenue)}</div>
          </div>
        </li>
      ))}
    </ol>
  )
}

// Flags as emoji: no image files, and each language is also named in words
const FLAGS: Record<string, string> = { vi: '🇻🇳', en: '🇬🇧', ru: '🇷🇺', ja: '🇯🇵', ko: '🇰🇷', zh: '🇨🇳' }

function Languages({ data, money }: { data: Analytics; money: (v: number) => string }) {
  const { t } = useTranslation()
  const content = useContentLocale()
  const [open, setOpen] = useState<string | null>(data.languages[0]?.language ?? null)

  return (
    <div className="space-y-2.5" data-testid="languages">
      {data.languages.map((lang) => {
        const code = lang.language ?? '—'
        const expanded = open === code
        const max = Math.max(...lang.top_items.map((i) => i.quantity), 1)
        return (
          <div
            key={code}
            className={`rounded-2xl border transition-colors ${expanded ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200'}`}
          >
            <button
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : code)}
            >
              <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xl leading-none">
                {FLAGS[code] ?? '🌐'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                  <span className="font-semibold">
                    {lang.language ? languageName(lang.language) : t('analytics.unknownLanguage')}
                    {lang.language && (
                      <span className="ml-2 text-xs font-normal text-slate-400 uppercase">{lang.language}</span>
                    )}
                  </span>
                  <span className="text-slate-500 tabular-nums">
                    <b className="text-base text-slate-900">{Math.round(lang.share * 100)}%</b> ·{' '}
                    {t('analytics.ordersN', { count: lang.orders })} · {money(lang.revenue)}
                  </span>
                </span>
                <Meter value={lang.share} />
              </span>
              <ChevronDown
                className={`size-5 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
            {expanded && (
              <div className="mx-4 mb-4 rounded-xl bg-white/80 px-4 py-3">
                <div className="mb-2 text-xs font-medium text-slate-500">{t('analytics.favorites')}</div>
                <ol className="space-y-2.5">
                  {lang.top_items.map((item, i) => (
                    <li key={`${item.item_id}-${i}`} className="text-sm" data-testid="item-bar">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate">{content.t(item.name)}</span>
                        <span className="shrink-0 text-slate-500 tabular-nums">
                          {t('analytics.qty', { count: item.quantity })}
                        </span>
                      </div>
                      <Meter value={item.quantity / max} thin />
                    </li>
                  ))}
                </ol>
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
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })
  const labelEvery = Math.ceil(data.by_day.length / 10)
  const orders = (n: number) => t('analytics.ordersN', { count: n })

  return (
    <BarChart
      height={150}
      bars={data.by_day.map((d, i) => ({
        key: d.date,
        value: d.orders,
        label: i % labelEvery === 0 ? fmt(d.date) : '',
      }))}
      label={(i) =>
        t('analytics.tooltipDay', {
          date: fmt(data.by_day[i].date),
          orders: orders(data.by_day[i].orders),
          revenue: money(data.by_day[i].revenue),
        })
      }
      tip={(i) => ({
        title: fmt(data.by_day[i].date),
        lines: [orders(data.by_day[i].orders), money(data.by_day[i].revenue)],
      })}
    />
  )
}

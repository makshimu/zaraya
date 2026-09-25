import { useContext } from 'react'

import { tr } from '../../../shared/localized'
import { formatMoney } from '../../../shared/money'
import { LangContext, useT } from '../i18n'
import type { GuestOrder, OrderStatus } from '../types'
import Sheet from './Sheet'

const STEPS: OrderStatus[] = ['accepted', 'cooking', 'served']

/** The guest's orders of this visit with live status. */
export default function OrdersSheet({
  orders,
  currency,
  fallbackLang,
  onClose,
}: {
  orders: GuestOrder[]
  currency: string
  fallbackLang: string
  onClose: () => void
}) {
  const t = useT()
  const { lang } = useContext(LangContext)
  const l = (v: Record<string, string>) => tr(v, lang, fallbackLang)
  const time = (iso: string) => new Date(iso).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })

  return (
    <Sheet label={t('myOrders')} title={t('myOrders')} onClose={onClose}>
      <div className="space-y-4 p-5">
        {orders.length === 0 && <p className="py-6 text-center text-slate-500">{t('noOrders')}</p>}
        {orders.map((order) => (
          <article key={order.id} data-testid="order" className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="font-semibold">{t('orderNo', { id: order.id })}</span>
              <span className="text-sm text-slate-500">{time(order.created_at)}</span>
            </div>
            <StatusTrack status={order.status} />
            <ul className="mt-3 space-y-1 text-sm">
              {order.items.map((line) => (
                <li key={line.id} className="flex justify-between gap-3">
                  <span>
                    {line.quantity} × {l(line.name)}
                    {l(line.price_name) && `, ${l(line.price_name)}`}
                    {line.modifiers.length > 0 && (
                      <span className="text-slate-500"> + {line.modifiers.map((m) => l(m.name)).join(', ')}</span>
                    )}
                  </span>
                  <span className="shrink-0">{formatMoney(line.total, currency, lang)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 font-semibold">
              <span>{t('total')}</span>
              <span>{formatMoney(order.total, currency, lang)}</span>
            </div>
          </article>
        ))}
      </div>
    </Sheet>
  )
}

function StatusTrack({ status }: { status: OrderStatus }) {
  const t = useT()
  if (status === 'rejected' || status === 'pending' || status === 'closed') {
    const tone = {
      rejected: 'bg-red-50 text-red-700',
      pending: 'bg-amber-50 text-amber-900',
      closed: 'bg-slate-100 text-slate-600',
    }[status]
    return (
      <div data-testid="order-status" className={`rounded-xl px-3 py-2 text-sm font-medium ${tone}`}>
        {t(`status.${status}`)}
      </div>
    )
  }
  const reached = STEPS.indexOf(status)
  return (
    <ol className="grid grid-cols-3 gap-1" data-testid="order-status" data-status={status}>
      {STEPS.map((step, i) => (
        <li key={step} className="text-center text-xs">
          <div className={`mb-1 h-1.5 rounded-full ${i <= reached ? 'bg-green-500' : 'bg-slate-200'}`} />
          <span className={i === reached ? 'font-semibold text-slate-900' : 'text-slate-400'}>
            {t(`status.${step}`)}
          </span>
        </li>
      ))}
    </ol>
  )
}

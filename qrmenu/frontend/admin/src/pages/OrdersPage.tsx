import { Minus, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatMoney } from '../../../shared/money'
import { useEditItems, useOrders, useSetStatus, type OrderFilters } from '../api/orders'
import { useTables } from '../api/tables'
import {
  ACTIVE_STATUSES,
  EDITABLE_STATUSES,
  NEXT_STATUSES,
  ORDER_STATUSES,
  type Order,
  type OrderStatus,
} from '../api/types'
import { btn, input } from '../components/ui'
import { useContentLocale, useErrorText } from './menu/shared'

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  accepted: 'bg-blue-100 text-blue-800',
  cooking: 'bg-violet-100 text-violet-800',
  served: 'bg-green-100 text-green-800',
  closed: 'bg-slate-100 text-slate-600',
  rejected: 'bg-red-100 text-red-700',
}

type StatusFilter = 'active' | 'all' | OrderStatus

export default function OrdersPage() {
  const { t } = useTranslation()
  const tables = useTables()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [tableId, setTableId] = useState<number | null>(null)
  const [date, setDate] = useState<string | null>(null)

  const filters: OrderFilters = {
    statuses: statusFilter === 'active' ? ACTIVE_STATUSES : statusFilter === 'all' ? [] : [statusFilter],
    tableId,
    date,
  }
  const orders = useOrders(filters)

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-3xl font-semibold">{t('orders.title')}</h1>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl bg-white p-1 shadow-sm">
          {(['active', ...ORDER_STATUSES, 'all'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-sm ${statusFilter === s ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {t(`orders.filter.${s}`)}
            </button>
          ))}
        </div>
        <select
          aria-label={t('orders.table')}
          className={input.replace('w-full', 'w-auto')}
          value={tableId ?? ''}
          onChange={(e) => setTableId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">{t('orders.allTables')}</option>
          {tables.data?.map((table) => (
            <option key={table.id} value={table.id}>
              {t('orders.tableN', { number: table.number })}
            </option>
          ))}
        </select>
        <input
          type="date"
          aria-label={t('orders.date')}
          className={input.replace('w-full', 'w-auto')}
          value={date ?? ''}
          onChange={(e) => setDate(e.target.value || null)}
        />
      </div>

      {orders.isLoading && <p className="text-slate-500">{t('common.loading')}</p>}
      {orders.data?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
          {t('orders.empty')}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {orders.data?.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>
    </div>
  )
}

function OrderCard({ order }: { order: Order }) {
  const { t } = useTranslation()
  const content = useContentLocale()
  const errorText = useErrorText()
  const setStatus = useSetStatus()
  const editItems = useEditItems()
  const [editing, setEditing] = useState<Record<number, number> | null>(null)
  const money = (amount: number) => formatMoney(amount, content.currency, content.lang)
  const time = new Date(order.created_at).toLocaleTimeString(content.lang, { hour: '2-digit', minute: '2-digit' })
  const editable = EDITABLE_STATUSES.includes(order.status)

  function saveEdit() {
    if (!editing) return
    const items = Object.entries(editing).map(([id, quantity]) => ({ id: Number(id), quantity }))
    editItems.mutate({ id: order.id, items }, { onSuccess: () => setEditing(null) })
  }

  const error = setStatus.error ?? editItems.error

  return (
    <article
      data-testid="order-card"
      className={`flex flex-col rounded-2xl border bg-white p-4 ${order.status === 'pending' ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'}`}
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-xl font-semibold">{t('orders.tableN', { number: order.table_number })}</div>
          <div className="text-sm text-slate-500">
            №{order.id} · {time}
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[order.status]}`}>
          {t(`orders.status.${order.status}`)}
        </span>
      </header>

      <ul className="flex-1 space-y-2 text-sm">
        {order.items
          .filter((line) => !editing || line.id in editing)
          .map((line) => (
            <li key={line.id} className="flex gap-2">
              {editing ? (
                <span className="flex items-center gap-1">
                  <button
                    className={btn.icon}
                    aria-label={t('orders.decrease')}
                    disabled={editing[line.id] <= 1}
                    onClick={() => setEditing({ ...editing, [line.id]: editing[line.id] - 1 })}
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-5 text-center font-semibold">{editing[line.id]}</span>
                  <button
                    className={btn.icon}
                    aria-label={t('orders.increase')}
                    onClick={() => setEditing({ ...editing, [line.id]: Math.min(99, editing[line.id] + 1) })}
                  >
                    <Plus className="size-3.5" />
                  </button>
                </span>
              ) : (
                <span className="w-6 shrink-0 font-semibold">{line.quantity}×</span>
              )}
              <div className="min-w-0 flex-1">
                <div>
                  {content.t(line.name)}
                  {content.t(line.price_name) && (
                    <span className="text-slate-500"> · {content.t(line.price_name)}</span>
                  )}
                </div>
                {line.modifiers.length > 0 && (
                  <div className="text-slate-500">+ {line.modifiers.map((m) => content.t(m.name)).join(', ')}</div>
                )}
                {line.comment && <div className="text-amber-700 italic">«{line.comment}»</div>}
              </div>
              {editing ? (
                <button
                  className={btn.icon}
                  aria-label={t('common.delete')}
                  disabled={Object.keys(editing).length <= 1}
                  onClick={() => {
                    const next = { ...editing }
                    delete next[line.id]
                    setEditing(next)
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              ) : (
                <span className="shrink-0 text-slate-600">{money(line.total)}</span>
              )}
            </li>
          ))}
      </ul>

      {order.comment && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">«{order.comment}»</p>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="font-semibold">{money(order.total)}</span>
        {order.updated_by && <span className="text-xs text-slate-500">{order.updated_by}</span>}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{errorText(error)}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {editing ? (
          <>
            <button className={btn.primary} disabled={editItems.isPending} onClick={saveEdit}>
              {t('common.save')}
            </button>
            <button className={btn.secondary} onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </button>
          </>
        ) : (
          <>
            {NEXT_STATUSES[order.status].map((next) => (
              <button
                key={next}
                disabled={setStatus.isPending}
                className={next === 'rejected' ? btn.danger : btn.primary}
                onClick={() =>
                  (next !== 'rejected' || confirm(t('orders.confirmReject', { id: order.id }))) &&
                  setStatus.mutate({ id: order.id, status: next })
                }
              >
                {t(`orders.action.${next}`)}
              </button>
            ))}
            {editable && (
              <button
                className={btn.secondary}
                onClick={() => setEditing(Object.fromEntries(order.items.map((i) => [i.id, i.quantity])))}
              >
                <Pencil className="size-4" /> {t('common.edit')}
              </button>
            )}
          </>
        )}
      </div>
    </article>
  )
}

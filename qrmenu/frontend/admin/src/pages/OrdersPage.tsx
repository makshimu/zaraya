import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useOrders, type OrderFilters } from '../api/orders'
import { useTables } from '../api/tables'
import { ACTIVE_STATUSES, ORDER_STATUSES, type OrderStatus } from '../api/types'
import OrderCard from '../components/OrderCard'
import { input } from '../components/ui'

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

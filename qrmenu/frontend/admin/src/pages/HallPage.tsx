import { Bell, DoorClosed, DoorOpen, Receipt, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatMoney } from '../../../shared/money'
import { useCloseTable, useHall, useOpenCalls, useOpenTable, useTakeCall, useVisit } from '../api/hall'
import { useOrders, useSetStatus } from '../api/orders'
import { useHalls } from '../api/tables'
import type { HallTable, StaffCall, TableState } from '../api/types'
import Modal from '../components/Modal'
import OrderCard from '../components/OrderCard'
import { btn } from '../components/ui'
import { useContentLocale, useErrorText } from './menu/shared'

const TILE: Record<TableState, string> = {
  bill: 'border-orange-400 bg-orange-50 ring-4 ring-orange-200',
  waiter: 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-200',
  new_order: 'border-amber-400 bg-amber-50',
  occupied: 'border-blue-300 bg-blue-50',
  free: 'border-slate-200 bg-white',
}
const DOT: Record<TableState, string> = {
  bill: 'bg-orange-500',
  waiter: 'bg-emerald-500',
  new_order: 'bg-amber-400',
  occupied: 'bg-blue-400',
  free: 'bg-slate-300',
}
const LEGEND: TableState[] = ['free', 'occupied', 'new_order', 'waiter', 'bill']

/** "3 min ago", refreshed every half minute. */
function useAgo() {
  const { t } = useTranslation()
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(timer)
  }, [])
  return (iso: string) => {
    const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
    return minutes < 1 ? t('hall.justNow') : t('hall.minutesAgo', { count: minutes })
  }
}

export default function HallPage() {
  const { t } = useTranslation()
  const hall = useHall()
  const halls = useHalls()
  const [hallId, setHallId] = useState<number | 'all'>('all')
  const [openTableId, setOpenTableId] = useState<number | null>(null)

  const tables = (hall.data ?? []).filter((x) => hallId === 'all' || x.hall_id === hallId)

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 xl:flex-row">
      <div className="min-w-0 flex-1">
        <h1 className="mb-4 text-3xl font-semibold">{t('hall.title')}</h1>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {(halls.data?.length ?? 0) > 1 ? (
            <div className="flex flex-wrap gap-1 rounded-xl bg-white p-1 shadow-sm">
              {[{ id: 'all' as const, name: t('hall.allHalls') }, ...(halls.data ?? [])].map((h) => (
                <button
                  key={h.id}
                  onClick={() => setHallId(h.id)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${hallId === h.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {h.name}
                </button>
              ))}
            </div>
          ) : (
            <span />
          )}
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            {LEGEND.map((state) => (
              <li key={state} className="flex items-center gap-1.5">
                <span className={`size-2.5 rounded-full ${DOT[state]}`} />
                {t(`hall.state.${state}`)}
              </li>
            ))}
          </ul>
        </div>

        {hall.isLoading && <p className="text-slate-500">{t('common.loading')}</p>}
        {hall.data?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
            {t('hall.noTables')}
          </div>
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-4">
          {tables.map((table) => (
            <TableTile key={table.id} table={table} onClick={() => setOpenTableId(table.id)} />
          ))}
        </div>
      </div>

      <aside className="xl:w-96 xl:shrink-0">
        <EventFeed onOpenTable={setOpenTableId} />
      </aside>

      {openTableId !== null && <TableDetails tableId={openTableId} onClose={() => setOpenTableId(null)} />}
    </div>
  )
}

function TableTile({ table, onClick }: { table: HallTable; onClick: () => void }) {
  const { t } = useTranslation()
  const content = useContentLocale()
  const bill = table.open_calls.find((c) => c.type === 'bill')

  return (
    <button
      onClick={onClick}
      data-testid="hall-table"
      data-state={table.state}
      className={`flex min-h-32 flex-col rounded-2xl border-2 p-3 text-left transition-shadow hover:shadow-md ${TILE[table.state]} ${table.is_active ? '' : 'opacity-50'}`}
    >
      <div className="flex items-start justify-between">
        <span className="text-2xl font-bold">{table.number}</span>
        {table.opened_at && <DoorOpen className="size-4 text-slate-500" aria-label={t('hall.opened')} />}
      </div>
      <div className="mt-auto space-y-0.5 text-sm">
        <div className="font-medium">
          {t(`hall.state.${table.state}`)}
          {bill?.payment_method && ` · ${t(`hall.pay.${bill.payment_method}`)}`}
        </div>
        {table.state !== 'free' && (
          <div className="flex items-center gap-2 text-slate-600">
            <span className="flex items-center gap-1">
              <Users className="size-3.5" /> {table.guests}
            </span>
            {table.visit_total > 0 && <span>{formatMoney(table.visit_total, content.currency, content.lang)}</span>}
          </div>
        )}
      </div>
    </button>
  )
}

/** Live feed: open calls and orders waiting for confirmation, oldest first. */
function EventFeed({ onOpenTable }: { onOpenTable: (id: number) => void }) {
  const { t } = useTranslation()
  const calls = useOpenCalls()
  const pending = useOrders({ statuses: ['pending'], tableId: null, date: null })
  const take = useTakeCall()
  const setStatus = useSetStatus()
  const ago = useAgo()

  const events = [
    ...(calls.data ?? []).map((call) => ({ kind: 'call' as const, at: call.created_at, call })),
    ...(pending.data ?? []).map((order) => ({ kind: 'order' as const, at: order.created_at, order })),
  ].sort((a, b) => a.at.localeCompare(b.at))

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 font-semibold">{t('hall.feed')}</h2>
      {events.length === 0 && <p className="py-6 text-center text-sm text-slate-500">{t('hall.feedEmpty')}</p>}
      <ul className="space-y-2">
        {events.map((e) =>
          e.kind === 'call' ? (
            <li
              key={`c${e.call.id}`}
              data-testid="feed-call"
              className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"
            >
              <CallIcon call={e.call} />
              <button className="min-w-0 flex-1 text-left" onClick={() => onOpenTable(e.call.table_id)}>
                <div className="font-medium">{t(`hall.callTitle.${e.call.type}`, { table: e.call.table_number })}</div>
                <div className="text-xs text-slate-500">
                  {e.call.payment_method && `${t(`hall.pay.${e.call.payment_method}`)} · `}
                  {ago(e.call.created_at)}
                </div>
              </button>
              <button className={btn.primary} disabled={take.isPending} onClick={() => take.mutate(e.call.id)}>
                {t('hall.take')}
              </button>
            </li>
          ) : (
            <li
              key={`o${e.order.id}`}
              data-testid="feed-order"
              className="flex items-center gap-3 rounded-xl bg-amber-50 p-3"
            >
              <Receipt className="size-5 shrink-0 text-amber-600" />
              <button className="min-w-0 flex-1 text-left" onClick={() => onOpenTable(e.order.table_id)}>
                <div className="font-medium">
                  {t('hall.orderTitle', { table: e.order.table_number, id: e.order.id })}
                </div>
                <div className="text-xs text-slate-500">{ago(e.order.created_at)}</div>
              </button>
              <button
                className={btn.primary}
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate({ id: e.order.id, status: 'accepted' })}
              >
                {t('orders.action.accepted')}
              </button>
            </li>
          ),
        )}
      </ul>
    </section>
  )
}

function CallIcon({ call }: { call: StaffCall }) {
  return call.type === 'bill' ? (
    <Receipt className="size-5 shrink-0 text-orange-500" />
  ) : (
    <Bell className="size-5 shrink-0 text-emerald-600" />
  )
}

function TableDetails({ tableId, onClose }: { tableId: number; onClose: () => void }) {
  const { t } = useTranslation()
  const content = useContentLocale()
  const errorText = useErrorText()
  const visit = useVisit(tableId)
  const openTable = useOpenTable()
  const closeTable = useCloseTable()
  const take = useTakeCall()
  const ago = useAgo()
  const [confirmClose, setConfirmClose] = useState(false)

  const table = visit.data?.table
  const error = openTable.error ?? closeTable.error ?? take.error

  return (
    <Modal title={table ? t('orders.tableN', { number: table.number }) : ''} onClose={onClose} wide>
      {!visit.data || !table ? (
        <p className="text-slate-500">{t('common.loading')}</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 text-sm">
              <span className={`size-2.5 rounded-full ${DOT[table.state]}`} />
              {t(`hall.state.${table.state}`)}
            </span>
            <span className="text-sm text-slate-500">
              {t('hall.guests', { count: table.guests })} · {t('hall.visitTotal')}:{' '}
              <b className="text-slate-900">{formatMoney(table.visit_total, content.currency, content.lang)}</b>
            </span>
            <div className="ml-auto flex gap-2">
              {!table.opened_at && (
                <button
                  className={btn.secondary}
                  disabled={openTable.isPending}
                  onClick={() => openTable.mutate(table.id)}
                >
                  <DoorOpen className="size-4" /> {t('hall.openTable')}
                </button>
              )}
              {confirmClose ? (
                <span className="flex items-center gap-2 text-sm">
                  {t('hall.closeConfirm')}
                  <button
                    className={btn.danger}
                    disabled={closeTable.isPending}
                    onClick={() => closeTable.mutate(table.id, { onSuccess: () => setConfirmClose(false) })}
                  >
                    {t('hall.closeYes')}
                  </button>
                  <button className={btn.secondary} onClick={() => setConfirmClose(false)}>
                    {t('common.cancel')}
                  </button>
                </span>
              ) : (
                <button className={btn.danger} onClick={() => setConfirmClose(true)}>
                  <DoorClosed className="size-4" /> {t('hall.closeTable')}
                </button>
              )}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{errorText(error)}</p>}

          <section>
            <h3 className="mb-2 font-semibold">{t('hall.calls')}</h3>
            {visit.data.calls.length === 0 ? (
              <p className="text-sm text-slate-500">{t('hall.noCalls')}</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {visit.data.calls.map((call) => (
                  <li key={call.id} className="flex items-center gap-3">
                    <CallIcon call={call} />
                    <span className="flex-1">
                      {t(`hall.callType.${call.type}`)}
                      {call.payment_method && ` · ${t(`hall.pay.${call.payment_method}`)}`}
                      <span className="text-slate-500"> · {ago(call.created_at)}</span>
                    </span>
                    {call.status === 'open' ? (
                      <button className={btn.primary} onClick={() => take.mutate(call.id)}>
                        {t('hall.take')}
                      </button>
                    ) : (
                      <span className="text-slate-500">{t('hall.takenBy', { name: call.taken_by ?? '—' })}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 font-semibold">{t('hall.orders')}</h3>
            {visit.data.orders.length === 0 ? (
              <p className="text-sm text-slate-500">{t('hall.noOrders')}</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {visit.data.orders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  )
}

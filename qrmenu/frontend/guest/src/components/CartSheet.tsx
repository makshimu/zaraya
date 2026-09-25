import { useQueryClient } from '@tanstack/react-query'
import { useContext, useMemo, useRef, useState } from 'react'

import { tr } from '../../../shared/localized'
import { formatMoney } from '../../../shared/money'
import { OrderError, placeOrder } from '../api'
import { resolveLines, useCart } from '../cart'
import { LangContext, useT } from '../i18n'
import type { GuestMenu, GuestOrder } from '../types'
import { MinusIcon, PlusIcon, XIcon } from './icons'
import Sheet from './Sheet'

// crypto.randomUUID is missing on older Android browsers
function newKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')
}

const ERRORS: Record<string, string> = {
  item_unavailable: 'errItemUnavailable',
  price_invalid: 'errItemUnavailable',
  modifier_invalid: 'errItemUnavailable',
  modifier_unavailable: 'errItemUnavailable',
  modifier_selection_invalid: 'errItemUnavailable',
  too_many_orders: 'errTooMany',
  session_required: 'noSession',
  session_expired: 'rescan',
  session_closed: 'tableClosed',
  session_table_inactive: 'tableInactive',
  session_table_not_open: 'tableNotOpen',
  network: 'errNetwork',
}

export default function CartSheet({
  menu,
  blockedReason,
  onClose,
  onOrdered,
}: {
  menu: GuestMenu
  blockedReason: string | null // i18n key when ordering isn't possible
  onClose: () => void
  onOrdered: (order: GuestOrder) => void
}) {
  const t = useT()
  const { lang } = useContext(LangContext)
  const cart = useCart()
  const qc = useQueryClient()
  const fallback = menu.restaurant.default_language
  const l = (v: Record<string, string>) => tr(v, lang, fallback)
  const money = (amount: number) => formatMoney(amount, menu.restaurant.currency, lang)

  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ code: string; itemId?: number } | null>(null)

  const lines = useMemo(() => resolveLines(cart.lines, menu), [cart.lines, menu])
  const total = lines.reduce((sum, r) => sum + (r.available ? r.unit * r.line.quantity : 0), 0)
  const allAvailable = lines.every((r) => r.available)

  // One key per checkout attempt: retries after a network error reuse it, so a request that
  // did reach the server can't create a second order. Changing the cart starts a new attempt.
  const attempt = useRef<{ key: string; signature: string } | null>(null)
  const signature = JSON.stringify([cart.lines, comment])

  const inFlight = useRef(false)

  async function submit() {
    // A double tap fires twice before React re-renders the disabled button
    if (inFlight.current) return
    inFlight.current = true
    if (!attempt.current || attempt.current.signature !== signature) {
      attempt.current = { key: newKey(), signature }
    }
    setBusy(true)
    setError(null)
    try {
      const order = await placeOrder(
        lines.map(({ line }) => ({
          item_id: line.itemId,
          price_id: line.priceId,
          modifier_ids: Object.values(line.modifierIds).flat(),
          quantity: line.quantity,
          comment: line.comment,
        })),
        comment,
        attempt.current.key,
      )
      attempt.current = null
      cart.clear()
      qc.setQueryData<GuestOrder[]>(['orders'], (list) => [order, ...(list ?? []).filter((o) => o.id !== order.id)])
      onOrdered(order)
    } catch (err) {
      const e = err instanceof OrderError ? err : new OrderError(0, 'network')
      setError({ code: e.code, itemId: e.itemId })
      if (e.code.startsWith('session_')) qc.invalidateQueries({ queryKey: ['session'] })
      if (e.itemId) qc.invalidateQueries({ queryKey: ['menu'] })
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <Sheet
      label={t('cart')}
      title={t('cart')}
      onClose={onClose}
      footer={
        lines.length > 0 && (
          <div className="space-y-3">
            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {t(ERRORS[error.code] ?? 'errUnknown')}
              </p>
            )}
            {blockedReason && !error && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{t(blockedReason ?? 'rescan')}</p>
            )}
            <button
              onClick={submit}
              disabled={busy || !!blockedReason || !allAvailable}
              className="flex w-full items-center justify-between rounded-2xl bg-blue-600 px-5 py-4 text-lg font-semibold text-white disabled:bg-slate-300"
            >
              <span>{busy ? t('sending') : t('placeOrder')}</span>
              <span data-testid="cart-total">{money(total)}</span>
            </button>
          </div>
        )
      }
    >
      {lines.length === 0 ? (
        <p className="p-10 text-center text-slate-500">{t('cartEmpty')}</p>
      ) : (
        <div className="space-y-4 p-5">
          {lines.map(({ line, item, groups, unit, available }) => {
            const price = item?.prices.find((p) => p.id === line.priceId)
            const mods = groups.flatMap((g) =>
              (line.modifierIds[g.id] ?? []).map((id) => g.modifiers.find((m) => m.id === id)).filter(Boolean),
            )
            const flagged = !available || error?.itemId === line.itemId
            return (
              <div key={line.key} data-testid="cart-line" className={`flex gap-3 ${flagged ? 'opacity-60' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{item ? l(item.name) : t('unavailableDish')}</div>
                  {item && item.prices.length > 1 && price && (
                    <div className="text-sm text-slate-500">{l(price.name)}</div>
                  )}
                  {mods.length > 0 && (
                    <div className="text-sm text-slate-500">{mods.map((m) => l(m!.name)).join(', ')}</div>
                  )}
                  {line.comment && <div className="text-sm text-slate-500 italic">«{line.comment}»</div>}
                  {flagged && <div className="text-sm font-medium text-red-600">{t('outOfStock')}</div>}
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      aria-label={t('decrease')}
                      disabled={line.quantity <= 1}
                      onClick={() => cart.setQuantity(line.key, line.quantity - 1)}
                      className="flex size-8 items-center justify-center rounded-full border border-slate-200 disabled:opacity-30"
                    >
                      <MinusIcon className="size-4" />
                    </button>
                    <span className="w-5 text-center font-semibold">{line.quantity}</span>
                    <button
                      aria-label={t('increase')}
                      onClick={() => cart.setQuantity(line.key, line.quantity + 1)}
                      className="flex size-8 items-center justify-center rounded-full border border-slate-200"
                    >
                      <PlusIcon className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-col items-end justify-between">
                  <button
                    aria-label={t('remove')}
                    onClick={() => cart.remove(line.key)}
                    className="flex size-8 items-center justify-center rounded-full text-slate-400"
                  >
                    <XIcon className="size-4" />
                  </button>
                  {available && <span className="font-semibold">{money(unit * line.quantity)}</span>}
                </div>
              </div>
            )
          })}
          <label className="block pt-2">
            <span className="mb-2 block font-semibold">{t('orderComment')}</span>
            <textarea
              rows={2}
              maxLength={500}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('orderCommentPlaceholder')}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none focus:border-blue-500"
            />
          </label>
        </div>
      )}
    </Sheet>
  )
}

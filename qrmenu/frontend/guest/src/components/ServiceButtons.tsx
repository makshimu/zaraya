import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { callStaff, OrderError, useCalls } from '../api'
import { useT } from '../i18n'
import type { CallType, GuestCall, PaymentMethod } from '../types'
import { BellIcon, ReceiptIcon } from './icons'
import Sheet from './Sheet'

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'qr']
const TAKEN_LABEL_MS = 5 * 60_000 // "on the way" stays on the button for a few minutes

/** "Call the waiter" and "Ask for the bill", always at hand above the cart. */
export default function ServiceButtons({
  blockedReason,
  notify,
}: {
  blockedReason: string | null // i18n key when the visit can't call anyone
  notify: (text: string) => void
}) {
  const t = useT()
  const qc = useQueryClient()
  const calls = useCalls()
  const [billOpen, setBillOpen] = useState(false)
  const [busy, setBusy] = useState<CallType | null>(null)

  const latest = (type: CallType): GuestCall | undefined => calls.data?.find((c) => c.type === type)

  function label(type: CallType) {
    const call = latest(type)
    if (call?.status === 'open') return t(type === 'waiter' ? 'waiterCalled' : 'billRequested')
    if (call?.status === 'taken' && Date.now() - new Date(call.created_at).getTime() < TAKEN_LABEL_MS) {
      return t('waiterComing')
    }
    return t(type === 'waiter' ? 'callWaiter' : 'askBill')
  }

  async function send(type: CallType, method?: PaymentMethod) {
    if (blockedReason) {
      notify(t(blockedReason))
      return
    }
    setBusy(type)
    try {
      const call = await callStaff(type, method)
      qc.setQueryData<GuestCall[]>(['calls'], (list) => [call, ...(list ?? []).filter((c) => c.id !== call.id)])
      notify(t(type === 'waiter' ? 'waiterCalledToast' : 'billRequestedToast'))
      setBillOpen(false)
    } catch (err) {
      const e = err instanceof OrderError ? err : new OrderError(0, 'network')
      if (e.code === 'too_many_calls') notify(t('callCooldown', { seconds: e.retryAfter ?? 60 }))
      else if (e.code.startsWith('session_')) {
        qc.invalidateQueries({ queryKey: ['session'] })
        notify(t('rescan'))
      } else notify(t(e.code === 'network' ? 'errNetwork' : 'errUnknown'))
    } finally {
      setBusy(null)
    }
  }

  const pill =
    'flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold shadow-lg disabled:opacity-60'

  return (
    <>
      <div className="flex gap-2">
        <button className={pill} disabled={busy === 'waiter'} onClick={() => send('waiter')} data-testid="call-waiter">
          <BellIcon className="size-5 text-emerald-600" />
          {label('waiter')}
        </button>
        <button
          className={pill}
          disabled={busy === 'bill'}
          onClick={() => (blockedReason ? notify(t(blockedReason)) : setBillOpen(true))}
          data-testid="ask-bill"
        >
          <ReceiptIcon className="size-5 text-amber-500" />
          {label('bill')}
        </button>
      </div>

      {billOpen && (
        <Sheet label={t('askBill')} title={t('howToPay')} onClose={() => setBillOpen(false)}>
          <div className="grid gap-3 p-5">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method}
                disabled={busy === 'bill'}
                onClick={() => send('bill', method)}
                className="rounded-2xl border border-slate-200 px-5 py-4 text-left text-lg font-semibold active:bg-slate-50"
              >
                {t(`pay.${method}`)}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  )
}

import { useT } from '../i18n'
import type { OrderStatus } from '../types'

/** Where an order is: 0 sent (waits for the waiter), 1 cooking, 2 served; null when it left the flow. */
export function orderStep(status: OrderStatus): number | null {
  if (status === 'pending') return 0
  if (status === 'accepted' || status === 'cooking') return 1 // accepting starts cooking
  if (status === 'served') return 2
  return null
}

/** Three-step track: waiting for the waiter / accepted → cooking → served. */
export default function StatusTrack({ status }: { status: OrderStatus }) {
  const t = useT()
  const reached = orderStep(status)
  if (reached === null) {
    const tone = status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-cream text-muted'
    return (
      <div
        data-testid="order-status"
        data-status={status}
        className={`rounded-xl px-3 py-2 text-sm font-medium ${tone}`}
      >
        {t(`status.${status}`)}
      </div>
    )
  }
  const labels = [t(reached === 0 ? 'status.waiting' : 'status.accepted'), t('status.cooking'), t('status.served')]
  return (
    <ol className="grid grid-cols-3 gap-1.5" data-testid="order-status" data-status={status}>
      {labels.map((label, i) => (
        <li key={i} className="text-center text-xs">
          <div
            className={`mb-1 h-1.5 rounded-full ${
              i < reached
                ? 'bg-jade'
                : i === reached
                  ? reached === 2
                    ? 'bg-jade'
                    : 'animate-pulse bg-wine'
                  : 'bg-line'
            }`}
          />
          <span className={i === reached ? 'font-semibold text-ink' : 'text-muted'}>{label}</span>
        </li>
      ))}
    </ol>
  )
}

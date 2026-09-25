import { useQuery } from '@tanstack/react-query'

import type { CallType, GuestCall, GuestMenu, GuestOrder, GuestSession, PaymentMethod } from './types'

async function get<T>(path: string): Promise<T> {
  const resp = await fetch(`/api/guest${path}`, { credentials: 'same-origin' })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.json()
}

// Realtime pushes keep these fresh; the long polls are only a safety net.
export const useMenu = () =>
  useQuery({ queryKey: ['menu'], queryFn: () => get<GuestMenu>('/menu'), refetchInterval: 5 * 60_000 })

export const useSession = () =>
  useQuery({ queryKey: ['session'], queryFn: () => get<GuestSession>('/session'), refetchInterval: 60_000 })

export const useOrders = () =>
  useQuery({ queryKey: ['orders'], queryFn: () => get<GuestOrder[]>('/orders'), refetchInterval: 5 * 60_000 })

export const useCalls = () =>
  useQuery({ queryKey: ['calls'], queryFn: () => get<GuestCall[]>('/calls'), refetchInterval: 5 * 60_000 })

export class OrderError extends Error {
  constructor(
    public status: number, // 0 = network failure
    public code: string,
    public itemId?: number,
  ) {
    super(code)
  }

  retryAfter?: number // seconds, for rate-limited calls
}

export interface OrderLine {
  item_id: number
  price_id: number
  modifier_ids: number[]
  quantity: number
  comment: string
}

export async function placeOrder(
  items: OrderLine[],
  comment: string,
  language: string,
  idempotencyKey: string,
): Promise<GuestOrder> {
  let resp: Response
  try {
    resp = await fetch('/api/guest/orders', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ items, comment, language }),
    })
  } catch {
    throw new OrderError(0, 'network')
  }
  const body = await resp.json().catch(() => null)
  if (!resp.ok) {
    const detail = body?.detail
    if (typeof detail === 'string') throw new OrderError(resp.status, detail)
    if (detail && typeof detail.code === 'string') throw new OrderError(resp.status, detail.code, detail.item_id)
    throw new OrderError(resp.status, 'unknown')
  }
  return body
}

export async function callStaff(type: CallType, paymentMethod?: PaymentMethod): Promise<GuestCall> {
  let resp: Response
  try {
    resp = await fetch('/api/guest/calls', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payment_method: paymentMethod ?? null }),
    })
  } catch {
    throw new OrderError(0, 'network')
  }
  const body = await resp.json().catch(() => null)
  if (!resp.ok) {
    const detail = body?.detail
    const code = typeof detail === 'string' ? detail : (detail?.code ?? 'unknown')
    const error = new OrderError(resp.status, code)
    error.retryAfter = detail?.retry_after
    throw error
  }
  return body
}

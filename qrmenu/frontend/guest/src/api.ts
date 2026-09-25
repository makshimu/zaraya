import { useQuery } from '@tanstack/react-query'

import type { GuestMenu, GuestOrder, GuestSession } from './types'

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

export class OrderError extends Error {
  constructor(
    public status: number, // 0 = network failure
    public code: string,
    public itemId?: number,
  ) {
    super(code)
  }
}

export interface OrderLine {
  item_id: number
  price_id: number
  modifier_ids: number[]
  quantity: number
  comment: string
}

export async function placeOrder(items: OrderLine[], comment: string, idempotencyKey: string): Promise<GuestOrder> {
  let resp: Response
  try {
    resp = await fetch('/api/guest/orders', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ items, comment }),
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

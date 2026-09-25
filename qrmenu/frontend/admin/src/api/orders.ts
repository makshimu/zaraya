import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './client'
import type { Order, OrderStatus } from './types'

export interface OrderFilters {
  statuses: OrderStatus[]
  tableId: number | null
  date: string | null // YYYY-MM-DD, restaurant time zone
}

function query(f: OrderFilters) {
  const params = new URLSearchParams()
  for (const s of f.statuses) params.append('status', s)
  if (f.tableId) params.set('table_id', String(f.tableId))
  if (f.date) params.set('date', f.date)
  return params.toString()
}

// Realtime events invalidate ['orders'], so every filtered list refetches on change
export const useOrders = (f: OrderFilters) =>
  useQuery({ queryKey: ['orders', f], queryFn: () => api.get<Order[]>(`/orders?${query(f)}`) })

export function useSetStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: OrderStatus }) =>
      api.post<Order>(`/orders/${id}/status`, { status }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })
}

export function useEditItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, items }: { id: number; items: { id: number; quantity: number }[] }) =>
      api.put<Order>(`/orders/${id}/items`, { items }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })
}

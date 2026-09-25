import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './client'
import type { HallTable, StaffCall, TableVisit } from './types'

// Realtime events invalidate these keys, so the hall stays live without polling
export const useHall = () => useQuery({ queryKey: ['hall'], queryFn: () => api.get<HallTable[]>('/hall') })

export const useVisit = (tableId: number) =>
  useQuery({ queryKey: ['visit', tableId], queryFn: () => api.get<TableVisit>(`/tables/${tableId}/visit`) })

export const useOpenCalls = () => useQuery({ queryKey: ['calls'], queryFn: () => api.get<StaffCall[]>('/calls') })

function useHallMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () =>
      Promise.all([['hall'], ['visit'], ['calls'], ['orders']].map((queryKey) => qc.invalidateQueries({ queryKey }))),
  })
}

export const useTakeCall = () => useHallMutation((id: number) => api.post<StaffCall>(`/calls/${id}/take`))
export const useOpenTable = () => useHallMutation((id: number) => api.post<HallTable>(`/tables/${id}/open`))
export const useCloseTable = () => useHallMutation((id: number) => api.post<HallTable>(`/tables/${id}/close`))

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { api } from './client'
import type { Hall, Table, TableInput } from './types'

export const useHalls = () => useQuery({ queryKey: ['halls'], queryFn: () => api.get<Hall[]>('/halls') })
export const useTables = () => useQuery({ queryKey: ['tables'], queryFn: () => api.get<Table[]>('/tables') })

function useInvalidate() {
  const qc = useQueryClient()
  return () =>
    Promise.all([qc.invalidateQueries({ queryKey: ['halls'] }), qc.invalidateQueries({ queryKey: ['tables'] })])
}

export function useSaveHall() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, name }: { id?: number; name: string }) =>
      id ? api.put<Hall>(`/halls/${id}`, { name }) : api.post<Hall>('/halls', { name }),
    onSuccess: invalidate,
  })
}

export function useDeleteHall() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (id: number) => api.delete(`/halls/${id}`), onSuccess: invalidate })
}

export function useSaveTable() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: TableInput }) =>
      id ? api.patch<Table>(`/tables/${id}`, data) : api.post<Table>('/tables', data),
    onSuccess: invalidate,
  })
}

export function useDeleteTable() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (id: number) => api.delete(`/tables/${id}`), onSuccess: invalidate })
}

export function useRegenerateToken() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: number) => api.post<Table>(`/tables/${id}/regenerate-token`),
    onSuccess: invalidate,
  })
}

/** Object URL of the table's QR PNG; the token is part of the key so a reissue refetches it. */
export function useQrImage(table: Table) {
  const { data: blob } = useQuery({
    queryKey: ['qr', table.id, table.token],
    queryFn: () => api.blob(`/tables/${table.id}/qr.png`),
    staleTime: Infinity,
  })
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

function saveBlob(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  // Revoking right away can cancel the download in some browsers
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}

export async function downloadQr(table: Table, fmt: 'png' | 'svg') {
  saveBlob(await api.blob(`/tables/${table.id}/qr.${fmt}`), `table-${table.number}.${fmt}`)
}

/** A4 sheets with a card per active table, ready to print and cut. */
export async function downloadQrPdf(hallId?: number) {
  const query = hallId === undefined ? '' : `?hall_id=${hallId}`
  saveBlob(await api.blob(`/tables/qr.pdf${query}`), 'tables-qr.pdf')
}

import { useQuery } from '@tanstack/react-query'

import type { GuestMenu, GuestSession } from './types'

async function get<T>(path: string): Promise<T> {
  const resp = await fetch(`/api/guest${path}`, { credentials: 'same-origin' })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.json()
}

// Polling keeps the menu fresh (a dish switched off in the admin disappears) until
// realtime push arrives in a later stage.
export const useMenu = () =>
  useQuery({ queryKey: ['menu'], queryFn: () => get<GuestMenu>('/menu'), refetchInterval: 30_000 })

export const useSession = () =>
  useQuery({ queryKey: ['session'], queryFn: () => get<GuestSession>('/session'), refetchInterval: 60_000 })

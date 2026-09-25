import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './client'
import type { RestaurantSettings } from './types'

export type SettingsInput = Omit<RestaurantSettings, 'logo_urls'>

export const useSettings = () =>
  useQuery({ queryKey: ['settings'], queryFn: () => api.get<RestaurantSettings>('/settings'), staleTime: 60_000 })

export function useSaveSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SettingsInput) => api.put<RestaurantSettings>('/settings', data),
    onSuccess: (saved) => qc.setQueryData(['settings'], saved),
  })
}

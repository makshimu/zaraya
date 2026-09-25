import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './client'
import type { RestaurantSettings } from './types'

// telegram_bot_token: undefined keeps the saved token, '' removes it
export type SettingsInput = Omit<RestaurantSettings, 'logo_urls' | 'telegram_token_set'> & {
  telegram_bot_token?: string
}

export const useSettings = () =>
  useQuery({ queryKey: ['settings'], queryFn: () => api.get<RestaurantSettings>('/settings'), staleTime: 60_000 })

export function useSaveSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SettingsInput) => api.put<RestaurantSettings>('/settings', data),
    onSuccess: (saved) => qc.setQueryData(['settings'], saved),
  })
}

export const testTelegram = () => api.post<void>('/settings/telegram-test')

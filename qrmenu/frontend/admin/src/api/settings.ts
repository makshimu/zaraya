import { useQuery } from '@tanstack/react-query'

import { api } from './client'
import type { RestaurantSettings } from './types'

export const useSettings = () =>
  useQuery({ queryKey: ['settings'], queryFn: () => api.get<RestaurantSettings>('/settings'), staleTime: 60_000 })

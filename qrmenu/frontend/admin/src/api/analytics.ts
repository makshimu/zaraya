import { useQuery } from '@tanstack/react-query'

import { api } from './client'
import type { Localized } from './types'

export interface ItemStat {
  item_id: number | null
  name: Localized
  image_url: string | null
  quantity: number
  revenue: number
}

export interface Summary {
  orders: number
  revenue: number
  avg_check: number
  items: number
  visits: number
}

export interface Analytics {
  date_from: string
  date_to: string
  currency: string
  timezone: string
  summary: Summary
  previous: Summary // the same number of days right before
  by_hour: { hour: number; orders: number; revenue: number }[]
  heatmap: { weekday: number; hour: number; orders: number }[]
  by_day: { date: string; orders: number; revenue: number }[]
  top_items: ItemStat[]
  dayparts: {
    key: string
    from_hour: number
    to_hour: number
    orders: number
    revenue: number
    top_items: ItemStat[]
  }[]
  languages: { language: string | null; orders: number; revenue: number; share: number; top_items: ItemStat[] }[]
}

export const useAnalytics = (from: string | null, to: string | null) =>
  useQuery({
    queryKey: ['analytics', from, to],
    queryFn: () => {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      return api.get<Analytics>(`/analytics?${params}`)
    },
    placeholderData: (previous) => previous, // keep the old charts while a new period loads
  })

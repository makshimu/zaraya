import type { Localized } from '../../shared/localized'

export interface ImageUrls {
  w400: string
  w1200: string
}

export interface Price {
  id: number
  name: Localized
  amount: number
  is_default: boolean
}

export interface GuestItem {
  id: number
  name: Localized
  description: Localized
  image_urls: ImageUrls | null
  is_available: boolean
  badges: string[]
  prices: Price[]
  modifier_group_ids: number[]
}

export interface GuestCategory {
  id: number
  name: Localized
  image_urls: ImageUrls | null
  items: GuestItem[]
}

export interface GuestModifier {
  id: number
  name: Localized
  price: number
  is_available: boolean
}

export interface GuestModifierGroup {
  id: number
  name: Localized
  min_select: number
  max_select: number
  is_required: boolean
  modifiers: GuestModifier[]
}

export interface GuestMenu {
  restaurant: {
    name: Localized
    logo_urls: ImageUrls | null
    currency: string
    languages: string[]
    default_language: string
  }
  categories: GuestCategory[]
  modifier_groups: GuestModifierGroup[]
}

export type SessionStatus = 'active' | 'expired' | 'closed' | 'table_inactive'

export interface GuestSession {
  status: SessionStatus | null
  table: { number: string } | null
  expires_at: string | null
}

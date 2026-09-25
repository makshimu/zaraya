export type Role = 'admin' | 'waiter'

export interface User {
  id: number
  email: string
  name: string
  role: Role
}

export interface Hall {
  id: number
  name: string
  sort_order: number
}

export interface Table {
  id: number
  number: string
  hall_id: number | null
  capacity: number
  is_active: boolean
  token: string
  token_issued_at: string
  qr_url: string
}

export interface TableInput {
  number: string
  hall_id: number | null
  capacity: number
  is_active: boolean
}

export interface RestaurantSettings {
  name: Record<string, string>
  logo: string | null
  logo_urls: ImageUrls | null
  currency: string
  languages: string[]
  default_language: string
  timezone: string
  session_ttl_minutes: number
  require_first_order_confirmation: boolean
  require_table_open: boolean
}

export type Localized = Record<string, string>

export interface ImageUrls {
  w400: string
  w1200: string
}

export interface Category {
  id: number
  name: Localized
  image: string | null
  image_urls: ImageUrls | null
  is_enabled: boolean
  available_from: string | null
  available_to: string | null
  sort_order: number
}

export interface Price {
  id?: number
  name: Localized
  amount: number
  is_default: boolean
}

export const BADGES = ['spicy', 'vegan', 'vegetarian', 'hit', 'new'] as const
export type Badge = (typeof BADGES)[number]

export interface Item {
  id: number
  category_id: number
  name: Localized
  description: Localized
  image: string | null
  image_urls: ImageUrls | null
  is_enabled: boolean
  is_available: boolean
  badges: Badge[]
  sort_order: number
  prices: Price[]
  modifier_group_ids: number[]
}

export interface Modifier {
  id?: number
  name: Localized
  price: number
  is_available: boolean
}

export interface ModifierGroup {
  id: number
  name: Localized
  min_select: number
  max_select: number
  is_required: boolean
  sort_order: number
  modifiers: Modifier[]
}

export interface Menu {
  categories: Category[]
  items: Item[]
  modifier_groups: ModifierGroup[]
}

export interface CategoryInput {
  name: Localized
  image: string | null
  is_enabled: boolean
  available_from: string | null
  available_to: string | null
}

export interface ItemInput {
  category_id: number
  name: Localized
  description: Localized
  image: string | null
  is_enabled: boolean
  is_available: boolean
  badges: Badge[]
  prices: Price[]
  modifier_group_ids: number[]
}

export interface ModifierGroupInput {
  name: Localized
  min_select: number
  max_select: number
  is_required: boolean
  modifiers: Modifier[]
}

export type OrderStatus = 'pending' | 'accepted' | 'cooking' | 'served' | 'closed' | 'rejected'

export const ORDER_STATUSES: OrderStatus[] = ['pending', 'accepted', 'cooking', 'served', 'closed', 'rejected']
export const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'accepted', 'cooking', 'served']
export const EDITABLE_STATUSES: OrderStatus[] = ['pending', 'accepted']

// Mirrors the backend's allowed transitions
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  pending: ['accepted', 'rejected'],
  accepted: ['cooking', 'served', 'rejected'],
  cooking: ['served'],
  served: ['closed'],
  closed: [],
  rejected: [],
}

export interface OrderItem {
  id: number
  item_id: number | null
  name: Localized
  price_name: Localized
  unit_price: number
  quantity: number
  total: number
  comment: string
  modifiers: { group_name: Localized; name: Localized; price: number }[]
}

export interface Order {
  id: number
  table_id: number
  table_number: string
  session_id: string
  status: OrderStatus
  comment: string
  total: number
  created_at: string
  updated_at: string
  updated_by: string | null
  items: OrderItem[]
}

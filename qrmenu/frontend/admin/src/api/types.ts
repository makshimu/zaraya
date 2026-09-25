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
  logo_url: string | null
  currency: string
  languages: string[]
  default_language: string
  session_ttl_minutes: number
  require_first_order_confirmation: boolean
  require_table_open: boolean
}

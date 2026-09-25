import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { isPreview } from './preview'
import { unitPrice, type Selection } from './selection'
import type { GuestItem, GuestMenu, GuestModifierGroup } from './types'

export interface CartLine {
  key: string // same dish with the same options merges into one line
  itemId: number
  priceId: number
  modifierIds: Record<number, number[]>
  quantity: number
  comment: string
}

interface CartState {
  lines: CartLine[]
  add: (itemId: number, sel: Selection, comment: string) => void
  setQuantity: (key: string, quantity: number) => void
  remove: (key: string) => void
  clear: () => void
}

const CartContext = createContext<CartState | null>(null)
// The admin's preview keeps its own cart so it never mixes with a real guest cart
const STORAGE_KEY = isPreview ? 'qrmenu_cart_preview' : 'qrmenu_cart'

function lineKey(itemId: number, sel: Selection, comment: string) {
  const mods = Object.values(sel.modifierIds)
    .flat()
    .sort((a, b) => a - b)
  return `${itemId}:${sel.priceId}:${mods.join(',')}:${comment.trim()}`
}

function load(): CartLine[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    } catch {
      /* private mode: the cart just won't survive a reload */
    }
  }, [lines])

  const add = useCallback((itemId: number, sel: Selection, comment: string) => {
    const key = lineKey(itemId, sel, comment)
    setLines((prev) =>
      prev.some((l) => l.key === key)
        ? prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(99, l.quantity + sel.quantity) } : l))
        : [
            ...prev,
            {
              key,
              itemId,
              priceId: sel.priceId,
              modifierIds: sel.modifierIds,
              quantity: sel.quantity,
              comment: comment.trim(),
            },
          ],
    )
  }, [])

  const value = useMemo<CartState>(
    () => ({
      lines,
      add,
      setQuantity: (key, quantity) =>
        setLines((prev) =>
          prev.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, Math.min(99, quantity)) } : l)),
        ),
      remove: (key) => setLines((prev) => prev.filter((l) => l.key !== key)),
      clear: () => setLines([]),
    }),
    [lines, add],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartState {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart outside CartProvider')
  return ctx
}

export interface ResolvedLine {
  line: CartLine
  item: GuestItem | null // null: the dish left the menu
  groups: GuestModifierGroup[]
  unit: number
  available: boolean
}

/** Match cart lines against the live menu for display; the backend re-prices on ordering. */
export function resolveLines(lines: CartLine[], menu: GuestMenu): ResolvedLine[] {
  const items = new Map(menu.categories.flatMap((c) => c.items).map((i) => [i.id, i]))
  const groupsById = new Map(menu.modifier_groups.map((g) => [g.id, g]))
  return lines.map((line) => {
    const item = items.get(line.itemId) ?? null
    const groups = item ? item.modifier_group_ids.map((id) => groupsById.get(id)!).filter(Boolean) : []
    const sel = { priceId: line.priceId, modifierIds: line.modifierIds, quantity: line.quantity }
    const modsOk = groups.every((g) =>
      (line.modifierIds[g.id] ?? []).every((id) => g.modifiers.find((m) => m.id === id)?.is_available),
    )
    const available = !!item && item.is_available && item.prices.some((p) => p.id === line.priceId) && modsOk
    return { line, item, groups, unit: item ? unitPrice(item, groups, sel) : 0, available }
  })
}

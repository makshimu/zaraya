import type { GuestItem, GuestModifierGroup } from './types'

/** What the guest picked on the dish screen. The backend recalculates the price on order. */
export interface Selection {
  priceId: number
  modifierIds: Record<number, number[]> // group id -> modifier ids
  quantity: number
}

export function initialSelection(item: GuestItem): Selection {
  const def = item.prices.find((p) => p.is_default) ?? item.prices[0]
  return { priceId: def.id, modifierIds: {}, quantity: 1 }
}

/** Toggle a modifier respecting max_select: single-choice groups behave like radio buttons. */
export function toggleModifier(sel: Selection, group: GuestModifierGroup, modifierId: number): Selection {
  const current = sel.modifierIds[group.id] ?? []
  let next: number[]
  if (current.includes(modifierId)) next = current.filter((id) => id !== modifierId)
  else if (group.max_select === 1) next = [modifierId]
  else if (current.length >= group.max_select) return sel
  else next = [...current, modifierId]
  return { ...sel, modifierIds: { ...sel.modifierIds, [group.id]: next } }
}

export function groupSatisfied(sel: Selection, group: GuestModifierGroup): boolean {
  const n = (sel.modifierIds[group.id] ?? []).length
  return n >= group.min_select && n <= group.max_select
}

export function unitPrice(item: GuestItem, groups: GuestModifierGroup[], sel: Selection): number {
  const base = item.prices.find((p) => p.id === sel.priceId)?.amount ?? 0
  let extra = 0
  for (const group of groups) {
    for (const id of sel.modifierIds[group.id] ?? []) extra += group.modifiers.find((m) => m.id === id)?.price ?? 0
  }
  return base + extra
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './client'
import type {
  Category,
  CategoryInput,
  ImageUrls,
  Item,
  ItemInput,
  Menu,
  ModifierGroup,
  ModifierGroupInput,
} from './types'

const MENU_KEY = ['menu']

export const useMenu = () => useQuery({ queryKey: MENU_KEY, queryFn: () => api.get<Menu>('/menu') })

function useMenuMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSettled: () => qc.invalidateQueries({ queryKey: MENU_KEY }) })
}

export const useSaveCategory = () =>
  useMenuMutation(({ id, data }: { id?: number; data: CategoryInput }) =>
    id ? api.put<Category>(`/categories/${id}`, data) : api.post<Category>('/categories', data),
  )

export const usePatchCategory = () =>
  useMenuMutation(({ id, is_enabled }: { id: number; is_enabled: boolean }) =>
    api.patch<Category>(`/categories/${id}`, { is_enabled }),
  )

export const useDeleteCategory = () => useMenuMutation((id: number) => api.delete(`/categories/${id}`))

export const useSaveItem = () =>
  useMenuMutation(({ id, data }: { id?: number; data: ItemInput }) =>
    id ? api.put<Item>(`/items/${id}`, data) : api.post<Item>('/items', data),
  )

export const usePatchItem = () =>
  useMenuMutation(({ id, ...patch }: { id: number; is_enabled?: boolean; is_available?: boolean }) =>
    api.patch<Item>(`/items/${id}`, patch),
  )

export const useDeleteItem = () => useMenuMutation((id: number) => api.delete(`/items/${id}`))

export const useSaveGroup = () =>
  useMenuMutation(({ id, data }: { id?: number; data: ModifierGroupInput }) =>
    id ? api.put<ModifierGroup>(`/modifier-groups/${id}`, data) : api.post<ModifierGroup>('/modifier-groups', data),
  )

export const useDeleteGroup = () => useMenuMutation((id: number) => api.delete(`/modifier-groups/${id}`))

type ReorderScope = { kind: 'categories' } | { kind: 'items'; categoryId: number } | { kind: 'groups' }

function reorderPath(scope: ReorderScope) {
  if (scope.kind === 'categories') return '/categories/order'
  if (scope.kind === 'groups') return '/modifier-groups/order'
  return `/categories/${scope.categoryId}/items/order`
}

function sortByIds<T extends { id: number }>(list: T[], ids: number[], inScope: (x: T) => boolean): T[] {
  const byId = new Map(list.map((x) => [x.id, x]))
  const ordered = ids.map((id) => byId.get(id)!).filter(Boolean)
  // Keep out-of-scope rows where they are; replace in-scope slots in the new order
  let i = 0
  return list.map((x) => (inScope(x) ? ordered[i++] : x))
}

/** Reorder with an optimistic update so drag & drop doesn't jump back while saving. */
export function useReorder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ scope, ids }: { scope: ReorderScope; ids: number[] }) => api.put(reorderPath(scope), { ids }),
    onMutate: async ({ scope, ids }) => {
      await qc.cancelQueries({ queryKey: MENU_KEY })
      const previous = qc.getQueryData<Menu>(MENU_KEY)
      if (previous) {
        const next = { ...previous }
        if (scope.kind === 'categories') next.categories = sortByIds(previous.categories, ids, () => true)
        if (scope.kind === 'groups') next.modifier_groups = sortByIds(previous.modifier_groups, ids, () => true)
        if (scope.kind === 'items')
          next.items = sortByIds(previous.items, ids, (x) => x.category_id === scope.categoryId)
        qc.setQueryData(MENU_KEY, next)
      }
      return { previous }
    },
    onError: (_err, _vars, ctx) => ctx?.previous && qc.setQueryData(MENU_KEY, ctx.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: MENU_KEY }),
  })
}

export async function uploadImage(file: File): Promise<{ key: string; urls: ImageUrls }> {
  const form = new FormData()
  form.append('file', file)
  return api.postForm('/uploads/image', form)
}

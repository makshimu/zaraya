import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './client'
import type { Role, User } from './types'

export interface StaffUser extends User {
  is_active: boolean
}

export interface UserInput {
  email?: string
  name?: string
  role?: Role
  is_active?: boolean
  password?: string // empty on edit = keep the current one
}

export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: () => api.get<StaffUser[]>('/users') })

export function useSaveUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: UserInput }) =>
      id ? api.patch<StaffUser>(`/users/${id}`, data) : api.post<StaffUser>('/users', data),
    onSettled: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

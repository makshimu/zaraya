import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react'

import { api, setUnauthorizedHandler, tokenStore } from '../api/client'
import type { User } from '../api/types'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<User>('/auth/me'),
    enabled: !!tokenStore.get(),
    retry: false,
  })

  const logout = useCallback(() => {
    tokenStore.clear()
    qc.clear()
    qc.setQueryData(['me'], null)
  }, [qc])

  useEffect(() => setUnauthorizedHandler(logout), [logout])

  const login = useCallback(
    async (email: string, password: string) => {
      const { access_token } = await api.post<{ access_token: string }>('/auth/login', { email, password })
      tokenStore.set(access_token)
      await qc.fetchQuery({ queryKey: ['me'], queryFn: () => api.get<User>('/auth/me') })
    },
    [qc],
  )

  const user = tokenStore.get() ? (me.data ?? null) : null
  return (
    <AuthContext.Provider value={{ user, loading: !!tokenStore.get() && me.isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}

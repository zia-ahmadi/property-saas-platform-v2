import { createContext, useContext } from 'react'
import type { AuthLifecycleService, AuthState } from './lifecycle'

export type AuthContextValue = { state: AuthState; service: AuthLifecycleService }
export const AuthContext = createContext<AuthContextValue | null>(null)
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider is required')
  return value
}
export function useOptionalAuth() { return useContext(AuthContext) }

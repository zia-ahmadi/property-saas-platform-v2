import { useSyncExternalStore } from 'react'
import { queryClient } from '@/app/providers/queryClient'
import { createAuthCoordinator } from './coordination'
import { AuthLifecycleService } from './lifecycle'
import { AuthContext } from './context'

const service = new AuthLifecycleService({
  coordinator: createAuthCoordinator(),
  clearCache: async () => { await queryClient.cancelQueries(); queryClient.clear() },
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot)
  return <AuthContext.Provider value={{ state, service }}>{children}</AuthContext.Provider>
}

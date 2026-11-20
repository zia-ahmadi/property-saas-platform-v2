import { createContext, useContext } from 'react'
import type { SessionOrganization } from '@/features/auth/api'
import type { OrganizationPermission } from './permissions'
import type { RequestOptions } from '@/lib/api/client'

export interface OrganizationContextValue {
  forbidden: boolean
  current: Readonly<SessionOrganization> | undefined
  organizations: readonly Readonly<SessionOrganization>[]
  select: (id: string) => void
  can: (permission: OrganizationPermission) => boolean
  request: <T>(method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, body?: unknown, options?: RequestOptions) => Promise<T>
  queryKey: (key: readonly unknown[]) => readonly unknown[]
}
export const OrganizationContext = createContext<OrganizationContextValue | null>(null)
export function useOrganization() { const context = useContext(OrganizationContext); if (!context) throw new Error('OrganizationProvider is required'); return context }
export function useOptionalOrganization() { return useContext(OrganizationContext) }

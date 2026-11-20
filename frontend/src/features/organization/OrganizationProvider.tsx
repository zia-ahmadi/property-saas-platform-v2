import { useEffect, useRef, useState } from 'react'
import { queryClient } from '@/app/providers/queryClient'
import { useAuth } from '@/features/auth/context'
import { hasPermission } from './permissions'
import { OrganizationContext, type OrganizationContextValue } from './context'
import type { RequestOptions } from '@/lib/api/client'
import { ApiError } from '@/lib/api/errors'

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { state, service } = useAuth()
  const [selected, setSelected] = useState<string>()
  const [deniedScope, setDeniedScope] = useState<{ identity: string; id: string; session: object }>()
  const version = useRef(0)
  const selectedRef = useRef<string | undefined>(undefined)
  const organizations = state.status === 'authenticated' ? state.session.organizations : []
  const current = organizations.find(org => org.organizationId === selected) ?? organizations[0]
  const identity = state.status === 'authenticated' ? state.session.user.id : undefined
  useEffect(() => service.subscribe(() => { version.current++ }), [service])
  useEffect(() => { void queryClient.cancelQueries().then(() => queryClient.clear()) }, [identity, current?.organizationId])
  const value: OrganizationContextValue = {
    current, organizations, forbidden: !!identity && deniedScope?.identity === identity && deniedScope.id === current?.organizationId && state.status === 'authenticated' && deniedScope.session === state.session,
    select(id) {
      if (!organizations.some(org => org.organizationId === id) || id === current?.organizationId) return
      version.current++
      selectedRef.current = id
      setDeniedScope(undefined)
      void queryClient.cancelQueries().then(() => queryClient.clear())
      setSelected(id)
    },
    can: permission => hasPermission(current?.role, permission),
    queryKey: key => ['organization', identity, current?.organizationId, current?.role, ...key],
    async request<T>(method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, body?: unknown, options?: RequestOptions): Promise<T> {
      if (!current || !identity) throw new Error('Organization required')
      const verified = service.getSnapshot()
      if (verified.status !== 'authenticated' || verified.session.user.id !== identity) throw new Error('Authentication changed')
      const selectedMembership = verified.session.organizations.find(org => org.organizationId === selectedRef.current) ?? verified.session.organizations[0]
      if (selectedMembership?.organizationId !== current.organizationId) throw new Error('Organization changed')
      const capturedVersion = version.current
      try {
        const result = await service.request<T>(method, `api/v1/organizations/${current.organizationId}${path ? `/${path}` : ''}`, body, options)
        if (capturedVersion !== version.current) throw new Error('Organization changed')
        return result
      } catch (error) {
        if (capturedVersion !== version.current) throw new Error('Organization changed', { cause: error })
        if (error instanceof ApiError && error.status === 403 && state.status === 'authenticated') setDeniedScope({ identity, id: current.organizationId, session: state.session })
        throw error
      }
    },
  }
  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>
}

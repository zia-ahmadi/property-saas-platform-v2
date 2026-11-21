import { useEffect, useRef, useState } from 'react'
import { queryClient } from '@/app/providers/queryClient'
import { useAuth } from '@/features/auth/context'
import { discardOrganizationQueries } from './cache'
import { hasPermission } from './permissions'
import { OrganizationContext, type OrganizationContextValue } from './context'
import type { RequestOptions } from '@/lib/api/client'
import { ApiError } from '@/lib/api/errors'

const SELECTION_KEY = 'property-saas:selected-organization'
type Selection = { userId: string; organizationId: string }

function readSelection(): Selection | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(SELECTION_KEY) ?? 'null')
    if (typeof value?.userId === 'string' && typeof value?.organizationId === 'string') return value
  } catch {
    // Selection is optional when browser storage is unavailable.
  }
}

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { state, service } = useAuth()
  const [selected, setSelected] = useState(readSelection)
  const [deniedScope, setDeniedScope] = useState<{ identity: string; id: string; session: object }>()
  const version = useRef(0)
  const selectedRef = useRef(selected)
  const organizations = state.status === 'authenticated' ? state.session.organizations : []
  const identity = state.status === 'authenticated' ? state.session.user.id : undefined
  const selectedId = selected?.userId === identity ? selected?.organizationId : undefined
  const current = organizations.find(org => org.organizationId === selectedId) ?? organizations[0]
  useEffect(() => service.subscribe(() => { version.current++ }), [service])
  useEffect(() => { discardOrganizationQueries(queryClient, [identity, current?.organizationId, current?.role]) }, [identity, current?.organizationId, current?.role])
  const value: OrganizationContextValue = {
    current, organizations, forbidden: !!identity && deniedScope?.identity === identity && deniedScope.id === current?.organizationId && state.status === 'authenticated' && deniedScope.session === state.session,
    select(id) {
      if (!identity || !organizations.some(org => org.organizationId === id) || id === current?.organizationId) return
      version.current++
      const selection = { userId: identity, organizationId: id }
      selectedRef.current = selection
      try {
        sessionStorage.setItem(SELECTION_KEY, JSON.stringify(selection))
      } catch {
        // Keep the in-memory selection for this page.
      }
      setDeniedScope(undefined)
      discardOrganizationQueries(queryClient)
      setSelected(selection)
    },
    can: permission => hasPermission(current?.role, permission),
    queryKey: key => ['organization', identity, current?.organizationId, current?.role, ...key],
    async request<T>(method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, body?: unknown, options?: RequestOptions): Promise<T> {
      if (!current || !identity) throw new Error('Organization required')
      const verified = service.getSnapshot()
      if (verified.status !== 'authenticated' || verified.session.user.id !== identity) throw new Error('Authentication changed')
      const selection = selectedRef.current
      const organizationId = selection?.userId === identity ? selection.organizationId : undefined
      const selectedMembership = verified.session.organizations.find(org => org.organizationId === organizationId) ?? verified.session.organizations[0]
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

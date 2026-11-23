import { useEffect, useState, type ReactNode } from 'react'
import { useOptionalAuth } from '@/features/auth/context'
import { ApiError } from '@/lib/api/errors'

import { PlatformAccessContext, type PlatformAccess } from './context'
export function PlatformAccessProvider({ children }: { children: ReactNode }) {
  const auth = useOptionalAuth()
  const identity = auth?.state.status === 'authenticated' ? auth.state.session.user.id : undefined
  const service = auth?.service
  const [result, setResult] = useState<{identity: string; access: PlatformAccess}>()
  useEffect(() => {
    if (!identity || !service) return
    let active = true
    void service.request('get', 'api/v1/platform/me').then(() => {
      if (active) setResult({identity, access: 'allowed'})
    }).catch(error => {
      if (active) setResult({identity, access: error instanceof ApiError && error.status === 403 ? 'denied' : 'unavailable'})
    })
    return () => { active = false }
  }, [identity, service])
  const access = !identity ? 'denied' : result?.identity === identity ? result.access : 'loading'
  return <PlatformAccessContext.Provider value={access}>{children}</PlatformAccessContext.Provider>
}

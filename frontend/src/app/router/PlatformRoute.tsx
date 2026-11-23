import { Outlet } from 'react-router'
import { usePlatformAccess } from '@/features/platform/context'
export function PlatformRoute() {
  const access = usePlatformAccess()
  if (access === 'loading') return <p role="status">Checking platform access…</p>
  if (access === 'denied') return <section><h2>Access denied</h2><p>Platform owner access is required.</p></section>
  if (access === 'unavailable') return <section><h2>Platform workspace unavailable</h2><p>Unable to verify platform access. Please refresh and try again.</p></section>
  return <Outlet />
}

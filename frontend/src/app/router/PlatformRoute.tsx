import { Outlet } from 'react-router'
import { usePlatformAccess } from '@/features/platform/context'
export function PlatformRoute() {
  const access = usePlatformAccess()
  if (access === 'loading') return <p role="status">Checking platform access…</p>
  if (access === 'denied') return <section><h2>Access denied</h2><p>Platform owner access is required.</p></section>
  if (access === 'unavailable') return <section role="alert" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
    <h2 className="text-xl font-semibold">Platform workspace unavailable</h2>
    <p>The backend could not verify platform-owner access. Check that the API and its database connection are healthy, then retry.</p>
    <button type="button" onClick={() => window.location.reload()} className="rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm font-semibold">Retry</button>
  </section>
  return <Outlet />
}

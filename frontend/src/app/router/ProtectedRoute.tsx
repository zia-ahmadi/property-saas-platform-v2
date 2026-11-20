import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/features/auth/context'
import { Button } from '@/components/ui/button'

export function ProtectedRoute() {
  const { state, service } = useAuth()
  const location = useLocation()
  if (state.status === 'authenticated') return <Outlet />
  if (state.status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (state.status === 'authenticating' || state.status === 'refreshing') return <main role="status" className="p-8">Verifying your session…</main>
  return <main className="mx-auto max-w-md space-y-4 p-8"><h1 className="text-xl font-semibold">Session unavailable</h1><p role="alert">{state.message}</p>{state.status === 'network-error' && <Button onClick={() => void service.retrySessionVerification()}>Retry verification</Button>} <Button variant="outline" onClick={() => { void service.signOut() }}>Return to sign in</Button></main>
}

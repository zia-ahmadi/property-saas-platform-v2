import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Building2 } from 'lucide-react'
import { useAuth } from '@/features/auth/context'

function safeDestination(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /%(2f|5c)/i.test(value) || [...value].some(char => char.charCodeAt(0) < 32)) return '/dashboard'
  return value === '/login' ? '/dashboard' : value
}
export function LoginPage() {
  const { state, service } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const entry = location.state as { from?: unknown; registered?: boolean; invitationAccepted?: boolean } | null
  const from = safeDestination(entry?.from)
  useEffect(() => {
    if (state.status === 'restoring') void service.restoreSession()
  }, [service, state.status])
  if (state.status === 'authenticated') {
    const destination = from === '/dashboard' && !state.session.organizations.length ? '/access' : from
    return <Navigate to={destination} replace />
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!email.trim() || !password) { setError('Enter your email and password.'); return }
    setError('')
    await service.signIn({ email: email.trim(), password })
    setPassword('')
  }
  const message = error || ('message' in state ? state.message : '')
  const busy = state.status === 'authenticating' || state.status === 'refreshing' || state.status === 'restoring'

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-8 sm:px-6">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
        <Link to="/" className="inline-flex min-h-9 items-center gap-2 rounded-md text-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-4">
          <ArrowLeft aria-hidden="true" className="size-4" /> Home
        </Link>
        <div className="space-y-3">
          <Building2 aria-hidden="true" className="size-11 rounded-xl bg-primary p-2.5 text-primary-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">Property SaaS Portal</h1>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </div>
        {entry?.invitationAccepted && <p role="status" className="rounded-lg bg-muted p-3 text-sm">Invitation accepted. Sign in to continue.</p>}
        {entry?.registered && <p role="status" className="rounded-lg bg-muted p-3 text-sm">Account created. Your organization is pending review. Sign in to check its status.</p>}
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email">Email address</Label>
            <Input id="login-email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} className="h-10" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">Password</Label>
            <PasswordInput id="login-password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} className="h-10" />
          </div>
          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
          <Button type="submit" className="h-11 w-full" disabled={busy}>
            {state.status === 'authenticating' ? 'Signing in…' : 'Sign in'}
          </Button>
          {state.status === 'network-error' && (
            <Button type="button" variant="outline" className="h-10 w-full" onClick={() => void service.retrySessionVerification()}>
              Retry session verification
            </Button>
          )}
        </form>
        <p className="text-center text-sm">Need an account? <Link to="/register" className="font-medium underline underline-offset-4">Create an organization</Link></p>
      </div>
    </main>
  )
}

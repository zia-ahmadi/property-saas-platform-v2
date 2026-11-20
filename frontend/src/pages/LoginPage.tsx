import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Building2 } from 'lucide-react'
import { useAuth } from '@/features/auth/context'

function safeDestination(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /%(2f|5c)/i.test(value) || [...value].some(char => char.charCodeAt(0) < 32)) return '/dashboard'
  return value === '/login' ? '/dashboard' : value
}
export function LoginPage() {
  const { state, service } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const from = safeDestination((location.state as { from?: unknown } | null)?.from)
  if (state.status === 'authenticated') return <Navigate to={from} replace />
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!email.trim() || !password) { setError('Enter your email and password.'); return }
    setError('')
    if (await service.signIn({ email: email.trim(), password })) navigate(from, { replace: true })
    setPassword('')
  }
  const message = error || (state.status === 'anonymous' ? state.message : state.status === 'network-error' || state.status === 'recovery-required' ? state.message : '')
  return <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6"><div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 shadow-lg">
    <div className="flex flex-col items-center space-y-2 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Building2 aria-hidden="true" /></div><h1 className="text-2xl font-bold">Property SaaS Portal</h1><p className="text-sm text-muted-foreground">Sign in to your account</p></div>
    {(location.state as { registered?: boolean } | null)?.registered && <p role="status" className="text-sm">Account created. Please sign in.</p>}<form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label htmlFor="login-email">Email address</Label><Input id="login-email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="login-password">Password</Label><PasswordInput id="login-password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></div>{message && <p role="alert" className="text-sm text-destructive">{message}</p>}<Button type="submit" className="w-full" disabled={state.status === 'authenticating' || state.status === 'refreshing'}>{state.status === 'authenticating' ? 'Signing in…' : 'Sign in'}</Button>{state.status === 'network-error' && <Button type="button" variant="outline" className="w-full" onClick={() => void service.retrySessionVerification()}>Retry session verification</Button>}</form><p className="text-center text-sm">Need an account? <Link to="/register" className="underline">Create an organization</Link></p>
  </div></main>
}

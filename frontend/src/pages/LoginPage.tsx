import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Building2, Lock, Mail } from 'lucide-react'

export function LoginPage() {
  const navigate = useNavigate()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    navigate('/dashboard')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 shadow-lg">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <Building2 className="size-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Property SaaS Portal</h1>
          <p className="text-sm text-muted-foreground">Sign in to your enterprise tenant account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="login-email"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail
                aria-hidden="true"
                className="absolute left-3 top-3 size-4 text-muted-foreground"
              />
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                required
                defaultValue="admin@enterprise.com"
                className="w-full rounded-lg border border-muted-foreground bg-background px-3 py-2 pl-9 text-sm outline-none focus:ring-2 focus:ring-ring/20"
                placeholder="name@company.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="login-password"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Password
            </label>
            <div className="relative">
              <Lock
                aria-hidden="true"
                className="absolute left-3 top-3 size-4 text-muted-foreground"
              />
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                defaultValue="••••••••"
                className="w-full rounded-lg border border-muted-foreground bg-background px-3 py-2 pl-9 text-sm outline-none focus:ring-2 focus:ring-ring/20"
                placeholder="••••••••"
              />
            </div>
          </div>

          <Button type="submit" className="w-full font-medium">
            Sign In to Dashboard
          </Button>
        </form>

        <div className="text-center text-xs text-muted-foreground">
          <p>Milestone F1 • Task 4 (Placeholder Authentication View)</p>
        </div>
      </div>
    </main>
  )
}

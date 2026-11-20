import { Link } from 'react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import { useOptionalAuth } from '@/features/auth/context'

export function ForbiddenPage() {
  const auth = useOptionalAuth()
  return <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center"><h1 className="text-3xl font-bold">Access denied</h1><p>You do not have permission to access this page in the selected organization.</p><Link className={buttonVariants()} to="/dashboard">Return to dashboard</Link>{auth && <Button variant="outline" onClick={() => { void auth.service.signOut() }}>Sign out</Button>}</main>
}

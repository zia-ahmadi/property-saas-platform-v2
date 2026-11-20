import { Link } from 'react-router'
import { buttonVariants } from '@/components/ui/button'

export function UnauthorizedPage() {
  return <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center"><h1 className="text-3xl font-bold">Sign-in required</h1><p>Please sign in to access your account.</p><Link className={buttonVariants()} to="/login">Go to sign in</Link></main>
}

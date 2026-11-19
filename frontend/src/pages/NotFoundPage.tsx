import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Home } from 'lucide-react'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center space-y-6">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-10" />
      </div>
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">404</h1>
        <p className="text-muted-foreground">The page you are looking for does not exist.</p>
      </div>
      <Button onClick={() => navigate('/dashboard')} className="gap-2">
        <Home className="size-4" /> Return to Dashboard
      </Button>
    </div>
  )
}

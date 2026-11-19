
import { Button } from '@/components/ui/button'

function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">
          Property Management SaaS
        </h1>

        <p className="text-muted-foreground">
          React + TypeScript + Tailwind CSS + shadcn/ui
        </p>

        <Button
          onClick={() => window.alert('shadcn/ui is working!')}
        >
          Test Button
        </Button>
      </div>
    </main>
  )
}

export default App

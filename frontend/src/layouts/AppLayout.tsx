import { NavLink, Outlet, useNavigate } from 'react-router'
import { LayoutDashboard, Building2, Settings, LogOut, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AppLayout() {
  const navigate = useNavigate()

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/properties', label: 'Properties', icon: Building2 },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-6 border-b flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold">
            PS
          </div>
          <div>
            <h2 className="font-semibold text-sm">Property SaaS</h2>
            <p className="text-xs text-muted-foreground">Enterprise Portal</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`
                }
              >
                <Icon className="size-4" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="p-4 border-t space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
            <ShieldCheck className="size-4 text-emerald-500" />
            <span>Tenant Isolated (JWT)</span>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => navigate('/login')}
          >
            <LogOut className="size-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card px-8 flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Property Management Platform</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs px-2.5 py-1 rounded-full bg-muted font-medium text-muted-foreground">
              Milestone F1 • Task 4
            </span>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto bg-background/50">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

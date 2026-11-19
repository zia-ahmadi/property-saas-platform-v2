import { Building2, LayoutDashboard, Settings } from 'lucide-react'
import { NavLink } from 'react-router'

const destinations = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/properties', label: 'Properties', icon: Building2 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function AppSidebar() {
  return (
    <aside className="w-full shrink-0 border-b border-sidebar-border bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-dvh md:w-64 md:overflow-y-auto md:border-r md:border-b-0">
      <div className="flex items-center gap-3 border-b border-sidebar-border p-6">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
        >
          PS
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Property SaaS</p>
          <p className="text-xs text-muted-foreground">Enterprise Portal</p>
        </div>
      </div>
      <nav aria-label="Main navigation" className="flex flex-wrap gap-1 p-4 md:flex-col">
        {destinations.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                  : 'font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`
            }
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

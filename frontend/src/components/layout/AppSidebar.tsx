import { Building2 } from 'lucide-react'
import { useLocation } from 'react-router'
import { AppNavigation } from './AppNavigation'

export function AppSidebar() {
  const { pathname } = useLocation()
  const platformWorkspace = pathname === '/platform' || pathname.startsWith('/platform/')
  return (
    <aside className="sticky top-0 hidden h-dvh w-52 lg:w-56 shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:block">
      <div className="flex items-center gap-3 px-5 py-5">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
        >
          <Building2 className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Property SaaS</p>
          <p className="text-xs text-muted-foreground">{platformWorkspace ? 'Platform workspace' : 'Organization workspace'}</p>
        </div>
      </div>
      <AppNavigation />
    </aside>
  )
}

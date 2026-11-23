import { Building2, LayoutDashboard, Settings, Users } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'
import { useOptionalOrganization } from '@/features/organization/context'

const destinations = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/properties', label: 'Properties', icon: Building2, permission: 'PROPERTY_VIEW' as const },
  { to: '/renters', label: 'Renters', icon: Users, permission: 'PROPERTY_VIEW' as const },
  { to: '/access', label: 'Organization access', icon: Building2 },
  { to: '/team', label: 'Team', icon: Users, permission: 'MEMBERSHIP_MANAGE' as const },
  { to: '/inbox', label: 'Inbox', icon: Users, permission: 'MEMBERSHIP_MANAGE' as const },
  { to: '/settings', label: 'Settings', icon: Settings, permission: 'ORGANIZATION_MANAGE' as const },
]

interface AppNavigationProps {
  label?: string
  onNavigate?: () => void
}

export function AppNavigation({ label = 'Main navigation', onNavigate }: AppNavigationProps) {
  const organization = useOptionalOrganization()
  const { pathname } = useLocation()
  const platformWorkspace = pathname === '/platform' || pathname.startsWith('/platform/')
  const available = destinations.filter(item => !('permission' in item) || !item.permission || (organization?.can(item.permission) ?? false))
  return (
    <nav aria-label={label} className="flex flex-col gap-1 p-4">
      {platformWorkspace ? <NavLink to="/platform" onClick={onNavigate} className="flex min-h-11 items-center rounded-lg bg-sidebar-accent px-3 py-2.5 text-sm font-semibold">Organizations</NavLink> : available.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors motion-reduce:transition-none ${
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
  )
}

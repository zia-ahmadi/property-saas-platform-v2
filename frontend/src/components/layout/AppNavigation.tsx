import { Building2, KeyRound, LayoutDashboard, Settings, Users, Wrench } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'
import { useOptionalOrganization } from '@/features/organization/context'

const destinations = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Workspace' },
  {
    to: '/properties',
    label: 'Properties',
    icon: Building2,
    permission: 'PROPERTY_VIEW' as const,
    group: 'Portfolio',
  },
  {
    to: '/renters',
    label: 'Renters',
    icon: Users,
    permission: 'PROPERTY_VIEW' as const,
    group: 'Portfolio',
  },
  {
    to: '/leases',
    label: 'Leasing',
    icon: KeyRound,
    permission: 'LEASE_MANAGE' as const,
    group: 'Portfolio',
  },
  {
    to: '/maintenance',
    label: 'Maintenance',
    icon: Wrench,
    permission: 'MAINTENANCE_MANAGE' as const,
    group: 'Portfolio',
  },
  { to: '/access', label: 'Organization access', icon: Building2, group: 'Organization' },
  {
    to: '/team',
    label: 'Team',
    icon: Users,
    permission: 'MEMBERSHIP_MANAGE' as const,
    group: 'Organization',
  },
  {
    to: '/inbox',
    label: 'Inbox',
    icon: Users,
    permission: 'MEMBERSHIP_MANAGE' as const,
    group: 'Organization',
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: Settings,
    permission: 'ORGANIZATION_MANAGE' as const,
    group: 'Organization',
  },
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
    <nav aria-label={label} className="flex flex-col gap-5 p-4">
      {platformWorkspace ? (
        <NavLink
          to="/platform"
          onClick={onNavigate}
          className="flex min-h-11 items-center rounded-lg bg-sidebar-accent px-3 py-2.5 text-sm font-semibold"
        >
          Organizations
        </NavLink>
      ) : (
        ['Workspace', 'Portfolio', 'Organization'].map((group) => {
          const items = available.filter((item) => item.group === group)
          if (!items.length) return null
          return (
            <section key={group} aria-label={`${group} navigation`}>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {group}
              </p>
              <div className="flex flex-col gap-1">
                {items.map(({ to, label: itemLabel, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors motion-reduce:transition-none ${
                        isActive
                          ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                          : 'font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      }`
                    }
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    {itemLabel}
                  </NavLink>
                ))}
              </div>
            </section>
          )
        })
      )}
    </nav>
  )
}

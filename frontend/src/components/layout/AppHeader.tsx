import { Link, matchPath, useLocation } from 'react-router'
import { usePlatformAccess } from '@/features/platform/context'
import { MobileNavigation } from './MobileNavigation'
import { useOptionalAuth } from '@/features/auth/context'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useOptionalOrganization } from '@/features/organization/context'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { OrganizationStatus } from '@/features/organization/OrganizationStatus'

export function AppHeader() {
  const { pathname } = useLocation()
  const auth = useOptionalAuth()
  const organization = useOptionalOrganization()
  const platformAccess = usePlatformAccess()
  const platformWorkspace = pathname === '/platform' || pathname.startsWith('/platform/')
  const [warning, setWarning] = useState(false)
  const title = pathname === '/notifications' ? 'Notifications' : platformWorkspace
    ? 'Platform workspace'
    : matchPath('/renters/*', pathname)
      ? 'Renters'
      : matchPath('/properties/:propertyId/units/*', pathname)
        ? 'Units'
        : matchPath('/properties/:propertyId/edit', pathname)
          ? 'Edit property'
          : matchPath('/properties/:propertyId', pathname)
            ? 'Property Details'
            : matchPath('/properties/new', pathname)
              ? 'Add property'
              : matchPath('/properties', pathname)
                ? 'Properties'
                : matchPath('/team', pathname)
                  ? 'Team'
                  : matchPath('/inbox', pathname) || matchPath('/organization-messages/:organizationId', pathname)
                    ? 'Support'
                    : matchPath('/access', pathname)
                      ? 'Organization access'
                      : matchPath('/settings', pathname)
                        ? 'Settings'
                        : matchPath('/maintenance/*', pathname)
                          ? 'Maintenance'
                          : matchPath('/leases/*', pathname)
                            ? 'Leasing'
                            : matchPath('/billing/*', pathname)
                              ? 'Billing'
                              : 'Dashboard'

  return (
    <header className="flex min-h-16 min-w-0 flex-wrap items-center justify-between gap-4 border-b bg-card px-4 py-3 text-card-foreground sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <MobileNavigation />
        <h1 className="min-w-0 break-words text-lg font-semibold tracking-tight">{title}</h1>
      </div>

      <div className="flex w-full min-w-0 flex-wrap items-center gap-3 sm:w-auto">
        {platformAccess === 'allowed' && <Link className="rounded border px-3 py-2 text-sm" to={platformWorkspace ? (organization?.current ? '/dashboard' : '/access') : '/platform'}>{platformWorkspace ? 'Switch to organization workspace' : 'Switch to platform workspace'}</Link>}
        {!platformWorkspace && organization &&
          (organization.current ? (
            <label className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm sm:flex-none">
              Organization{' '}
              <select
                aria-label="Organization"
                className="min-h-11 w-40 min-w-0 max-w-full rounded border bg-background p-1"
                value={organization.current.organizationId}
                onChange={(event) => organization.select(event.target.value)}
              >
                {organization.organizations.map((org) => (
                  <option key={org.organizationId} value={org.organizationId}>
                    {org.organizationName}
                  </option>
                ))}
              </select>
              <OrganizationStatus organization={organization} />
            </label>
          ) : (
            <span className="text-sm">No active organization</span>
          ))}
        {warning && <span role="alert">Server logout could not be confirmed.</span>}
        {auth?.state.status === 'authenticated' && <NotificationBell />}
        {auth && (
          <Button
            variant="outline"
            onClick={() => {
              void auth.service.signOut().then((ok) => {
                if (!ok) setWarning(true)
              })
            }}
          >
            Sign out
          </Button>
        )}
      </div>
    </header>
  )
}

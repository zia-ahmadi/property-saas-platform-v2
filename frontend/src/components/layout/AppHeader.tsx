import { Link, matchPath, useLocation } from 'react-router'
import { Building2, ChevronDown, LayoutGrid, LogOut } from 'lucide-react'
import { usePlatformAccess } from '@/features/platform/context'
import { MobileNavigation } from './MobileNavigation'
import { useOptionalAuth } from '@/features/auth/context'
import { useState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { useOptionalOrganization } from '@/features/organization/context'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { OrganizationStatus } from '@/features/organization/OrganizationStatus'

function accountInitials(firstName: string, lastName: string, email: string) {
  const fromName = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.trim()
  return (fromName || email?.[0] || '?').toUpperCase()
}

export function AppHeader() {
  const { pathname } = useLocation()
  const auth = useOptionalAuth()
  const organization = useOptionalOrganization()
  const platformAccess = usePlatformAccess()
  const platformWorkspace = pathname === '/platform' || pathname.startsWith('/platform/')
  const [warning, setWarning] = useState(false)
  const user = auth?.state.status === 'authenticated' ? auth.state.session.user : null
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
    <header className="sticky top-0 z-30 min-w-0 border-b border-border bg-card/95 text-card-foreground shadow-xs backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex min-h-16 min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <MobileNavigation />
          <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight">{title}</h1>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          {platformAccess === 'allowed' && (
            <Link
              className={buttonVariants({ variant: 'outline', className: 'h-10 gap-2 px-3' })}
              to={platformWorkspace ? (organization?.current ? '/dashboard' : '/access') : '/platform'}
            >
              <LayoutGrid aria-hidden="true" className="size-4" />
              <span className="sr-only lg:not-sr-only">
                {platformWorkspace ? 'Switch to organization workspace' : 'Switch to platform workspace'}
              </span>
            </Link>
          )}

          {!platformWorkspace && organization &&
            (organization.current ? (
              <>
                <div className="relative flex items-center">
                  <Building2
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
                  />
                  <select
                    aria-label="Organization"
                    className="h-10 w-36 min-w-0 appearance-none rounded-lg border border-input bg-background py-2 pr-9 pl-9 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-44"
                    value={organization.current.organizationId}
                    onChange={(event) => organization.select(event.target.value)}
                  >
                    {organization.organizations.map((org) => (
                      <option key={org.organizationId} value={org.organizationId}>
                        {org.organizationName}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 size-4 text-muted-foreground"
                  />
                </div>
                <span className="hidden sm:inline-flex">
                  <OrganizationStatus organization={organization} />
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">No active organization</span>
            ))}

          {warning && <span role="alert">Server logout could not be confirmed.</span>}

          {user && (
            <>
              <NotificationBell />
              <span aria-hidden="true" className="hidden h-6 w-px bg-border sm:block" />
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                >
                  {accountInitials(user.firstName, user.lastName, user.email)}
                </span>
                <span className="hidden min-w-0 max-w-40 truncate text-sm font-medium lg:block">
                  {`${user.firstName} ${user.lastName}`.trim() || user.email}
                </span>
              </div>
            </>
          )}

          {auth && (
            <Button
              variant="outline"
              className="h-10 gap-2 px-3"
              onClick={() => {
                void auth.service.signOut().then((ok) => {
                  if (!ok) setWarning(true)
                })
              }}
            >
              <LogOut aria-hidden="true" className="size-4" />
              <span className="sr-only sm:not-sr-only">Sign out</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

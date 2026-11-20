import { matchPath, useLocation } from 'react-router'
import { MobileNavigation } from './MobileNavigation'
import { useOptionalAuth } from '@/features/auth/context'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useOptionalOrganization } from '@/features/organization/context'
import { OrganizationStatus } from '@/features/organization/OrganizationStatus'

export function AppHeader() {
  const { pathname } = useLocation()
  const auth = useOptionalAuth()
  const organization = useOptionalOrganization()
  const [warning, setWarning] = useState(false)
  const title = matchPath('/properties/:propertyId/units', pathname)
    ? 'Units'
    : matchPath('/properties/:propertyId', pathname)
      ? 'Property Details'
      : matchPath('/properties', pathname)
        ? 'Properties'
        : matchPath('/settings', pathname)
          ? 'Settings'
          : 'Dashboard'

  return (
    <header className="flex min-h-16 min-w-0 items-center justify-between gap-4 border-b bg-card px-4 py-3 text-card-foreground sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <MobileNavigation />
        <h1 className="min-w-0 break-words text-lg font-semibold tracking-tight">{title}</h1>
      </div>
      {/* Reserved for future account and organization controls. */}
      <div className="flex min-w-0 shrink-0 items-center gap-3">{organization && (organization.current ? <label className="text-sm">Organization <select aria-label="Organization" className="max-w-40 rounded border bg-background p-1" value={organization.current.organizationId} onChange={event => organization.select(event.target.value)}>{organization.organizations.map(org => <option key={org.organizationId} value={org.organizationId}>{org.organizationName}</option>)}</select><OrganizationStatus organization={organization} /></label> : <span className="text-sm">No active organization</span>)}{warning && <span role="alert">Server logout could not be confirmed.</span>}{auth && <Button variant="outline" onClick={() => { void auth.service.signOut().then(ok => { if (!ok) setWarning(true) }) }}>Sign out</Button>}</div>
    </header>
  )
}

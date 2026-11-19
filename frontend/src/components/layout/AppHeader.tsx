import { matchPath, useLocation } from 'react-router'

export function AppHeader() {
  const { pathname } = useLocation()
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
      <h1 className="min-w-0 break-words text-lg font-semibold tracking-tight">{title}</h1>
      {/* Reserved for future account and organization controls. */}
      <div className="flex min-w-0 shrink-0 items-center gap-3" />
    </header>
  )
}

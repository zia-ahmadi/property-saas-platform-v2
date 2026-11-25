import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useOptionalAuth } from '@/features/auth/context'
import { graphqlQuery } from '@/features/notifications/api'
import { useOrganization } from '@/features/organization/context'
import { dashboardSummary, dashboardError, type DashboardSummary } from '@/features/dashboard/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LoadingState } from '@/components/ui/loading-state'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'

export function DashboardPage() {
  const org = useOrganization()
  const auth = useOptionalAuth()
  const organizationId = org.current?.organizationId
  const permitted = !!org.current && !org.forbidden && org.can('PROPERTY_VIEW')
  const query = useQuery({
    queryKey: org.queryKey(['dashboard', 'summary']),
    queryFn: async ({ signal }) => {
      if (auth && organizationId) {
        try {
          const result = await graphqlQuery<{ portfolioDashboard: DashboardSummary }>(auth.service,
            `query PortfolioDashboard($organizationId: ID!) {
              portfolioDashboard(organizationId: $organizationId) {
                totalProperties activeProperties archivedProperties totalUnits availableUnits unavailableUnits occupiedUnits
              }
            }`, { organizationId }, signal)
          return dashboardSummary(result.portfolioDashboard)
        } catch {
          signal.throwIfAborted()
        }
      }
      return dashboardSummary(await org.request<DashboardSummary>('get', 'dashboard/summary', undefined, { signal }))
    },
    enabled: permitted,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  })
  const data = query.data
  return (
    <div className="min-w-0 space-y-6">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight">Enterprise Portfolio Dashboard</h2>
          <p className="wrap-anywhere text-muted-foreground">
            {org.current?.organizationName ?? 'Selected organization'} · Property and unit overview
          </p>
        </div>
        {permitted && (
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {query.isFetching ? 'Refreshing…' : 'Refresh dashboard'}
          </Button>
        )}
      </div>
      {!permitted ? (
        <p role="status">
          Portfolio widgets require an active organization and property viewing permission.
        </p>
      ) : (
        <>
          {query.isPending && (
            <LoadingState
              label="Loading portfolio summary…"
              placeholder={
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 7 }, (_, index) => (
                    <Skeleton key={index} className="h-28 w-full" />
                  ))}
                </div>
              }
            />
          )}
          {query.isError && (
            <ErrorState
              title="Dashboard unavailable"
              description={dashboardError(query.error)}
              onRetry={() => void query.refetch()}
              retrying={query.isFetching}
            />
          )}
          {data && !query.isError && (
            <>
              <p className="text-sm text-muted-foreground">
                Counts include archived properties and their units. Availability reflects the stored
                unit status, including units in archived properties.
              </p>
              <dl
                aria-label="Portfolio totals"
                className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
              >
                {(
                  [
                    ['Total properties', data.totalProperties],
                    ['Active properties', data.activeProperties],
                    ['Archived properties', data.archivedProperties],
                    ['Total units', data.totalUnits],
                    ['Available units', data.availableUnits],
                    ['Unavailable units', data.unavailableUnits],
                    ['Occupied units', data.occupiedUnits],
                  ] as const
                ).map(([label, value]) => (
                  <Card key={label}>
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd
                      className="wrap-anywhere text-3xl font-semibold tabular-nums"
                      aria-label={`${label}: ${value}`}
                      data-metric={label}
                    >
                      {value.toLocaleString()}
                    </dd>
                  </Card>
                ))}
              </dl>
              {data.totalProperties === 0 && (
                <EmptyState
                  title="Your portfolio is empty"
                  description={
                    org.can('PROPERTY_MANAGE')
                      ? 'Add your first property, then create units within it.'
                      : 'No properties have been added to this organization. A property manager can add them.'
                  }
                />
              )}
              <section
                aria-labelledby="availability-heading"
                className="min-w-0 space-y-4 rounded-xl border bg-card p-4 sm:p-6"
              >
                <h3 id="availability-heading" className="text-lg font-semibold">
                  Unit availability
                </h3>
                {data.totalUnits === 0 ? (
                  <p>No units yet. Open a property to view or add its units.</p>
                ) : (
                  <>
                    <div
                      aria-hidden="true"
                      className="flex h-5 w-full overflow-hidden rounded bg-muted"
                    >
                      {[
                        { count: data.availableUnits, color: 'bg-green-600' },
                        { count: data.unavailableUnits, color: 'bg-amber-500' },
                        { count: data.occupiedUnits, color: 'bg-blue-600' },
                      ].map((segment, index) => (
                        <span
                          key={index}
                          className={segment.color}
                          style={{ width: `${(segment.count / data.totalUnits) * 100}%` }}
                        />
                      ))}
                    </div>
                    <ul
                      aria-label="Unit availability counts"
                      className="flex min-w-0 flex-wrap gap-x-6 gap-y-3"
                    >
                      <li>
                        <span
                          aria-hidden="true"
                          className="mr-2 inline-block size-3 rounded bg-green-600"
                        />
                        AVAILABLE: {data.availableUnits.toLocaleString()}
                      </li>
                      <li>
                        <span
                          aria-hidden="true"
                          className="mr-2 inline-block size-3 rounded bg-amber-500"
                        />
                        UNAVAILABLE: {data.unavailableUnits.toLocaleString()}
                      </li>
                      <li>
                        <span
                          aria-hidden="true"
                          className="mr-2 inline-block size-3 rounded bg-blue-600"
                        />
                        OCCUPIED: {data.occupiedUnits.toLocaleString()}
                      </li>
                    </ul>
                  </>
                )}
                <p className="text-sm text-muted-foreground">
                  AVAILABLE and UNAVAILABLE are managed within a property. Occupancy is controlled
                  through lease management. Archived properties remain read-only.
                </p>
              </section>
            </>
          )}
          <section
            aria-labelledby="quick-navigation-heading"
            className="space-y-3 rounded-xl border bg-card p-4 sm:p-6"
          >
            <h3 id="quick-navigation-heading" className="text-lg font-semibold">
              Quick navigation
            </h3>
            <p className="text-sm text-muted-foreground">
              Open a property to view its details, units and availability.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link className={buttonVariants({ variant: 'outline' })} to="/properties">
                View Properties
              </Link>
              {org.can('PROPERTY_MANAGE') && (
                <Link className={buttonVariants()} to="/properties/new">
                  Add property
                </Link>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

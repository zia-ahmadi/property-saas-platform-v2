import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ArrowUpRight, Building2, MapPin, Plus, RefreshCw } from 'lucide-react'
import { useOrganization } from '@/features/organization/context'
import type { PropertyPage } from '@/features/properties/api'
import { propertyError } from '@/features/properties/errors'
import { Button, buttonVariants } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { OrganizationImage } from '@/components/OrganizationImage'

export function PropertiesPage() {
  const org = useOrganization()
  const [paging, setPaging] = useState({ organizationId: org.current?.organizationId, page: 0 })
  const page = paging.organizationId === org.current?.organizationId ? paging.page : 0
  const setPage = (next: number) => setPaging({ organizationId: org.current?.organizationId, page: next })
  const [size, setSize] = useState(10)
  const query = useQuery({ queryKey: org.queryKey(['properties', page, size]), queryFn: ({ signal }) => org.request<PropertyPage>('get', 'properties', undefined, { params: { page, size }, signal }), retry: false })
  const canManage = org.can('PROPERTY_MANAGE')
  const properties = query.data?.content ?? []
  const activeOnPage = properties.filter((property) => property.status === 'ACTIVE').length
  const archivedOnPage = properties.filter((property) => property.status === 'ARCHIVED').length
  const firstResult = query.data?.totalElements
    ? query.data.page * query.data.size + 1
    : 0
  const lastResult = query.data
    ? Math.min((query.data.page + 1) * query.data.size, query.data.totalElements)
    : 0

  return (
    <div className="mx-auto w-full max-w-[1440px] min-w-0 space-y-7">
      <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-5 py-7 text-white shadow-lg sm:px-8 sm:py-9">
        <div
          aria-hidden="true"
          className="absolute -right-10 -top-20 -z-10 size-72 rounded-full bg-indigo-400/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-28 left-1/3 -z-10 size-64 rounded-full bg-cyan-300/10 blur-3xl"
        />
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
              Property portfolio
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Properties</h2>
            <p className="max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              Keep every address, building, and unit organized in one clear view.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
              className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              {query.isFetching ? 'Refreshing…' : 'Refresh'}
            </Button>
            {canManage && (
              <Link
                className={buttonVariants({
                  className: 'bg-white text-slate-950 hover:bg-slate-100',
                })}
                to="/properties/new"
              >
                <Plus aria-hidden="true" className="size-4" />
                Add property
              </Link>
            )}
          </div>
        </div>
      </section>

      {query.data && (
        <dl aria-label="Property portfolio summary" className="grid gap-3 sm:grid-cols-3">
          {[
            {
              label: 'Properties in portfolio',
              value: query.data.totalElements,
              detail: 'Across all pages',
              tone: 'text-slate-900 dark:text-slate-100',
            },
            {
              label: 'Active on this page',
              value: activeOnPage,
              detail: 'Ready to manage',
              tone: 'text-emerald-700 dark:text-emerald-300',
            },
            {
              label: 'Archived on this page',
              value: archivedOnPage,
              detail: 'Kept for your records',
              tone: 'text-amber-700 dark:text-amber-300',
            },
          ].map((stat) => (
            <Card key={stat.label} className="gap-2 border-border/70 p-4 sm:p-5">
              <dt className="text-sm text-muted-foreground">{stat.label}</dt>
              <dd className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className={`text-3xl font-semibold tracking-tight tabular-nums ${stat.tone}`}>
                  {stat.value.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">{stat.detail}</span>
              </dd>
            </Card>
          ))}
        </dl>
      )}

      <section aria-labelledby="property-list-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 id="property-list-heading" className="text-xl font-semibold tracking-tight">
              Your properties
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Select a property to review its details and manage its units.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Rows per page
            <select
              aria-label="Page size"
              className="min-h-10 rounded-lg border bg-card px-3 text-foreground"
              value={size}
              onChange={(event) => {
                setSize(Number(event.target.value))
                setPage(0)
              }}
            >
              {[10, 25, 50, 100].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        {query.isPending && (
          <div role="status" aria-label="Loading properties" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-52 rounded-2xl" />
            ))}
          </div>
        )}
        {query.isError && (
          <ErrorState
            title="Properties unavailable"
            description={propertyError(query.error)}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        )}
        {query.data && properties.length === 0 && (
          <EmptyState
            icon={<Building2 className="size-5" />}
            title="No properties yet"
            description={
              canManage
                ? 'Add your first property to start building an organized portfolio.'
                : 'No properties have been added to this organization yet.'
            }
            action={
              canManage ? (
                <Link className={buttonVariants()} to="/properties/new">
                  <Plus aria-hidden="true" className="size-4" />
                  Add your first property
                </Link>
              ) : undefined
            }
          />
        )}
        {query.data && properties.length > 0 && (
          <>
            <ul aria-label="Properties" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {properties.map((property) => (
                <li key={property.id} className="min-w-0">
                  <Card className="group h-full gap-5 rounded-2xl border-border/70 p-5 transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none">
                    <OrganizationImage
                      resourceType="property"
                      resourceId={property.id}
                      alt={`${property.name} property`}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary ring-1 ring-primary/10">
                        <Building2 aria-hidden="true" className="size-5" />
                      </span>
                      <Badge
                        variant={property.status === 'ACTIVE' ? 'secondary' : 'outline'}
                        className={
                          property.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : 'text-muted-foreground'
                        }
                      >
                        {property.status === 'ACTIVE' ? 'Active' : 'Archived'}
                      </Badge>
                    </div>
                    <div className="min-w-0 space-y-2">
                      <h4 className="wrap-anywhere text-lg font-semibold tracking-tight">
                        <Link
                          className="rounded-sm outline-offset-4 hover:text-primary focus-visible:text-primary"
                          to={`/properties/${property.id}`}
                        >
                          {property.name}
                        </Link>
                      </h4>
                      <p className="flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                        <span className="wrap-anywhere">
                          {property.addressLine1}, {property.city}, {property.countryCode}
                        </span>
                      </p>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {property.propertyType.replaceAll('_', ' ')}
                      </span>
                      <Link
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-primary transition hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                        to={`/properties/${property.id}`}
                        aria-label={`Open ${property.name}`}
                      >
                        Open property
                        <ArrowUpRight aria-hidden="true" className="size-4" />
                      </Link>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {firstResult}–{lastResult} of {query.data.totalElements} properties
              </p>
              <Pagination
                page={page + 1}
                totalPages={query.data.totalPages}
                onPageChange={(nextPage) => setPage(nextPage - 1)}
              />
            </div>
          </>
        )}
      </section>
    </div>
  )
}

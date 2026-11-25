import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ArrowUpRight, Building2, ChartPie, DoorOpen, KeyRound, Plus, Search } from 'lucide-react'
import { useOrganization } from '@/features/organization/context'
import { propertyTypes, type Property, type PropertyPage } from '@/features/properties/api'
import { propertyError } from '@/features/properties/errors'
import { dashboardSummary, type DashboardSummary } from '@/features/dashboard/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { OrganizationImage } from '@/components/OrganizationImage'
import { LoadingState } from '@/components/ui/loading-state'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const scopes = [
  { status: '', label: 'All properties', count: 'totalProperties' },
  { status: 'ACTIVE', label: 'Active', count: 'activeProperties' },
  { status: 'ARCHIVED', label: 'Archived', count: 'archivedProperties' },
] as const

export function PropertiesPage() {
  const org = useOrganization()
  return <PropertyRegister key={org.current?.organizationId} />
}

function PropertyRegister() {
  const org = useOrganization()
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(10)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const canManage = org.can('PROPERTY_MANAGE')
  const filtered = Boolean(search || status || type)
  const query = useQuery({
    queryKey: org.queryKey(['properties', page, size, search, status, type]),
    queryFn: ({ signal }) => org.request<PropertyPage>('get', 'properties', undefined, {
      params: { page, size, ...(search && { search }), ...(status && { status }), ...(type && { type }) }, signal,
    }),
    retry: false,
  })
  const summary = useQuery({
    queryKey: org.queryKey(['dashboard', 'summary']),
    queryFn: async ({ signal }) => dashboardSummary(await org.request<DashboardSummary>('get', 'dashboard/summary', undefined, { signal })),
    retry: false,
  })
  const totals = summary.data
  const percent = totals?.totalUnits
    ? new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(totals.occupiedUnits / totals.totalUnits)
    : '—'
  const stats = [
    { label: 'Total properties', value: totals?.totalProperties ?? (!filtered ? query.data?.totalElements : undefined), icon: Building2, note: totals ? `${totals.activeProperties} active` : undefined },
    { label: 'Occupancy rate', value: percent, icon: ChartPie, note: totals?.totalUnits ? `${totals.occupiedUnits} of ${totals.totalUnits} occupied` : undefined },
    { label: 'Total units', value: totals?.totalUnits, icon: KeyRound, note: totals ? `${totals.unavailableUnits} unavailable` : undefined },
    { label: 'Available units', value: totals?.availableUnits, icon: DoorOpen },
  ]

  const firstResult = query.data ? query.data.page * query.data.size + 1 : 0
  const lastResult = query.data ? Math.min((query.data.page + 1) * query.data.size, query.data.totalElements) : 0

  function clearFilters() {
    setDraft('')
    setSearch('')
    setStatus('')
    setType('')
    setPage(0)
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] min-w-0 space-y-6">
      <PageHeader headingLevel={2} title="Properties" description="Manage your properties, units, and occupancy."
        actions={canManage && <Link className={buttonVariants({ className: 'h-10 px-3' })} to="/properties/new">
          <Plus aria-hidden="true" className="size-4" /> Add property
        </Link>} />

      {summary.isError && <ErrorState title="Couldn’t load portfolio totals" onRetry={() => void summary.refetch()} />}
      <dl aria-label="Property portfolio summary" aria-busy={summary.isPending} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, note }) => (
          <div key={label} className="min-w-0 rounded-xl border bg-card p-3 sm:p-4">
            <dt className="flex items-start justify-between gap-1.5 text-sm font-medium text-muted-foreground">
              {label}<Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
            </dt>
            <dd className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value?.toLocaleString() ?? '—'}</dd>
            {note && <dd className="mt-1 text-xs text-muted-foreground">{note}</dd>}
          </div>
        ))}
      </dl>

      <section aria-label="Property register" className="min-w-0 rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-x-4 border-b px-3 sm:px-5">
          <div className="flex flex-wrap gap-x-3 sm:gap-x-5" role="group" aria-label="Property status">
            {scopes.map(scope => (
              <button key={scope.status} type="button" aria-pressed={status === scope.status}
                onClick={() => { setStatus(scope.status); setPage(0) }}
                className={`flex min-h-11 items-center gap-1.5 border-b-2 px-1 text-sm font-medium ${status === scope.status ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                {scope.label}
                {totals && <span className="rounded bg-muted px-1.5 text-xs tabular-nums">{totals[scope.count]}</span>}
              </button>
            ))}
          </div>
          {query.data && <p role="status" className="py-2 text-xs text-muted-foreground">{query.data.totalElements} matching {query.data.totalElements === 1 ? 'property' : 'properties'}</p>}
        </div>

        <form className="flex flex-wrap items-end gap-2 p-3 sm:px-5" onSubmit={event => {
          event.preventDefault()
          setSearch(draft.trim())
          setPage(0)
        }}>
          <label className="min-w-36 flex-1 space-y-1 text-sm font-medium">
            <span>Search properties</span>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" type="search" placeholder="Name, street or city" maxLength={150} value={draft}
                onChange={event => {
                  setDraft(event.target.value)
                  if (!event.target.value) { setSearch(''); setPage(0) }
                }} />
            </div>
          </label>
          <Button variant="outline" type="submit" className="h-10">Search</Button>
          <Select label="Property type" value={type} onChange={event => { setType(event.target.value); setPage(0) }}>
            <option value="">All types</option>
            {propertyTypes.map(value => <option key={value} value={value}>{typeLabel(value)}</option>)}
          </Select>
          <Select label="Page size" value={size} onChange={event => { setSize(Number(event.target.value)); setPage(0) }}>
            {[10, 25, 50, 100].map(value => <option key={value} value={value}>{value}</option>)}
          </Select>
          {filtered && <Button variant="ghost" type="button" onClick={clearFilters}>Clear filters</Button>}
        </form>

        {query.isPending && <div className="border-t p-4"><LoadingState label="Loading properties" /></div>}
        {query.isError && <div className="border-t p-4"><ErrorState title="Properties unavailable" description={propertyError(query.error)}
          onRetry={() => void query.refetch()} retrying={query.isFetching} /></div>}
        {query.data && !query.data.content.length && (
          <div className="border-t p-4">
            <EmptyState icon={<Building2 className="size-5" />}
              title={page ? 'No properties on this page' : filtered ? 'No matching properties' : 'No properties yet'}
              description={page ? 'Return to the first page to see current results.' : filtered ? 'Change your search or filters to find a property.' : 'Add a property to start managing its units.'}
              action={page ? <Button variant="outline" onClick={() => setPage(0)}>First page</Button>
                : !filtered && canManage ? <Link className={buttonVariants()} to="/properties/new">Add your first property</Link> : undefined} />
          </div>
        )}
        {query.data && query.data.content.length > 0 && <>
          <TableContainer aria-label="Properties" className="rounded-none border-x-0 border-b-0">
            <Table>
              <TableHeader className="text-xs text-muted-foreground">
                <TableRow>
                  <TableHead className="w-full">Property name</TableHead>
                  <TableHead className="hidden whitespace-nowrap sm:table-cell">Property type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead><span className="sr-only">Details</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{query.data.content.map(property => <PropertyRow key={property.id} property={property} />)}</TableBody>
            </Table>
          </TableContainer>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 sm:px-5">
            <p className="text-sm text-muted-foreground">Showing {firstResult}–{lastResult} of {query.data.totalElements} properties</p>
            <Pagination page={page + 1} totalPages={query.data.totalPages} onPageChange={next => setPage(next - 1)} />
          </div>
        </>}
      </section>
    </div>
  )
}

function PropertyRow({ property }: { property: Property }) {
  const url = `/properties/${property.id}`
  const address = [property.addressLine1, property.addressLine2, property.city, property.countryCode].filter(Boolean).join(', ')
  return <TableRow className="transition-colors hover:bg-muted/60">
    <TableCell className="min-w-32">
      <div className="flex items-center gap-3">
        <OrganizationImage resourceType="property" resourceId={property.id} alt={property.name} thumbnail className="hidden sm:flex" />
        <div className="min-w-0">
          <Link to={url} className="wrap-anywhere font-semibold hover:text-primary hover:underline">{property.name}</Link>
          <p className="mt-0.5 wrap-anywhere text-xs text-muted-foreground">{address}</p>
          <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">{typeLabel(property.propertyType)}</p>
        </div>
      </div>
    </TableCell>
    <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">{typeLabel(property.propertyType)}</TableCell>
    <TableCell>
      <Badge variant={property.status === 'ACTIVE' ? 'secondary' : 'outline'}
        className={property.status === 'ACTIVE' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}>
        {property.status === 'ACTIVE' ? 'Active' : 'Archived'}
      </Badge>
    </TableCell>
    <TableCell className="px-1 sm:px-4">
      <Link to={url} aria-label={`Open ${property.name}`} className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-primary">
        <ArrowUpRight aria-hidden="true" className="size-4" />
      </Link>
    </TableCell>
  </TableRow>
}

function typeLabel(value: string) {
  const label = value.toLowerCase().replaceAll('_', ' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

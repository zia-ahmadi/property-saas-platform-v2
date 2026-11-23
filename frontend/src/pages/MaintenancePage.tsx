import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowUpRight, CalendarDays, CheckCircle2, ClipboardList, MapPin, Plus, Timer, Wrench } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { LoadingState } from '@/components/ui/loading-state'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import { Select } from '@/components/ui/select'
import { useOrganization } from '@/features/organization/context'
import type { Property } from '@/features/properties/api'
import { categories, formatDate, isOverdue, maintenancePropertyId, priorities, statuses } from '@/features/maintenance/api'
import type { MaintenancePageData, MaintenanceSummary } from '@/features/maintenance/api'

const metrics = [
  { key: 'open', label: 'Open', icon: ClipboardList, color: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  { key: 'inProgress', label: 'In progress', icon: Timer, color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  { key: 'urgent', label: 'Active urgent', icon: AlertTriangle, color: 'bg-rose-500/10 text-rose-700 dark:text-rose-300' },
  { key: 'resolved', label: 'Resolved', icon: CheckCircle2, color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
] as const

const statusColors = {
  OPEN: metrics[0].color,
  IN_PROGRESS: metrics[1].color,
  RESOLVED: metrics[3].color,
  CANCELLED: 'bg-muted text-muted-foreground',
}

export function MaintenancePage() {
  const org = useOrganization()
  return <MaintenanceQueue key={org.current?.organizationId} />
}

function MaintenanceQueue() {
  const org = useOrganization()
  const [params, setParams] = useSearchParams()
  const search = (params.get('search') ?? '').slice(0, 150)
  const rawStatus = params.get('status') ?? ''
  const rawPriority = params.get('priority') ?? ''
  const status = Object.hasOwn(statuses, rawStatus) ? rawStatus : ''
  const priority = Object.hasOwn(priorities, rawPriority) ? rawPriority : ''
  const propertyId = maintenancePropertyId(params)
  const pageNumber = Number(params.get('page') ?? 0)
  const page = Number.isInteger(pageNumber) && pageNumber >= 0 && pageNumber <= 2147483647 ? pageNumber : 0
  const setFilter = (key: string, value: string) => {
    // Browser history is updated before the router renders the next search state.
    const next = new URLSearchParams(window.location.search)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  const query = useQuery({
    queryKey: org.queryKey(['maintenance', 'queue', propertyId, search, status, priority, page]),
    queryFn: ({ signal }) => org.request<MaintenancePageData>('get', 'maintenance', undefined, {
      params: { page, search, propertyId: propertyId || undefined, status: status || undefined, priority: priority || undefined },
      signal,
    }),
    retry: false,
  })
  const summary = useQuery({
    queryKey: org.queryKey(['maintenance', 'summary']),
    queryFn: ({ signal }) => org.request<MaintenanceSummary>('get', 'maintenance/summary', undefined, { signal }),
    retry: false,
  })
  const property = useQuery({
    queryKey: org.queryKey(['maintenance', 'property', propertyId]),
    queryFn: ({ signal }) => org.request<Property>('get', `properties/${propertyId}`, undefined, { signal }),
    enabled: !!propertyId,
    retry: false,
  })
  const suffix = params.size ? `?${params}` : ''
  const firstPageParams = new URLSearchParams(params)
  firstPageParams.delete('page')
  const createLink = `/maintenance/new${suffix}`
  const filtered = !!(search || status || priority || propertyId)

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <section className="relative isolate flex flex-wrap items-end justify-between gap-5 overflow-hidden rounded-3xl bg-linear-to-br from-slate-950 via-slate-900 to-teal-950 p-6 text-white shadow-lg sm:p-9">
        <div aria-hidden="true" className="absolute -right-10 -top-28 -z-10 size-80 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="space-y-3">
          <Wrench aria-hidden="true" className="size-11 rounded-xl border border-white/20 bg-white/10 p-2.5 text-teal-200" />
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Maintenance</h2>
          <p className="text-sm text-slate-300 sm:text-base">Track repairs and service requests across your properties.</p>
        </div>
        <Link to={createLink} className={buttonVariants({ className: 'bg-teal-200 text-slate-950 hover:bg-teal-100' })}>
          <Plus aria-hidden="true" className="size-4" /> New request
        </Link>
      </section>

      {summary.isError ? (
        <ErrorState title="Summary unavailable" onRetry={() => void summary.refetch()} retrying={summary.isFetching} />
      ) : (
        <dl aria-label="Maintenance summary" aria-busy={summary.isPending} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map(({ key, label, icon: Icon, color }) => (
            <div key={key} className="rounded-2xl border bg-card p-3 shadow-xs sm:p-5">
              <dt className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
                <Icon aria-hidden="true" className={`size-8 rounded-lg p-1.5 ${color}`} /> {label}
              </dt>
              <dd className="mt-3 text-3xl font-semibold tabular-nums">{summary.data?.[key] ?? '—'}</dd>
            </div>
          ))}
        </dl>
      )}

      <section aria-label="Request queue" className="space-y-4 rounded-2xl border bg-card p-4 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xl font-semibold">{propertyId ? `Requests for ${property.data?.name ?? 'selected property'}` : 'Request queue'}</h3>
          {query.data && <p role="status" className="text-sm text-muted-foreground">{query.data.totalElements} {query.data.totalElements === 1 ? 'request' : 'requests'}</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <label className="space-y-1 text-sm font-medium">
            <span>Search requests</span>
            <Input type="search" value={search} maxLength={150} placeholder="Title, property, unit or assignee" onChange={event => setFilter('search', event.target.value)} />
          </label>
          <Select label="Status" value={status} onChange={event => setFilter('status', event.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
          <Select label="Priority" value={priority} onChange={event => setFilter('priority', event.target.value)}>
            <option value="">All priorities</option>
            {Object.entries(priorities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </div>
        {filtered && <Link to="/maintenance" className="inline-block text-sm font-medium underline underline-offset-4">Clear filters</Link>}
        {query.isPending && <LoadingState label="Loading requests…" />}
        {query.isError && <ErrorState title="Couldn’t load requests" onRetry={() => void query.refetch()} retrying={query.isFetching} />}
        {query.data && (query.data.content.length ? (
          <ul className="divide-y rounded-xl border">
            {query.data.content.map(request => (
              <li key={request.id}>
                <Link to={`/maintenance/${request.id}${suffix}`} className="grid gap-3 rounded-lg p-4 transition-colors hover:bg-muted/60 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{categories[request.category]}</p>
                    <p className="wrap-break-word font-semibold">{request.title}</p>
                    <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                      <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                      <span className="wrap-anywhere">{request.propertyName}{request.unitNumber && ` · Unit ${request.unitNumber}`}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold sm:justify-end">
                    <span className={`rounded-full px-2.5 py-1 ${statusColors[request.status]}`}>{statuses[request.status]}</span>
                    <span className={`rounded-full px-2.5 py-1 ${request.priority === 'URGENT' ? metrics[2].color : 'bg-muted text-foreground'}`}>{priorities[request.priority]} priority</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground sm:min-w-36 sm:justify-end">
                    <div className="min-w-0 sm:max-w-40 sm:text-right">
                      <p className="wrap-anywhere">{request.assignedTo ?? 'Unassigned'}</p>
                      {request.dueDate && (
                        <p className={`flex items-center gap-1 text-xs sm:justify-end ${isOverdue(request) ? 'font-semibold text-destructive' : ''}`}>
                          <CalendarDays aria-hidden="true" className="size-3" />
                          {isOverdue(request) ? 'Overdue · ' : 'Due '}{formatDate(request.dueDate)}
                        </p>
                      )}
                    </div>
                    <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={page ? 'No requests on this page' : filtered ? 'No matching requests' : 'No maintenance requests yet'}
            description={page ? 'Return to the first page to see current results.' : filtered ? 'Adjust your filters to see more requests.' : 'Log a repair or service request to start tracking work.'}
            action={page ? <Link to={`/maintenance?${firstPageParams}`} className={buttonVariants({ variant: 'outline' })}>First page</Link> :
              !filtered ? <Link to={createLink} className={buttonVariants()}>New request</Link> : undefined}
          />
        ))}
        {query.data && <Pagination label="Request pages" page={page + 1} totalPages={query.data.totalPages} onPageChange={next => setFilter('page', String(next - 1))} />}
      </section>
    </div>
  )
}

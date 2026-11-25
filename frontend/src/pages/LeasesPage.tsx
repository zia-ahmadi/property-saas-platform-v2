import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, CalendarClock, FileCheck2, FileText, KeyRound, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/ui/loading-state'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination } from '@/components/ui/pagination'
import { Select } from '@/components/ui/select'
import { useOrganization } from '@/features/organization/context'
import { LeaseStatus } from '@/features/leases/LeaseStatus'
import { leaseDate, leaseMoney, leaseStatuses, type Lease, type LeasePage, type LeaseSummary } from '@/features/leases/api'

const metrics = [
  { key: 'drafts', label: 'Draft leases', icon: FileText, tone: 'bg-violet-500/10 text-violet-700 dark:text-violet-200' },
  { key: 'active', label: 'Active leases', icon: KeyRound, tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-200' },
  { key: 'endingSoon', label: 'Ending within 30 days or overdue', icon: CalendarClock, tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-200' },
  { key: 'ended', label: 'Ended leases', icon: FileCheck2, tone: 'bg-slate-500/10 text-slate-700 dark:text-slate-200' },
] as const

export function LeasesPage() {
  const org = useOrganization()
  return <LeaseRegister key={org.current?.organizationId} />
}

function LeaseRegister() {
  const org = useOrganization()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [endingSoon, setEndingSoon] = useState(false)
  const [page, setPage] = useState(0)
  const summary = useQuery({
    queryKey: org.queryKey(['leases', 'summary']),
    queryFn: ({ signal }) => org.request<LeaseSummary>('get', 'leases/summary', undefined, { signal }),
    retry: false,
  })
  const list = useQuery({
    queryKey: org.queryKey(['leases', 'register', search.trim(), status, endingSoon, page]),
    queryFn: ({ signal }) => org.request<LeasePage<Lease>>('get', 'leases', undefined, {
      params: { search: search.trim(), status: status || undefined, endingSoon, page }, signal,
    }),
    retry: false,
  })
  const filtered = Boolean(search || status || endingSoon)

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <PageHeader headingLevel={2} title="Leasing" description="Manage lease terms, move-ins, and upcoming end dates."
        actions={<Link to="/leases/new" className={buttonVariants({ className: 'h-10 px-3' })}>
          <Plus aria-hidden="true" className="size-4" /> New lease
        </Link>} />
      {summary.isError ? <ErrorState title="Couldn’t load lease totals" onRetry={() => void summary.refetch()} /> :
        <dl aria-label="Lease summary" aria-busy={summary.isPending} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map(({ key, label, icon: Icon, tone }) => (
            <div key={key} className="rounded-xl border bg-card p-3 sm:p-4">
              <dt className="flex items-start gap-2 text-sm font-medium text-muted-foreground">
                <Icon aria-hidden="true" className={`size-8 shrink-0 rounded-lg p-1.5 ${tone}`} />
                <span className="self-center">{label}</span>
              </dt>
              <dd className="mt-3 text-3xl font-semibold tabular-nums">{summary.data?.[key] ?? '—'}</dd>
            </div>
          ))}
        </dl>}
      <section aria-label="Lease register" className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xl font-semibold">Lease register</h3>
          {list.data && <p role="status" className="text-sm text-muted-foreground">{list.data.totalElements} {list.data.totalElements === 1 ? 'lease' : 'leases'}</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <label className="block space-y-1 text-sm font-medium">
            <span>Search leases</span>
            <Input type="search" maxLength={150} value={search} placeholder="Renter, property or unit number"
              onChange={event => { setSearch(event.target.value); setPage(0) }} />
          </label>
          <Select label="Status" value={endingSoon ? 'ENDING_SOON' : status} onChange={event => {
            const value = event.target.value
            setEndingSoon(value === 'ENDING_SOON')
            setStatus(value === 'ENDING_SOON' ? '' : value)
            setPage(0)
          }}>
            <option value="">All statuses</option>
            {Object.entries(leaseStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            <option value="ENDING_SOON">Ending soon or overdue</option>
          </Select>
        </div>
        {filtered && <Button type="button" variant="ghost" onClick={() => { setSearch(''); setStatus(''); setEndingSoon(false); setPage(0) }}>Clear filters</Button>}
        {list.isPending && <LoadingState label="Loading leases…" />}
        {list.isError && <ErrorState title="Couldn’t load leases" onRetry={() => void list.refetch()} retrying={list.isFetching} />}
        {list.data && (list.data.content.length ? (
          <TableContainer aria-label="Leases">
            <Table>
              <TableHeader className="text-xs text-muted-foreground">
                <TableRow>
                  <TableHead>Renter and unit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Lease term</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Monthly rent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.content.map(lease => {
                  const overdue = lease.status === 'ACTIVE' && lease.endsOn && summary.data && lease.endsOn < summary.data.asOf
                  const term = `${leaseDate(lease.startsOn)} – ${lease.endsOn ? leaseDate(lease.endsOn) : 'Open-ended'}`
                  return <TableRow key={lease.id} className="hover:bg-muted/60">
                    <TableCell>
                      <Link to={`/leases/${lease.id}`} className="inline-flex items-center gap-1.5 font-semibold hover:text-primary hover:underline">
                        <span className="wrap-anywhere">{lease.renterName}</span><ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                      </Link>
                      <p className="wrap-anywhere text-xs text-muted-foreground">{lease.propertyName} · Unit {lease.unitNumber}</p>
                      <p className="mt-1 text-xs text-muted-foreground lg:hidden">{term}</p>
                    </TableCell>
                    <TableCell>
                      <LeaseStatus status={lease.status} />
                      {overdue && <p className="mt-1 text-xs font-medium text-destructive">Past end date</p>}
                      <p className="mt-1 text-xs tabular-nums text-muted-foreground sm:hidden">{leaseMoney(lease.monthlyRent, lease.currency)}</p>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{term}</TableCell>
                    <TableCell className="hidden text-right font-medium whitespace-nowrap tabular-nums sm:table-cell">{leaseMoney(lease.monthlyRent, lease.currency)}</TableCell>
                  </TableRow>
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : <EmptyState title={page ? 'No leases on this page' : filtered ? 'No matching leases' : 'No leases yet'}
          description={page ? 'Return to the first page for current results.' : filtered ? 'Try a different search or status.' : 'Create a draft by choosing a renter, a unit, and the lease terms.'}
          action={page ? <Button variant="outline" onClick={() => setPage(0)}>First page</Button> : undefined} />)}
        {list.data && <Pagination label="Lease pages" page={page + 1} totalPages={list.data.totalPages} onPageChange={next => setPage(next - 1)} />}
      </section>
    </div>
  )
}

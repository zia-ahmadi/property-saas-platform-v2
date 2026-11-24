import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, CalendarClock, CircleCheck, FileText, Plus, Receipt } from 'lucide-react'
import { Link } from 'react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/ui/loading-state'
import { Pagination } from '@/components/ui/pagination'
import { Select } from '@/components/ui/select'
import { useOrganization } from '@/features/organization/context'
import { leaseDate, leaseMoney, type LeasePage } from '@/features/leases/api'
import { billingKey, invoiceMonth, invoicePath, invoiceStatuses, type BillingSummary, type Invoice } from '@/features/billing/api'
import { InvoiceStatusBadge } from '@/features/billing/InvoiceStatusBadge'

const metrics = [
  { key: 'open', label: 'Open invoices', icon: FileText },
  { key: 'overdue', label: 'Overdue invoices', icon: CalendarClock },
  { key: 'paid', label: 'Paid invoices', icon: CircleCheck },
] as const

export function BillingPage() {
  const org = useOrganization()
  return <InvoiceRegister key={org.current?.organizationId} />
}

function InvoiceRegister() {
  const org = useOrganization()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const summary = useQuery({
    queryKey: org.queryKey([...billingKey, 'summary']),
    queryFn: ({ signal }) => org.request<BillingSummary>('get', `${invoicePath}/summary`, undefined, { signal }),
  })
  const invoices = useQuery({
    queryKey: org.queryKey([...billingKey, 'register', search.trim(), status, page]),
    queryFn: ({ signal }) => org.request<LeasePage<Invoice>>('get', invoicePath, undefined, {
      params: { search: search.trim(), status: status || undefined, page }, signal,
    }),
  })

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-5 rounded-3xl bg-linear-to-br from-slate-950 via-slate-900 to-teal-950 p-6 text-white shadow-lg sm:p-9">
        <div className="space-y-3">
          <Receipt aria-hidden="true" className="size-11 rounded-xl border border-white/20 bg-white/10 p-2.5 text-teal-200" />
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Rent billing</h2>
          <p className="text-sm text-slate-200 sm:text-base">Issue rent invoices, track balances, and record payments.</p>
        </div>
        <Link to="/billing/new" className={buttonVariants({ className: 'bg-teal-200 text-slate-950 hover:bg-teal-100' })}>
          <Plus aria-hidden="true" className="size-4" /> Issue invoice
        </Link>
      </section>

      {summary.isPending && <LoadingState label="Loading billing totals…" />}
      {summary.isError && <ErrorState title="Couldn’t load billing totals" onRetry={() => void summary.refetch()} />}
      {summary.data && <>
        <dl aria-label="Invoice counts" className="grid gap-3 sm:grid-cols-3">
          {metrics.map(({ key, label, icon: Icon }) => (
            <div key={key} className="rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
              <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Icon aria-hidden="true" className="size-8 shrink-0 rounded-lg bg-teal-500/10 p-1.5 text-teal-800 dark:text-teal-200" />
                {label}
              </dt>
              <dd className="mt-2 text-3xl font-semibold tabular-nums">{summary.data[key]}</dd>
            </div>
          ))}
        </dl>
        {summary.data.totals.length > 0 && (
          <section className="rounded-2xl border bg-card p-4 shadow-xs sm:p-6">
            <h3 className="text-lg font-semibold">Balances by currency</h3>
            <div className="mt-3 divide-y">
              {summary.data.totals.map(totals => (
                <dl key={totals.currency} aria-label={totals.currency} className="grid grid-cols-2 gap-3 py-3 sm:grid-cols-4">
                  <div><dt className="text-xs text-muted-foreground">Currency</dt><dd className="font-semibold">{totals.currency}</dd></div>
                  {(['outstanding', 'overdue', 'collected'] as const).map(label => (
                    <div key={label}>
                      <dt className="text-xs capitalize text-muted-foreground">{label}</dt>
                      <dd className="wrap-anywhere font-semibold tabular-nums">{leaseMoney(totals[label], totals.currency)}</dd>
                    </div>
                  ))}
                </dl>
              ))}
            </div>
          </section>
        )}
      </>}

      <section aria-labelledby="invoice-register" className="space-y-4 rounded-2xl border bg-card p-4 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="invoice-register" className="text-xl font-semibold">Invoice register</h3>
          {invoices.data && <p role="status" className="text-sm text-muted-foreground">{invoices.data.totalElements} invoices</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <label className="space-y-1 text-sm font-medium">
            <span>Search invoices</span>
            <Input type="search" maxLength={150} value={search} placeholder="Invoice number, renter, property or unit"
              onChange={event => { setSearch(event.target.value); setPage(0) }} />
          </label>
          <Select label="Status" value={status} onChange={event => { setStatus(event.target.value); setPage(0) }}>
            <option value="">All statuses</option>
            {Object.entries(invoiceStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </div>
        {invoices.isPending && <LoadingState label="Loading invoices…" />}
        {invoices.isError && <ErrorState title="Couldn’t load invoices" onRetry={() => void invoices.refetch()} />}
        {invoices.data && (invoices.data.content.length ? (
          <ul className="divide-y rounded-xl border">
            {invoices.data.content.map(invoice => (
              <li key={invoice.id}>
                <Link to={`/billing/${invoice.id}`} className="grid gap-3 rounded-lg p-4 hover:bg-muted/60 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="wrap-anywhere font-semibold">INV-{invoice.invoiceNumber} · {invoice.renterName}</p>
                    <p className="wrap-anywhere text-sm text-muted-foreground">{invoice.propertyName} · Unit {invoice.unitNumber}</p>
                  </div>
                  <div className="space-y-1">
                    <InvoiceStatusBadge status={invoice.status} />
                    <p className="text-xs text-muted-foreground">{invoiceMonth(invoice.billingMonth)} · Due {leaseDate(invoice.dueOn)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:text-right">
                    <div>
                      <p className="font-semibold tabular-nums">{leaseMoney(invoice.balance, invoice.currency)}</p>
                      <p className="text-xs text-muted-foreground">Balance due</p>
                    </div>
                    <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : <EmptyState title={page ? 'No invoices on this page' : search || status ? 'No matching invoices' : 'No invoices to show'}
          description={page ? 'Return to the first page for current results.' : search || status ? 'Try a different search or status.' : 'Issue a rent invoice from an active or ended lease.'}
          action={page > 0 ? <Button variant="outline" onClick={() => setPage(0)}>First page</Button> : undefined} />)}
        {invoices.data && <Pagination label="Invoice pages" page={page + 1} totalPages={invoices.data.totalPages}
          onPageChange={next => setPage(next - 1)} />}
      </section>
    </div>
  )
}

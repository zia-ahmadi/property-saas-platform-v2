import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, CalendarClock, CircleCheck, FileText, Plus } from 'lucide-react'
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
      <PageHeader headingLevel={2} title="Rent billing" description="Issue rent invoices, track balances, and record payments."
        actions={<Link to="/billing/new" className={buttonVariants({ className: 'h-10 px-3' })}>
          <Plus aria-hidden="true" className="size-4" /> Issue invoice
        </Link>} />

      {summary.isPending && <LoadingState label="Loading billing totals…" />}
      {summary.isError && <ErrorState title="Couldn’t load billing totals" onRetry={() => void summary.refetch()} />}
      {summary.data && <>
        <dl aria-label="Invoice counts" className="grid gap-3 sm:grid-cols-3">
          {metrics.map(({ key, label, icon: Icon }) => (
            <div key={key} className="rounded-xl border bg-card p-3 sm:p-4">
              <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Icon aria-hidden="true" className="size-8 shrink-0 rounded-lg bg-teal-500/10 p-1.5 text-teal-800 dark:text-teal-200" />
                {label}
              </dt>
              <dd className="mt-2 text-3xl font-semibold tabular-nums">{summary.data[key]}</dd>
            </div>
          ))}
        </dl>
        {summary.data.totals.length > 0 && (
          <section className="rounded-xl border bg-card p-4 sm:p-5">
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

      <section aria-labelledby="invoice-register" className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
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
          <TableContainer aria-label="Invoices">
            <Table>
              <TableHeader className="text-xs text-muted-foreground">
                <TableRow>
                  <TableHead>Invoice and renter</TableHead>
                  <TableHead className="hidden md:table-cell">Due date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Balance due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.data.content.map(invoice => (
                  <TableRow key={invoice.id} className="hover:bg-muted/60">
                    <TableCell>
                      <Link to={`/billing/${invoice.id}`} className="inline-flex items-center gap-1.5 font-semibold hover:text-primary hover:underline">
                        <span className="wrap-anywhere">INV-{invoice.invoiceNumber} · {invoice.renterName}</span>
                        <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                      </Link>
                      <p className="wrap-anywhere text-xs text-muted-foreground">{invoice.propertyName} · Unit {invoice.unitNumber}</p>
                      <p className="mt-1 text-xs text-muted-foreground md:hidden">Due {leaseDate(invoice.dueOn)}</p>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap md:table-cell">
                      {leaseDate(invoice.dueOn)}
                      <p className="text-xs text-muted-foreground">{invoiceMonth(invoice.billingMonth)}</p>
                    </TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={invoice.status} />
                      <p className="mt-1 text-xs tabular-nums text-muted-foreground sm:hidden">{leaseMoney(invoice.balance, invoice.currency)} due</p>
                    </TableCell>
                    <TableCell className="hidden text-right font-medium whitespace-nowrap tabular-nums sm:table-cell">{leaseMoney(invoice.balance, invoice.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : <EmptyState title={page ? 'No invoices on this page' : search || status ? 'No matching invoices' : 'No invoices to show'}
          description={page ? 'Return to the first page for current results.' : search || status ? 'Try a different search or status.' : 'Issue a rent invoice from an active or ended lease.'}
          action={page > 0 ? <Button variant="outline" onClick={() => setPage(0)}>First page</Button> : undefined} />)}
        {invoices.data && <Pagination label="Invoice pages" page={page + 1} totalPages={invoices.data.totalPages}
          onPageChange={next => setPage(next - 1)} />}
      </section>
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { Select } from '@/components/ui/select'
import { ErrorState } from '@/components/ui/error-state'
import { PageHeader } from '@/components/ui/page-header'
import { billingError, billingKey, invoicePath, type InvoiceDetails } from '@/features/billing/api'
import { leaseDate, leaseMoney, type Lease, type LeasePage } from '@/features/leases/api'
import { useOrganization } from '@/features/organization/context'

export function IssueInvoicePage() {
  const org = useOrganization()
  const [params] = useSearchParams()
  const leaseId = params.get('lease') ?? ''
  return <IssueInvoiceForm key={`${org.current?.organizationId}:${leaseId}`} initialLeaseId={leaseId} />
}

function IssueInvoiceForm({ initialLeaseId }: { initialLeaseId: string }) {
  const org = useOrganization()
  const client = useQueryClient()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Lease>()
  const [useLinkedLease, setUseLinkedLease] = useState(Boolean(initialLeaseId))
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [page, setPage] = useState(0)
  const linked = useQuery({
    queryKey: org.queryKey([...billingKey, 'lease', initialLeaseId]),
    queryFn: ({ signal }) => org.request<Lease>('get', `leases/${encodeURIComponent(initialLeaseId)}`, undefined, { signal }),
    enabled: useLinkedLease,
  })
  const options = useQuery({
    queryKey: org.queryKey([...billingKey, 'lease-options', search.trim(), status, page]),
    queryFn: ({ signal }) => org.request<LeasePage<Lease>>('get', 'leases', undefined, {
      params: { search: search.trim(), status, page, size: 10 }, signal,
    }),
    enabled: !useLinkedLease,
  })
  const lease = useLinkedLease ? linked.data : selected
  const billable = lease && (lease.status === 'ACTIVE' || lease.status === 'ENDED') && lease.monthlyRent > 0
  const choices = options.data?.content ?? []
  const save = useMutation({
    mutationFn: (terms: { leaseId: string; billingMonth: string; dueOn: string }) =>
      org.request<InvoiceDetails>('post', invoicePath, terms),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: org.queryKey(billingKey) })
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!lease || !billable || save.isPending) return
    const form = new FormData(event.currentTarget)
    const billingMonth = String(form.get('billingMonth'))
    save.mutate({ leaseId: lease.id, billingMonth: `${billingMonth}-01`, dueOn: String(form.get('dueOn')) }, {
      onSuccess: ({ invoice }) => navigate(`/billing/${invoice.id}`, { replace: true }),
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader headingLevel={2} title="Issue rent invoice" actions={
        <Link to="/billing" className={buttonVariants({ variant: 'outline' })}>Back to billing</Link>
      } />
      <form onSubmit={submit} className="rounded-2xl border bg-card p-5 shadow-xs sm:p-7">
        <fieldset disabled={save.isPending} className="min-w-0 space-y-5">
          {useLinkedLease ? (
            <div className="space-y-2">
              {linked.isPending && <p role="status">Loading lease…</p>}
              {linked.isError && <ErrorState title="Couldn’t load the linked lease" onRetry={() => void linked.refetch()} />}
              <Button type="button" variant="outline" onClick={() => setUseLinkedLease(false)}>Choose another lease</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                <label className="space-y-1 text-sm font-medium">
                  <span>Find a lease</span>
                  <Input type="search" maxLength={150} value={search} placeholder="Renter, property or unit"
                    onChange={event => { setSearch(event.target.value); setPage(0) }} />
                </label>
                <Select label="Lease status" value={status} onChange={event => {
                  setStatus(event.target.value)
                  setSelected(undefined)
                  setPage(0)
                }}>
                  <option value="ACTIVE">Active leases</option>
                  <option value="ENDED">Ended leases</option>
                </Select>
              </div>
              <Select label="Lease" required value={selected?.id ?? ''} aria-busy={options.isPending}
                onChange={event => setSelected(choices.find(choice => choice.id === event.target.value))}>
                <option value="">{options.isPending ? 'Loading leases…' : 'Choose a lease'}</option>
                {selected && !choices.some(choice => choice.id === selected.id) &&
                  <option value={selected.id}>{leaseLabel(selected)}</option>}
                {choices.map(choice => <option key={choice.id} value={choice.id} disabled={choice.monthlyRent <= 0}>
                  {leaseLabel(choice)}{choice.monthlyRent <= 0 ? ' · No rent' : ''}
                </option>)}
              </Select>
              {options.isError && <ErrorState title="Couldn’t load leases" onRetry={() => void options.refetch()} />}
              {options.isSuccess && !choices.length && <p role="status" className="text-sm text-muted-foreground">No leases match these filters.</p>}
              {options.data && <Pagination label="Available lease pages" page={page + 1} totalPages={options.data.totalPages}
                onPageChange={next => setPage(next - 1)} />}
            </div>
          )}
          {lease && (
            <div className="flex flex-wrap justify-between gap-3 rounded-xl bg-muted/60 p-4 text-sm">
              <div>
                <p className="font-semibold">{leaseLabel(lease)}</p>
                <p className="text-muted-foreground">{leaseDate(lease.startsOn)}{lease.endsOn ? ` – ${leaseDate(lease.endsOn)}` : ' · Open-ended'}</p>
              </div>
              <p className="font-semibold tabular-nums">{leaseMoney(lease.monthlyRent, lease.currency)} / month</p>
            </div>
          )}
          {lease && !billable && <p role="alert" className="text-sm text-destructive">Choose an active or ended lease with positive monthly rent.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">
              <span>Billing month</span>
              <Input name="billingMonth" type="month" placeholder="YYYY-MM" pattern="[0-9]{4}-(0[1-9]|1[0-2])" min="0001-01" max="9999-12" required />
            </label>
            <label className="space-y-1 text-sm font-medium">
              <span>Due date</span>
              <Input name="dueOn" type="date" min="0001-01-01" max="9999-12-31" required />
            </label>
          </div>
          <p className="text-sm text-muted-foreground">The month must overlap the lease term. The invoice uses the full monthly rent from the lease.</p>
          {save.isError && <p role="alert" className="text-sm text-destructive">{billingError(save.error, 'Couldn’t issue the invoice. Try again.')}</p>}
          <div className="flex justify-end border-t pt-4">
            <Button type="submit" disabled={!billable}>{save.isPending ? 'Issuing…' : 'Issue invoice'}</Button>
          </div>
        </fieldset>
      </form>
    </div>
  )
}

function leaseLabel(lease: Lease) {
  return `${lease.renterName} · ${lease.propertyName} · Unit ${lease.unitNumber}`
}

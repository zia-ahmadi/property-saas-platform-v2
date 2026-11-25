import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowUpRight, CalendarDays, FileText, KeyRound, Wallet } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/ui/loading-state'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useNotification } from '@/components/ui/use-notification'
import { useOrganization } from '@/features/organization/context'
import { LeasePartyPicker, type PartyOption } from '@/features/leases/LeasePartyPicker'
import { LeaseStatus } from '@/features/leases/LeaseStatus'
import { leaseDate, leaseError, leaseMoney, type Lease, type LeaseAction, type LeaseTerms, type LeaseSummary } from '@/features/leases/api'
import { ApiError } from '@/lib/api/errors'

const actions = {
  ACTIVATE: { label: 'Activate lease', title: 'Activate this lease?', description: 'The unit will be marked occupied immediately.', success: 'Lease activated' },
  END: { label: 'End lease', title: 'End this lease?', description: 'The unit will become available immediately and the lease will remain in the register.', success: 'Lease ended' },
  CANCEL: { label: 'Cancel draft', title: 'Cancel this draft?', description: 'The draft will be closed and retained in the register.', success: 'Draft cancelled' },
} as const

const currencies = Intl.supportedValuesOf('currency')
const currencyNames = new Intl.DisplayNames(undefined, { type: 'currency' })

export function LeaseDetailsPage({ mode = 'detail' }: { mode?: 'detail' | 'new' | 'edit' }) {
  const org = useOrganization()
  const { leaseId } = useParams()
  return <LeaseScreen key={`${org.current?.organizationId}/${leaseId ?? 'new'}/${mode}`} leaseId={leaseId} mode={mode} />
}

function LeaseScreen({ leaseId, mode }: { leaseId?: string; mode: 'detail' | 'new' | 'edit' }) {
  const org = useOrganization()
  const client = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotification()
  const [action, setAction] = useState<LeaseAction>()
  const [actionError, setActionError] = useState<string>()
  const query = useQuery({
    queryKey: org.queryKey(['leases', 'detail', leaseId]),
    queryFn: ({ signal }) => org.request<Lease>('get', `leases/${encodeURIComponent(leaseId ?? '')}`, undefined, { signal }),
    enabled: mode !== 'new' && !!leaseId,
    retry: false,
  })
  const summary = useQuery({
    queryKey: org.queryKey(['leases', 'summary']),
    queryFn: ({ signal }) => org.request<LeaseSummary>('get', 'leases/summary', undefined, { signal }),
    enabled: mode === 'detail' && query.data?.status === 'DRAFT',
    retry: false,
  })

  const refresh = (saved: Lease) => {
    client.setQueryData(org.queryKey(['leases', 'detail', saved.id]), saved)
    for (const key of [['leases'], ['units', saved.propertyId], ['unit', saved.propertyId, saved.unitId], ['dashboard']]) {
      void client.invalidateQueries({ queryKey: org.queryKey(key) })
    }
  }
  const transition = useMutation({
    mutationFn: ({ next, lease }: { next: LeaseAction; lease: Lease }) =>
      org.request<Lease>('post', `leases/${lease.id}/transition`, { action: next, version: lease.version }),
    onSuccess: (saved, { next }) => {
      refresh(saved)
      notify({ variant: 'success', title: actions[next].success })
      setAction(undefined)
    },
    onError: error => {
      setAction(undefined)
      setActionError(leaseError(error))
      if (error instanceof ApiError && error.status === 409) void query.refetch()
    },
  })

  const lease = query.data
  const backLink = mode === 'edit' && lease ? `/leases/${lease.id}` : '/leases'
  const draft = lease?.status === 'DRAFT'
  const asOf = summary.data?.asOf
  const activationBlocked = !!(lease && asOf && (lease.startsOn > asOf || (lease.endsOn && lease.endsOn < asOf)))
  const availableActions: LeaseAction[] = draft ? ['CANCEL', 'ACTIVATE'] : lease?.status === 'ACTIVE' ? ['END'] : []

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link to={backLink} className={buttonVariants({ variant: 'ghost' })}>
        <ArrowLeft aria-hidden="true" className="size-4" /> {mode === 'edit' && lease ? 'Back to lease' : 'Back to leasing'}
      </Link>
      {mode !== 'new' && !lease ? query.isPending ? <LoadingState label="Loading lease…" /> :
        <ErrorState title={query.error instanceof ApiError && query.error.status === 404 ? 'Lease not found' : 'Couldn’t load lease'}
          onRetry={() => void query.refetch()} retrying={query.isFetching} /> :
        mode === 'new' || (mode === 'edit' && draft) ? (
          <LeaseForm lease={lease} onSaved={saved => {
            refresh(saved)
            notify({ variant: 'success', title: lease ? 'Draft updated' : 'Draft created' })
            void navigate(`/leases/${saved.id}`, { replace: true })
          }} />
        ) : lease && (
          <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <header className="flex items-start gap-4 border-b bg-accent/50 p-5 sm:p-7">
              <KeyRound aria-hidden="true" className="size-12 shrink-0 rounded-xl bg-accent p-3 text-accent-foreground" />
              <div className="min-w-0 space-y-1">
                <LeaseStatus status={lease.status} />
                <h2 className="wrap-anywhere text-2xl font-semibold tracking-tight">{lease.renterName}</h2>
                <p className="wrap-anywhere text-sm text-muted-foreground">{lease.propertyName} · Unit {lease.unitNumber}</p>
              </div>
            </header>
            <div className="space-y-6 p-5 sm:p-7">
              <div className="grid gap-3 sm:grid-cols-2">
                <section className="space-y-3 rounded-xl border p-4">
                  <h3 className="flex items-center gap-2 font-semibold"><CalendarDays aria-hidden="true" className="size-4 text-violet-600 dark:text-violet-300" /> Lease term</h3>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <LeaseFact label="Start date">{leaseDate(lease.startsOn)}</LeaseFact>
                    <LeaseFact label="End date">{lease.endsOn ? leaseDate(lease.endsOn) : 'Open-ended'}</LeaseFact>
                    {lease.activatedAt && <LeaseFact label="Activated">{leaseDate(lease.activatedAt)}</LeaseFact>}
                    {lease.closedAt && <LeaseFact label={lease.status === 'ENDED' ? 'Ended' : 'Cancelled'}>{leaseDate(lease.closedAt)}</LeaseFact>}
                  </dl>
                </section>
                <section className="space-y-3 rounded-xl border p-4">
                  <h3 className="flex items-center gap-2 font-semibold"><Wallet aria-hidden="true" className="size-4 text-violet-600 dark:text-violet-300" /> Financial terms</h3>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <LeaseFact label="Monthly rent">{leaseMoney(lease.monthlyRent, lease.currency)}</LeaseFact>
                    <LeaseFact label="Security deposit">{leaseMoney(lease.deposit, lease.currency)}</LeaseFact>
                  </dl>
                </section>
              </div>
              {lease.notes && <section className="space-y-1">
                <h3 className="font-semibold">Notes</h3>
                <p className="wrap-anywhere whitespace-pre-wrap text-sm text-muted-foreground">{lease.notes}</p>
              </section>}
              <div className="flex flex-wrap gap-4 text-sm">
                <Link className="inline-flex items-center gap-1 underline underline-offset-4" to={`/renters/${lease.renterId}`}>View renter <ArrowUpRight aria-hidden="true" className="size-4" /></Link>
                <Link className="inline-flex items-center gap-1 underline underline-offset-4" to={`/properties/${lease.propertyId}/units/${lease.unitId}`}>View unit <ArrowUpRight aria-hidden="true" className="size-4" /></Link>
                {org.can('BILLING_MANAGE') && lease.monthlyRent > 0 && (lease.status === 'ACTIVE' || lease.status === 'ENDED') &&
                  <Link className="inline-flex items-center gap-1 underline underline-offset-4" to={`/billing/new?lease=${lease.id}`}>Issue rent invoice <ArrowUpRight aria-hidden="true" className="size-4" /></Link>}
              </div>
              {activationBlocked && <p className="rounded-lg border bg-muted/60 p-3 text-sm">A draft can be activated during its lease term.</p>}
              {actionError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">{actionError}</p>}
              {availableActions.length > 0 && <div className="flex flex-wrap justify-end gap-2 border-t pt-5">
                {draft && <Link to={`/leases/${lease.id}/edit`} className={buttonVariants({ variant: 'outline' })}>Edit draft</Link>}
                {availableActions.map(next => {
                  const details = actions[next]
                  return <ConfirmationDialog key={next}
                    trigger={<Button type="button" disabled={next === 'ACTIVATE' && activationBlocked}
                      variant={next === 'ACTIVATE' ? 'default' : 'outline'}>{details.label}</Button>}
                    open={action === next}
                    onOpenChange={open => { setAction(open ? next : undefined); if (open) setActionError(undefined) }}
                    title={details.title} description={details.description} confirmLabel={details.label}
                    destructive={next !== 'ACTIVATE'} loading={transition.isPending}
                    onConfirm={() => transition.mutate({ next, lease })} />
                })}
              </div>}
            </div>
          </article>
        )}
    </div>
  )
}

function LeaseFact({ label, children }: { label: string; children: string }) {
  return <div className="min-w-0">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="mt-1 wrap-anywhere font-semibold tabular-nums">{children}</dd>
  </div>
}

function LeaseForm({ lease, onSaved }: { lease?: Lease; onSaved: (lease: Lease) => void }) {
  const org = useOrganization()
  const [unit, setUnit] = useState<PartyOption | undefined>(lease && { id: lease.unitId, label: `${lease.propertyName} · Unit ${lease.unitNumber}` })
  const [renter, setRenter] = useState<PartyOption | undefined>(lease && { id: lease.renterId, label: lease.renterName })
  const [error, setError] = useState<string>()
  // Keep the edit version from when the form opened, even if React Query refreshes the record.
  const [version] = useState(lease?.version)
  const save = useMutation({
    mutationFn: (terms: LeaseTerms) => lease
      ? org.request<Lease>('put', `leases/${lease.id}`, { terms, version })
      : org.request<Lease>('post', 'leases', terms),
    onSuccess: onSaved,
    onError: failure => setError(leaseError(failure)),
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!renter || !unit || save.isPending) return
    const form = new FormData(event.currentTarget)
    const text = (key: string) => String(form.get(key) ?? '').trim()
    const startsOn = text('startsOn')
    const endsOn = text('endsOn') || null
    if (endsOn && endsOn < startsOn) {
      setError('Choose an end date on or after the start date.')
      return
    }
    setError(undefined)
    save.mutate({
      unitId: unit.id, renterId: renter.id, startsOn, endsOn,
      monthlyRent: Number(text('monthlyRent')), deposit: Number(text('deposit')),
      currency: text('currency'), notes: text('notes') || null,
    })
  }

  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <header className="flex items-start gap-4 border-b bg-accent/50 p-5 sm:p-7">
        <FileText aria-hidden="true" className="size-12 shrink-0 rounded-xl bg-accent p-3 text-accent-foreground" />
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">{lease ? 'Edit draft lease' : 'New lease'}</h2>
          <p className="text-sm text-muted-foreground">Choose a renter and unit, then record the agreement terms.</p>
        </div>
      </header>
      <form onSubmit={submit} className="p-5 sm:p-7">
        <fieldset disabled={save.isPending} className="min-w-0 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <LeasePartyPicker kind="renter" selected={renter} onChange={setRenter} />
            <LeasePartyPicker kind="unit" selected={unit} onChange={setUnit} />
          </div>
          <div className="grid gap-4 border-t pt-5 sm:grid-cols-2">
            <label className="block space-y-1 text-sm font-medium">
              <span>Start date</span>
              <Input type="date" name="startsOn" required min="0001-01-01" max="9999-12-31" defaultValue={lease?.startsOn} />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              <span>End date <span className="font-normal text-muted-foreground">(optional)</span></span>
              <Input type="date" name="endsOn" min="0001-01-01" max="9999-12-31" defaultValue={lease?.endsOn ?? ''} />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Currency" name="currency" required defaultValue={lease?.currency ?? ''}>
              <option value="">Choose currency</option>
              {lease?.currency && !currencies.includes(lease.currency) && <option value={lease.currency}>{lease.currency}</option>}
              {currencies.map(code => <option key={code} value={code}>{code} · {currencyNames.of(code)}</option>)}
            </Select>
            <label className="block space-y-1 text-sm font-medium">
              <span>Monthly rent</span>
              <Input type="number" name="monthlyRent" required min="0" max="9999999999.99" step="0.01" defaultValue={lease?.monthlyRent} />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              <span>Security deposit</span>
              <Input type="number" name="deposit" required min="0" max="9999999999.99" step="0.01" defaultValue={lease?.deposit ?? 0} />
            </label>
          </div>
          <label className="block space-y-1 text-sm font-medium">
            <span>Notes <span className="font-normal text-muted-foreground">(optional)</span></span>
            <Textarea rows={4} name="notes" maxLength={4000} defaultValue={lease?.notes ?? ''} />
          </label>
          {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2 border-t pt-5">
            <Link to={lease ? `/leases/${lease.id}` : '/leases'} className={buttonVariants({ variant: 'outline' })}>Back</Link>
            <Button type="submit" disabled={!renter || !unit}>{save.isPending ? 'Saving…' : 'Save draft'}</Button>
          </div>
        </fieldset>
      </form>
    </article>
  )
}

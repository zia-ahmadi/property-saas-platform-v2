import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/ui/loading-state'
import { PageHeader } from '@/components/ui/page-header'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { InvoiceStatusBadge } from '@/features/billing/InvoiceStatusBadge'
import { billingError, billingKey, invoiceMonth, invoicePath, paymentMethods, type InvoiceDetails, type PaymentMethod } from '@/features/billing/api'
import { leaseDate, leaseMoney } from '@/features/leases/api'
import { useOrganization } from '@/features/organization/context'
import { ApiError } from '@/lib/api/errors'

type InvoiceChange =
  | { action: 'payments'; body: { amount: number; receivedOn: string; method: PaymentMethod; reference: string; version: number } }
  | { action: 'void'; body: { reason: string; version: number } }

export function InvoiceDetailsPage() {
  const { invoiceId = '' } = useParams()
  const org = useOrganization()
  return <InvoiceRecord key={`${org.current?.organizationId}:${invoiceId}`} id={invoiceId} />
}

function InvoiceRecord({ id }: { id: string }) {
  const org = useOrganization()
  const client = useQueryClient()
  const detailKey = org.queryKey([...billingKey, 'invoice', id])
  const path = `${invoicePath}/${encodeURIComponent(id)}`
  const details = useQuery({
    queryKey: detailKey,
    queryFn: ({ signal }) => org.request<InvoiceDetails>('get', path, undefined, { signal }),
  })
  const [editing, setEditing] = useState<'payments' | 'void'>()
  const [version, setVersion] = useState(0)
  const [confirmVoid, setConfirmVoid] = useState(false)
  const [reason, setReason] = useState('')
  const save = useMutation({
    mutationFn: ({ action, body }: InvoiceChange) =>
      org.request<InvoiceDetails>('post', `${path}/${action}`, body),
    onSuccess: data => {
      client.setQueryData(detailKey, data)
      void client.invalidateQueries({ queryKey: org.queryKey(billingKey) })
      closeForm()
    },
    onError: () => setConfirmVoid(false),
  })

  function closeForm() {
    setConfirmVoid(false)
    setEditing(undefined)
    setReason('')
    save.reset()
  }

  function openForm(action: 'payments' | 'void', currentVersion: number) {
    closeForm()
    setEditing(action)
    setVersion(currentVersion)
  }

  function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (save.isPending) return
    const form = new FormData(event.currentTarget)
    save.mutate({ action: 'payments', body: {
      amount: Number(form.get('amount')), receivedOn: String(form.get('receivedOn')),
      method: form.get('method') as PaymentMethod, reference: String(form.get('reference')), version,
    } })
  }

  const invoice = details.data?.invoice
  const back = <Link to="/billing" className={buttonVariants({ variant: 'outline' })}>Back to billing</Link>
  const conflict = save.error instanceof ApiError && save.error.status === 409

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader headingLevel={2} title={invoice ? `Invoice INV-${invoice.invoiceNumber}` : 'Rent invoice'} actions={back} />
      {details.isPending && <LoadingState label="Loading invoice…" />}
      {details.isError && <ErrorState title="Couldn’t load invoice" onRetry={() => void details.refetch()} />}
      {invoice && details.data && <>
        <section aria-label="Invoice details" className="space-y-5 rounded-2xl border bg-card p-5 shadow-xs sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="wrap-anywhere text-xl font-semibold">{invoice.renterName}</h3>
              <p className="wrap-anywhere text-sm text-muted-foreground">{invoice.propertyName} · Unit {invoice.unitNumber}</p>
            </div>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Fact label="Billing month" value={invoiceMonth(invoice.billingMonth)} />
            <Fact label="Due date" value={leaseDate(invoice.dueOn)} />
            <Fact label="Issued" value={leaseDate(invoice.issuedAt)} />
          </dl>
          <dl className="grid gap-4 rounded-xl bg-muted/60 p-4 sm:grid-cols-3">
            <Fact label="Invoice amount" value={leaseMoney(invoice.amount, invoice.currency)} />
            <Fact label="Amount paid" value={leaseMoney(invoice.paidAmount, invoice.currency)} />
            <Fact label="Balance due" value={leaseMoney(invoice.balance, invoice.currency)} />
          </dl>
          {invoice.voidedAt && (
            <div className="rounded-xl border p-4 text-sm">
              <p className="font-semibold">Voided {leaseDate(invoice.voidedAt)}</p>
              <p className="wrap-anywhere whitespace-pre-wrap text-muted-foreground">{invoice.voidReason}</p>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <Link to={`/leases/${invoice.leaseId}`} className="text-sm font-medium underline underline-offset-4">View lease</Link>
            {!editing && invoice.balance > 0 && <div className="flex flex-wrap gap-2">
              {invoice.paidAmount === 0 && <Button variant="outline" onClick={() => openForm('void', invoice.version)}>Void invoice</Button>}
              <Button onClick={() => openForm('payments', invoice.version)}>Record payment</Button>
            </div>}
          </div>
        </section>

        {editing && (
          <section aria-label={editing === 'payments' ? 'Record payment' : 'Void invoice'} className="space-y-4 rounded-2xl border bg-card p-5 shadow-xs sm:p-7">
            <h3 className="text-lg font-semibold">{editing === 'payments' ? 'Record payment' : 'Void invoice'}</h3>
            {save.isError && <p role="alert" className="text-sm text-destructive">{billingError(save.error, 'Couldn’t save the invoice change. Try again.')}</p>}
            {conflict && <Button variant="outline" onClick={() => { closeForm(); void details.refetch() }}>Reload invoice</Button>}
            {editing === 'payments' ? (
              <form onSubmit={recordPayment}>
                <fieldset disabled={save.isPending} className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <label className="space-y-1 text-sm font-medium">
                    <span>Amount ({invoice.currency})</span>
                    <Input name="amount" type="number" min="0.01" max={invoice.balance} step="0.01" required />
                  </label>
                  <label className="space-y-1 text-sm font-medium">
                    <span>Date received</span>
                    <Input name="receivedOn" type="date" min="0001-01-01" max={details.data.asOf} defaultValue={details.data.asOf} required />
                  </label>
                  <Select name="method" label="Payment method" required defaultValue="">
                    <option value="">Choose a method</option>
                    {Object.entries(paymentMethods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </Select>
                  <label className="space-y-1 text-sm font-medium">
                    <span>Reference (optional)</span>
                    <Input name="reference" maxLength={150} />
                  </label>
                  <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
                    <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
                    <Button type="submit">{save.isPending ? 'Recording…' : 'Save payment'}</Button>
                  </div>
                </fieldset>
              </form>
            ) : (
              <>
                <label className="block space-y-1 text-sm font-medium">
                  <span>Reason for voiding</span>
                  <Textarea rows={3} value={reason} maxLength={500} required onChange={event => setReason(event.target.value)} />
                </label>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={closeForm}>Cancel</Button>
                  <ConfirmationDialog
                    trigger={<Button variant="destructive" disabled={!reason.trim()}>Void invoice</Button>}
                    open={confirmVoid} onOpenChange={setConfirmVoid}
                    title={`Void invoice INV-${invoice.invoiceNumber}?`}
                    description="The invoice will stay in the register with its void reason and a zero balance."
                    confirmLabel="Void invoice" destructive loading={save.isPending}
                    onConfirm={() => save.mutate({ action: 'void', body: { reason: reason.trim(), version } })}
                  />
                </div>
              </>
            )}
          </section>
        )}

        <section aria-label="Payment history" className="space-y-4 rounded-2xl border bg-card p-5 shadow-xs sm:p-7">
          <h3 className="text-lg font-semibold">Payment history</h3>
          {details.data.payments.length ? <ul className="divide-y rounded-xl border">
            {details.data.payments.map(payment => (
              <li key={payment.id} className="flex flex-wrap justify-between gap-3 p-4 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold">{paymentMethods[payment.method]} · {leaseDate(payment.receivedOn)}</p>
                  {payment.reference && <p className="wrap-anywhere text-muted-foreground">{payment.reference}</p>}
                </div>
                <p className="font-semibold tabular-nums">{leaseMoney(payment.amount, invoice.currency)}</p>
              </li>
            ))}
          </ul> : <p className="text-sm text-muted-foreground">No payments recorded.</p>}
        </section>
      </>}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="wrap-anywhere font-semibold tabular-nums">{value}</dd>
  </div>
}

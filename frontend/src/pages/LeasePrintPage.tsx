import { useEffect, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import { leaseDate, leaseMoney, leaseStatuses, type LeaseDocument } from '@/features/leases/api'
import { useOrganization } from '@/features/organization/context'
import { ApiError } from '@/lib/api/errors'
import './lease-print.css'

export function LeasePrintPage() {
  const org = useOrganization()
  const { leaseId = '' } = useParams()
  const documentQuery = useQuery({
    queryKey: org.queryKey(['leases', 'document', leaseId]),
    queryFn: ({ signal }) => org.request<LeaseDocument>('get', `leases/${encodeURIComponent(leaseId)}/document`, undefined, { signal }),
    retry: false,
  })

  const agreement = documentQuery.data
  useEffect(() => {
    if (!agreement || documentQuery.isError) return
    const title = document.title
    document.title = `Lease agreement - ${agreement.id}`
    return () => { document.title = title }
  }, [agreement, documentQuery.isError])

  return (
    <main className="min-h-dvh bg-muted/50 px-4 py-6 sm:px-8 print:min-h-0 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl print:max-w-none">
        <nav aria-label="Lease print controls" className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link to={`/leases/${leaseId}`} className={buttonVariants({ variant: 'outline', className: 'h-11' })}>
            <ArrowLeft aria-hidden="true" /> Back to lease
          </Link>
          {agreement && !documentQuery.isError && <Button type="button" className="h-11" onClick={() => window.print()}>
            <Printer aria-hidden="true" /> Print or save as PDF
          </Button>}
        </nav>
        {documentQuery.isPending ? <LoadingState label="Preparing lease agreement…" /> :
          documentQuery.isError ? (
            <ErrorState title={documentQuery.error instanceof ApiError && documentQuery.error.status === 404 ? 'Lease not found' : 'Couldn’t load the lease agreement'}
              onRetry={() => void documentQuery.refetch()} retrying={documentQuery.isFetching} />
          ) : <Agreement agreement={documentQuery.data} />}
      </div>
    </main>
  )
}

function Agreement({ agreement }: { agreement: LeaseDocument }) {
  return (
    <article className="lease-agreement wrap-anywhere rounded-xl border border-slate-300 bg-white p-5 text-slate-950 shadow-sm sm:p-12 print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <header className="break-inside-avoid border-b-2 border-slate-900 pb-4">
        <p className="text-base font-semibold">{agreement.organizationName}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Lease agreement</h1>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <Fact label="Lease reference">{agreement.id}</Fact>
          <Fact label="Lease status">{leaseStatuses[agreement.status]}</Fact>
        </dl>
      </header>

      <Section title="Parties and premises">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 print:grid-cols-2">
          <Fact label="Leasing organization">{agreement.organizationName}</Fact>
          <Fact label="Renter">{agreement.renterName}</Fact>
          <Fact label="Property and unit">{agreement.propertyName} · Unit {agreement.unitNumber}</Fact>
          <Fact label="Property address">{agreement.propertyAddress}</Fact>
        </dl>
      </Section>
      <Section title="Lease term">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 print:grid-cols-2">
          <Fact label="Start date">{leaseDate(agreement.startsOn)}</Fact>
          <Fact label="Agreed end date">{agreement.endsOn ? leaseDate(agreement.endsOn) : 'Open-ended'}</Fact>
          {agreement.closedAt && <Fact label={agreement.status === 'ENDED' ? 'Date ended' : 'Date cancelled'}>{leaseDate(agreement.closedAt)}</Fact>}
        </dl>
      </Section>
      <Section title="Rent and deposit">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 print:grid-cols-2">
          <Fact label="Monthly rent">{leaseMoney(agreement.monthlyRent, agreement.currency)}</Fact>
          <Fact label="Security deposit">{leaseMoney(agreement.deposit, agreement.currency)}</Fact>
          {agreement.paymentTerms && (
            <div className="sm:col-span-2 print:col-span-2">
              <dt className="font-semibold">Payment instructions</dt>
              <dd className="mt-1 whitespace-pre-wrap">{agreement.paymentTerms}</dd>
            </div>
          )}
        </dl>
      </Section>
      {agreement.agreementTerms && <Section title="Additional agreed terms">
        <p className="whitespace-pre-wrap">{agreement.agreementTerms}</p>
      </Section>}
      {agreement.status !== 'CANCELLED' && (
        <Section title="Signatures" keepTogether>
          <div className="grid gap-8 sm:grid-cols-2 print:grid-cols-2">
            <Signature label="Leasing organization representative" />
            <Signature label="Renter" />
          </div>
        </Section>
      )}
    </article>
  )
}

function Section({ title, children, keepTogether }: { title: string; children: ReactNode; keepTogether?: boolean }) {
  return (
    <section className={`mt-5 border-t border-slate-300 pt-3 text-sm leading-relaxed ${keepTogether ? 'break-inside-avoid' : ''}`}>
      <h2 className="mb-2 break-after-avoid text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0 break-inside-avoid"><dt className="font-semibold">{label}</dt><dd>{children}</dd></div>
}

function Signature({ label }: { label: string }) {
  return (
    <div className="pt-6">
      <p className="border-t border-slate-700 pt-1">{label}</p>
      <p className="mt-3">Date __________________</p>
    </div>
  )
}

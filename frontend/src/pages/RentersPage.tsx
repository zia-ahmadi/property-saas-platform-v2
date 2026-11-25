import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination } from '@/components/ui/pagination'
import { useOrganization } from '@/features/organization/context'
import { renterError, type RenterPage } from '@/features/renters/api'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingState } from '@/components/ui/loading-state'
import { Select } from '@/components/ui/select'
import { OrganizationImage } from '@/components/OrganizationImage'

export function RentersPage() {
  const org = useOrganization()
  return <RenterList key={org.current?.organizationId} />
}

function RenterList() {
  const org = useOrganization()
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(10)
  const query = useQuery({
    queryKey: org.queryKey(['renters', search, page, size]),
    queryFn: ({ signal }) =>
      org.request<RenterPage>('get', 'renters', undefined, {
        params: { search, page, size },
        signal,
      }),
    retry: false,
  })
  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <PageHeader headingLevel={2} title="Renter directory" description="Find renters and manage their contact information."
        actions={org.can('PROPERTY_MANAGE') && (
          <Link className={buttonVariants({ className: 'h-10 px-3' })} to="/renters/new">
            <Plus aria-hidden="true" className="size-4" /> Add renter
          </Link>
        )}
      />
      <section aria-label="Renters" className="min-w-0 rounded-xl border bg-card">
        <form className="flex flex-wrap items-end gap-2 p-4 sm:px-5" onSubmit={event => {
          event.preventDefault()
          setSearch(draft.trim())
          setPage(0)
        }}>
          <label className="min-w-36 flex-1 space-y-1 text-sm font-medium">
            <span>Search renters</span>
            <Input type="search" placeholder="Name or email" maxLength={254} value={draft}
              onChange={event => setDraft(event.target.value)} />
          </label>
          <Button variant="outline" type="submit" className="h-10">Search</Button>
          <Select label="Page size" value={size} onChange={event => {
            setSize(Number(event.target.value))
            setPage(0)
          }}>
            {[10, 25, 50].map(value => <option key={value} value={value}>{value}</option>)}
          </Select>
          {search && <Button variant="ghost" type="button" className="h-10" onClick={() => {
            setDraft('')
            setSearch('')
            setPage(0)
          }}>Clear search</Button>}
        </form>
        {query.isPending && <div className="border-t p-4"><LoadingState label="Loading renters…" /></div>}
        {query.isError && <div className="border-t p-4">
          <ErrorState title="Couldn’t load renters" description={renterError(query.error)} onRetry={() => void query.refetch()} />
        </div>}
        {query.data && <>
          {query.data.content.length === 0 ? (
            <div className="border-t p-4"><EmptyState title="No renters found."
              description={search ? 'Try a different name or email.' : 'Add a renter to manage their contact information and leases.'} /></div>
          ) : (
            <TableContainer aria-label="Renter directory" className="rounded-none border-x-0 border-b-0">
              <Table>
                <TableHeader className="text-xs text-muted-foreground"><TableRow>
                  <TableHead>Renter</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead className="hidden sm:table-cell">Phone</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {query.data.content.map(renter => {
                    const name = `${renter.firstName} ${renter.lastName}`
                    return <TableRow key={renter.id} className="hover:bg-muted/60">
                      <TableCell><div className="flex items-center gap-3">
                        <OrganizationImage resourceType="renter" resourceId={renter.id} alt={name} thumbnail />
                        <div className="min-w-0">
                          <Link to={`/renters/${renter.id}`} className="inline-flex items-center gap-1.5 font-semibold hover:text-primary hover:underline">
                            <span className="wrap-anywhere">{name}</span><ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                          </Link>
                          {renter.email && <p className="wrap-anywhere text-xs text-muted-foreground sm:hidden">{renter.email}</p>}
                          {renter.phone && <p className="wrap-anywhere text-xs text-muted-foreground sm:hidden">{renter.phone}</p>}
                        </div>
                      </div></TableCell>
                      <TableCell className="hidden wrap-anywhere text-muted-foreground sm:table-cell">{renter.email || '—'}</TableCell>
                      <TableCell className="hidden wrap-anywhere text-muted-foreground sm:table-cell">{renter.phone || '—'}</TableCell>
                    </TableRow>
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 sm:px-5">
            <p role="status" className="text-sm text-muted-foreground">{query.data.totalElements} renters</p>
            {page >= query.data.totalPages && page > 0 ? (
              <Button variant="outline" onClick={() => setPage(0)}>Back to results</Button>
            ) : (
              <Pagination page={page + 1} totalPages={query.data.totalPages} onPageChange={next => setPage(next - 1)} />
            )}
          </div>
        </>}
      </section>
    </div>
  )
}

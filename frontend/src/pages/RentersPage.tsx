import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination } from '@/components/ui/pagination'
import { useOrganization } from '@/features/organization/context'
import { renterError, type RenterPage } from '@/features/renters/api'
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
    <div className="space-y-6">
      <PageHeader
        headingLevel={2}
        title="Renter directory"
        actions={
          org.can('PROPERTY_MANAGE') && (
            <Link className={buttonVariants()} to="/renters/new">
              Add renter
            </Link>
          )
        }
      />
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          setSearch(draft.trim())
          setPage(0)
        }}
      >
        <label className="space-y-1">
          <span>Search renters</span>
          <Input
            type="search"
            maxLength={254}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
        <Button type="submit">Search</Button>
        <label className="space-x-2">
          <span>Page size</span>
          <select
            className="rounded border bg-background p-2"
            value={size}
            onChange={(event) => {
              setSize(Number(event.target.value))
              setPage(0)
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </label>
      </form>
      {query.isPending && <p role="status">Loading renters…</p>}
      {query.isError && (
        <div role="alert">
          <p>{renterError(query.error)}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      )}
      {query.data && (
        <>
          {query.data.content.length === 0 ? (
            <p>No renters found.</p>
          ) : (
            <ul className="space-y-3">
              {query.data.content.map((renter) => (
                <li key={renter.id} className="rounded-xl border bg-card p-5 break-words">
                  <OrganizationImage
                    resourceType="renter"
                    resourceId={renter.id}
                    alt={`${renter.firstName} ${renter.lastName}`}
                    className="mb-4 max-w-sm"
                  />
                  <h3>
                    <Link className="font-semibold underline" to={`/renters/${renter.id}`}>
                      {renter.firstName} {renter.lastName}
                    </Link>
                  </h3>
                  {renter.email && <p>{renter.email}</p>}
                  {renter.phone && <p>{renter.phone}</p>}
                </li>
              ))}
            </ul>
          )}
          <p role="status">{query.data.totalElements} renters</p>
          {page >= query.data.totalPages && page > 0 ? (
            <Button
              variant="outline"
              onClick={() => setPage(Math.max(0, query.data!.totalPages - 1))}
            >
              Back to results
            </Button>
          ) : (
            <Pagination
              page={page + 1}
              totalPages={query.data.totalPages}
              onPageChange={(next) => setPage(next - 1)}
            />
          )}
        </>
      )}
    </div>
  )
}

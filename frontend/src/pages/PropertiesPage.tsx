import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useOrganization } from '@/features/organization/context'
import type { PropertyPage } from '@/features/properties/api'
import { propertyError } from '@/features/properties/errors'
import { Button, buttonVariants } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { PageHeader } from '@/components/ui/page-header'

export function PropertiesPage() {
  const org = useOrganization()
  const [paging, setPaging] = useState({ organizationId: org.current?.organizationId, page: 0 })
  const page = paging.organizationId === org.current?.organizationId ? paging.page : 0
  const setPage = (next: number) => setPaging({ organizationId: org.current?.organizationId, page: next })
  const [size, setSize] = useState(10)
  const query = useQuery({ queryKey: org.queryKey(['properties', page, size]), queryFn: ({ signal }) => org.request<PropertyPage>('get', 'properties', undefined, { params: { page, size }, signal }), retry: false })
  return <div className="space-y-6"><PageHeader headingLevel={2} title="Properties" description="Manage properties in the selected organization." actions={org.can('PROPERTY_MANAGE') && <Link className={buttonVariants()} to="/properties/new">Add property</Link>} />
    <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh</Button><label>Page size <select aria-label="Page size" className="rounded border bg-background p-2" value={size} onChange={e => { setSize(Number(e.target.value)); setPage(0) }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label></div>
    {query.isPending && <p role="status">Loading properties…</p>}{query.isError && <p role="alert">{propertyError(query.error)}</p>}
    {query.data && <>{query.data.content.length === 0 ? <p>No properties found.</p> : <ul className="space-y-3">{query.data.content.map(property => <li key={property.id} className="rounded-xl border bg-card p-5"><h3><Link className="font-semibold underline" to={`/properties/${property.id}`}>{property.name}</Link></h3><p>{property.city}, {property.countryCode}</p><p className="text-sm text-muted-foreground">{property.propertyType.replace('_', ' ')} · {property.status}</p></li>)}</ul>}<p>Page {query.data.page + 1} of {Math.max(query.data.totalPages, 1)} · {query.data.totalElements} properties</p><Pagination page={page + 1} totalPages={query.data.totalPages} onPageChange={n => setPage(n - 1)} /></>}
  </div>
}

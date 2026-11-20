import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router'
import { useOrganization } from '@/features/organization/context'
import type { Property } from '@/features/properties/api'
import { propertyError } from '@/features/properties/errors'
import { Button, buttonVariants } from '@/components/ui/button'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'

export function PropertyDetailsPage() {
  const { propertyId = '' } = useParams()
  const location = useLocation()
  const saved = (location.state as { saved?: string } | null)?.saved
  const org = useOrganization(); const client = useQueryClient(); const [open, setOpen] = useState(false)
  const query = useQuery({ queryKey: org.queryKey(['property', propertyId]), queryFn: ({ signal }) => org.request<Property>('get', `properties/${propertyId}`, undefined, { signal }), retry: false })
  const archive = useMutation({ mutationFn: () => org.request<Property>('patch', `properties/${propertyId}/archive`), onError: () => { setOpen(false); void client.invalidateQueries({ queryKey: org.queryKey(['dashboard']) }) }, onSuccess: async () => { await client.invalidateQueries({ queryKey: org.queryKey(['dashboard']) }); setOpen(false); await client.invalidateQueries({ queryKey: org.queryKey(['properties']) }); await client.invalidateQueries({ queryKey: org.queryKey(['property', propertyId]) }) } })
  return <div className="space-y-5"><Link className={buttonVariants({ variant: 'outline' })} to="/properties">Back to Properties</Link><h2 className="text-2xl font-bold">Property Details</h2>{(saved === 'created' || saved === 'updated') && <p role="status">Property {saved} successfully.</p>}
    {query.isPending && <p role="status">Loading property…</p>}{query.isError && <p role="alert">{propertyError(query.error)}</p>}
    {query.data && <section className="space-y-4 rounded-xl border bg-card p-6"><h3 className="text-xl font-semibold">{query.data.name}</h3><p>{query.data.addressLine1}{query.data.addressLine2 && `, ${query.data.addressLine2}`}, {query.data.city}, {query.data.countryCode}</p><p>Type: {query.data.propertyType.replace('_', ' ')} · Status: {query.data.status}</p><Link className="underline" to={`/properties/${propertyId}/units`}>Manage Units</Link>
    {org.can('PROPERTY_MANAGE') && query.data.status === 'ACTIVE' && <div className="flex flex-wrap gap-3"><Link className={buttonVariants({ variant: 'outline' })} to={`/properties/${propertyId}/edit`}>Edit property</Link><ConfirmationDialog trigger={<Button variant="destructive">Archive property</Button>} open={open} onOpenChange={setOpen} title="Archive property?" description="This marks the property as archived. It remains in the property list and is not deleted." confirmLabel="Archive" loading={archive.isPending} onConfirm={() => archive.mutate()} destructive /></div>}{archive.isError && <p role="alert">{propertyError(archive.error)}</p>}</section>}
  </div>
}

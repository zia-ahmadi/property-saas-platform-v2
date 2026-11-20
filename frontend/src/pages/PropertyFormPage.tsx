import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { useOrganization } from '@/features/organization/context'
import { PropertyForm } from '@/features/properties/PropertyForm'
import { emptyProperty } from '@/features/properties/api'
import type { Property, PropertyInput } from '@/features/properties/api'
import { propertyError } from '@/features/properties/errors'

export function PropertyFormPage({ edit = false }: { edit?: boolean }) {
  const { propertyId = '' } = useParams(); const org = useOrganization(); const navigate = useNavigate(); const client = useQueryClient()
  const query = useQuery({ queryKey: org.queryKey(['property', propertyId]), queryFn: ({ signal }) => org.request<Property>('get', `properties/${propertyId}`, undefined, { signal }), enabled: edit, retry: false })
  const save = useMutation({ mutationFn: (input: PropertyInput) => org.request<Property>(edit ? 'patch' : 'post', edit ? `properties/${propertyId}` : 'properties', input), onSuccess: result => { void client.invalidateQueries({ queryKey: org.queryKey(['properties']) }); void client.invalidateQueries({ queryKey: org.queryKey(['property', result.id]) }); navigate(`/properties/${result.id}`, { state: { saved: edit ? 'updated' : 'created' } }) } })
  const initial = edit && query.data ? { name: query.data.name, propertyType: query.data.propertyType, addressLine1: query.data.addressLine1, addressLine2: query.data.addressLine2, city: query.data.city, countryCode: query.data.countryCode } : emptyProperty
  return <div className="space-y-5"><Link className="underline" to="/properties">Back to properties</Link><h2 className="text-2xl font-bold">{edit ? 'Edit property' : 'Add property'}</h2>{edit && query.isPending && <p role="status">Loading property…</p>}{edit && query.isError && <p role="alert">{propertyError(query.error)}</p>}{edit && query.data?.status === 'ARCHIVED' && <p role="alert">Archived properties cannot be edited here.</p>}{(!edit || (query.data && query.data.status === 'ACTIVE')) && <PropertyForm key={`${org.current?.organizationId}:${propertyId}`} initial={initial} saving={save.isPending} error={save.isError ? propertyError(save.error) : undefined} onSave={input => save.mutate(input)} />}</div>
}

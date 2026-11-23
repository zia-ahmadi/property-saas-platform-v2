import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { useOrganization } from '@/features/organization/context'
import { PropertyForm } from '@/features/properties/PropertyForm'
import { emptyProperty } from '@/features/properties/api'
import type { Property, PropertyInput } from '@/features/properties/api'
import { propertyError } from '@/features/properties/errors'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function PropertyFormPage({ edit = false }: { edit?: boolean }) {
  const { propertyId = '' } = useParams()
  const org = useOrganization()
  const navigate = useNavigate()
  const client = useQueryClient()
  const query = useQuery({
    queryKey: org.queryKey(['property', propertyId]),
    queryFn: ({ signal }) =>
      org.request<Property>('get', `properties/${propertyId}`, undefined, { signal }),
    enabled: edit,
    retry: false,
  })
  const save = useMutation({
    mutationFn: (input: PropertyInput) =>
      org.request<Property>(
        edit ? 'patch' : 'post',
        edit ? `properties/${propertyId}` : 'properties',
        input,
      ),
    onError: () => {
      void client.invalidateQueries({ queryKey: org.queryKey(['dashboard']) })
    },
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: org.queryKey(['dashboard']) })
      void client.invalidateQueries({ queryKey: org.queryKey(['properties']) })
      void client.invalidateQueries({ queryKey: org.queryKey(['property', result.id]) })
      navigate(`/properties/${result.id}`, { state: { saved: edit ? 'updated' : 'created' } })
    },
  })
  const initial =
    edit && query.data
      ? {
          name: query.data.name,
          propertyType: query.data.propertyType,
          addressLine1: query.data.addressLine1,
          addressLine2: query.data.addressLine2,
          city: query.data.city,
          countryCode: query.data.countryCode,
        }
      : emptyProperty
  const archived = edit && query.data?.status === 'ARCHIVED'

  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 space-y-6">
      <Link className={buttonVariants({ variant: 'outline' })} to="/properties">
        Back to properties
      </Link>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Portfolio / Properties
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">
          {edit ? 'Edit property' : 'Add property'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {edit
            ? 'Keep the location and property details up to date.'
            : 'Add a property to start organizing its units and availability.'}
        </p>
      </div>
      {edit && query.isPending && (
        <p role="status" className="rounded-xl border bg-card p-5 text-muted-foreground">
          Loading property…
        </p>
      )}
      {edit && query.isError && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          {propertyError(query.error)}
        </p>
      )}
      {archived && (
        <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          Archived properties cannot be edited here.
        </p>
      )}
      {(!edit || (query.data && !archived)) && (
        <Card className="rounded-2xl p-5 sm:p-7">
          <PropertyForm
            key={`${org.current?.organizationId}:${propertyId}`}
            initial={initial}
            saving={save.isPending}
            error={save.isError ? propertyError(save.error) : undefined}
            onSave={(input) => save.mutate(input)}
          />
        </Card>
      )}
    </div>
  )
}

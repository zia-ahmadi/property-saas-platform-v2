import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router'
import { ArrowRight, Building2, MapPin, Pencil, Warehouse } from 'lucide-react'
import { useOrganization } from '@/features/organization/context'
import type { Property } from '@/features/properties/api'
import { propertyError } from '@/features/properties/errors'
import { Button, buttonVariants } from '@/components/ui/button'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { OrganizationImage } from '@/components/OrganizationImage'

export function PropertyDetailsPage() {
  const { propertyId = '' } = useParams()
  const location = useLocation()
  const saved = (location.state as { saved?: string } | null)?.saved
  const org = useOrganization()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const query = useQuery({
    queryKey: org.queryKey(['property', propertyId]),
    queryFn: ({ signal }) =>
      org.request<Property>('get', `properties/${propertyId}`, undefined, { signal }),
    retry: false,
  })
  const archive = useMutation({
    mutationFn: () => org.request<Property>('patch', `properties/${propertyId}/archive`),
    onError: () => {
      setOpen(false)
      void client.invalidateQueries({ queryKey: org.queryKey(['dashboard']) })
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: org.queryKey(['dashboard']) })
      setOpen(false)
      await client.invalidateQueries({ queryKey: org.queryKey(['properties']) })
      await client.invalidateQueries({ queryKey: org.queryKey(['property', propertyId]) })
    },
  })
  const property = query.data
  const editable = org.can('PROPERTY_MANAGE') && property?.status === 'ACTIVE'
  return (
    <div className="mx-auto w-full max-w-[1200px] min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className={buttonVariants({ variant: 'outline' })} to="/properties">
          Back to Properties
        </Link>
        {editable && (
          <div className="flex flex-wrap gap-2">
            <Link
              className={buttonVariants({ variant: 'outline' })}
              to={`/properties/${propertyId}/edit`}
            >
              <Pencil aria-hidden="true" className="size-4" />
              Edit property
            </Link>
            <ConfirmationDialog
              trigger={<Button variant="destructive">Archive property</Button>}
              open={open}
              onOpenChange={setOpen}
              title="Archive property?"
              description="This marks the property as archived. It remains in the property list and is not deleted."
              confirmLabel="Archive"
              loading={archive.isPending}
              onConfirm={() => archive.mutate()}
              destructive
            />
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Portfolio / Property
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">Property Details</h2>
      </div>
      {(saved === 'created' || saved === 'updated') && (
        <p
          role="status"
          className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200"
        >
          Property {saved} successfully.
        </p>
      )}
      {query.isPending && (
        <p role="status" className="rounded-xl border bg-card p-5 text-muted-foreground">
          Loading property…
        </p>
      )}
      {query.isError && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          {propertyError(query.error)}
        </p>
      )}
      {property && (
        <>
          <section className="rounded-xl border bg-card p-4 sm:p-6">
            <div className="relative flex flex-wrap items-start justify-between gap-5">
              <div className="flex min-w-0 items-start gap-4">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                  <Building2 aria-hidden="true" className="size-7" />
                </span>
                <div className="min-w-0 space-y-2">
                  <h3 className="wrap-anywhere text-2xl font-semibold tracking-tight sm:text-3xl">
                    {property.name}
                  </h3>
                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    <span className="wrap-anywhere">
                      {property.addressLine1}
                      {property.addressLine2 && `, ${property.addressLine2}`}, {property.city},{' '}
                      {property.countryCode}
                    </span>
                  </p>
                </div>
              </div>
              <Badge
                variant="secondary"
                className={
                  property.status === 'ACTIVE'
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-muted text-muted-foreground'
                }
              >
                {property.status === 'ACTIVE' ? 'Active' : 'Archived'}
              </Badge>
            </div>
          </section>

          {property.status === 'ARCHIVED' && (
            <p role="status" className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm">
              This property is archived. Its details and units remain available for review, but it
              can no longer be changed.
            </p>
          )}
          {archive.isError && (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              {propertyError(archive.error)}
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="gap-5 rounded-2xl p-5 sm:p-6">
              <div>
                <h3 className="text-lg font-semibold">Property information</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Key details for this location.
                </p>
              </div>
              <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Property type
                  </dt>
                  <dd className="mt-1 font-medium">
                    {property.propertyType.replaceAll('_', ' ')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Status
                  </dt>
                  <dd className="mt-1 font-medium">
                    {property.status === 'ACTIVE' ? 'Active' : 'Archived'}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Address
                  </dt>
                  <dd className="mt-1 wrap-anywhere font-medium">
                    {property.addressLine1}
                    {property.addressLine2 && `, ${property.addressLine2}`}, {property.city},{' '}
                    {property.countryCode}
                  </dd>
                </div>
              </dl>
            </Card>
            <Card className="gap-4 rounded-2xl border-primary/15 bg-primary/[0.025] p-5 sm:p-6">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Warehouse aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h3 className="text-lg font-semibold">Units & spaces</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Review unit details, availability, and floor information for this property.
                </p>
              </div>
              <Link
                className={buttonVariants({
                  variant: 'outline',
                  className: 'mt-auto w-full justify-between',
                })}
                to={`/properties/${propertyId}/units`}
              >
                {property.status === 'ARCHIVED' ? 'View units' : 'Manage Units'}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              {!org.can('PROPERTY_MANAGE') && (
                <p className="text-xs text-muted-foreground">
                  You have read-only access to this property.
                </p>
              )}
              {org.can('MAINTENANCE_MANAGE') && (
                <Link
                  className={buttonVariants({ variant: 'outline', className: 'w-full justify-between' })}
                  to={`/maintenance?propertyId=${property.id}`}
                >
                  View maintenance requests
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              )}
            </Card>
          </div>
          <Card className="max-w-xl">
            <h3 className="text-lg font-semibold">Property photo</h3>
            <OrganizationImage
              resourceType="property"
              resourceId={property.id}
              alt={`${property.name} property`}
              canManage={org.can('PROPERTY_MANAGE')}
              editable={property.status === 'ACTIVE'}
            />
          </Card>
        </>
      )}
    </div>
  )
}

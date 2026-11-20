import { useOptionalOrganization } from '@/features/organization/context'
import { Link } from 'react-router'
import { Building2, ChevronRight, MapPin } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'

export function PropertiesPage() {
  const organization = useOptionalOrganization()
  const properties = [
    {
      id: 'prop-101',
      name: 'Grandview Commercial Tower',
      address: '100 Financial Way, New York, NY',
      units: 42,
      occupancy: '95%',
    },
    {
      id: 'prop-102',
      name: 'Parkside Residential Apartments',
      address: '450 Park Avenue, Boston, MA',
      units: 28,
      occupancy: '92%',
    },
    {
      id: 'prop-103',
      name: 'Harbor Logistics Center',
      address: '88 Port Boulevard, Seattle, WA',
      units: 14,
      occupancy: '100%',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        headingLevel={2}
        title="Properties"
        description="Manage your enterprise real estate portfolio."
        actions={organization?.can('PROPERTY_MANAGE') && <Button disabled>Add Property</Button>}
      />

      <div className="grid grid-cols-1 gap-4">
        {properties.map((prop) => (
          <div
            key={prop.id}
            className="flex flex-wrap items-center justify-between gap-4 relative rounded-xl border bg-card p-4 shadow-xs motion-safe:transition-shadow hover:border-primary/50 hover:shadow-md sm:p-6"
          >
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="size-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold">
                  <Link
                    to={`/properties/${prop.id}`}
                    className="before:absolute before:inset-0 hover:underline"
                  >
                    {prop.name}
                  </Link>
                </h3>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <MapPin aria-hidden="true" className="size-3.5" />
                  <span>{prop.address}</span>
                  <span aria-hidden="true">•</span>
                  <span>{prop.units} Units</span>
                  <span aria-hidden="true">•</span>
                  <span>{prop.occupancy} Occupied</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={`/properties/${prop.id}/units`}
                aria-label={`View Units for ${prop.name}`}
                className={buttonVariants({
                  variant: 'outline',
                  size: 'sm',
                  className: 'relative',
                })}
              >
                View Units
              </Link>
              <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

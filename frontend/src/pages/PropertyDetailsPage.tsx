import { Link, useParams } from 'react-router'
import { Building2, MapPin, Layers, ArrowLeft, ExternalLink } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

export function PropertyDetailsPage() {
  const { propertyId } = useParams<{ propertyId: string }>()

  return (
    <div className="space-y-6">
      <div className="flex min-w-0 items-center gap-4">
        <Link
          to="/properties"
          className={buttonVariants({ variant: 'outline', size: 'sm', className: 'gap-2' })}
        >
          <ArrowLeft aria-hidden="true" className="size-4" /> Back to Properties
        </Link>
      </div>

      <div className="rounded-xl border bg-card p-4 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex size-12 shrink-0 items-center sm:size-16 justify-center rounded-2xl bg-primary/10 text-primary">
              <Building2 className="size-8" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight">Property Details</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-medium wrap-anywhere">
                  ID: {propertyId}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin aria-hidden="true" className="size-4 shrink-0" />
                <span>100 Financial Way, New York, NY (Enterprise Commercial Portfolio)</span>
              </div>
            </div>
          </div>

          <Link
            to={`/properties/${propertyId}/units`}
            className={buttonVariants({ className: 'gap-2' })}
          >
            <Layers aria-hidden="true" className="size-4" /> Manage Units
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
          <div className="min-w-0 space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Units
            </span>
            <p className="text-xl font-bold">42 Units</p>
          </div>
          <div className="min-w-0 space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Occupancy Rate
            </span>
            <p className="text-xl font-bold text-emerald-600">95%</p>
          </div>
          <div className="min-w-0 space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Tenant Isolation
            </span>
            <p className="text-xl font-bold font-mono text-primary">Organization Scoped</p>
          </div>
        </div>
      </div>
    </div>
  )
}

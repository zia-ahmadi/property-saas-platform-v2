import { useParams, useNavigate } from 'react-router'
import { Building2, MapPin, Layers, ArrowLeft, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PropertyDetailsPage() {
  const { propertyId } = useParams<{ propertyId: string }>()
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/properties')}
          className="gap-2"
        >
          <ArrowLeft className="size-4" /> Back to Properties
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-8 shadow-xs space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Building2 className="size-8" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight">Property Details</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-medium">
                  ID: {propertyId}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="size-4" />
                <span>100 Financial Way, New York, NY (Enterprise Commercial Portfolio)</span>
              </div>
            </div>
          </div>

          <Button onClick={() => navigate(`/properties/${propertyId}/units`)} className="gap-2">
            <Layers className="size-4" /> Manage Units <ExternalLink className="size-3.5" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Units
            </span>
            <p className="text-xl font-bold">42 Units</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Occupancy Rate
            </span>
            <p className="text-xl font-bold text-emerald-600">95%</p>
          </div>
          <div className="space-y-1">
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

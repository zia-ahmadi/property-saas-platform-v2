import { useNavigate } from 'react-router'
import { Building2, ChevronRight, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PropertiesPage() {
  const navigate = useNavigate()

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Properties</h2>
          <p className="text-sm text-muted-foreground">
            Manage your enterprise real estate portfolio.
          </p>
        </div>
        <Button>Add Property</Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {properties.map((prop) => (
          <div
            key={prop.id}
            onClick={() => navigate(`/properties/${prop.id}`)}
            className="flex items-center justify-between rounded-xl border bg-card p-6 shadow-xs transition-all hover:border-primary/50 hover:shadow-md cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="size-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-base">{prop.name}</h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="size-3.5" />
                  <span>{prop.address}</span>
                  <span>•</span>
                  <span>{prop.units} Units</span>
                  <span>•</span>
                  <span>{prop.occupancy} Occupied</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/properties/${prop.id}/units`)
                }}
              >
                View Units
              </Button>
              <ChevronRight className="size-5 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

import { useOptionalOrganization } from '@/features/organization/context'
import { Link, useParams } from 'react-router'
import { Layers, ArrowLeft, Plus, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'

export function UnitsPage() {
  const organization = useOptionalOrganization()
  const { propertyId } = useParams<{ propertyId: string }>()

  const units = [
    {
      id: 'unit-301',
      number: 'Suite 400',
      floor: '4th Floor',
      status: 'Occupied',
      tenant: 'Acme Corp',
      rent: '$12,500/mo',
    },
    {
      id: 'unit-302',
      number: 'Suite 402',
      floor: '4th Floor',
      status: 'Vacant',
      tenant: '—',
      rent: '$9,800/mo',
    },
    {
      id: 'unit-303',
      number: 'Suite 501',
      floor: '5th Floor',
      status: 'Occupied',
      tenant: 'Apex Logistics',
      rent: '$15,000/mo',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to={`/properties/${propertyId}`}
          className={buttonVariants({ variant: 'outline', size: 'sm', className: 'gap-2' })}
        >
          <ArrowLeft aria-hidden="true" className="size-4" /> Back to Property Details
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Units Management</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted font-mono font-medium text-foreground wrap-anywhere">
              Property: {propertyId}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage leasable units and tenant allocations for this property.
          </p>
        </div>
        {organization?.can('PROPERTY_MANAGE') && <Button disabled className="gap-2"><Plus className="size-4" /> Add Unit</Button>}
      </div>

      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <div className="p-6 border-b bg-muted/30">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Layers className="size-4 text-primary" /> Registered Units
          </h3>
        </div>
        <div className="divide-y">
          {units.map((unit) => (
            <div
              key={unit.id}
              className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-muted/50 motion-safe:transition-colors sm:px-6"
            >
              <div className="flex items-center gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold text-sm">
                  {unit.number.split(' ')[1] || 'U'}
                </div>
                <div>
                  <h4 className="font-semibold text-sm">{unit.number}</h4>
                  <p className="text-xs text-muted-foreground">
                    {unit.floor} • Tenant: {unit.tenant}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-sm font-semibold">{unit.rent}</div>
                  <div className="flex items-center gap-1.5 justify-end text-xs">
                    {unit.status === 'Occupied' ? (
                      <>
                        <CheckCircle2 aria-hidden="true" className="size-3.5" />
                        <span className="font-medium">Occupied</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle aria-hidden="true" className="size-3.5" />
                        <span className="font-medium">Vacant</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

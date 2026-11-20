import { matchPath, useLocation } from 'react-router'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'

export function PortfolioBreadcrumbs() {
  const { pathname } = useLocation()
  const match = matchPath('/properties/:propertyId/*', pathname)
  if (!match || match.params.propertyId === 'new') return null
  const property = `/properties/${match.params.propertyId}`
  const tail = match.params['*'] ?? ''
  const ancestors = [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Properties', to: '/properties' },
  ]
  if (tail && tail !== 'edit') ancestors.push({ label: 'Property details', to: property })
  if (tail.startsWith('units/'))
    ancestors.push({ label: 'Property units', to: `${property}/units` })
  const unit = matchPath('/properties/:propertyId/units/:unitId/edit', pathname)
  if (unit) ancestors.push({ label: 'Unit details', to: `${property}/units/${unit.params.unitId}` })
  const current =
    tail === ''
      ? 'Property details'
      : tail === 'edit'
        ? 'Edit property'
        : tail === 'units'
          ? 'Property units'
          : tail === 'units/new'
            ? 'Create unit'
            : unit
              ? 'Edit unit'
              : 'Unit details'
  return (
    <div className="mb-5">
      <Breadcrumbs ancestors={ancestors} current={current} />
    </div>
  )
}

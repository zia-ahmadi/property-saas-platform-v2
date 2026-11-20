export const unitTypes = ['APARTMENT', 'OFFICE', 'SHOP', 'OTHER'] as const
export type UnitType = (typeof unitTypes)[number]
export interface UnitInput {
  unitNumber: string
  unitType: UnitType
  floorNumber: number | null
  areaSqm: number | null
}
export interface Unit extends UnitInput {
  id: string
  propertyId: string
  availabilityStatus: string
  createdAt: string
  updatedAt: string
}
export interface UnitPage {
  content: Unit[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}
export const emptyUnit: UnitInput = {
  unitNumber: '',
  unitType: 'APARTMENT',
  floorNumber: null,
  areaSqm: null,
}
export function manualTarget(status: string): 'AVAILABLE' | 'UNAVAILABLE' | undefined {
  return status === 'AVAILABLE' ? 'UNAVAILABLE' : status === 'UNAVAILABLE' ? 'AVAILABLE' : undefined
}

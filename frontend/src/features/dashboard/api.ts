import { ApiError } from '@/lib/api/errors'
export interface DashboardSummary {
  totalProperties: number
  activeProperties: number
  archivedProperties: number
  totalUnits: number
  availableUnits: number
  unavailableUnits: number
  occupiedUnits: number
}
export function dashboardSummary(value: DashboardSummary): DashboardSummary {
  const keys: (keyof DashboardSummary)[] = [
    'totalProperties',
    'activeProperties',
    'archivedProperties',
    'totalUnits',
    'availableUnits',
    'unavailableUnits',
    'occupiedUnits',
  ]
  if (
    !value ||
    keys.some((key) => !Number.isSafeInteger(value[key]) || value[key] < 0) ||
    value.totalProperties !== value.activeProperties + value.archivedProperties ||
    value.totalUnits !== value.availableUnits + value.unavailableUnits + value.occupiedUnits
  )
    throw new Error('Invalid dashboard summary')
  return value
}
export function dashboardError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session needs verification. Please sign in again.'
    if (error.status === 403)
      return 'You no longer have permission to view this organization’s portfolio.'
    if (error.isNetworkError || error.isTimeoutError)
      return 'Unable to reach the server. Check your connection and retry.'
  }
  return 'The portfolio summary could not be loaded. Please retry.'
}

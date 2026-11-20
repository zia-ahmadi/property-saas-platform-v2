import { ApiError } from '@/lib/api/errors'
export function unitError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400) return 'Check the unit fields and try again.'
    if (error.status === 401) return 'Your session needs verification. Please sign in again.'
    if (error.status === 403) return 'You do not have permission to access this unit or property.'
    if (error.status === 404)
      return 'This unit or property was not found in the selected organization.'
    if (error.status === 409)
      return 'This change conflicts with the current state. The unit number may already exist, the property may be archived, or occupancy may have changed. Refresh and try again.'
    if (error.isNetworkError || error.isTimeoutError)
      return 'Unable to reach the server. Check your connection and try again.'
  }
  return 'The request could not be completed. Please try again.'
}

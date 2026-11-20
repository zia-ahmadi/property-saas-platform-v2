import { ApiError } from '@/lib/api/errors'
export function propertyError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'The request could not be completed. Please try again.'
  if (error.status === 400) return 'Please check the property details and try again.'
  if (error.status === 401) return 'Your session needs verification. Please try again after signing in.'
  if (error.status === 403) return 'You do not have permission to perform this action.'
  if (error.status === 404) return 'This property could not be found in the selected organization.'
  if (error.status === 409) return 'This change conflicts with the current property state.'
  if (error.isNetworkError || error.isTimeoutError) return 'Unable to reach the server. Check your connection and try again.'
  return 'The request could not be completed. Please try again.'
}

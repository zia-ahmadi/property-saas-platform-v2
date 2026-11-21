import { ApiError } from '@/lib/api/errors'

export interface RenterInput {
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
}

export interface Renter extends RenterInput {
  id: string
  organizationId: string
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export interface RenterPage {
  content: Renter[]
  page: number
  totalPages: number
  totalElements: number
}

export function renterError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400) return 'Check the renter details or search and try again.'
    if (error.status === 403) return 'You do not have permission to perform this action.'
    if (error.status === 404) return 'This renter could not be found in the selected organization.'
    if (error.status === 409) return 'This renter has already been archived.'
    if (error.isNetworkError || error.isTimeoutError)
      return 'Unable to reach the server. Check your connection and try again.'
  }
  return 'The request could not be completed. Please try again.'
}

import { ApiError } from '@/lib/api/errors'

export const leaseStatuses = { DRAFT: 'Draft', ACTIVE: 'Active', ENDED: 'Ended', CANCELLED: 'Cancelled' }
export type LeaseStatus = keyof typeof leaseStatuses
export type LeaseAction = 'ACTIVATE' | 'END' | 'CANCEL'

export interface LeaseTerms {
  unitId: string
  renterId: string
  startsOn: string
  endsOn: string | null
  monthlyRent: number
  deposit: number
  currency: string
  notes: string | null
}

export interface Lease extends LeaseTerms {
  id: string
  propertyId: string
  propertyName: string
  unitNumber: string
  renterName: string
  status: LeaseStatus
  activatedAt: string | null
  closedAt: string | null
  version: number
}

export interface LeasePage<T> {
  content: T[]
  totalElements: number
  totalPages: number
}

export interface LeaseSummary {
  drafts: number
  active: number
  endingSoon: number
  ended: number
  asOf: string
}

export interface LeaseUnit {
  id: string
  propertyId: string
  propertyName: string
  unitNumber: string
  availabilityStatus: 'AVAILABLE' | 'OCCUPIED' | 'UNAVAILABLE'
}

export function leaseDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value))
}

export function leaseMoney(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'code', maximumFractionDigits: 2 }).format(value)
}

export function leaseError(error: unknown) {
  return error instanceof ApiError && error.status >= 400 && error.status < 500
    ? error.message : 'The lease could not be saved. Please try again.'
}

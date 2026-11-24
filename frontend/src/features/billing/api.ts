import { ApiError } from '@/lib/api/errors'

export const invoiceStatuses = {
  OPEN: 'Open', PARTIALLY_PAID: 'Partially paid', OVERDUE: 'Overdue', PAID: 'Paid', VOID: 'Void',
}

export const paymentMethods = {
  CASH: 'Cash', BANK_TRANSFER: 'Bank transfer', CHECK: 'Check', OTHER: 'Other',
}

export type InvoiceStatus = keyof typeof invoiceStatuses
export type PaymentMethod = keyof typeof paymentMethods

export interface Invoice {
  id: string
  invoiceNumber: number
  leaseId: string
  renterName: string
  propertyName: string
  unitNumber: string
  billingMonth: string
  dueOn: string
  currency: string
  amount: number
  paidAmount: number
  balance: number
  status: InvoiceStatus
  issuedAt: string
  voidedAt: string | null
  voidReason: string | null
  version: number
}

export interface InvoiceDetails {
  invoice: Invoice
  payments: {
    id: string
    amount: number
    receivedOn: string
    method: PaymentMethod
    reference: string | null
    recordedAt: string
  }[]
  asOf: string
}

export interface BillingSummary {
  open: number
  overdue: number
  paid: number
  totals: { currency: string; outstanding: number; overdue: number; collected: number }[]
  asOf: string
}

export const invoicePath = 'billing/invoices'
export const billingKey = ['billing'] as const

export function invoiceMonth(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(value))
}

export function billingError(error: unknown, fallback: string) {
  return error instanceof ApiError && error.status >= 400 && error.status < 500 ? error.message : fallback
}

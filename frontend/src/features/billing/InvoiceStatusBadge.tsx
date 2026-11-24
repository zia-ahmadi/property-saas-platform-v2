import { StatusBadge } from '@/components/ui/status-badge'
import { invoiceStatuses, type InvoiceStatus } from './api'

const tones = { OPEN: 'neutral', PARTIALLY_PAID: 'warning', OVERDUE: 'destructive', PAID: 'success', VOID: 'neutral' } as const

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <StatusBadge tone={tones[status]}>{invoiceStatuses[status]}</StatusBadge>
}

export const categories = {
  GENERAL: 'General repairs',
  PLUMBING: 'Plumbing',
  ELECTRICAL: 'Electrical',
  HVAC: 'Heating & cooling',
  APPLIANCE: 'Appliances',
  OTHER: 'Other',
}

export const priorities = { LOW: 'Low', NORMAL: 'Normal', HIGH: 'High', URGENT: 'Urgent' }
export const statuses = { OPEN: 'Open', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved', CANCELLED: 'Cancelled' }

export interface MaintenanceInput {
  propertyId: string
  unitId: string | null
  title: string
  description: string
  category: keyof typeof categories
  priority: keyof typeof priorities
  assignedTo: string | null
  dueDate: string | null
}

export interface MaintenanceRequest extends MaintenanceInput {
  id: string
  propertyName: string
  unitNumber: string | null
  status: keyof typeof statuses
  resolutionNotes: string | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  version: number
}

export interface MaintenancePageData {
  content: MaintenanceRequest[]
  totalElements: number
  totalPages: number
}

export interface MaintenanceSummary {
  open: number
  inProgress: number
  urgent: number
  resolved: number
}

export function maintenancePropertyId(params: URLSearchParams) {
  const id = params.get('propertyId') ?? ''
  return /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id) ? id : ''
}

export function formatDate(value: string) {
  const date = new Date(value.length === 10 ? value + 'T00:00:00' : value)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function isOverdue(request: MaintenanceRequest) {
  if (!request.dueDate || request.status === 'RESOLVED' || request.status === 'CANCELLED') return false
  return new Date(request.dueDate + 'T23:59:59.999').getTime() < Date.now()
}

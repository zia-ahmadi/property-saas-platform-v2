export const testProperty = { id: 'prop-101', organizationId: 'test', name: 'Grandview Commercial Tower', propertyType: 'COMMERCIAL', addressLine1: '100 Financial Way', addressLine2: null, city: 'New York', countryCode: 'US', status: 'ACTIVE', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' }
export const propertyOrganization = {
  current: { organizationId: 'test', organizationName: 'Test', organizationSlug: 'test', role: 'OWNER' },
  can: () => true, organizations: [], select: () => {},
  queryKey: (keys: unknown[]) => ['organization', 'test', ...keys],
  request: async (_method: string, path: string) => {
    if (path === 'dashboard/summary') {
      return {
        totalProperties: 1, activeProperties: 1, archivedProperties: 0,
        totalUnits: 0, availableUnits: 0, unavailableUnits: 0, occupiedUnits: 0,
      }
    }
    if (path === 'billing/invoices/summary') {
      return { open: 0, overdue: 0, paid: 0, totals: [], asOf: '2026-11-24' }
    }
    if (path === 'renters' || path === 'billing/invoices' || path.endsWith('/units')) {
      return { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, first: true, last: true }
    }
    if (path === 'properties') {
      return { content: [testProperty], page: 0, size: 10, totalElements: 1, totalPages: 1, first: true, last: true }
    }
    return path.startsWith('properties/') ? testProperty : { status: 'active' }
  },
}

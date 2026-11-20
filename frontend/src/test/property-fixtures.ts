export const testProperty = { id: 'prop-101', organizationId: 'test', name: 'Grandview Commercial Tower', propertyType: 'COMMERCIAL', addressLine1: '100 Financial Way', addressLine2: null, city: 'New York', countryCode: 'US', status: 'ACTIVE', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' }
export const propertyOrganization = {
  current: { organizationId: 'test', organizationName: 'Test', organizationSlug: 'test', role: 'OWNER' },
  can: () => true, organizations: [], select: () => {},
  queryKey: (keys: unknown[]) => ['organization', 'test', ...keys],
  request: async (_method: string, path: string) => path === 'properties' ? { content: [testProperty], page: 0, size: 10, totalElements: 1, totalPages: 1, first: true, last: true } : path.startsWith('properties/') ? testProperty : { status: 'active' },
}

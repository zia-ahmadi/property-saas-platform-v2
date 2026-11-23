import type { OrganizationRole } from '@/features/auth/api'

export type OrganizationPermission = 'ORGANIZATION_VIEW' | 'ORGANIZATION_MANAGE' | 'MEMBERSHIP_MANAGE' | 'PROPERTY_VIEW' | 'PROPERTY_MANAGE' | 'LEASE_MANAGE' | 'BILLING_MANAGE' | 'MAINTENANCE_MANAGE'
const all: readonly OrganizationPermission[] = ['ORGANIZATION_VIEW', 'ORGANIZATION_MANAGE', 'MEMBERSHIP_MANAGE', 'PROPERTY_VIEW', 'PROPERTY_MANAGE', 'LEASE_MANAGE', 'BILLING_MANAGE', 'MAINTENANCE_MANAGE']
const permissions: Record<OrganizationRole, readonly OrganizationPermission[]> = {
  OWNER: all,
  ADMIN: all.filter(permission => permission !== 'MEMBERSHIP_MANAGE'),
  MANAGER: ['ORGANIZATION_VIEW', 'PROPERTY_VIEW', 'PROPERTY_MANAGE', 'LEASE_MANAGE', 'MAINTENANCE_MANAGE'],
  STAFF: ['ORGANIZATION_VIEW', 'PROPERTY_VIEW', 'MAINTENANCE_MANAGE'],
}
export function hasPermission(role: OrganizationRole | undefined, permission: OrganizationPermission): boolean {
  return role !== undefined && (permissions[role]?.includes(permission) ?? false)
}

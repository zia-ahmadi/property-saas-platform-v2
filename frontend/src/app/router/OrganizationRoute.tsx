import { Navigate, Outlet } from 'react-router'
import { useOptionalOrganization } from '@/features/organization/context'
import { RestrictedOrganizations } from '@/features/organization/RestrictedOrganizations'
import type { OrganizationPermission } from '@/features/organization/permissions'

export function OrganizationRoute({ permission }: { permission: OrganizationPermission }) {
  const organization = useOptionalOrganization()
  if (!organization) return <Navigate to="/login" replace />
  if (!organization.current) return <section><h2 className="text-xl font-semibold">No active organizations</h2><p>Your organization may be pending review or access may be restricted. Contact your organization or platform administrator.</p><RestrictedOrganizations /></section>
  if (organization.forbidden) return <section><h2>Access denied</h2><p>Organization access restricted</p><p>Access to this organization has changed. Select another active organization above or contact an administrator.</p><RestrictedOrganizations /></section>
  if (!organization.can(permission)) return <Navigate to="/forbidden" replace />
  return <Outlet />
}

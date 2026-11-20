import { Navigate, Outlet } from 'react-router'
import { useOptionalOrganization } from '@/features/organization/context'
import type { OrganizationPermission } from '@/features/organization/permissions'

export function OrganizationRoute({ permission }: { permission: OrganizationPermission }) {
  const organization = useOptionalOrganization()
  if (!organization) return <Navigate to="/login" replace />
  if (!organization.current) return <section><h2 className="text-xl font-semibold">No active organizations</h2><p>Contact an administrator to request an active membership.</p></section>
  if (organization.forbidden) return <Navigate to="/forbidden" replace />
  if (!organization.can(permission)) return <Navigate to="/forbidden" replace />
  return <Outlet />
}

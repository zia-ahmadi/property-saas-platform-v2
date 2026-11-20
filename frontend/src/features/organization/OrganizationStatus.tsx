import { useQuery } from '@tanstack/react-query'
import type { OrganizationContextValue } from './context'

interface OrganizationResponse { id: string; name: string; slug: string; status: string }
export function OrganizationStatus({ organization }: { organization: OrganizationContextValue }) {
  const details = useQuery({
    queryKey: organization.queryKey(['details']),
    queryFn: ({ signal }) => organization.request<OrganizationResponse>('get', '', undefined, { signal }),
    retry: false,
  })
  if (details.isError) return <span className="text-xs text-muted-foreground">Organization details unavailable</span>
  if (!details.data) return null
  return <span className="text-xs text-muted-foreground">{details.data.status}</span>
}

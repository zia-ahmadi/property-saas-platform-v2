import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/features/auth/context'
type Restricted = { id: string; name: string; status: 'pending' | 'rejected' | 'suspended' | 'banned'; role: string }
const descriptions = { pending: 'Pending review', rejected: 'Registration rejected', suspended: 'Access suspended', banned: 'Access banned' }
export function RestrictedOrganizations() {
  const { service, state } = useAuth(); const session = state.status === 'authenticated' ? state.session : undefined; const [items, setItems] = useState<Restricted[]>([]); const [error, setError] = useState(false)
  useEffect(() => { let active = true; void service.request<Restricted[]>('get', 'api/v1/my-organizations/status').then(value => { if (active) setItems(value) }).catch(() => { if (active) setError(true) }); return () => { active = false } }, [service, session])
  return <div className="space-y-2">{items.map(item => <p key={item.id}>{item.name}: {descriptions[item.status] ?? 'Access restricted'} {item.role.toLowerCase() === 'owner' && <Link className="underline" to={`/organization-messages/${item.id}`}>Messages with platform</Link>}</p>)}{error && <p>Organization status could not be loaded.</p>}<button className="rounded border p-2" onClick={() => void service.refresh()}>Refresh access</button></div>
}

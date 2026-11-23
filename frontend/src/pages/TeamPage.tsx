import { useEffect, useState } from 'react'
import { useOrganization } from '@/features/organization/context'

type Member = { id: string; email: string; role: string; status: string }
type Invitation = { id: string; email: string; role: string; expires_at: string }
type Team = { members: Member[]; invitations: Invitation[] }
const roles = ['ADMIN', 'MANAGER', 'STAFF']
export function TeamPage() {
  const org = useOrganization()
  return <TeamContent key={org.current?.organizationId} />
}
function TeamContent() {
  const org = useOrganization()
  const [team, setTeam] = useState<Team>()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('STAFF')
  const [inviting, setInviting] = useState(false)
  const [link, setLink] = useState('')
  const [error, setError] = useState('')
  const load = () => org.request<Team>('get', 'team').then(setTeam).catch(() => setError('Unable to load the team.'))
  useEffect(() => { void load() }, [org.current?.organizationId]) // eslint-disable-line react-hooks/exhaustive-deps
  const action = async (fn: () => Promise<unknown>) => { setError(''); try { await fn(); await load() } catch { setError('The request failed. Check your access and try again.') } }
  return <section className="space-y-6"><h2 className="text-2xl font-bold">Team</h2><button className="rounded border p-2" onClick={() => void load()}>Refresh team</button>{error && <p role="alert">{error}</p>}
    <form className="space-y-2" onSubmit={e => { e.preventDefault(); if (inviting) return; setInviting(true); setLink(''); void action(async () => { const result = await org.request<{token: string}>('post', 'invitations', { email, role }); setLink(`${window.location.origin}/invite#${encodeURIComponent(result.token)}`); setEmail('') }).finally(() => setInviting(false)) }}>
      <h3 className="font-semibold">Invite a member</h3><label>Email <input className="rounded border p-2" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>{' '}
      <label>Role <select aria-label="Invitation role" className="rounded border p-2" value={role} onChange={e => setRole(e.target.value)}>{roles.map(r => <option key={r}>{r}</option>)}</select></label>{' '}<button disabled={inviting} className="rounded border p-2">Create invitation</button>
    </form>
    {link && <div role="status" className="space-y-2"><p>Email delivery is not configured. Copy this link now and share it privately; it expires in seven days.</p><input aria-label="Invitation link" readOnly className="w-full rounded border p-2" value={link} /><button className="rounded border p-2" onClick={() => void navigator.clipboard.writeText(link).catch(() => setError('Copy failed. Select the link and copy it manually.'))}>Copy link</button></div>}
    <h3 className="font-semibold">Members</h3>{team?.members.map(m => <div key={m.id} className="flex flex-wrap items-center gap-3 border-b py-2"><span>{m.email} · {m.status}</span>{m.role.toLowerCase() === 'owner' || m.status !== 'active' ? <span>{m.role}</span> : <><label>Role for {m.email} <select aria-label={`Role for ${m.email}`} value={m.role.toUpperCase()} onChange={e => void action(() => org.request('patch', `members/${m.id}`, {role: e.target.value}))}>{roles.map(r => <option key={r}>{r}</option>)}</select></label><button className="rounded border p-2" onClick={() => { if (window.confirm(`Revoke access for ${m.email}?`)) void action(() => org.request('delete', `members/${m.id}`)) }}>Revoke access</button></>}</div>)}
    <h3 className="font-semibold">Pending invitations</h3>{team?.invitations.map(i => <div key={i.id} className="flex flex-wrap items-center gap-3 border-b py-2"><span>{i.email} · {i.role} · expires {new Date(i.expires_at).toLocaleString()}</span><button className="rounded border p-2" onClick={() => void action(() => org.request('delete', `invitations/${i.id}`))}>Cancel invitation</button></div>)}
  </section>
}

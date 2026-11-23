import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { useAuth } from '@/features/auth/context'
import { useOrganization } from '@/features/organization/context'
type Message = { id: string; body: string; created_at: string; direction: string; read_at: string | null; platform_read_at: string | null }
export function InboxPage() {
  const org = useOrganization(); const { organizationId } = useParams()
  const id = organizationId ?? org.current?.organizationId
  return id ? <InboxContent key={id} id={id} /> : <p>Select an organization to view messages.</p>
}
function InboxContent({id}: {id: string}) {
  const {service} = useAuth(); const [messages, setMessages] = useState<Message[]>([]); const [error, setError] = useState(''); const [body, setBody] = useState('')
  const path = `api/v1/my-organizations/${id}/messages`
  const load = () => service.request<Message[]>('get', path).then(setMessages).catch(() => setError('Unable to load messages.'))
  useEffect(() => { void load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  return <section className="space-y-4"><h2 className="text-2xl font-bold">Inbox</h2><p>Messages with the platform team remain available if your organization is restricted.</p>{error && <p role="alert">{error}</p>}{messages.length === 0 && <p>No messages.</p>}{messages.map(m => <article key={m.id} className="space-y-2 rounded border p-4"><p>{m.direction === 'platform_to_organization' ? `Platform · ${m.read_at ? 'Read' : 'Unread'}` : `Your organization · ${m.platform_read_at ? 'Read by platform' : 'Unread by platform'}`} · {new Date(m.created_at).toLocaleString()}</p><p className="whitespace-pre-wrap">{m.body}</p>{m.direction === 'platform_to_organization' && !m.read_at && <button className="rounded border p-2" onClick={() => void service.request('post', `${path}/${m.id}/read`).then(load).catch(() => setError('Unable to mark the message read.'))}>Mark read</button>}</article>)}<form onSubmit={e => { e.preventDefault(); void service.request('post', path, {body}).then(() => { setBody(''); return load() }).catch(() => setError('Unable to send message.')) }}><label>Message to platform <textarea className="block w-full rounded border p-2" value={body} onChange={e => setBody(e.target.value)} required maxLength={5000} /></label><button className="rounded border p-2">Send message</button></form></section>
}

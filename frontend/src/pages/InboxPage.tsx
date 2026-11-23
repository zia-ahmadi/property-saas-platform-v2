import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { useAuth } from '@/features/auth/context'
import { useOrganization } from '@/features/organization/context'
import { ApiError } from '@/lib/api/errors'

type Message = {
  id: string
  body: string
  created_at: string
  direction: string
  read_at: string | null
  platform_read_at: string | null
}

function messageError(error: unknown, action: string) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session expired. Sign in again to continue.'
    if (error.status === 403) return 'You do not have permission to access this organization inbox.'
    if (error.isNetworkError) return 'Could not reach the backend. Check the API connection and try again.'
    if (error.isTimeoutError) return 'The backend did not respond in time. Try again.'
    return `Unable to ${action} (HTTP ${error.status}).`
  }
  return `Unable to ${action}. Check your connection and try again.`
}

export function InboxPage() {
  const org = useOrganization()
  const { organizationId } = useParams()
  const id = organizationId ?? org.current?.organizationId
  return id ? <InboxContent key={id} id={id} /> : <p>Select an organization to view messages.</p>
}

function InboxContent({ id }: { id: string }) {
  const { service } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [error, setError] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const requestSequence = useRef(0)
  const path = `api/v1/my-organizations/${id}/messages`

  const load = useCallback(async () => {
    const current = ++requestSequence.current
    try {
      const result = await service.request<Message[]>('get', path)
      if (current === requestSequence.current) {
        setMessages(result)
        setError('')
      }
    } catch (requestError) {
      if (current === requestSequence.current) setError(messageError(requestError, 'load messages'))
    }
  }, [path, service])

  useEffect(() => {
    let active = true
    let timer: number
    const poll = async () => {
      if (!active) return
      if (document.visibilityState === 'visible') await load()
      if (active) timer = window.setTimeout(() => void poll(), 3_000)
    }
    void poll()
    return () => {
      active = false
      window.clearTimeout(timer)
      requestSequence.current += 1
    }
  }, [load])

  const markRead = async (messageId: string) => {
    try {
      await service.request('post', `${path}/${messageId}/read`)
      await load()
    } catch (requestError) {
      setError(messageError(requestError, 'mark the message read'))
    }
  }

  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!body.trim() || sending) return
    setSending(true)
    try {
      await service.request('post', path, { body: body.trim() })
      setBody('')
      setError('')
      await load()
    } catch (requestError) {
      setError(messageError(requestError, 'send the message'))
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">Inbox</h2>
      <p>Messages with the platform team remain available if your organization is restricted. New messages refresh automatically while this page is open.</p>
      {error && <p role="alert">{error}</p>}
      {messages.length === 0 && !error && <p>No messages yet.</p>}
      <div aria-live="polite" className="space-y-3">
        {messages.map(item => (
          <article key={item.id} className="space-y-2 rounded border p-4">
            <p>{item.direction === 'platform_to_organization' ? `Platform · ${item.read_at ? 'Read' : 'Unread'}` : `Your organization · ${item.platform_read_at ? 'Read by platform' : 'Unread by platform'}`} · {new Date(item.created_at).toLocaleString()}</p>
            <p className="whitespace-pre-wrap">{item.body}</p>
            {item.direction === 'platform_to_organization' && !item.read_at && <button className="rounded border p-2" onClick={() => void markRead(item.id)}>Mark read</button>}
          </article>
        ))}
      </div>
      <form onSubmit={event => void send(event)}>
        <label>Message to platform <textarea className="block w-full rounded border p-2" value={body} onChange={event => setBody(event.target.value)} required maxLength={5000} /></label>
        <button className="rounded border p-2" disabled={sending || !body.trim()}>{sending ? 'Sending…' : 'Send message'}</button>
      </form>
    </section>
  )
}

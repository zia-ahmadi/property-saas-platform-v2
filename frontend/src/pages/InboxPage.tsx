import { PageHeader } from '@/components/ui/page-header'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { MessageCircle, RefreshCw, Send, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/features/auth/context'
import { useOrganization } from '@/features/organization/context'
import { organizationStatusPath, type RestrictedOrganization } from '@/features/organization/RestrictedOrganizations'
import { ApiError } from '@/lib/api/errors'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Textarea } from '@/components/ui/textarea'

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
  const { state } = useAuth()
  const { organizationId } = useParams()
  const id = organizationId ?? org.current?.organizationId
  const knownOrganization = org.organizations.find(item => item.organizationId === id) ?? org.current
  const name = knownOrganization?.organizationId === id ? knownOrganization?.organizationName : undefined
  const userId = state.status === 'authenticated' ? state.session.user.id : undefined
  return id ? <InboxContent key={`${userId}:${id}`} id={id} name={name} /> : <p>Select an organization to view messages.</p>
}

function InboxContent({ id, name }: { id: string; name?: string }) {
  const { service } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [restrictedName, setRestrictedName] = useState<string>()
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [canSend, setCanSend] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const requestSequence = useRef(0)
  const transcript = useRef<HTMLDivElement>(null)
  const followLatest = useRef(true)
  const composer = useRef<HTMLTextAreaElement>(null)
  const focusComposer = useRef(false)
  const path = `api/v1/my-organizations/${id}/messages`

  useEffect(() => {
    if (name) return
    let active = true
    void service.request<RestrictedOrganization[]>('get', organizationStatusPath)
      .then(items => { if (active) setRestrictedName(items.find(item => item.id === id)?.name) })
      .catch(() => { /* The conversation can load independently of the review status. */ })
    return () => { active = false }
  }, [id, name, service])

  const lastMessage = messages.at(-1)?.id
  useEffect(() => {
    const scrollArea = transcript.current
    if (scrollArea && followLatest.current) scrollArea.scrollTop = scrollArea.scrollHeight
  }, [lastMessage])

  useEffect(() => {
    if (!sending && focusComposer.current) {
      focusComposer.current = false
      composer.current?.focus()
    }
  }, [sending])

  const load = useCallback(async () => {
    const current = ++requestSequence.current
    try {
      const result = await service.request<Message[]>('get', path)
      if (current === requestSequence.current) {
        setMessages(result)
        setCanSend(true)
        setError('')
      }
    } catch (requestError) {
      if (current === requestSequence.current) {
        if (requestError instanceof ApiError && (requestError.status === 403 || requestError.status === 401)) {
          setMessages([])
          setCanSend(false)
        }
        setError(messageError(requestError, 'load messages'))
      }
    } finally {
      if (current === requestSequence.current) setLoaded(true)
    }
  }, [path, service])

  useEffect(() => {
    let active = true
    let initialLoad = true
    let timer: number
    const poll = async () => {
      if (!active) return
      if (initialLoad || document.visibilityState === 'visible') {
        initialLoad = false
        await load()
      }
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
    setActionError('')
    try {
      await service.request('post', `${path}/${messageId}/read`)
      await load()
    } catch (requestError) {
      setActionError(messageError(requestError, 'mark the message read'))
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!body.trim() || sending || !canSend) return
    setSending(true)
    setActionError('')
    try {
      await service.request('post', path, { body: body.trim() })
      setBody('')
      followLatest.current = true
      await load()
    } catch (requestError) {
      setActionError(messageError(requestError, 'send the message'))
    } finally {
      focusComposer.current = true
      setSending(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-6">
      <PageHeader headingLevel={2} title="Platform support" description={name ?? restrictedName ?? 'Private organization conversation'}
        actions={<Link to="/access" className={buttonVariants({ variant: 'outline', className: 'h-10' })}>Organization access</Link>} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="min-w-0 gap-0 overflow-hidden rounded-2xl p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/5 text-primary">
                <MessageCircle aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold">Conversation</h3>
                <p className="text-xs text-muted-foreground">Replies appear while this page is open.</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={refreshing}
              onClick={() => void refresh()}
            >
              <RefreshCw aria-hidden="true" className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>

          {error && (
            <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-3 sm:mx-6">
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
              <Button variant="outline" size="sm" disabled={refreshing} onClick={() => void refresh()}>
                Try again
              </Button>
            </div>
          )}

          <div
            ref={transcript}
            role="log"
            aria-label="Organization support conversation"
            tabIndex={0}
            onScroll={event => {
              const area = event.currentTarget
              followLatest.current = area.scrollHeight - area.scrollTop - area.clientHeight < 64
            }}
            className="min-h-64 max-h-[min(55dvh,36rem)] space-y-4 overflow-y-auto bg-muted/20 p-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:p-6"
          >
            {!loaded && !error && (
              <p role="status" className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                Loading your conversation…
              </p>
            )}
            {loaded && messages.length === 0 && !error && (
              <EmptyState
                icon={<MessageCircle className="size-5" />}
                title="No messages yet."
                description="Send a note to the platform team and the conversation will appear here."
              />
            )}
            {messages.map((item) => {
              const incoming = item.direction === 'platform_to_organization'
              const status = incoming
                ? item.read_at
                  ? 'Read'
                  : 'Unread'
                : item.platform_read_at
                  ? 'Read by platform'
                  : 'Awaiting platform'
              const createdAt = new Date(item.created_at)
              return (
                <article
                  key={item.id}
                  className={`flex ${incoming ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`w-full max-w-[90%] space-y-2 rounded-2xl border p-4 shadow-sm sm:max-w-[78%] ${
                      incoming
                        ? 'rounded-tl-md bg-card'
                        : 'rounded-tr-md border-primary/15 bg-primary/[0.06]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <p className="text-xs font-semibold text-foreground">
                        {incoming ? 'Platform team' : 'Your organization'}
                      </p>
                      <time
                        className="text-xs text-muted-foreground"
                        dateTime={
                          Number.isNaN(createdAt.getTime()) ? undefined : createdAt.toISOString()
                        }
                      >
                        {Number.isNaN(createdAt.getTime())
                          ? 'Date unavailable'
                          : createdAt.toLocaleString()}
                      </time>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6">{item.body}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-2">
                      <span className="text-xs text-muted-foreground">{status}</span>
                      {incoming && !item.read_at && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void markRead(item.id)}
                        >
                          Mark as read
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          {actionError && <p role="alert" className="border-t px-4 py-3 text-sm text-destructive sm:px-6">{actionError}</p>}

          <form onSubmit={(event) => void send(event)} className="space-y-3 border-t p-4 sm:p-6">
            <label htmlFor="support-message" className="text-sm font-semibold">
              Message the platform team
            </label>
            <Textarea
              ref={composer}
              id="support-message"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Describe how we can help…"
              rows={4}
              maxLength={5000}
              required
              aria-describedby="support-message-hint support-message-count"
              disabled={sending || !canSend}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p id="support-message-hint" className="text-xs text-muted-foreground">
                Keep messages clear and avoid sharing passwords or payment details.
              </p>
              <span id="support-message-count" className="text-xs tabular-nums text-muted-foreground">
                {body.length}/5000
              </span>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={sending || !canSend || !body.trim()}>
                <Send aria-hidden="true" className="size-4" />
                {sending ? 'Sending…' : 'Send message'}
              </Button>
            </div>
          </form>
        </Card>

        <aside className="space-y-4">
          <Card className="rounded-2xl p-5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </span>
            <h3 className="font-semibold">Who can see this conversation?</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Organization owners and the platform team can see these messages.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  )
}

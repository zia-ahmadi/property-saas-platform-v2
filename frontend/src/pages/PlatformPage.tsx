import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MessageCircle,
  RefreshCw,
  Search,
  UsersRound,
} from 'lucide-react'
import { useAuth } from '@/features/auth/context'
import { ApiError } from '@/lib/api/errors'

type OrganizationStatus = 'pending' | 'active' | 'rejected' | 'suspended' | 'banned'
type Organization = {
  id: string
  name: string
  slug: string
  status: OrganizationStatus
  created_at: string
  updated_at: string
  owner_first_name: string | null
  owner_last_name: string | null
  owner_email: string | null
  member_count: number
  property_count: number
  unread_message_count: number
}
type Message = {
  id: string
  body: string
  direction: 'organization_to_platform' | 'platform_to_organization'
  created_at: string
  platform_read_at: string | null
  read_at: string | null
}
type AuditEntry = {
  id: string
  previous_status: string
  new_status: string
  reason: string | null
  created_at: string
}
type Page = { content: Organization[]; total: number; page: number; size: number }
type Summary = {
  total_organizations: number
  active_organizations: number
  pending_organizations: number
  restricted_organizations: number
  unread_messages: number
}

const statuses: Array<{ value: '' | OrganizationStatus; label: string }> = [
  { value: '', label: 'All organizations' },
  { value: 'pending', label: 'Pending review' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'banned', label: 'Banned' },
]
const choices: Record<OrganizationStatus, string[]> = {
  pending: ['approve', 'reject', 'ban'],
  active: ['suspend', 'ban'],
  suspended: ['reinstate', 'ban'],
  rejected: [],
  banned: [],
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function requestFailure(error: unknown, resource: string) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session is no longer valid. Sign in again and retry.'
    if (error.status === 403) return 'This account does not have platform-owner access.'
    if (error.status === 404) return `The backend does not provide ${resource} yet. Restart or update the backend, then retry.`
    if (error.isNetworkError) return 'The frontend could not reach the backend. Check that the API is running and the configured API URL is correct.'
    if (error.status >= 500) return `The backend failed while loading ${resource} (HTTP ${error.status}). Check the backend logs.`
    return `Unable to load ${resource} (HTTP ${error.status}).`
  }
  return `Unable to load ${resource}. Sign in again if your session has expired.`
}

function statusStyle(status: OrganizationStatus) {
  return ({
    pending: 'bg-amber-50 text-amber-800 ring-amber-200',
    active: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    suspended: 'bg-orange-50 text-orange-800 ring-orange-200',
    rejected: 'bg-slate-100 text-slate-700 ring-slate-200',
    banned: 'bg-rose-50 text-rose-800 ring-rose-200',
  }[status] ?? 'bg-slate-100 text-slate-700 ring-slate-200')
}

export function PlatformPage() {
  const { service } = useAuth()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'' | OrganizationStatus>('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(0)
  const [summary, setSummary] = useState<Summary>()
  const [data, setData] = useState<Page>()
  const [selected, setSelected] = useState<Organization>()
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesError, setMessagesError] = useState('')
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [auditError, setAuditError] = useState('')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const sequence = useRef(0)
  const selectionSequence = useRef(0)

  const load = useCallback(async (showLoading = true) => {
    const current = ++sequence.current
    if (showLoading) setLoading(true)
    const [directoryResult, summaryResult] = await Promise.allSettled([
      service.request<Page>('get', 'api/v1/platform/organizations', undefined, { params: { search, status, unreadOnly, page } }),
      service.request<Summary>('get', 'api/v1/platform/summary'),
    ])
    if (current === sequence.current) {
      const failures: string[] = []
      if (directoryResult.status === 'fulfilled') setData(directoryResult.value)
      else {
        setData(undefined)
        failures.push(requestFailure(directoryResult.reason, 'the organization directory'))
      }
      if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value)
      else {
        setSummary(undefined)
        failures.push(requestFailure(summaryResult.reason, 'platform summary'))
      }
      setNotice(failures.join(' '))
      setLoading(false)
    }
  }, [service, search, status, unreadOnly, page])

  useEffect(() => { void Promise.resolve().then(() => load()) }, [load])

  useEffect(() => {
    let active = true
    let timer: number
    const poll = async () => {
      if (!active) return
      if (document.visibilityState === 'visible') await load(false)
      if (active) timer = window.setTimeout(() => void poll(), 15_000)
    }
    timer = window.setTimeout(() => void poll(), 15_000)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [load])

  const select = async (id: string) => {
    const current = ++selectionSequence.current
    setSelected(undefined)
    setMessages([])
    setMessagesError('')
    setAudit([])
    setAuditError('')
    setReason('')
    setMessage('')
    const [detailsResult, messagesResult, auditResult] = await Promise.allSettled([
      service.request<Organization>('get', `api/v1/platform/organizations/${id}`),
      service.request<Message[]>('get', `api/v1/platform/organizations/${id}/messages`),
      service.request<AuditEntry[]>('get', `api/v1/platform/organizations/${id}/audit`),
    ])
    if (current !== selectionSequence.current) return
    if (detailsResult.status === 'rejected') {
      setNotice(requestFailure(detailsResult.reason, 'organization details'))
      return
    }
    setSelected(detailsResult.value)
    if (messagesResult.status === 'fulfilled') setMessages(messagesResult.value)
    else setMessagesError(requestFailure(messagesResult.reason, 'the support conversation'))
    if (auditResult.status === 'fulfilled') setAudit(auditResult.value)
    else setAuditError(requestFailure(auditResult.reason, 'status history'))
    setNotice('')
  }

  const refreshMessages = useCallback(async (organizationId: string, selection = selectionSequence.current) => {
    try {
      const thread = await service.request<Message[]>('get', `api/v1/platform/organizations/${organizationId}/messages`)
      if (selection === selectionSequence.current) {
        setMessages(thread)
        setMessagesError('')
      }
    } catch (error) {
      if (selection === selectionSequence.current) setMessagesError(requestFailure(error, 'the support conversation'))
    }
  }, [service])

  const selectedId = selected?.id
  useEffect(() => {
    if (!selectedId) return
    const selection = selectionSequence.current
    let active = true
    let timer: number
    const poll = async () => {
      if (!active) return
      if (document.visibilityState === 'visible') await refreshMessages(selectedId, selection)
      if (active) timer = window.setTimeout(() => void poll(), 3_000)
    }
    timer = window.setTimeout(() => void poll(), 3_000)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [selectedId, refreshMessages])

  const decide = async (action: string) => {
    if (!selected) return
    if (['reject', 'suspend', 'ban'].includes(action) && !reason.trim()) {
      setNotice('Enter a reason for this decision.')
      return
    }
    if (['suspend', 'ban'].includes(action) && !window.confirm(`${action} ${selected.name}?`)) return
    const organizationId = selected.id
    const selection = selectionSequence.current
    try {
      await service.request('post', `api/v1/platform/organizations/${organizationId}/decisions`, { action, reason })
      await load()
      if (selection !== selectionSequence.current) return
      await select(organizationId)
      setNotice('Organization status updated.')
    } catch (error) {
      setNotice(requestFailure(error, 'the organization status'))
    }
  }

  const markRead = async (item: Message) => {
    if (!selected) return
    const organizationId = selected.id
    const selection = selectionSequence.current
    try {
      await service.request('post', `api/v1/platform/organizations/${organizationId}/messages/${item.id}/read`)
      if (selection !== selectionSequence.current) return
      await Promise.all([refreshMessages(organizationId, selection), load()])
    } catch {
      if (selection === selectionSequence.current) setNotice('Unable to mark this message as read. Refresh the conversation and retry.')
    }
  }

  const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected || !message.trim()) return
    const organizationId = selected.id
    const selection = selectionSequence.current
    setSending(true)
    try {
      await service.request('post', `api/v1/platform/organizations/${organizationId}/messages`, { body: message.trim() })
      if (selection !== selectionSequence.current) return
      setMessage('')
      setNotice('Your message was sent.')
      await Promise.all([refreshMessages(organizationId, selection), load()])
    } catch (error) {
      if (selection === selectionSequence.current) setNotice(requestFailure(error, 'your message'))
    } finally {
      setSending(false)
    }
  }

  const selectedActions = selected ? choices[selected.status] ?? [] : []

  return (
    <section className="mx-auto max-w-[1500px] space-y-7 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-semibold uppercase tracking-[0.16em] text-primary">Platform workspace</p>
          <h2 className="text-3xl font-semibold tracking-tight">Organizations</h2>
          <p className="mt-1 text-sm text-muted-foreground">Review organizations, understand their activity, and stay close to their support requests.</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium shadow-sm transition hover:bg-muted">
          <RefreshCw aria-hidden="true" className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      {notice && <p role="status" className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">{notice}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Building2} label="Total organizations" value={summary?.total_organizations} detail="Across the platform" />
        <SummaryCard icon={Check} label="Active organizations" value={summary?.active_organizations} detail="Currently in good standing" tone="green" />
        <SummaryCard icon={Clock3} label="Pending review" value={summary?.pending_organizations} detail="Awaiting your decision" tone="amber" />
        <SummaryCard icon={MessageCircle} label="Unread support" value={summary?.unread_messages} detail="Organization messages to review" tone="blue" />
      </div>

      <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,0.9fr)]">
        <section className="min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div>
              <h3 className="font-semibold">Organization directory</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">{data ? `${data.total} organizations` : 'Search and review customer workspaces'}</p>
            </div>
            <label className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input aria-label="Search" value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} placeholder="Search name or workspace..." className="min-h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" />
            </label>
          </div>

          <div className="flex gap-1 overflow-x-auto border-b px-4 py-2">
            {statuses.map(option => (
              <button key={option.value || 'all'} type="button" onClick={() => { setStatus(option.value); setPage(0) }} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${status === option.value ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                {option.label}
              </button>
            ))}
            <button type="button" aria-pressed={unreadOnly} onClick={() => { setUnreadOnly(value => !value); setPage(0) }} className={`ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${unreadOnly ? 'bg-blue-100 font-semibold text-blue-800' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <MessageCircle aria-hidden="true" className="size-4" />Unread support{summary?.unread_messages ? ` · ${summary.unread_messages}` : ''}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[790px] border-collapse text-left text-sm">
              <thead className="bg-muted/45 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Organization</th>
                  <th scope="col" className="px-4 py-3 font-medium">Owner</th>
                  <th scope="col" className="px-4 py-3 font-medium">Portfolio</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Support</th>
                  <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Open details</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.content.map(organization => {
                  const owner = [organization.owner_first_name, organization.owner_last_name].filter(Boolean).join(' ')
                  return (
                    <tr key={organization.id} className={`cursor-pointer transition hover:bg-muted/40 ${selected?.id === organization.id ? 'bg-primary/5' : ''}`} onClick={() => void select(organization.id)}>
                      <td className="px-5 py-4">
                        <button type="button" aria-label={organization.name} onClick={event => { event.stopPropagation(); void select(organization.id) }} className="flex items-center gap-3 text-left">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 aria-hidden="true" className="size-4" /></span>
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">{organization.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{organization.slug}</span>
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <span className="block font-medium">{owner || 'Owner not assigned'}</span>
                        <span className="block max-w-[190px] truncate text-xs text-muted-foreground">{organization.owner_email || '—'}</span>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        <span className="block text-foreground">{organization.property_count} properties</span>
                        <span className="text-xs">{organization.member_count} members</span>
                      </td>
                      <td className="px-4 py-4"><StatusPill status={organization.status} /></td>
                      <td className="px-4 py-4">
                        {organization.unread_message_count > 0
                          ? <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800"><MessageCircle aria-hidden="true" className="size-3.5" />{organization.unread_message_count} new</span>
                          : <span className="text-xs text-muted-foreground">All caught up</span>}
                      </td>
                      <td className="px-4 py-4 text-right"><span className="text-xs font-semibold text-primary">Manage <ArrowUpRight aria-hidden="true" className="ml-1 inline size-3.5" /></span></td>
                    </tr>
                  )
                })}
                {data && data.content.length === 0 && <tr><td colSpan={6} className="px-5 py-14 text-center"><Building2 aria-hidden="true" className="mx-auto mb-3 size-8 text-muted-foreground/50" /><p className="font-medium">No organizations found</p><p className="mt-1 text-sm text-muted-foreground">Try a different search or status filter.</p></td></tr>}
                {!data && <tr><td colSpan={6} className="px-5 py-14 text-center text-sm text-muted-foreground">{loading ? 'Loading organizations…' : 'Organization directory is unavailable.'}</td></tr>}
              </tbody>
            </table>
          </div>

          {data && <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-xs text-muted-foreground">
            <span>Showing {data.total === 0 ? 0 : page * data.size + 1}–{Math.min((page + 1) * data.size, data.total)} of {data.total}</span>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(current => current - 1)} className="flex size-8 items-center justify-center rounded-lg border disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft aria-hidden="true" className="size-4" /></button>
              <span>Page {page + 1}</span>
              <button type="button" aria-label="Next page" disabled={(page + 1) * data.size >= data.total} onClick={() => setPage(current => current + 1)} className="flex size-8 items-center justify-center rounded-lg border disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight aria-hidden="true" className="size-4" /></button>
            </div>
          </footer>}
        </section>

        <aside aria-label="Organization details and support" className="min-w-0">
          {selected ? (
            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="border-b bg-gradient-to-br from-primary/10 via-card to-card px-5 pb-5 pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Building2 aria-hidden="true" className="size-5" /></span>
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold">{selected.name}</h3>
                      <p className="truncate text-sm text-muted-foreground">{selected.slug}</p>
                    </div>
                  </div>
                  <StatusPill status={selected.status} />
                </div>
                <p className="mt-4 text-xs text-muted-foreground">Workspace created {formatDate(selected.created_at)}</p>
              </div>

              <div className="grid grid-cols-2 divide-x border-b">
                <DetailMetric icon={Building2} label="Properties" value={selected.property_count} />
                <DetailMetric icon={UsersRound} label="Active members" value={selected.member_count} />
              </div>

              <div className="space-y-5 p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Organization owner</p>
                  <p className="mt-2 font-medium">{[selected.owner_first_name, selected.owner_last_name].filter(Boolean).join(' ') || 'No active owner assigned'}</p>
                  {selected.owner_email && <p className="mt-0.5 break-all text-sm text-muted-foreground">{selected.owner_email}</p>}
                </div>

                <div className="border-t pt-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-semibold">Organization support</h4>
                      <p className="text-xs text-muted-foreground">Private conversation · live updates every 3 seconds</p>
                    </div>
                    <button type="button" aria-label="Refresh messages" onClick={() => void refreshMessages(selected.id)} className="flex size-9 items-center justify-center rounded-lg border text-muted-foreground hover:bg-muted"><RefreshCw aria-hidden="true" className="size-4" /></button>
                  </div>
                  <div aria-live="polite" className="max-h-[320px] space-y-3 overflow-y-auto rounded-xl bg-muted/40 p-3">
                    {messagesError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{messagesError}</p>}
                    {messages.length === 0 && !messagesError && <p className="py-5 text-center text-sm text-muted-foreground">No support messages yet. Send a note to start the conversation.</p>}
                    {messages.map(item => {
                      const incoming = item.direction === 'organization_to_platform'
                      return <article key={item.id} className={`max-w-[92%] rounded-xl border p-3 text-sm ${incoming ? 'mr-auto bg-card' : 'ml-auto border-primary/20 bg-primary/5'}`}>
                        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground">{incoming ? 'Organization' : 'Platform team'}</span>
                          <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
                        </div>
                        <p className="whitespace-pre-wrap break-words">{item.body}</p>
                        {incoming && <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                          <span className={item.platform_read_at ? 'text-muted-foreground' : 'font-medium text-blue-700'}>{item.platform_read_at ? 'Read by platform' : 'Unread'}</span>
                          {!item.platform_read_at && <button type="button" onClick={() => void markRead(item)} className="font-semibold text-primary hover:underline">Mark read</button>}
                        </div>}
                        {!incoming && <p className="mt-2 text-right text-xs text-muted-foreground">{item.read_at ? 'Read by organization' : 'Sent'}</p>}
                      </article>
                    })}
                  </div>
                  <form onSubmit={event => void sendMessage(event)} className="mt-3 space-y-2">
                    <label htmlFor="platform-message" className="sr-only">Private message</label>
                    <textarea id="platform-message" aria-label="Private message" required maxLength={5000} rows={3} value={message} onChange={event => setMessage(event.target.value)} placeholder="Write a helpful message…" className="w-full resize-y rounded-xl border bg-background p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">{message.length}/5000</span>
                      <button type="submit" disabled={sending || !message.trim()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                        <ArrowUpRight aria-hidden="true" className="size-4" />{sending ? 'Sending…' : 'Send message'}
                      </button>
                    </div>
                  </form>
                </div>

                {(selectedActions.length > 0 || audit.length > 0 || auditError) && <div className="space-y-3 border-t pt-4">
                  {selectedActions.length > 0 && <>
                    <div>
                      <h4 className="font-semibold">Workspace status</h4>
                      <p className="text-xs text-muted-foreground">Status changes are recorded for review.</p>
                    </div>
                    <label className="block text-sm font-medium">Reason for reject, suspend, or ban
                      <textarea aria-label="Reason for adverse decisions" maxLength={2000} rows={2} value={reason} onChange={event => setReason(event.target.value)} placeholder="Add context for the organization status change…" className="mt-1.5 w-full rounded-lg border bg-background p-2.5 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {selectedActions.map(action => <button key={action} type="button" onClick={() => void decide(action)} className={`rounded-lg border px-3 py-2 text-sm font-semibold capitalize transition hover:bg-muted ${['reject', 'suspend', 'ban'].includes(action) ? 'border-rose-200 text-rose-700 hover:bg-rose-50' : 'text-foreground'}`}>{action}</button>)}
                    </div>
                  </>}
                  {audit.length > 0 && <div className="space-y-2 border-t pt-3">
                    <h4 className="text-sm font-semibold">Status history</h4>
                    {audit.map(entry => <div key={entry.id} className="rounded-lg bg-muted/45 px-3 py-2 text-xs">
                      <p className="font-medium capitalize">{entry.previous_status} <ArrowUpRight aria-hidden="true" className="inline size-3" /> {entry.new_status}</p>
                      <p className="mt-0.5 text-muted-foreground">{formatDate(entry.created_at)}{entry.reason ? ` · ${entry.reason}` : ''}</p>
                    </div>)}
                  </div>}
                  {auditError && <p role="alert" className="text-sm text-muted-foreground">{auditError}</p>}
                </div>}
              </div>
            </div>
          ) : (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed bg-card/60 px-8 py-12 text-center">
              <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ArrowDownLeft aria-hidden="true" className="size-6" /></span>
              <h3 className="font-semibold">Organization workspace</h3>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">Select an organization to review its owner, portfolio, status history, and private support conversation.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}

function SummaryCard({ icon: Icon, label, value, detail, tone = 'default' }: {
  icon: typeof Building2
  label: string
  value: number | undefined
  detail: string
  tone?: 'default' | 'green' | 'amber' | 'blue'
}) {
  const color = { default: 'bg-primary/10 text-primary', green: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', blue: 'bg-blue-50 text-blue-700' }[tone]
  return <article className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight">{value === undefined ? '—' : value.toLocaleString()}</p>
      </div>
      <span className={`flex size-10 items-center justify-center rounded-xl ${color}`}><Icon aria-hidden="true" className="size-5" /></span>
    </div>
    <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
  </article>
}

function DetailMetric({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: number }) {
  return <div className="flex items-center gap-3 px-5 py-4">
    <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon aria-hidden="true" className="size-4" /></span>
    <div><p className="text-lg font-semibold">{value.toLocaleString()}</p><p className="text-xs text-muted-foreground">{label}</p></div>
  </div>
}

function StatusPill({ status }: { status: OrganizationStatus }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${statusStyle(status)}`}>{status}</span>
}

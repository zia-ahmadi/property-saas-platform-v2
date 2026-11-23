import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useOrganization } from '@/features/organization/context'
import { ApiError } from '@/lib/api/errors'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { Link } from 'react-router'
import { ArrowRight, Copy, MailPlus, RefreshCw, Shield, Users, UserRound } from 'lucide-react'

type Member = {
  id: string
  email: string
  first_name: string
  last_name: string
  role: string
  status: string
}
type Invitation = {
  id: string
  email: string
  role: string
  expires_at: string
}
type Team = { members: Member[]; invitations: Invitation[] }
type TeamAction =
  | { type: 'invite'; email: string; role: string }
  | { type: 'change-role'; id: string; role: string }
  | { type: 'revoke-member'; id: string }
  | { type: 'cancel-invitation'; id: string }
type InviteResult = { token: string }
const roles = ['ADMIN', 'MANAGER', 'STAFF'] as const

function teamError(error: unknown, action: string) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session expired. Sign in again to continue.'
    if (error.status === 403) return 'You do not have permission to manage this organization’s team.'
    if (error.isNetworkError) return 'Could not reach the server. Check your connection and try again.'
    if (error.isTimeoutError) return 'The server did not respond in time. Try again.'
  }
  return `Unable to ${action}. Please try again.`
}

function initials(member: Member) {
  const first = member.first_name.trim().charAt(0)
  const last = member.last_name.trim().charAt(0)
  return `${first}${last}`.toUpperCase() || member.email.slice(0, 1).toUpperCase()
}

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString()
}

function AccessBadge({ status }: { status: string }) {
  const active = status.toLowerCase() === 'active'
  return (
    <Badge
      variant="secondary"
      className={
        active
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'bg-amber-500/10 text-amber-800 dark:text-amber-200'
      }
    >
      {active ? 'Active' : status.replaceAll('_', ' ')}
    </Badge>
  )
}

function ConfirmAction({
  label,
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
}: {
  label: string
  title: string
  description: string
  confirmLabel: string
  pending: boolean
  onConfirm: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <ConfirmationDialog
      trigger={
        <Button variant="outline" size="sm" disabled={pending}>
          {label}
        </Button>
      }
      open={open}
      onOpenChange={setOpen}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      loading={pending}
      onConfirm={() => {
        onConfirm()
        setOpen(false)
      }}
      destructive
    />
  )
}

export function TeamPage() {
  const org = useOrganization()
  return <TeamContent key={org.current?.organizationId} />
}

function TeamContent() {
  const org = useOrganization()
  const client = useQueryClient()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<(typeof roles)[number]>('STAFF')
  const [search, setSearch] = useState('')
  const [invitationLink, setInvitationLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')
  const [notice, setNotice] = useState('')
  const teamKey = org.queryKey(['team'])
  const team = useQuery({
    queryKey: teamKey,
    queryFn: ({ signal }) => org.request<Team>('get', 'team', undefined, { signal }),
    retry: false,
  })
  const action = useMutation({
    mutationFn: async (request: TeamAction): Promise<InviteResult | undefined> => {
      switch (request.type) {
        case 'invite':
          return org.request<InviteResult>('post', 'invitations', {
            email: request.email,
            role: request.role,
          })
        case 'change-role':
          await org.request('patch', `members/${request.id}`, { role: request.role })
          return undefined
        case 'revoke-member':
          await org.request('delete', `members/${request.id}`)
          return undefined
        case 'cancel-invitation':
          await org.request('delete', `invitations/${request.id}`)
          return undefined
      }
    },
    onSuccess: async (result, request) => {
      setNotice(
        request.type === 'change-role'
          ? 'Member role updated.'
          : request.type === 'revoke-member'
            ? 'Member access revoked.'
            : request.type === 'cancel-invitation'
              ? 'Invitation cancelled.'
              : '',
      )
      if (request.type === 'invite' && result) {
        setInvitationLink(
          `${window.location.origin}/invite#${encodeURIComponent(result.token)}`,
        )
        setNotice('')
        setCopied(false)
        setCopyError('')
        setEmail('')
      }
      await client.invalidateQueries({ queryKey: teamKey })
    },
    onMutate: () => setNotice(''),
  })
  const activeMembers = team.data?.members.filter((member) => member.status.toLowerCase() === 'active') ?? []
  const pendingInvitations = team.data?.invitations ?? []
  const filteredMembers =
    team.data?.members.filter((member) => {
      const term = search.trim().toLowerCase()
      return (
        !term ||
        `${member.first_name} ${member.last_name} ${member.email} ${member.role}`
          .toLowerCase()
          .includes(term)
      )
    }) ?? []

  return (
    <div className="mx-auto w-full max-w-[1200px] min-w-0 space-y-7">
      <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-5 py-7 text-white shadow-lg sm:px-8 sm:py-9">
        <div
          aria-hidden="true"
          className="absolute -right-10 -top-20 -z-10 size-64 rounded-full bg-indigo-400/20 blur-3xl"
        />
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
              People & access
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your team</h2>
            <p className="text-sm leading-6 text-slate-300 sm:text-base">
              Invite teammates, keep roles up to date, and manage access to your organization.
            </p>
          </div>
          <Button
            variant="outline"
            disabled={team.isFetching}
            onClick={() => void team.refetch()}
            className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
          >
            <RefreshCw aria-hidden="true" className={`size-4 ${team.isFetching ? 'animate-spin' : ''}`} />
            {team.isFetching ? 'Refreshing…' : 'Refresh team'}
          </Button>
        </div>
      </section>

      {action.isError && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          {teamError(action.error, 'complete the team update')}
        </p>
      )}
      {!action.isError && notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-800 dark:text-emerald-200"
        >
          {notice}
        </p>
      )}

      {team.data && (
        <dl aria-label="Team overview" className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Active members', value: activeMembers.length, icon: Users },
            { label: 'Pending invitations', value: pendingInvitations.length, icon: MailPlus },
            {
              label: 'Administrators',
              value: activeMembers.filter((member) => member.role.toUpperCase() === 'ADMIN').length,
              icon: Shield,
            },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} className="gap-3 border-border/70 p-4 sm:p-5">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="flex items-center justify-between gap-3">
                <span className="text-3xl font-semibold tracking-tight tabular-nums">
                  {value.toLocaleString()}
                </span>
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/5 text-primary">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
              </dd>
            </Card>
          ))}
        </dl>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <section aria-labelledby="team-members-heading" className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 id="team-members-heading" className="text-xl font-semibold tracking-tight">
                Members
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {team.data
                  ? `${team.data.members.length} ${team.data.members.length === 1 ? 'person' : 'people'} with access`
                  : 'People with access to this organization'}
              </p>
            </div>
            <label className="w-full sm:w-64">
              <span className="sr-only">Search team members</span>
              <Input
                type="search"
                placeholder="Search members"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search team members"
              />
            </label>
          </div>

          {team.isPending && (
            <div role="status" aria-label="Loading team" className="space-y-3">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-24 rounded-2xl" />
              ))}
            </div>
          )}
          {team.isError && (
            <ErrorState
              title="Team unavailable"
              description={teamError(team.error, 'load the team')}
              onRetry={() => void team.refetch()}
              retrying={team.isFetching}
            />
          )}
          {team.data && filteredMembers.length === 0 && (
            <EmptyState
              icon={<UserRound className="size-5" />}
              title={search ? 'No matching members' : 'No team members'}
              description={
                search
                  ? 'Try another name, email, or role.'
                  : 'Members who join your organization will appear here.'
              }
            />
          )}
          {team.data && filteredMembers.length > 0 && (
            <ul aria-label="Team members" className="space-y-3">
              {filteredMembers.map((member) => {
                const owner = member.role.toLowerCase() === 'owner'
                const canManageMember = !owner && member.status.toLowerCase() === 'active'
                return (
                  <li key={member.id}>
                    <Card className="gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {initials(member)}
                        </span>
                        <div className="min-w-0 space-y-2">
                          <div>
                            <h4 className="wrap-anywhere font-semibold">
                              {[member.first_name, member.last_name].filter(Boolean).join(' ') ||
                                member.email}
                            </h4>
                            <p className="wrap-anywhere text-sm text-muted-foreground">
                              {member.email}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={owner ? 'default' : 'outline'}>
                              {member.role.toUpperCase()}
                            </Badge>
                            <AccessBadge status={member.status} />
                          </div>
                        </div>
                      </div>
                      {canManageMember && (
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <label className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="sr-only">Role for {member.email}</span>
                            <select
                              aria-label={`Role for ${member.email}`}
                              className="min-h-10 rounded-lg border bg-background px-3 text-foreground"
                              value={member.role.toUpperCase()}
                              disabled={action.isPending}
                              onChange={(event) =>
                                action.mutate({
                                  type: 'change-role',
                                  id: member.id,
                                  role: event.target.value,
                                })
                              }
                            >
                              {roles.map((value) => (
                                <option key={value} value={value}>
                                  {value}
                                </option>
                              ))}
                            </select>
                          </label>
                          <ConfirmAction
                            label="Remove"
                            title="Remove team member?"
                            description={`This will suspend ${member.email}'s access to this organization.`}
                            confirmLabel="Remove access"
                            pending={action.isPending}
                            onConfirm={() =>
                              action.mutate({ type: 'revoke-member', id: member.id })
                            }
                          />
                        </div>
                      )}
                    </Card>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <aside className="space-y-5">
          <Card className="rounded-2xl p-5 sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary">
                <MailPlus aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold">Invite a teammate</h3>
                <p className="text-sm text-muted-foreground">
                  Create a private invitation link for a new member.
                </p>
              </div>
            </div>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                if (!action.isPending) {
                  setInvitationLink('')
                  action.mutate({ type: 'invite', email: email.trim(), role })
                }
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="team-invite-email">Email address</Label>
                <Input
                  id="team-invite-email"
                  type="email"
                  autoComplete="email"
                  placeholder="teammate@example.com"
                  required
                  maxLength={320}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={action.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-invite-role">Organization role</Label>
                <select
                  id="team-invite-role"
                  aria-label="Invitation role"
                  className="min-h-11 w-full rounded-lg border bg-background px-3"
                  value={role}
                  onChange={(event) => setRole(event.target.value as (typeof roles)[number])}
                  disabled={action.isPending}
                >
                  {roles.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Invitations expire after seven days. Email delivery is not configured, so you’ll
                share the link privately.
              </p>
              <Button type="submit" disabled={action.isPending || !email.trim()} className="w-full">
                <MailPlus aria-hidden="true" className="size-4" />
                {action.isPending ? 'Creating invitation…' : 'Create invitation'}
              </Button>
            </form>
            {invitationLink && (
              <div className="mt-4 space-y-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p role="status" className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                  Invitation created. Copy this link and share it with the teammate.
                </p>
                <Input
                  aria-label="Invitation link"
                  readOnly
                  value={invitationLink}
                  className="text-xs"
                  onFocus={(event) => event.currentTarget.select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    !navigator.clipboard
                      ? setCopyError('Clipboard access is unavailable. Select the link and copy it manually.')
                      : void navigator.clipboard
                          .writeText(invitationLink)
                          .then(() => {
                            setCopied(true)
                            setCopyError('')
                          })
                          .catch(() => {
                            setCopied(false)
                            setCopyError('Could not copy the link. Select it above and copy it manually.')
                          })
                  }
                >
                  <Copy aria-hidden="true" className="size-4" />
                  {copied ? 'Copied' : 'Copy invitation link'}
                </Button>
                {copyError && (
                  <p role="status" className="text-xs text-muted-foreground">
                    {copyError}
                  </p>
                )}
              </div>
            )}
          </Card>

          <Card className="rounded-2xl p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Pending invitations</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Links waiting to be accepted.
                </p>
              </div>
              <Badge variant="secondary">{pendingInvitations.length}</Badge>
            </div>
            {team.data && pendingInvitations.length === 0 && (
              <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
                No pending invitations.
              </p>
            )}
            {pendingInvitations.length > 0 && (
              <ul className="space-y-3">
                {pendingInvitations.map((invitation) => (
                  <li
                    key={invitation.id}
                    className="flex flex-wrap items-start justify-between gap-3 border-t pt-3 first:border-t-0 first:pt-0"
                  >
                    <div className="min-w-0">
                      <p className="wrap-anywhere text-sm font-medium">{invitation.email}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {invitation.role.toUpperCase()} · expires {dateLabel(invitation.expires_at)}
                      </p>
                    </div>
                    <ConfirmAction
                      label="Cancel"
                      title="Cancel invitation?"
                      description={`The invitation for ${invitation.email} will no longer be valid.`}
                      confirmLabel="Cancel invitation"
                      pending={action.isPending}
                      onConfirm={() =>
                        action.mutate({
                          type: 'cancel-invitation',
                          id: invitation.id,
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">
          Roles control which parts of the organization workspace each person can access.
        </p>
        <Link className="inline-flex items-center gap-1 text-sm font-medium text-primary" to="/settings">
          Organization settings <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </div>
  )
}

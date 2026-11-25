import { useEffect, useState } from 'react'
import { ArrowRight, Building2, MessageCircle, RefreshCw } from 'lucide-react'
import { Link } from 'react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { useAuth } from '@/features/auth/context'
import { useOrganization } from './context'

const reviewStates = {
  pending: {
    title: 'Pending review',
    detail: 'The platform team is reviewing your registration. You can message support if you have questions or need to share more information.',
    color: 'bg-amber-100 text-amber-950',
  },
  rejected: {
    title: 'Registration rejected',
    detail: 'The platform team did not approve this registration. The organization owner can message support to ask about the decision.',
    color: 'bg-rose-100 text-rose-950',
  },
  suspended: {
    title: 'Access suspended',
    detail: 'The workspace is temporarily unavailable. The organization owner can message support about restoring access.',
    color: 'bg-amber-100 text-amber-950',
  },
  banned: {
    title: 'Access banned',
    detail: 'This organization’s workspace access has been revoked. The organization owner can contact support about the decision.',
    color: 'bg-rose-100 text-rose-950',
  },
}

export type RestrictedOrganization = { id: string; name: string; status: keyof typeof reviewStates; role: string }
export const organizationStatusPath = 'api/v1/my-organizations/status'

export function OrganizationAccessPage() {
  const { organizations, current, forbidden } = useOrganization()
  const owners = organizations.filter(item => item.role === 'OWNER')

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        headingLevel={2}
        title="Organization access"
        description="Check your organization’s status and contact platform support."
        actions={current && !forbidden && (
          <Link to="/dashboard" className={buttonVariants({ className: 'h-10' })}>
            Open dashboard <ArrowRight aria-hidden="true" />
          </Link>
        )}
      />
      <RestrictedOrganizations />
      {owners.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">Support for active organizations</h3>
          {owners.map(item => (
            <Card key={item.organizationId} className="flex flex-row flex-wrap items-center justify-between gap-3 p-4 sm:px-5">
              <p className="min-w-0 wrap-anywhere font-medium">{item.organizationName}</p>
              <Link to={`/organization-messages/${item.organizationId}`} className={buttonVariants({ variant: 'outline', className: 'h-10' })}>
                <MessageCircle aria-hidden="true" /> Message support
                <span className="sr-only"> for {item.organizationName}</span>
              </Link>
            </Card>
          ))}
        </section>
      )}
    </section>
  )
}

export function RestrictedOrganizations() {
  const { state } = useAuth()
  if (state.status !== 'authenticated') return null
  return <RestrictedOrganizationList key={state.session.user.id} />
}

function RestrictedOrganizationList() {
  const { service, state } = useAuth()
  const session = state.status === 'authenticated' ? state.session : undefined
  const [result, setResult] = useState<{ items: RestrictedOrganization[] } | { error: true }>()
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let active = true
    void service.request<RestrictedOrganization[]>('get', organizationStatusPath)
      .then(items => { if (active) setResult({ items }) })
      .catch(() => { if (active) setResult({ error: true }) })
    return () => { active = false }
  }, [service, session])

  async function refresh() {
    setRefreshing(true)
    try {
      await service.refresh()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <section aria-label="Organization review" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Review and restrictions</h3>
        <Button variant="outline" className="h-10" disabled={refreshing} onClick={() => void refresh()}>
          <RefreshCw aria-hidden="true" className={refreshing ? 'motion-safe:animate-spin' : undefined} />
          {refreshing ? 'Checking access…' : 'Refresh access'}
        </Button>
      </div>
      {!result && <p role="status" className="text-sm text-muted-foreground">Checking organization status…</p>}
      {result && 'error' in result && <p role="alert" className="text-sm text-destructive">Organization status could not be loaded. Try refreshing access.</p>}
      {result && 'items' in result && (
        result.items.length === 0 ? (
          <Card className="gap-2 p-5">
            <h4 className="font-semibold">{session?.organizations.length ? 'No organizations under review or restricted' : 'No active organizations'}</h4>
            {!session?.organizations.length && <p className="text-sm text-muted-foreground">If you’re expecting access to an organization, contact its owner.</p>}
          </Card>
        ) : result.items.map(item => {
          const review = reviewStates[item.status]
          return (
            <Card key={item.id} className="gap-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-3">
                <Building2 aria-hidden="true" className="size-9 rounded-lg bg-muted p-2 text-primary" />
                <h4 className="min-w-0 wrap-anywhere text-lg font-semibold">{item.name}</h4>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${review.color}`}>{review.title}</span>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{review.detail}</p>
              {item.role.toLowerCase() === 'owner' && (
                <Link to={`/organization-messages/${item.id}`} className={buttonVariants({ className: 'h-10 self-start' })}>
                  <MessageCircle aria-hidden="true" /> Message support
                  <span className="sr-only"> for {item.name}</span>
                </Link>
              )}
            </Card>
          )
        })
      )}
    </section>
  )
}

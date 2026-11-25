import { Bell, MessageCircle, Receipt, Wrench } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingState } from '@/components/ui/loading-state'
import { PageHeader } from '@/components/ui/page-header'
import { useNotificationFeed } from '@/features/notifications/NotificationFeedProvider'

const titles = {
  MAINTENANCE_CREATED: 'Maintenance request created',
  MAINTENANCE_STATUS_CHANGED: 'Maintenance status updated',
  PAYMENT_RECORDED: 'Rent payment recorded',
}
const statuses: Record<string, string> = {
  OPEN: 'Open', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved', CANCELLED: 'Cancelled',
}

export function OrganizationNotificationsPage() {
  const feed = useNotificationFeed()
  if (!feed) return null
  const { activity, support, mark } = feed
  const items = [
    ...(activity.isEnabled && !activity.isError ? activity.data?.notifications ?? [] : []).map(event => {
      const payment = event.kind === 'PAYMENT_RECORDED'
      return {
        key: `activity-${event.cursor}`, Icon: payment ? Receipt : Wrench, title: titles[event.kind],
        detail: event.maintenanceStatus ? statuses[event.maintenanceStatus] : undefined,
        to: `/${payment ? 'billing' : 'maintenance'}/${event.resourceId}`,
        occurredAt: event.occurredAt, unread: event.unread, read: { cursor: event.cursor },
      }
    }),
    ...(!support.isError ? support.data?.replies ?? [] : []).map(reply => ({
      key: `support-${reply.messageId}`, Icon: MessageCircle, title: 'New message from platform support',
      detail: reply.organizationName,
      to: `/organization-messages/${reply.organizationId}#message-${reply.messageId}`,
      occurredAt: reply.occurredAt, unread: reply.unread,
      read: { organizationId: reply.organizationId, messageId: reply.messageId },
    })),
  ].sort((first, second) => Date.parse(second.occurredAt) - Date.parse(first.occurredAt))
  const loading = (activity.isEnabled && activity.isPending) || (support.isEnabled && support.isPending)
  const failed = (activity.isEnabled && activity.isError) || support.isError
  const refresh = () => {
    if (activity.isEnabled) void activity.refetch()
    void support.refetch()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader headingLevel={2} title="Notification center"
        description={feed.unreadCount ? `${feed.unreadCount} unread` : 'Maintenance, billing, and support updates'}
        actions={<>
          {feed.unreadCount > 0 && <Button variant="outline" onClick={() => mark.mutate('all')} disabled={mark.isPending}>Mark all as read</Button>}
          <Button variant="outline" onClick={refresh} disabled={activity.isFetching || support.isFetching}>Refresh notifications</Button>
        </>} />
      {failed && <p role="alert" className="text-sm text-destructive">Some notifications couldn’t be loaded. Try refreshing the list.</p>}
      {mark.isError && <p role="alert" className="text-sm text-destructive">Couldn’t update read status. Please try again.</p>}
      {items.length === 0 ? loading ? <LoadingState label="Loading notifications…" /> :
        !failed && <EmptyState icon={<Bell aria-hidden="true" className="size-5" />} title="No notifications yet"
          description="Maintenance, payment, and platform support updates you can access will appear here." /> :
        <ul aria-label="Recent notifications" className="divide-y rounded-xl border bg-card">
          {items.map(({ key, Icon, title, detail, to, occurredAt, unread, read }) => (
            <li key={key} className={`flex min-w-0 items-start gap-3 p-4 ${unread ? 'bg-accent/40' : ''}`}>
              <Icon aria-hidden="true" className="size-9 shrink-0 rounded-lg bg-muted p-2 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link to={to} onClick={() => { if (unread) mark.mutate(read) }}
                    className="wrap-anywhere font-medium underline-offset-4 hover:underline">{title}</Link>
                  {unread && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">Unread</span>}
                </div>
                <p className="mt-1 wrap-anywhere text-sm text-muted-foreground">
                  {detail && <>{detail} · </>}
                  <time dateTime={occurredAt}>{new Date(occurredAt).toLocaleString()}</time>
                </p>
                {unread && <Button type="button" variant="link" size="sm" className="mt-1 px-0"
                  disabled={mark.isPending} onClick={() => mark.mutate(read)}>Mark as read</Button>}
              </div>
            </li>
          ))}
        </ul>}
    </div>
  )
}

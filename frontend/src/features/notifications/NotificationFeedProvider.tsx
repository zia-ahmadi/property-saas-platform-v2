import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOptionalAuth } from '@/features/auth/context'
import { useOptionalOrganization } from '@/features/organization/context'
import {
  markActivityRead, notificationHistory, subscribeToNotifications, supportHistory,
  type ActivityFeed, type SupportNotification,
} from './api'

type ReadItem = 'all' | { cursor: string } | Pick<SupportNotification, 'organizationId' | 'messageId'>

function useNotificationFeedData() {
  const auth = useOptionalAuth()
  const org = useOptionalOrganization()
  const client = useQueryClient()
  const userId = auth?.state.status === 'authenticated' ? auth.state.session.user.id : undefined
  const service = auth?.service
  const organizationId = org?.current?.organizationId
  const role = org?.current?.role
  const activityKey = useMemo(() => ['organization', userId, organizationId, role, 'notification-feed'], [userId, organizationId, role])
  const supportKey = useMemo(() => ['support-notifications', userId], [userId])
  const enabled = !!userId && !!service && typeof service.graphql === 'function'
  const activity = useQuery({
    queryKey: activityKey,
    queryFn: ({ signal }) => notificationHistory(service!, organizationId!, signal),
    enabled: enabled && !!organizationId && !org?.forbidden && (org?.can('MAINTENANCE_MANAGE') || org?.can('BILLING_MANAGE')),
    retry: false,
    refetchInterval: 20_000,
  })
  const support = useQuery({
    queryKey: supportKey,
    queryFn: ({ signal }) => supportHistory(service!, signal),
    enabled,
    retry: false,
    refetchInterval: 5_000,
  })
  const ready = activity.isSuccess && activity.isEnabled

  useEffect(() => {
    if (!ready || !service || !organizationId) return
    const controller = new AbortController()
    let timer: number | undefined
    let refreshTimer: number | undefined
    let after = client.getQueryData<ActivityFeed>(activityKey)?.notifications[0]?.cursor ?? '0'
    async function connect() {
      if (!service || !organizationId) return
      let delay = 750
      try {
        await subscribeToNotifications(service, organizationId, after, controller.signal, event => {
          if (controller.signal.aborted) return
          after = event.cursor
          window.clearTimeout(refreshTimer)
          refreshTimer = window.setTimeout(() => {
            void client.invalidateQueries({ queryKey: activityKey, exact: true })
          }, 150)
        })
      } catch {
        delay = 5_000
      }
      if (!controller.signal.aborted) timer = window.setTimeout(() => void connect(), delay)
    }
    void connect()
    return () => {
      controller.abort()
      window.clearTimeout(timer)
      window.clearTimeout(refreshTimer)
    }
  }, [activityKey, client, organizationId, ready, service])

  const refreshSupport = () => client.invalidateQueries({ queryKey: supportKey, exact: true })
  const mark = useMutation({
    mutationKey: ['notification-read', userId, organizationId],
    mutationFn: async (item: ReadItem) => {
      const session = service?.getSnapshot()
      if (!service || session?.status !== 'authenticated' || session.session.user.id !== userId) {
        throw new Error('Sign in to mark notifications read')
      }
      if (item === 'all') {
        const writes = [service.request('post', 'api/v1/my-support-notifications/read')]
        if (activity.isEnabled && organizationId) {
          writes.push(service.request('post', `api/v1/organizations/${organizationId}/notification-events/read`))
        }
        const outcomes = await Promise.allSettled(writes)
        if (outcomes.some(result => result.status === 'rejected')) throw new Error('Could not clear unread notifications')
      } else if ('messageId' in item) {
        await service.request('post', `api/v1/my-organizations/${item.organizationId}/messages/${item.messageId}/read`)
      } else if (organizationId) {
        await markActivityRead(service, organizationId, item.cursor)
      }
    },
    onSettled: async (_, __, item) => {
      await Promise.all([
        item === 'all' || 'messageId' in item ? refreshSupport() : undefined,
        item === 'all' || 'cursor' in item ? client.invalidateQueries({ queryKey: activityKey, exact: true }) : undefined,
      ])
    },
  })

  return {
    activity, support, mark, refreshSupport,
    unreadCount: (activity.isEnabled && !activity.isError ? activity.data?.notificationUnreadCount ?? 0 : 0)
      + (!support.isError ? support.data?.unreadCount ?? 0 : 0),
  }
}

const NotificationFeedContext = createContext<ReturnType<typeof useNotificationFeedData> | null>(null)

export function NotificationFeedProvider({ children }: { children: ReactNode }) {
  const auth = useOptionalAuth()
  if (auth?.state.status !== 'authenticated') return children
  return <AuthenticatedNotificationFeedProvider key={auth.state.session.user.id}>
    {children}
  </AuthenticatedNotificationFeedProvider>
}

function AuthenticatedNotificationFeedProvider({ children }: { children: ReactNode }) {
  const feed = useNotificationFeedData()
  return <NotificationFeedContext.Provider value={feed}>{children}</NotificationFeedContext.Provider>
}

export function useNotificationFeed() {
  return useContext(NotificationFeedContext)
}

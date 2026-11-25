import type { AuthLifecycleService } from '@/features/auth/lifecycle'

export interface OrganizationNotification {
  cursor: string
  kind: 'MAINTENANCE_CREATED' | 'MAINTENANCE_STATUS_CHANGED' | 'PAYMENT_RECORDED'
  resourceId: string
  maintenanceStatus: string | null
  occurredAt: string
  unread: boolean
}

export interface SupportNotification {
  messageId: string
  organizationId: string
  organizationName: string
  occurredAt: string
  unread: boolean
}

export interface SupportFeed { replies: SupportNotification[]; unreadCount: number }
export interface ActivityFeed { notifications: OrganizationNotification[]; notificationUnreadCount: number }

const fields = 'cursor kind resourceId maintenanceStatus occurredAt unread'
interface GraphqlResult<T> { data?: T; errors?: Array<{ message: string }> }

export async function graphqlQuery<T>(
  service: AuthLifecycleService,
  query: string,
  variables: Record<string, unknown>,
  signal: AbortSignal,
): Promise<T> {
  const response = await service.graphql({ query, variables }, signal)
  const payload: GraphqlResult<T> = await response.json()
  if (payload.errors?.length || !payload.data) throw new Error('The GraphQL query could not be completed')
  return payload.data
}

export async function notificationHistory(service: AuthLifecycleService, organizationId: string, signal: AbortSignal) {
  return graphqlQuery<ActivityFeed>(service,
    `query Notifications($organizationId: ID!) {
      notifications(organizationId: $organizationId, limit: 40) { ${fields} }
      notificationUnreadCount(organizationId: $organizationId)
    }`, { organizationId }, signal)
}

export async function supportHistory(service: AuthLifecycleService, signal: AbortSignal) {
  const data = await graphqlQuery<{ supportNotifications: SupportFeed }>(service, `query SupportNotifications {
    supportNotifications { unreadCount replies { messageId organizationId organizationName occurredAt unread } }
  }`, {}, signal)
  return data.supportNotifications
}

export async function markActivityRead(service: AuthLifecycleService, organizationId: string, cursor: string) {
  await graphqlQuery<{ markNotificationRead: boolean }>(service, `mutation ReadNotification($organizationId: ID!, $cursor: String!) {
    markNotificationRead(organizationId: $organizationId, cursor: $cursor)
  }`, { organizationId, cursor }, new AbortController().signal)
}

export async function subscribeToNotifications(
  service: AuthLifecycleService, organizationId: string, after: string, signal: AbortSignal,
  onEvent: (event: OrganizationNotification) => void,
) {
  const response = await service.graphql({
    query: `subscription NotificationEvents($organizationId: ID!, $after: String!) {
      notificationEvents(organizationId: $organizationId, after: $after) { ${fields} }
    }`,
    variables: { organizationId, after },
  }, signal, true)

  if (!response.body || !response.headers.get('Content-Type')?.startsWith('text/event-stream')) {
    await response.body?.cancel()
    throw new Error('The notification stream is unavailable')
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let pending = ''
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read()
      if (done) return
      const frames = (pending + value).split(/\r?\n\r?\n/)
      pending = frames.pop() ?? ''
      for (const frame of frames) {
        const lines = frame.split(/\r?\n/)
        if (lines.includes('event:complete') || lines.includes('event: complete')) return
        const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
        if (!data) continue
        const result: GraphqlResult<{ notificationEvents: OrganizationNotification }> = JSON.parse(data)
        if (!result.data?.notificationEvents || result.errors?.length) throw new Error('The notification stream closed')
        onEvent(result.data.notificationEvents)
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

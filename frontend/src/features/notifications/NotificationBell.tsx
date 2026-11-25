import { Bell } from 'lucide-react'
import { NavLink } from 'react-router'
import { useDevicePreferences } from '@/features/settings/devicePreferences'
import { buttonVariants } from '@/components/ui/button'
import { useNotificationFeed } from './NotificationFeedProvider'

export function NotificationBell() {
  const { showUnreadCount } = useDevicePreferences()
  const count = useNotificationFeed()?.unreadCount ?? 0
  const label = count ? `Notifications (${count} unread)` : 'Notifications'
  return (
    <NavLink to="/notifications" aria-label={label} title={label}
      className={buttonVariants({ variant: 'outline', className: 'relative size-10 shrink-0 p-0 aria-[current=page]:bg-accent' })}>
      <Bell aria-hidden="true" className="size-5" />
      {count > 0 && (showUnreadCount ? (
        <span aria-hidden="true" className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
          {count > 99 ? '99+' : count}
        </span>
      ) : <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-primary" />)}
    </NavLink>
  )
}

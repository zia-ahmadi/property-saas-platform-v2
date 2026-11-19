import { Toast } from '@base-ui/react/toast'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import type { NotificationData, NotificationVariant } from '@/components/ui/use-notification'

const variants = {
  success: { icon: CircleCheck, label: 'Success' },
  error: { icon: CircleAlert, label: 'Error' },
  warning: { icon: TriangleAlert, label: 'Warning' },
  info: { icon: Info, label: 'Information' },
} satisfies Record<NotificationVariant, { icon: typeof Info; label: string }>

function NotificationViewport() {
  const { toasts } = Toast.useToastManager<NotificationData>()

  return (
    <Toast.Portal>
      <Toast.Viewport className="pointer-events-none fixed inset-x-0 bottom-0 z-50 grid max-h-[50dvh] gap-2 overflow-y-auto p-3 sm:left-auto sm:w-full sm:max-w-sm sm:p-4">
        {toasts.map((toast) => {
          const variant = toast.data?.variant ?? 'info'
          const { icon: Icon, label } = variants[variant]

          return (
            <Toast.Root
              key={toast.id}
              toast={toast}
              swipeDirection={[]}
              className="pointer-events-auto grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md data-ending-style:hidden data-limited:hidden"
            >
              <Icon
                aria-hidden="true"
                className={variant === 'error' ? 'mt-0.5 size-4 text-destructive' : 'mt-0.5 size-4'}
              />
              <div className="min-w-0 wrap-anywhere">
                <Toast.Title className="text-sm font-semibold">
                  {`${label}: ${toast.title}`}
                </Toast.Title>
                {toast.description && (
                  <Toast.Description className="mt-1 text-sm text-muted-foreground" />
                )}
              </div>
              <Toast.Close
                aria-label={`Dismiss notification: ${toast.title}`}
                aria-hidden={false}
                render={
                  <Button variant="ghost" size="icon" className="motion-reduce:transition-none" />
                }
              >
                <X aria-hidden="true" />
              </Toast.Close>
            </Toast.Root>
          )
        })}
      </Toast.Viewport>
    </Toast.Portal>
  )
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider>
      {children}
      <NotificationViewport />
    </Toast.Provider>
  )
}

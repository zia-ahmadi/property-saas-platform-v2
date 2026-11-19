import { Toast } from '@base-ui/react/toast'

export type NotificationVariant = 'success' | 'error' | 'warning' | 'info'

export interface NotificationData {
  variant: NotificationVariant
}

interface NotificationOptions {
  variant: NotificationVariant
  title: string
  description?: string
}

export function useNotification() {
  const { add, close } = Toast.useToastManager<NotificationData>()

  return {
    notify: ({ variant, title, description }: NotificationOptions) =>
      add({
        title,
        description,
        data: { variant },
        timeout: variant === 'error' || variant === 'warning' ? 0 : 8000,
      }),
    dismiss: close,
  }
}

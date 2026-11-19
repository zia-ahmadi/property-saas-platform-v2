import { StrictMode } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '@/App'
import { useNotification, type NotificationVariant } from '@/components/ui/use-notification'
import { NotificationProvider } from './NotificationProvider'

vi.mock('@/app/router/AppRouter', () => ({
  AppRouter: () => <NotificationTrigger variant="info" />,
}))

function NotificationTrigger({ variant }: { variant: NotificationVariant }) {
  const { notify } = useNotification()
  return (
    <button
      type="button"
      onClick={() =>
        notify({
          variant,
          title: 'Update received',
          description: variant === 'info' ? undefined : 'You can continue working.',
        })
      }
    >
      Show notification
    </button>
  )
}

describe('notifications', () => {
  it.each([
    ['success', 'Success'],
    ['error', 'Error'],
    ['warning', 'Warning'],
    ['info', 'Information'],
  ] as const)(
    'renders the %s variant with a polite, labeled notification',
    async (variant, label) => {
      const user = userEvent.setup()
      render(
        <NotificationProvider>
          <NotificationTrigger variant={variant} />
        </NotificationProvider>,
      )

      await user.click(screen.getByRole('button', { name: 'Show notification' }))
      const viewport = screen.getByRole('region', { name: 'Notifications' })
      const notification = within(viewport).getByRole('dialog', {
        name: `${label}: Update received`,
      })
      expect(viewport).toHaveAttribute('aria-live', 'polite')
      if (variant === 'info') {
        expect(notification).not.toHaveAttribute('aria-describedby')
      } else {
        expect(within(notification).getByText('You can continue working.')).toBeVisible()
        expect(notification).toHaveAccessibleDescription('You can continue working.')
      }
    },
  )

  it('dismisses a notification using its labeled close button', async () => {
    const user = userEvent.setup()
    render(
      <NotificationProvider>
        <NotificationTrigger variant="error" />
      </NotificationProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Show notification' }))
    await user.click(screen.getByRole('button', { name: 'Dismiss notification: Update received' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Error: Update received' }),
      ).not.toBeInTheDocument(),
    )
  })

  it('dismisses a focused notification with Escape', async () => {
    const user = userEvent.setup()
    render(
      <NotificationProvider>
        <NotificationTrigger variant="warning" />
      </NotificationProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Show notification' }))
    const toast = screen.getByRole('dialog', { name: 'Warning: Update received' })
    act(() => toast.focus())
    expect(toast).toHaveFocus()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(toast).not.toBeInTheDocument())
  })

  it('mounts one viewport and shows one toast from the route tree under StrictMode', async () => {
    const user = userEvent.setup()
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    )

    expect(screen.getAllByRole('region', { name: 'Notifications' })).toHaveLength(1)
    const trigger = screen.getByRole('button', { name: 'Show notification' })
    await user.click(trigger)
    expect(screen.getAllByRole('dialog', { name: 'Information: Update received' })).toHaveLength(1)
    expect(trigger).toHaveFocus()
  })
})

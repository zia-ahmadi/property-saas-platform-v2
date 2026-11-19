import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '@/App'
import { useNotification, type NotificationVariant } from '@/components/ui/use-notification'
import { NotificationProvider } from './NotificationProvider'

vi.mock('@/app/router/AppRouter', () => ({
  AppRouter: () => <NotificationTrigger variant="info" />,
}))

function NotificationTrigger({
  variant,
  title = 'Update received',
}: {
  variant: NotificationVariant
  title?: string
}) {
  const { notify } = useNotification()
  return (
    <button
      type="button"
      onClick={() =>
        notify({
          variant,
          title,
          description: variant === 'info' ? undefined : 'You can continue working.',
        })
      }
    >
      {title === 'Update received' ? 'Show notification' : `Show ${title}`}
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

  it('returns focus after tabbing into a notification and dismissing it with Escape', async () => {
    const user = userEvent.setup()
    render(
      <NotificationProvider>
        <NotificationTrigger variant="warning" />
      </NotificationProvider>,
    )

    const trigger = screen.getByRole('button', { name: 'Show notification' })
    await user.tab()
    await user.keyboard('{Enter}')
    const toast = screen.getByRole('dialog', { name: 'Warning: Update received' })
    await user.tab()
    expect(toast).toHaveFocus()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(toast).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('returns focus after keyboard activation of a toast close button', async () => {
    const user = userEvent.setup()
    render(
      <NotificationProvider>
        <NotificationTrigger variant="warning" />
      </NotificationProvider>,
    )

    await user.tab()
    const trigger = screen.getByRole('button', { name: 'Show notification' })
    await user.keyboard('{Enter}')
    await user.tab()
    await user.tab()
    expect(
      screen.getByRole('button', { name: 'Dismiss notification: Update received' }),
    ).toHaveFocus()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('moves focus to the remaining toast, then back to the page', async () => {
    const user = userEvent.setup()
    render(
      <NotificationProvider>
        <NotificationTrigger variant="warning" title="first" />
        <NotificationTrigger variant="warning" title="second" />
      </NotificationProvider>,
    )

    await user.tab()
    await user.keyboard('{Enter}')
    await user.tab()
    const trigger = screen.getByRole('button', { name: 'Show second' })
    await user.keyboard('{Enter}')
    await user.tab()
    expect(screen.getByRole('dialog', { name: 'Warning: second' })).toHaveFocus()
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Warning: first' })).toHaveFocus(),
    )
    await user.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('keeps page focus in place when a notification times out', async ({ onTestFinished }) => {
    const user = userEvent.setup()
    render(
      <NotificationProvider>
        <NotificationTrigger variant="info" />
        <button type="button">Continue working</button>
      </NotificationProvider>,
    )

    await user.tab()
    await user.tab()
    const workButton = screen.getByRole('button', { name: 'Continue working' })
    expect(workButton).toHaveFocus()
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Show notification' }))
    const toast = screen.getByRole('dialog', { name: 'Information: Update received' })
    await act(() => vi.advanceTimersByTimeAsync(8000))
    expect(toast).not.toBeInTheDocument()
    expect(workButton).toHaveFocus()
  })

  it('returns focus when new notifications hide the focused toast', async () => {
    const user = userEvent.setup()
    let publish = () => {}
    const backgroundUpdate = new Promise<void>((resolve) => {
      publish = resolve
    })

    function ScheduleNotifications() {
      const { notify } = useNotification()
      return (
        <button
          type="button"
          onClick={() => {
            notify({ variant: 'warning', title: 'First warning' })
            void backgroundUpdate.then(() => {
              for (const title of ['Second warning', 'Third warning', 'Fourth warning']) {
                notify({ variant: 'warning', title })
              }
            })
          }}
        >
          Schedule notifications
        </button>
      )
    }

    render(
      <NotificationProvider>
        <ScheduleNotifications />
      </NotificationProvider>,
    )
    await user.tab()
    const trigger = screen.getByRole('button', { name: 'Schedule notifications' })
    await user.keyboard('{Enter}')
    await user.tab()
    expect(screen.getByRole('dialog', { name: 'Warning: First warning' })).toHaveFocus()
    await act(async () => publish())
    expect(trigger).toHaveFocus()
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

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ComponentProps } from 'react'
import { expect, it, vi } from 'vitest'
import { Button } from './button'
import { ConfirmationDialog } from './confirmation-dialog'

function Example({ onConfirm, ...props }: Partial<ComponentProps<typeof ConfirmationDialog>>) {
  const [open, setOpen] = useState(false)
  return (
    <ConfirmationDialog
      trigger={<Button>Review action</Button>}
      title="Confirm action"
      description="Review the action before continuing."
      {...props}
      open={open}
      onOpenChange={setOpen}
      onConfirm={() => {
        onConfirm?.()
        setOpen(false)
      }}
    />
  )
}

it('opens a labelled and described dialog, focuses cancel, and restores trigger focus on dismissal', async () => {
  const user = userEvent.setup()
  render(<Example />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  const trigger = screen.getByRole('button', { name: 'Review action' })
  await user.click(trigger)
  const dialog = await screen.findByRole('dialog', { name: 'Confirm action' })
  expect(dialog).toHaveAccessibleDescription('Review the action before continuing.')
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await waitFor(() => expect(trigger).toHaveFocus())
})

it('invokes cancel without confirming', async () => {
  const user = userEvent.setup()
  const confirm = vi.fn()
  const cancel = vi.fn()
  render(<Example onConfirm={confirm} onCancel={cancel} />)
  await user.click(screen.getByRole('button', { name: 'Review action' }))
  await user.click(await screen.findByRole('button', { name: 'Cancel' }))
  expect(cancel).toHaveBeenCalledOnce()
  expect(confirm).not.toHaveBeenCalled()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

it('allows keyboard confirmation and lets the parent close the dialog', async () => {
  const user = userEvent.setup()
  const confirm = vi.fn()
  render(<Example onConfirm={confirm} confirmLabel="Continue" />)
  await user.click(screen.getByRole('button', { name: 'Review action' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus())
  await user.tab()
  expect(screen.getByRole('button', { name: 'Continue' })).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(confirm).toHaveBeenCalledOnce()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

it('supports explicitly labelled destructive confirmation', async () => {
  const user = userEvent.setup()
  const confirm = vi.fn()
  render(
    <Example
      destructive
      title="Delete record?"
      description="This action cannot be undone."
      confirmLabel="Delete record"
      onConfirm={confirm}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Review action' }))
  const dialog = await screen.findByRole('dialog', { name: 'Delete record?' })
  expect(dialog).toHaveAccessibleDescription('This action cannot be undone.')
  await user.click(within(dialog).getByRole('button', { name: 'Delete record' }))
  expect(confirm).toHaveBeenCalledOnce()
})

it.each([
  { loading: true, label: 'Saving…' },
  { loading: false, label: 'Confirm' },
])(
  'blocks confirmation when loading=$loading or explicitly disabled',
  async ({ loading, label }) => {
    const user = userEvent.setup()
    const confirm = vi.fn()
    render(
      <Example
        loading={loading}
        loadingLabel="Saving…"
        confirmDisabled={!loading}
        onConfirm={confirm}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Review action' }))
    const button = await screen.findByRole('button', { name: label })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', String(loading))
    await user.click(button)
    expect(confirm).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    if (loading) {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    } else {
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    }
  },
)

it('keeps confirmation open until its owner updates the controlled state', async () => {
  const user = userEvent.setup()
  const confirm = vi.fn()
  const change = vi.fn()
  render(
    <ConfirmationDialog
      trigger={<Button>Review action</Button>}
      open
      onOpenChange={change}
      title="Confirm action"
      description="Review carefully."
      onConfirm={confirm}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Confirm' }))
  expect(confirm).toHaveBeenCalledOnce()
  expect(change).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

it('blocks cancel, Escape, and outside dismissal while loading, then restores normal dismissal', async () => {
  const user = userEvent.setup()
  const cancel = vi.fn()
  const confirm = vi.fn()
  const { rerender } = render(<Example loading onCancel={cancel} onConfirm={confirm} />)
  await user.click(screen.getByRole('button', { name: 'Review action' }))
  const dialog = await screen.findByRole('dialog')
  const cancelButton = within(dialog).getByRole('button', { name: 'Cancel' })
  expect(cancelButton).toBeDisabled()
  await user.click(cancelButton)
  await user.keyboard('{Escape}')
  await user.click(document.body)
  expect(screen.getByRole('dialog')).toBe(dialog)
  expect(cancel).not.toHaveBeenCalled()
  expect(confirm).not.toHaveBeenCalled()

  rerender(<Example loading={false} onCancel={cancel} onConfirm={confirm} />)
  expect(cancelButton).toBeEnabled()
  expect(within(dialog).getByRole('button', { name: 'Confirm' })).toBeEnabled()
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Review action' })).toHaveFocus())
})

it('does not forward blocked user close requests but accepts parent-controlled closure during loading', async () => {
  const user = userEvent.setup()
  const change = vi.fn()
  const view = (open: boolean) => (
    <ConfirmationDialog
      trigger={<Button>Review action</Button>}
      open={open}
      loading
      onOpenChange={change}
      title="Confirm action"
      description="Saving changes."
      onConfirm={vi.fn()}
    />
  )
  const { rerender } = render(view(true))
  await screen.findByRole('dialog')
  await user.keyboard('{Escape}')
  await user.click(document.body)
  expect(change).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  rerender(view(false))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(change).not.toHaveBeenCalled()
})

it('allows outside dismissal when not loading', async () => {
  const user = userEvent.setup()
  render(<Example />)
  await user.click(screen.getByRole('button', { name: 'Review action' }))
  await screen.findByRole('dialog')
  await user.click(document.body)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

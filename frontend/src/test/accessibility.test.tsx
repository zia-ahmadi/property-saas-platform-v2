import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { useState } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NotificationProvider } from '@/app/providers/NotificationProvider'
import { Button } from '@/components/ui/button'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/ui/loading-state'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useNotification } from '@/components/ui/use-notification'
import { AppShell } from '@/layouts/AppShell'
import { LoginPage } from '@/pages/LoginPage'

vi.mock('@/features/organization/context', async () => { const { propertyOrganization } = await import('@/test/property-fixtures'); return { useOptionalOrganization: () => ({ can: () => true }), useOrganization: () => propertyOrganization } })

vi.mock('@/features/auth/context', () => ({ useAuth: () => ({ state: { status: 'anonymous' }, service: {} }), useOptionalAuth: () => null }))
import { PropertyDetailsPage } from '@/pages/PropertyDetailsPage'
import { UnitsPage } from '@/pages/UnitsPage'
import { PropertiesPage } from '@/pages/PropertiesPage'

async function expectAccessible(root: HTMLElement) {
  const { violations } = await axe.run(root, {
    // jsdom cannot compute rendered contrast. Check that separately in Chrome.
    rules: { 'color-contrast': { enabled: false } },
  })
  expect(
    violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) })),
  ).toEqual([])
}

function SharedControls() {
  const { notify } = useNotification()
  const [open, setOpen] = useState(false)

  return (
    <main>
      <h1>Shared controls</h1>
      <Field label="Name" description="Use your display name." error="Enter a name." required>
        {(props) => <Input {...props} />}
      </Field>
      <Field label="Notes" disabled>
        {(props) => <Textarea {...props} />}
      </Field>
      <TableContainer aria-label="Scrollable records">
        <Table>
          <TableCaption>Example records</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Example</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      <LoadingState />
      <EmptyState title="No results" description="Change your search." />
      <ErrorState title="Unavailable" onRetry={() => {}} />
      <ConfirmationDialog
        trigger={<Button>Review action</Button>}
        open={open}
        onOpenChange={setOpen}
        title="Confirm action"
        description="Confirm to continue."
        onConfirm={() => {}}
      />
      <Button onClick={() => notify({ variant: 'warning', title: 'Review notification' })}>
        Notify
      </Button>
    </main>
  )
}

describe('accessibility audit', () => {
  it('exposes login labels, native required inputs, and a keyboard tab order', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )
    const email = screen.getByLabelText('Email address')
    const password = screen.getByLabelText('Password')
    expect(email).toBeRequired()
    expect(password).toBeRequired()
    await user.tab()
    expect(email).toHaveFocus()
    await user.tab()
    expect(password).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveFocus()
    await expectAccessible(container)
  })

  it('exposes keyboard-operable property routes in the application shell', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/properties']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/properties" element={<PropertiesPage />} />
            <Route path="/properties/:propertyId" element={<PropertyDetailsPage />} />
            <Route path="/properties/:propertyId/units" element={<UnitsPage />} />
          </Route>
        </Routes>
      </MemoryRouter></QueryClientProvider>,
    )
    const details = await screen.findByRole('link', { name: 'Grandview Commercial Tower' })
    await expectAccessible(container)

    await user.tab()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('main')).toHaveFocus()
    for (const control of [
      screen.getByRole('link', { name: 'Add property' }),
      screen.getByRole('button', { name: /^All properties/ }),
      screen.getByRole('button', { name: /^Active/ }),
      screen.getByRole('button', { name: /^Archived/ }),
      screen.getByRole('searchbox', { name: 'Search properties' }),
      screen.getByRole('button', { name: /^Search$/ }),
      screen.getByRole('combobox', { name: 'Property type' }),
      screen.getByRole('combobox', { name: 'Page size' }),
      screen.getByRole('region', { name: /^Properties$/ }),
      details,
    ]) {
      await user.tab()
      expect(control).toHaveFocus()
    }
    await user.keyboard('{Enter}')
    const manage = await screen.findByRole('link', { name: 'Manage Units' })
    expect(manage).toHaveAttribute('href', '/properties/prop-101/units')
    expect(screen.getByRole('link', { name: 'Back to Properties' })).toHaveAttribute(
      'href',
      '/properties',
    )

    await user.click(manage)
    expect(screen.getByRole('heading', { name: 'Units', level: 2 })).toBeVisible()
    const back = screen.getByRole('link', { name: 'Back to property' })
    expect(back).toHaveAttribute('href', '/properties/prop-101')
    await user.click(back)
    expect(await screen.findByRole('link', { name: 'Manage Units' })).toBeVisible()
  })

  it('audits shared forms, table and feedback states, and a visible notification', async () => {
    const user = userEvent.setup()
    render(
      <NotificationProvider>
        <SharedControls />
      </NotificationProvider>,
    )
    const trigger = screen.getByRole('button', { name: 'Notify' })
    await user.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Warning: Review notification' })).toBeVisible()
    expect(trigger).toHaveFocus()
    await expectAccessible(document.body)
  })

  it('audits the mobile navigation drawer when opened with the keyboard', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<h2>Dashboard content</h2>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    const trigger = screen.getByRole('button', { name: 'Open navigation menu' })
    while (document.activeElement !== trigger) {
      await user.tab()
      expect(document.activeElement).not.toBe(document.body)
    }
    await user.keyboard('{Enter}')
    const drawer = await screen.findByRole('dialog', { name: 'Property SaaS navigation' })
    await expectAccessible(drawer)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('audits the open confirmation dialog and keeps tab focus inside it', async ({
    onTestFinished,
  }) => {
    // Base UI checks element geometry to identify focusable controls.
    const rects = vi
      .spyOn(HTMLElement.prototype, 'getClientRects')
      .mockReturnValue([new DOMRect(0, 0, 100, 44)] as unknown as DOMRectList)
    onTestFinished(() => rects.mockRestore())
    const user = userEvent.setup()
    render(
      <NotificationProvider>
        <SharedControls />
      </NotificationProvider>,
    )
    const trigger = screen.getByRole('button', { name: 'Review action' })
    await user.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: 'Confirm action' })
    await expectAccessible(dialog)
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' })
    const confirm = within(dialog).getByRole('button', { name: 'Confirm' })
    await waitFor(() => expect(cancel).toHaveFocus())
    await user.tab({ shift: true })
    await waitFor(() => expect(confirm).toHaveFocus())
    await user.tab()
    await waitFor(() => expect(cancel).toHaveFocus())
    await user.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})

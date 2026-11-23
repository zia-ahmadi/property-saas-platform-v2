import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import { TeamPage } from './TeamPage'

const mocks = vi.hoisted(() => ({ request: vi.fn(), organizationId: 'org-1' }))

vi.mock('@/features/organization/context', () => ({
  useOrganization: () => ({
    current: { organizationId: mocks.organizationId },
    queryKey: (key: unknown[]) => ['organization', mocks.organizationId, ...key],
    request: mocks.request,
  }),
}))

const team = {
  members: [
    {
      id: 'owner-1',
      email: 'owner@example.test',
      first_name: 'Olive',
      last_name: 'Owner',
      role: 'owner',
      status: 'active',
    },
    {
      id: 'staff-1',
      email: 'staff@example.test',
      first_name: 'Sam',
      last_name: 'Staff',
      role: 'staff',
      status: 'active',
    },
  ],
  invitations: [
    {
      id: 'invite-1',
      email: 'new@example.test',
      role: 'manager',
      expires_at: '2026-12-01T10:00:00Z',
    },
  ],
}

function show() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <TeamPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mocks.organizationId = 'org-1'
  mocks.request.mockReset()
  mocks.request.mockImplementation(async (method: string, path: string) => {
    if (method === 'get' && path === 'team') return team
    if (method === 'post' && path === 'invitations') return { token: 'safe-test-token' }
    return undefined
  })
})

it('shows members, roles, active counts, and pending invitations', async () => {
  show()
  expect(await screen.findByRole('heading', { name: 'Your team' })).toBeInTheDocument()
  expect(await screen.findByText('owner@example.test')).toBeInTheDocument()
  expect(screen.getByText('Active members').closest('[data-slot="card"]')).toHaveTextContent('2')
  expect(
    screen.getByRole('heading', { name: 'Pending invitations' }).closest('[data-slot="card"]'),
  ).toHaveTextContent('1')
  expect(screen.queryByText('No pending invitations.')).not.toBeInTheDocument()
  expect(screen.getByText('new@example.test')).toBeInTheDocument()
  expect(screen.queryByRole('combobox', { name: 'Role for owner@example.test' })).not.toBeInTheDocument()
})

it('filters members and updates a member role', async () => {
  const user = userEvent.setup()
  show()
  const role = await screen.findByRole('combobox', { name: 'Role for staff@example.test' })
  await user.selectOptions(role, 'MANAGER')
  await waitFor(() =>
    expect(mocks.request).toHaveBeenCalledWith('patch', 'members/staff-1', {
      role: 'MANAGER',
    }),
  )
  await user.type(screen.getByRole('searchbox', { name: 'Search team members' }), 'Olive')
  expect(screen.getByText('owner@example.test')).toBeInTheDocument()
  expect(screen.queryByText('staff@example.test')).not.toBeInTheDocument()
})

it('creates an invitation and exposes a copyable, private link', async () => {
  const user = userEvent.setup()
  show()
  await user.type(await screen.findByLabelText('Email address'), 'teammate@example.test')
  await user.selectOptions(screen.getByLabelText('Invitation role'), 'ADMIN')
  await user.click(screen.getByRole('button', { name: 'Create invitation' }))
  const link = await screen.findByLabelText('Invitation link')
  expect(link).toHaveValue(`${window.location.origin}/invite#safe-test-token`)
  expect(screen.getByRole('status')).toHaveTextContent('Invitation created')
  expect(mocks.request).toHaveBeenCalledWith('post', 'invitations', {
    email: 'teammate@example.test',
    role: 'ADMIN',
  })
})

it('confirms before revoking a member and shows safe errors', async () => {
  const user = userEvent.setup()
  show()
  const remove = await screen.findByRole('button', { name: 'Remove' })
  await user.click(remove)
  const dialog = await screen.findByRole('dialog', { name: 'Remove team member?' })
  expect(within(dialog).getByText(/suspend staff@example.test/)).toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: 'Remove access' }))
  await waitFor(() =>
    expect(mocks.request).toHaveBeenCalledWith('delete', 'members/staff-1'),
  )
})

it('shows safe team request errors', async () => {
  mocks.request.mockRejectedValueOnce(
    new ApiError({ status: 500, message: 'private SQL detail' }),
  )
  show()
  expect(await screen.findByText('Unable to load the team. Please try again.')).toBeInTheDocument()
  expect(screen.queryByText('private SQL detail')).not.toBeInTheDocument()
})

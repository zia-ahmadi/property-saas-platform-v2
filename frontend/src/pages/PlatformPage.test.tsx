import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, it, vi } from 'vitest'
import { AuthContext } from '@/features/auth/context'
import { PlatformPage } from './PlatformPage'
import type { AuthLifecycleService } from '@/features/auth/lifecycle'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://api.example.test' }))

it('shows organization context and lets the platform owner reply to a support message', async () => {
  const messages = [{
    id: 'message-1',
    body: 'Please help with our workspace',
    direction: 'organization_to_platform',
    created_at: '2026-01-02T03:04:00Z',
    platform_read_at: null,
    read_at: null,
  }]
  const organization = {
    id: 'org-1',
    name: 'Northstar Living',
    slug: 'northstar',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    owner_first_name: 'Emma',
    owner_last_name: 'Wilson',
    owner_email: 'emma@example.test',
    member_count: 12,
    property_count: 4,
    unread_message_count: 1,
  }
  const request = vi.fn(async (method: string, path: string, body?: { body: string }) => {
    if (path === 'api/v1/platform/organizations') return { content: [organization], total: 1, page: 0, size: 20 }
    if (path === 'api/v1/platform/summary') return { total_organizations: 1, active_organizations: 1, pending_organizations: 0, restricted_organizations: 0, unread_messages: messages.filter(item => !item.platform_read_at).length }
    if (path === 'api/v1/platform/organizations/org-1') return organization
    if (path === 'api/v1/platform/organizations/org-1/audit') return []
    if (path === 'api/v1/platform/organizations/org-1/messages' && method === 'get') return messages
    if (path === 'api/v1/platform/organizations/org-1/messages' && method === 'post') {
      messages.push({ ...messages[0], id: 'message-2', body: body?.body ?? '', direction: 'platform_to_organization', platform_read_at: null })
      return { id: 'message-2' }
    }
    return undefined
  })
  const service = { request, signOut: vi.fn() } as unknown as AuthLifecycleService
  render(
    <AuthContext.Provider value={{ state: { status: 'authenticated', session: { user: { id: 'platform', email: 'owner@example.test', firstName: 'Alex', lastName: 'Morgan' }, organizations: [] } }, service }}>
      <MemoryRouter><PlatformPage /></MemoryRouter>
    </AuthContext.Provider>,
  )

  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: /Unread support/ }))
  await waitFor(() => expect(request).toHaveBeenCalledWith('get', 'api/v1/platform/organizations', undefined, { params: { search: '', status: '', unreadOnly: true, page: 0 } }))
  await user.click(await screen.findByRole('button', { name: 'Northstar Living' }))
  const details = screen.getByRole('complementary', { name: 'Organization details and support' })
  expect(within(details).getByText('Emma Wilson')).toBeVisible()
  expect(within(details).getByText('4')).toBeVisible()
  expect(within(details).getByText('Please help with our workspace')).toBeVisible()

  await user.type(within(details).getByLabelText('Private message'), 'We are looking into this.')
  await user.click(within(details).getByRole('button', { name: 'Send message' }))
  expect(await within(details).findByText('We are looking into this.')).toBeVisible()
  expect(request).toHaveBeenCalledWith('post', 'api/v1/platform/organizations/org-1/messages', { body: 'We are looking into this.' })
})

it('keeps the directory visible and explains when the summary endpoint is unavailable', async () => {
  const request = vi.fn(async (_method: string, path: string) => {
    if (path === 'api/v1/platform/organizations') return { content: [], total: 0, page: 0, size: 20 }
    throw new ApiError({ message: 'Not found', status: 404 })
  })
  const service = { request, signOut: vi.fn() } as unknown as AuthLifecycleService
  render(
    <AuthContext.Provider value={{ state: { status: 'authenticated', session: { user: { id: 'platform', email: 'owner@example.test', firstName: 'Alex', lastName: 'Morgan' }, organizations: [] } }, service }}>
      <MemoryRouter><PlatformPage /></MemoryRouter>
    </AuthContext.Provider>,
  )

  expect(await screen.findByText('No organizations found')).toBeVisible()
  expect(screen.getByRole('status')).toHaveTextContent('The backend does not provide platform summary yet')
})

it('lets the platform owner reinstate a banned organization after confirming its data is preserved', async () => {
  const organization = {
    id: 'org-banned',
    name: 'Banned Organization',
    slug: 'banned-organization',
    status: 'banned',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    owner_first_name: 'Owner',
    owner_last_name: 'One',
    owner_email: 'owner@example.test',
    member_count: 1,
    property_count: 2,
    unread_message_count: 0,
  }
  const request = vi.fn(async (method: string, path: string, body?: { action: string }) => {
    if (path === 'api/v1/platform/organizations') return { content: [organization], total: 1, page: 0, size: 20 }
    if (path === 'api/v1/platform/summary') return { total_organizations: 1, active_organizations: 0, pending_organizations: 0, restricted_organizations: 1, unread_messages: 0 }
    if (path === 'api/v1/platform/organizations/org-banned') return organization
    if (path.endsWith('/audit')) return []
    if (path.endsWith('/messages')) return []
    if (path.endsWith('/decisions') && method === 'post') return { status: body?.action === 'reinstate' ? 'active' : 'banned' }
    return undefined
  })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  const service = { request, signOut: vi.fn() } as unknown as AuthLifecycleService
  render(
    <AuthContext.Provider value={{ state: { status: 'authenticated', session: { user: { id: 'platform', email: 'owner@example.test', firstName: 'Alex', lastName: 'Morgan' }, organizations: [] } }, service }}>
      <MemoryRouter><PlatformPage /></MemoryRouter>
    </AuthContext.Provider>,
  )

  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Banned Organization' }))
  const details = screen.getByRole('complementary', { name: 'Organization details and support' })
  expect(within(details).getByText(/existing properties, units, memberships, and records are retained/i)).toBeVisible()
  await user.click(within(details).getByRole('button', { name: 'reinstate' }))

  expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Existing organization data will be preserved.'))
  expect(request).toHaveBeenCalledWith('post', 'api/v1/platform/organizations/org-banned/decisions', { action: 'reinstate', reason: '' })
  expect(await screen.findByRole('status')).toHaveTextContent('Organization status updated.')
  confirm.mockRestore()
})

it('refreshes the selected support thread automatically while the page is visible', async () => {
  vi.useFakeTimers()
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  const organization = {
    id: 'org-poll', name: 'Polling Org', slug: 'polling-org', status: 'active',
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    owner_first_name: 'Owner', owner_last_name: 'One', owner_email: 'owner@example.test',
    member_count: 1, property_count: 1, unread_message_count: 0,
  }
  const request = vi.fn(async (_method: string, path: string) => {
    if (path === 'api/v1/platform/organizations') return { content: [organization], total: 1, page: 0, size: 20 }
    if (path === 'api/v1/platform/summary') return { total_organizations: 1, active_organizations: 1, pending_organizations: 0, restricted_organizations: 0, unread_messages: 0 }
    if (path === 'api/v1/platform/organizations/org-poll') return organization
    if (path.endsWith('/audit')) return []
    if (path.endsWith('/messages')) return []
    return undefined
  })
  const service = { request, signOut: vi.fn() } as unknown as AuthLifecycleService
  render(
    <AuthContext.Provider value={{ state: { status: 'authenticated', session: { user: { id: 'platform', email: 'owner@example.test', firstName: 'Alex', lastName: 'Morgan' }, organizations: [] } }, service }}>
      <MemoryRouter><PlatformPage /></MemoryRouter>
    </AuthContext.Provider>,
  )

  try {
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    fireEvent.click(screen.getByRole('button', { name: 'Polling Org' }))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    const messagePath = 'api/v1/platform/organizations/org-poll/messages'
    expect(request.mock.calls.filter(([, path]) => path === messagePath)).toHaveLength(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000) })
    expect(request.mock.calls.filter(([, path]) => path === messagePath)).toHaveLength(2)
  } finally {
    vi.useRealTimers()
  }
})

import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, it, vi } from 'vitest'
import { AuthContext } from '@/features/auth/context'
import type { AuthLifecycleService } from '@/features/auth/lifecycle'
import { OrganizationContext, type OrganizationContextValue } from '@/features/organization/context'
import { InboxPage } from './InboxPage'

vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://api.example.test' }))

it('shows platform replies automatically without reloading the organization inbox', async () => {
  vi.useFakeTimers()
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  let messages: Array<{ id: string; body: string; created_at: string; direction: string; read_at: string | null; platform_read_at: string | null }> = []
  const service = {
    request: vi.fn(async () => messages),
    signOut: vi.fn(),
  } as unknown as AuthLifecycleService
  const organization = {
    current: { organizationId: 'org-1', organizationName: 'Northstar', organizationSlug: 'northstar', role: 'OWNER' },
    organizations: [],
    forbidden: false,
    can: () => true,
    select: vi.fn(),
    request: vi.fn(),
    queryKey: () => ['org'],
  } as unknown as OrganizationContextValue
  render(
    <AuthContext.Provider value={{ state: { status: 'authenticated', session: { user: { id: 'owner', email: 'owner@example.test', firstName: 'Org', lastName: 'Owner' }, organizations: [] } }, service }}>
      <OrganizationContext.Provider value={organization}>
        <MemoryRouter initialEntries={['/inbox']}>
          <Routes><Route path="/inbox" element={<InboxPage />} /></Routes>
        </MemoryRouter>
      </OrganizationContext.Provider>
    </AuthContext.Provider>,
  )

  try {
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByText('No messages yet.')).toBeVisible()
    messages = [{
      id: 'reply-1',
      body: 'We are looking into your request.',
      created_at: '2026-01-02T03:04:00Z',
      direction: 'platform_to_organization',
      read_at: null,
      platform_read_at: null,
    }]
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000) })
    expect(screen.getByText('We are looking into your request.')).toBeVisible()
  } finally {
    vi.useRealTimers()
  }
})

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrganizationProvider } from './OrganizationProvider'
import { useOrganization } from './context'
import { hasPermission } from './permissions'
import { ApiError } from '@/lib/api/errors'
import { useState } from 'react'

const mocks = vi.hoisted(() => ({ auth: { state: { status: 'authenticated', session: { user: { id: 'user' }, organizations: [ { organizationId: 'one', organizationName: 'First', organizationSlug: 'first', role: 'OWNER' }, { organizationId: 'two', organizationName: 'Second', organizationSlug: 'second', role: 'STAFF' } ] } }, service: { subscribe: vi.fn(() => () => {}), request: vi.fn(), getSnapshot: vi.fn() } } }))
vi.mock('@/features/auth/context', () => ({ useAuth: () => mocks.auth }))
vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://api.example.test' }))
mocks.auth.service.getSnapshot.mockImplementation(() => mocks.auth.state)
function Consumer() {
  const org = useOrganization()
  const [result, setResult] = useState('')
  return <><span>{org.current?.organizationName ?? 'No organization'}</span><span>{org.can('PROPERTY_MANAGE') ? 'Can manage' : 'Read only'}</span><span>{org.forbidden ? 'Forbidden' : ''}</span><button onClick={() => org.select('two')}>Switch</button><button onClick={() => void org.request('get', '').then(() => setResult('Received data')).catch(() => setResult('Request rejected'))}>Request</button><span>{org.queryKey(['items']).join(':')}</span><span>{result}</span></>
}
afterEach(() => sessionStorage.clear())

describe('organization context', () => {
  it('uses selected membership and its role for permissions and query keys', async () => {
    render(<OrganizationProvider><Consumer /></OrganizationProvider>); expect(screen.getByText('First')).toBeInTheDocument(); expect(screen.getByText('Can manage')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Switch')); expect(screen.getByText('Second')).toBeInTheDocument(); expect(screen.getByText('Read only')).toBeInTheDocument(); expect(screen.getByText('organization:user:two:STAFF:items')).toBeInTheDocument()
  })
  it('treats a 403 as forbidden without requesting refresh', async () => {
    mocks.auth.service.request.mockRejectedValueOnce(new ApiError({ status: 403, message: 'denied' }))
    render(<OrganizationProvider><Consumer /></OrganizationProvider>); await userEvent.click(screen.getByText('Request')); await waitFor(() => expect(screen.getByText('Forbidden')).toBeInTheDocument())
  })
  it('rejects a late result after an organization switch', async () => {
    let finish!: (value: unknown) => void
    mocks.auth.service.request.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    render(<OrganizationProvider><Consumer /></OrganizationProvider>)
    await userEvent.click(screen.getByText('Request')); await userEvent.click(screen.getByText('Switch')); finish({})
    await waitFor(() => expect(screen.getByText('Request rejected')).toBeInTheDocument())
    expect(screen.queryByText('Received data')).not.toBeInTheDocument()
  })
  it('shows no selection when there are no active memberships', () => {
    const organizations = mocks.auth.state.session.organizations.splice(0)
    try { render(<OrganizationProvider><Consumer /></OrganizationProvider>); expect(screen.getByText('No organization')).toBeInTheDocument(); expect(screen.getByText('Read only')).toBeInTheDocument() }
    finally { mocks.auth.state.session.organizations.push(...organizations) }
  })
  it('rejects a stale callback before it can send a request for the old organization', async () => {
    mocks.auth.service.request.mockClear()
    function StaleCallback() {
      const org = useOrganization()
      const [oldRequest] = useState(() => org.request)
      const [result, setResult] = useState('')
      return <><button onClick={() => org.select('two')}>Switch</button><button onClick={() => { void oldRequest('get', '').catch(() => setResult('Rejected')) }}>Use old callback</button><span>{result}</span></>
    }
    render(<OrganizationProvider><StaleCallback /></OrganizationProvider>)
    await userEvent.click(screen.getByText('Switch'))
    await userEvent.click(screen.getByText('Use old callback'))
    expect(await screen.findByText('Rejected')).toBeInTheDocument()
    expect(mocks.auth.service.request).not.toHaveBeenCalled()
  })
  it('matches the backend roles and fails closed on missing roles', () => {
    expect(hasPermission('OWNER', 'BILLING_MANAGE')).toBe(true); expect(hasPermission('ADMIN', 'MEMBERSHIP_MANAGE')).toBe(true); expect(hasPermission('MANAGER', 'BILLING_MANAGE')).toBe(false); expect(hasPermission('STAFF', 'PROPERTY_MANAGE')).toBe(false); expect(hasPermission(undefined, 'PROPERTY_VIEW')).toBe(false)
  })
})

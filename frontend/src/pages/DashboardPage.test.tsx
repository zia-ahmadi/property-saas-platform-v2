import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import axe from 'axe-core'
import { DashboardPage } from './DashboardPage'
import { PropertiesPage } from './PropertiesPage'
import { dashboardSummary } from '@/features/dashboard/api'
import { ApiError } from '@/lib/api/errors'
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  view: true,
  manage: true,
  forbidden: false,
  orgId: 'one',
  identity: 'user',
}))
vi.mock('@/features/organization/context', () => ({
  useOrganization: () => ({
    current: { organizationId: mocks.orgId, organizationName: 'Portfolio One' },
    forbidden: mocks.forbidden,
    can: (permission: string) => (permission === 'PROPERTY_VIEW' ? mocks.view : mocks.manage),
    queryKey: (keys: unknown[]) => ['organization', mocks.identity, mocks.orgId, ...keys],
    request: mocks.request,
  }),
}))
const summary = {
  totalProperties: 13,
  activeProperties: 10,
  archivedProperties: 3,
  totalUnits: 117,
  availableUnits: 50,
  unavailableUnits: 7,
  occupiedUnits: 60,
}
const zero = {
  totalProperties: 0,
  activeProperties: 0,
  archivedProperties: 0,
  totalUnits: 0,
  availableUnits: 0,
  unavailableUnits: 0,
  occupiedUnits: 0,
}
function show(children = <DashboardPage />) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <main>
          <h1>Dashboard</h1>
          <Routes>
            <Route path="/dashboard" element={children} />
            <Route path="/properties" element={<PropertiesPage />} />
            <Route path="/properties/new" element={<h2>Add property</h2>} />
          </Routes>
        </main>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...result, client }
}
beforeEach(() => {
  mocks.request.mockReset()
  mocks.request.mockResolvedValue(summary)
  mocks.view = true
  mocks.manage = true
  mocks.forbidden = false
  mocks.orgId = 'one'
  mocks.identity = 'user'
})
it('renders accurate backend counts and accessible availability counts', async () => {
  show()
  for (const [name, count] of [
    ['Total properties', 13],
    ['Active properties', 10],
    ['Archived properties', 3],
    ['Total units', 117],
    ['Available units', 50],
    ['Unavailable units', 7],
    ['Occupied units', 60],
  ])
    expect(await screen.findByLabelText(`${name}: ${count}`)).toHaveTextContent(String(count))
  expect(screen.getByRole('list', { name: 'Unit availability counts' })).toHaveTextContent(
    'AVAILABLE: 50UNAVAILABLE: 7OCCUPIED: 60',
  )
  expect(screen.getByText(/Counts include archived properties/)).toBeInTheDocument()
  expect(screen.queryByText('Monthly Revenue')).not.toBeInTheDocument()
  expect(screen.queryByText('Active Leases')).not.toBeInTheDocument()
  expect(mocks.request).toHaveBeenCalledTimes(1)
  expect(mocks.request).toHaveBeenCalledWith(
    'get',
    'dashboard/summary',
    undefined,
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  )
})
it('shows skeletons until counts arrive', async () => {
  let finish!: (value: unknown) => void
  mocks.request.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  const { container } = show()
  expect(screen.getByRole('status')).toHaveTextContent('Loading portfolio summary')
  expect(container.querySelectorAll('[data-slot=skeleton]')).toHaveLength(7)
  expect(screen.queryByRole('definition')).not.toBeInTheDocument()
  await act(async () => finish(zero))
  await screen.findByText('Your portfolio is empty')
})
it('handles an empty portfolio without a chart or division by zero', async () => {
  mocks.request.mockResolvedValue(zero)
  const { container } = show()
  await screen.findByText('Your portfolio is empty')
  expect(screen.getByText(/No units yet/)).toBeInTheDocument()
  expect(screen.queryByRole('list', { name: 'Unit availability counts' })).not.toBeInTheDocument()
  expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
})
it('shows read-only quick navigation for STAFF', async () => {
  mocks.manage = false
  mocks.request.mockResolvedValue(zero)
  show()
  await screen.findByText('Your portfolio is empty')
  expect(screen.queryByRole('link', { name: 'Add property' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'View Properties' })).toHaveAttribute(
    'href',
    '/properties',
  )
  expect(screen.getByText(/A property manager can add them/)).toBeInTheDocument()
})
it('does not request or reveal widgets without viewing permission', () => {
  mocks.view = false
  show()
  expect(screen.getByRole('status')).toHaveTextContent('property viewing permission')
  expect(mocks.request).not.toHaveBeenCalled()
  expect(screen.queryByRole('link', { name: 'View Properties' })).not.toBeInTheDocument()
})
it.each([401, 403, 404, 500])('handles HTTP %i without exposing server details', async (status) => {
  mocks.request.mockRejectedValue(new ApiError({ status, message: 'private SQL detail' }))
  show()
  await screen.findByText('Dashboard unavailable')
  expect(screen.queryByText('private SQL detail')).not.toBeInTheDocument()
  expect(screen.queryByRole('definition')).not.toBeInTheDocument()
})
it('retries a network failure and refreshes the aggregate only', async () => {
  mocks.request
    .mockRejectedValueOnce(new ApiError({ status: 0, message: 'private', isNetworkError: true }))
    .mockResolvedValue(summary)
  show()
  await screen.findByText(/Unable to reach the server/)
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByLabelText('Total units: 117')
  await userEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }))
  await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(3))
  expect(mocks.request.mock.calls.every((call) => call[1] === 'dashboard/summary')).toBe(true)
})
it('hides cached statistics when permission is revoked', async () => {
  function Revoker() {
    const [, update] = useState(0)
    return (
      <>
        <button
          onClick={() => {
            mocks.forbidden = true
            update((n) => n + 1)
          }}
        >
          Revoke
        </button>
        <DashboardPage />
      </>
    )
  }
  show(<Revoker />)
  await screen.findByLabelText('Total units: 117')
  await userEvent.click(screen.getByRole('button', { name: 'Revoke' }))
  expect(screen.queryByLabelText('Total units: 117')).not.toBeInTheDocument()
})
it('does not display late data after switching organizations or identities', async () => {
  let finish!: (value: unknown) => void
  const late = new Promise((resolve) => {
    finish = resolve
  })
  mocks.request.mockImplementation(() => (mocks.orgId === 'one' ? late : Promise.resolve(zero)))
  function Switcher() {
    const [, update] = useState(0)
    return (
      <>
        <button
          onClick={() => {
            mocks.orgId = 'two'
            mocks.identity = 'other-user'
            update((n) => n + 1)
          }}
        >
          Switch
        </button>
        <DashboardPage />
      </>
    )
  }
  const { client } = show(<Switcher />)
  await userEvent.click(screen.getByRole('button', { name: 'Switch' }))
  await screen.findByLabelText('Total properties: 0')
  await act(async () => finish(summary))
  expect(screen.queryByLabelText('Total properties: 13')).not.toBeInTheDocument()
  expect(
    client.getQueryData(['organization', 'other-user', 'two', 'dashboard', 'summary']),
  ).toEqual(zero)
})
it('navigates to the property portfolio', async () => {
  mocks.request.mockImplementation(async (_m, path) =>
    path === 'dashboard/summary'
      ? summary
      : { content: [], page: 0, totalPages: 0, totalElements: 0 },
  )
  show()
  await screen.findByLabelText('Total units: 117')
  await userEvent.click(screen.getByRole('link', { name: 'View Properties' }))
  expect(await screen.findByRole('heading', { name: 'Properties' })).toBeInTheDocument()
})
it('provides semantic, accessible content and a responsive card grid', async () => {
  const { container } = show()
  await screen.findByLabelText('Total units: 117')
  const { violations } = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  })
  expect(violations.map((v) => v.id)).toEqual([])
  expect(screen.getByLabelText('Portfolio totals')).toHaveClass('sm:grid-cols-2', 'xl:grid-cols-4')
})
it('rejects malformed and non-reconciling summaries', () => {
  expect(() => dashboardSummary({ ...summary, totalUnits: 118 })).toThrow()
  expect(() => dashboardSummary({ ...summary, activeProperties: -1 })).toThrow()
  expect(() => dashboardSummary({ ...summary, totalProperties: NaN })).toThrow()
})

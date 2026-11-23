import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { UnitsPage } from '@/pages/UnitsPage'
import { UnitForm } from './UnitForm'
import { UnitStatus } from './UnitStatus'
import { emptyUnit, manualTarget } from './api'
import { unitError } from './errors'
import { ApiError } from '@/lib/api/errors'
const mocks = vi.hoisted(() => ({ request: vi.fn(), manage: true, orgId: 'org' }))
vi.mock('@/features/organization/context', () => ({
  useOrganization: () => ({
    can: () => mocks.manage,
    request: mocks.request,
    queryKey: (key: unknown[]) => ['organization', mocks.orgId, ...key],
  }),
}))
const property = { id: 'p', name: 'Parent property', status: 'ACTIVE' }
const unit = {
  id: 'u',
  propertyId: 'p',
  unitNumber: 'A-101',
  unitType: 'OFFICE',
  floorNumber: 1,
  areaSqm: 35.5,
  availabilityStatus: 'AVAILABLE',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-02',
}
const paged = (page = 0) => ({ content: [unit], page, size: 10, totalElements: 11, totalPages: 2 })
function show(path = '/properties/p/units', child?: React.ReactNode) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/properties/:propertyId/units" element={child ?? <UnitsPage />} />
          <Route path="/properties/:propertyId/units/new" element={<UnitsPage mode="create" />} />
          <Route
            path="/properties/:propertyId/units/:unitId"
            element={<UnitsPage mode="details" />}
          />
          <Route
            path="/properties/:propertyId/units/:unitId/edit"
            element={<UnitsPage mode="edit" />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
beforeEach(() => {
  mocks.manage = true
  mocks.orgId = 'org'
  mocks.request.mockReset()
  mocks.request.mockImplementation(async (_method, path, _body, options) =>
    path === 'properties/p'
      ? property
      : path === 'properties/p/units'
        ? paged(options?.params?.page)
        : unit,
  )
})
it('lists units and requests server pages', async () => {
  show()
  expect(await screen.findByRole('link', { name: 'A-101' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
  expect(await screen.findByText('Page 2 of 2 · 11 units')).toBeInTheDocument()
  expect(mocks.request).toHaveBeenCalledWith(
    'get',
    'properties/p/units',
    undefined,
    expect.objectContaining({ params: { page: 1, size: 10 } }),
  )
  await userEvent.selectOptions(screen.getByLabelText('Page size'), '25')
  await waitFor(() =>
    expect(mocks.request).toHaveBeenCalledWith(
      'get',
      'properties/p/units',
      undefined,
      expect.objectContaining({ params: { page: 0, size: 25 } }),
    ),
  )
})
it('recovers when the final page becomes empty', async () => {
  show()
  await userEvent.click(await screen.findByRole('button', { name: 'Next page' }))
  await screen.findByText('Page 2 of 2 · 11 units')
  mocks.request.mockImplementation(async (_m, path, _b, options) =>
    path === 'properties/p'
      ? property
      : {
          ...paged(options.params.page),
          content: options.params.page ? [] : [unit],
          totalPages: 1,
          totalElements: 1,
        },
  )
  await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  expect(await screen.findByText('Page 1 of 1 · 1 unit')).toBeInTheDocument()
})
it('creates only allowed DTO fields', async () => {
  const invalidation = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
  show('/properties/p/units/new')
  await userEvent.type(await screen.findByLabelText('Unit number *'), ' A-102 ')
  await userEvent.click(screen.getByRole('button', { name: 'Save unit' }))
  await waitFor(() =>
    expect(mocks.request).toHaveBeenCalledWith('post', 'properties/p/units', {
      ...emptyUnit,
      unitNumber: 'A-102',
    }),
  )
  expect(await screen.findByRole('heading', { name: 'Unit details' })).toBeInTheDocument()
  expect(invalidation).toHaveBeenCalledWith({ queryKey: ['organization', 'org', 'dashboard'] })
})
it('edits attributes without sending availability or IDs', async () => {
  show('/properties/p/units/u/edit')
  const number = await screen.findByLabelText('Unit number *')
  expect(number).toHaveValue('A-101')
  await userEvent.clear(number)
  await userEvent.type(number, 'new')
  await userEvent.click(screen.getByRole('button', { name: 'Save unit' }))
  await waitFor(() =>
    expect(mocks.request).toHaveBeenCalledWith('patch', 'properties/p/units/u', {
      unitNumber: 'new',
      unitType: 'OFFICE',
      floorNumber: 1,
      areaSqm: 35.5,
    }),
  )
})
it.each(['AVAILABLE', 'UNAVAILABLE'])('confirms transition from %s', async (status) => {
  const invalidation = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
  let current = status
  mocks.request.mockImplementation(async (method, path, body) => {
    if (path === 'properties/p') return property
    if (method === 'patch') current = body.availabilityStatus
    return { ...unit, availabilityStatus: current }
  })
  show('/properties/p/units/u')
  const target = manualTarget(status)!
  await userEvent.click(await screen.findByRole('button', { name: `Mark ${target}` }))
  expect(mocks.request.mock.calls.some((call) => call[0] === 'patch')).toBe(false)
  await userEvent.click(screen.getByRole('button', { name: 'Change availability' }))
  expect(await screen.findByText(`Availability: ${target}`)).toBeInTheDocument()
  expect(invalidation).toHaveBeenCalledWith({ queryKey: ['organization', 'org', 'dashboard'] })
})
it('prevents all manual occupancy transitions', async () => {
  mocks.request.mockImplementation(async (_m, path) =>
    path === 'properties/p' ? property : { ...unit, availabilityStatus: 'OCCUPIED' },
  )
  show('/properties/p/units/u')
  await screen.findByText('Availability: OCCUPIED')
  expect(screen.queryByRole('button', { name: /Mark/ })).not.toBeInTheDocument()
  expect(manualTarget('OCCUPIED')).toBeUndefined()
  expect(manualTarget('UNKNOWN')).toBeUndefined()
})
it.each(['list', 'create', 'details', 'edit'])('blocks archived %s mutations', async (mode) => {
  mocks.request.mockImplementation(async (_m, path) =>
    path === 'properties/p'
      ? { ...property, status: 'ARCHIVED' }
      : path.endsWith('/units')
        ? paged()
        : unit,
  )
  show(
    mode === 'list'
      ? '/properties/p/units'
      : mode === 'create'
        ? '/properties/p/units/new'
        : `/properties/p/units/u${mode === 'edit' ? '/edit' : ''}`,
  )
  await screen.findByText(/This property is archived/)
  expect(screen.queryByRole('button', { name: /Save unit|Mark/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Create unit|Edit unit/ })).not.toBeInTheDocument()
})
it('rechecks archive state before writing', async () => {
  show('/properties/p/units/new')
  await userEvent.type(await screen.findByLabelText('Unit number *'), 'new')
  mocks.request.mockResolvedValue({ ...property, status: 'ARCHIVED' })
  await userEvent.click(screen.getByRole('button', { name: 'Save unit' }))
  await screen.findByText(/This property is archived/)
  expect(mocks.request.mock.calls.some((call) => call[0] === 'post')).toBe(false)
})
it('hides direct form controls for read-only roles', async () => {
  mocks.manage = false
  show('/properties/p/units/new')
  await screen.findByText(/Read-only access/)
  expect(screen.queryByRole('button', { name: 'Save unit' })).not.toBeInTheDocument()
})
it('handles duplicate unit conflict', async () => {
  mocks.request.mockImplementation(async (method) => {
    if (method === 'post') throw new ApiError({ status: 409, message: 'private' })
    return property
  })
  show('/properties/p/units/new')
  await userEvent.type(await screen.findByLabelText('Unit number *'), 'duplicate')
  await userEvent.click(screen.getByRole('button', { name: 'Save unit' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('unit number may already exist')
})
it('rejects stale organization list responses', async () => {
  let finish!: (value: unknown) => void
  const late = new Promise((resolve) => {
    finish = resolve
  })
  mocks.request.mockImplementation(async (_m, path) =>
    path === 'properties/p'
      ? property
      : mocks.orgId === 'org'
        ? late
        : { ...paged(), content: [{ ...unit, unitNumber: 'Other tenant unit' }] },
  )
  function Switcher() {
    const [, update] = useState(0)
    return (
      <>
        <button
          onClick={() => {
            mocks.orgId = 'other'
            update((n) => n + 1)
          }}
        >
          Switch
        </button>
        <UnitsPage />
      </>
    )
  }
  show('/properties/p/units', <Switcher />)
  await waitFor(() =>
    expect(mocks.request).toHaveBeenCalledWith(
      'get',
      'properties/p/units',
      undefined,
      expect.anything(),
    ),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Switch' }))
  await screen.findByRole('link', { name: 'Other tenant unit' })
  finish(paged())
  await waitFor(() => expect(screen.queryByText('A-101')).not.toBeInTheDocument())
})
it.each([400, 401, 403, 404, 409])('renders safe HTTP %i errors', async (status) => {
  mocks.request.mockRejectedValue(new ApiError({ status, message: 'private' }))
  show()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    unitError(new ApiError({ status, message: '' })),
  )
})
it('validates area precision and floor overflow', async () => {
  const save = vi.fn()
  render(<UnitForm initial={{ ...emptyUnit, unitNumber: 'a' }} saving={false} onSave={save} />)
  await userEvent.type(screen.getByLabelText('Area in m² (optional)'), '0.001')
  await userEvent.click(screen.getByRole('button', { name: 'Save unit' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Area must')
  await userEvent.type(screen.getByLabelText('Floor (optional)'), '2147483648')
  await userEvent.click(screen.getByRole('button', { name: 'Save unit' }))
  expect(screen.getByRole('alert')).toHaveTextContent('32-bit integer')
  expect(save).not.toHaveBeenCalled()
})
it.each(['AVAILABLE', 'UNAVAILABLE', 'OCCUPIED', 'UNKNOWN'])('labels %s', (status) => {
  render(<UnitStatus status={status} />)
  expect(
    screen.getByText(status === 'UNKNOWN' ? /Unknown/ : `Availability: ${status}`),
  ).toBeInTheDocument()
})
it('explains network failure', () => {
  expect(unitError(new ApiError({ status: 0, message: '', isNetworkError: true }))).toContain(
    'reach the server',
  )
})
it('shows loading, empty and network failure states', async () => {
  let finish!: (value: unknown) => void
  mocks.request.mockImplementation((_m, path) =>
    path === 'properties/p'
      ? Promise.resolve(property)
      : new Promise((resolve) => {
          finish = resolve
        }),
  )
  show()
  await screen.findByText('Loading units…')
  finish({ ...paged(), content: [], totalElements: 0, totalPages: 0 })
  await screen.findByRole('heading', { name: 'No units yet' })
  mocks.request.mockRejectedValue(
    new ApiError({ status: 0, message: 'private', isNetworkError: true }),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('reach the server')
})
it('does not navigate after a pending mutation from an old organization completes', async () => {
  let finish!: (value: unknown) => void
  mocks.request.mockImplementation((method, path) =>
    method === 'post'
      ? new Promise((resolve) => {
          finish = resolve
        })
      : Promise.resolve(path === 'properties/p' ? property : unit),
  )
  function Switcher() {
    const [, update] = useState(0)
    return (
      <>
        <button
          onClick={() => {
            mocks.orgId = 'other'
            update((n) => n + 1)
          }}
        >
          Switch
        </button>
        <UnitsPage mode="create" />
      </>
    )
  }
  show('/properties/p/units', <Switcher />)
  await userEvent.type(await screen.findByLabelText('Unit number *'), 'old draft')
  await userEvent.click(screen.getByRole('button', { name: 'Save unit' }))
  await waitFor(() =>
    expect(mocks.request.mock.calls.some((call) => call[0] === 'post')).toBe(true),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Switch' }))
  expect(await screen.findByLabelText('Unit number *')).toHaveValue('')
  finish(unit)
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: 'Create unit' })).toBeInTheDocument(),
  )
  expect(screen.queryByText('Unit saved successfully.')).not.toBeInTheDocument()
})
it('handles availability conflicts and refreshes server state', async () => {
  let occupied = false
  mocks.request.mockImplementation(async (method, path) => {
    if (path === 'properties/p') return property
    if (method === 'patch') {
      occupied = true
      throw new ApiError({ status: 409, message: 'private' })
    }
    return { ...unit, availabilityStatus: occupied ? 'OCCUPIED' : 'AVAILABLE' }
  })
  show('/properties/p/units/u')
  await userEvent.click(await screen.findByRole('button', { name: 'Mark UNAVAILABLE' }))
  await userEvent.click(screen.getByRole('button', { name: 'Change availability' }))
  await screen.findByText('Availability: OCCUPIED')
  expect(screen.getByRole('alert')).toHaveTextContent('occupancy may have changed')
  expect(screen.queryByRole('button', { name: /Mark/ })).not.toBeInTheDocument()
})

it('discards late responses when navigating between properties', async () => {
  let finish!: (value: unknown) => void
  const late = new Promise((resolve) => {
    finish = resolve
  })
  mocks.request.mockImplementation(async (_method, path) => {
    if (path === 'properties/p' || path === 'properties/q') return property
    return path === 'properties/p/units'
      ? late
      : { ...paged(), content: [{ ...unit, unitNumber: 'New property unit', propertyId: 'q' }] }
  })
  function Switcher() {
    const navigate = useNavigate()
    return (
      <>
        <button onClick={() => navigate('/properties/q/units')}>Change property</button>
        <UnitsPage />
      </>
    )
  }
  show('/properties/p/units', <Switcher />)
  await waitFor(() =>
    expect(mocks.request).toHaveBeenCalledWith(
      'get',
      'properties/p/units',
      undefined,
      expect.anything(),
    ),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Change property' }))
  await screen.findByRole('link', { name: 'New property unit' })
  finish(paged())
  await waitFor(() => expect(screen.queryByText('A-101')).not.toBeInTheDocument())
})
it('blocks duplicate submissions while saving', async () => {
  let finish!: () => void
  const save = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  render(<UnitForm initial={{ ...emptyUnit, unitNumber: 'a' }} saving={false} onSave={save} />)
  await userEvent.dblClick(screen.getByRole('button', { name: 'Save unit' }))
  expect(save).toHaveBeenCalledTimes(1)
  finish()
})

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PropertiesPage } from '@/pages/PropertiesPage'
import { PropertyDetailsPage } from '@/pages/PropertyDetailsPage'
import { PropertyFormPage } from '@/pages/PropertyFormPage'
import { ApiError } from '@/lib/api/errors'
import { propertyError } from './errors'
import { useState } from 'react'

const mocks = vi.hoisted(() => ({ request: vi.fn(), manage: true, orgId: 'org' }))
vi.mock('@/features/organization/context', () => ({ useOrganization: () => ({ current: { organizationId: mocks.orgId }, can: () => mocks.manage, request: mocks.request, queryKey: (key: unknown[]) => ['organization', 'user', mocks.orgId, ...key] }) }))
const property = { id: 'id-1', organizationId: 'org', name: 'Property One', propertyType: 'HOUSE', addressLine1: 'Main street', addressLine2: null, city: 'London', countryCode: 'GB', status: 'ACTIVE' }
function show(path = '/properties') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes><Route path="/properties" element={<PropertiesPage />} /><Route path="/properties/new" element={<PropertyFormPage />} /><Route path="/properties/:propertyId" element={<PropertyDetailsPage />} /><Route path="/properties/:propertyId/edit" element={<PropertyFormPage edit />} /></Routes></MemoryRouter></QueryClientProvider>)
}
beforeEach(() => { mocks.request.mockReset(); mocks.manage = true; mocks.orgId = 'org' })
describe('property workflows', () => {
  it('lists backend pages and requests the next page from the server', async () => {
    mocks.request.mockImplementation(async (_method, _path, _body, options) => ({ content: [property], page: options.params.page, size: 10, totalElements: 11, totalPages: 2, first: options.params.page === 0, last: options.params.page === 1 }))
    show(); expect(await screen.findByRole('link', { name: 'Property One' })).toBeInTheDocument(); expect(screen.getByText('Page 1 of 2 · 11 properties')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' })); await waitFor(() => expect(screen.getByText('Page 2 of 2 · 11 properties')).toBeInTheDocument())
    expect(mocks.request).toHaveBeenLastCalledWith('get', 'properties', undefined, expect.objectContaining({ params: { page: 1, size: 10 } }))
  })
  it('creates a property with validated backend fields', async () => {
    mocks.request.mockResolvedValue(property); show('/properties/new'); const user = userEvent.setup()
    await user.type(screen.getByLabelText('Property name'), 'Property One'); await user.type(screen.getByLabelText('Address line 1'), 'Main street'); await user.type(screen.getByLabelText('City'), 'London'); await user.type(screen.getByLabelText('Country code'), 'gb')
    await user.click(screen.getByRole('button', { name: 'Save property' }))
    await waitFor(() => expect(mocks.request).toHaveBeenCalledWith('post', 'properties', expect.objectContaining({ name: 'Property One', countryCode: 'GB', addressLine2: null })))
  })
  it('loads and updates a property', async () => {
    mocks.request.mockResolvedValue(property); show('/properties/id-1/edit'); const name = await screen.findByLabelText('Property name'); expect(name).toHaveValue('Property One')
    const user = userEvent.setup(); await user.clear(name); await user.type(name, 'Updated'); await user.click(screen.getByRole('button', { name: 'Save property' }))
    await waitFor(() => expect(mocks.request).toHaveBeenCalledWith('patch', 'properties/id-1', expect.objectContaining({ name: 'Updated' })))
  })
  it('requires confirmation before archive', async () => {
    mocks.request.mockImplementation(async method => method === 'patch' ? { ...property, status: 'ARCHIVED' } : property); show('/properties/id-1')
    const user = userEvent.setup(); await user.click(await screen.findByRole('button', { name: 'Archive property' })); expect(mocks.request).not.toHaveBeenCalledWith('patch', 'properties/id-1/archive')
    await user.click(screen.getByRole('button', { name: /^Archive$/ })); await waitFor(() => expect(mocks.request).toHaveBeenCalledWith('patch', 'properties/id-1/archive'))
  })
  it('shows an archive failure after dismissing the confirmation', async () => {
    mocks.request.mockImplementation(async method => { if (method === 'patch') throw new ApiError({ status: 500, message: 'internal detail' }); return property })
    show('/properties/id-1'); const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Archive property' })); await user.click(screen.getByRole('button', { name: /^Archive$/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be completed')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('hides management actions for read-only users', async () => {
    mocks.manage = false; mocks.request.mockResolvedValue(property); show('/properties/id-1'); expect(await screen.findByText('Property One')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Archive property' })).not.toBeInTheDocument(); expect(screen.queryByRole('link', { name: 'Edit property' })).not.toBeInTheDocument()
  })
  it('does not display late results from a previously selected organization', async () => {
    let finish!: (value: unknown) => void
    const late = new Promise(resolve => { finish = resolve })
    mocks.request.mockImplementation(() => mocks.orgId === 'org' ? late : Promise.resolve({ content: [{ ...property, name: 'Second organization' }], page: 0, size: 10, totalElements: 1, totalPages: 1, first: true, last: true }))
    function Switcher() { const [, update] = useState(0); return <><button onClick={() => { mocks.orgId = 'other'; update(value => value + 1) }}>Switch organization</button><PropertiesPage /></> }
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><Switcher /></MemoryRouter></QueryClientProvider>)
    await userEvent.click(screen.getByRole('button', { name: 'Switch organization' }))
    expect(await screen.findByRole('link', { name: 'Second organization' })).toBeInTheDocument()
    finish({ content: [{ ...property, name: 'Old organization' }], page: 0, size: 10, totalElements: 1, totalPages: 1, first: true, last: true })
    await waitFor(() => expect(screen.queryByText('Old organization')).not.toBeInTheDocument())
  })
  it('shows safe not-found and server errors', async () => {
    mocks.request.mockRejectedValue(new ApiError({ status: 404, message: 'internal detail' })); show('/properties/id-1'); expect(await screen.findByRole('alert')).toHaveTextContent('could not be found'); expect(screen.queryByText('internal detail')).not.toBeInTheDocument()
  })
})

describe('property error messages', () => {
  it.each([[400, 'check the property'], [401, 'session'], [403, 'permission'], [404, 'could not be found'], [409, 'conflicts'], [500, 'could not be completed']])('handles HTTP %i safely', (status, message) => {
    expect(propertyError(new ApiError({ status, message: 'sensitive detail' }))).toContain(message)
    expect(propertyError(new ApiError({ status, message: 'sensitive detail' }))).not.toContain('sensitive detail')
  })
  it('explains network failure', () => { expect(propertyError(new ApiError({ status: 0, message: 'offline', isNetworkError: true }))).toContain('reach the server') })
})

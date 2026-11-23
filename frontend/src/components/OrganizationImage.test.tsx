import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { OrganizationContext, type OrganizationContextValue } from '@/features/organization/context'
import { OrganizationImage } from './OrganizationImage'

it('uploads an image through the organization-scoped multipart API', async () => {
  const request = vi.fn(async (...args: unknown[]) => args[0] === 'get' ? null : undefined)
  const organization: OrganizationContextValue = {
    forbidden: false,
    current: { organizationId: 'org-1', organizationName: 'Test Org', organizationSlug: 'test-org', role: 'OWNER' },
    organizations: [],
    select: vi.fn(),
    can: () => true,
    request: request as unknown as OrganizationContextValue['request'],
    queryKey: (key) => ['org-1', ...key],
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <OrganizationContext.Provider value={organization}>
        <OrganizationImage resourceType="property" resourceId="property-1" alt="Northstar property" canManage />
      </OrganizationContext.Provider>
    </QueryClientProvider>,
  )

  const user = userEvent.setup()
  await user.upload(
    screen.getByLabelText('Upload image for Northstar property'),
    new File(['image'], 'northstar.png', { type: 'image/png' }),
  )

  await waitFor(() => {
    const uploadCall = request.mock.calls.find(([method]) => method === 'put')
    expect(uploadCall).toBeDefined()
    expect(uploadCall?.[1]).toBe('images/property/property-1')
    expect(uploadCall?.[2]).toBeInstanceOf(FormData)
    expect((uploadCall?.[2] as FormData).get('file')).toMatchObject({ name: 'northstar.png' })
  })
  expect(screen.getByText('No image uploaded')).toBeVisible()
  client.clear()
})

it('rejects unsupported image types before making an upload request', async () => {
  const request = vi.fn(async (...args: unknown[]) => args[0] === 'get' ? null : undefined)
  const organization: OrganizationContextValue = {
    forbidden: false,
    current: { organizationId: 'org-1', organizationName: 'Test Org', organizationSlug: 'test-org', role: 'OWNER' },
    organizations: [],
    select: vi.fn(),
    can: () => true,
    request: request as unknown as OrganizationContextValue['request'],
    queryKey: (key) => ['org-1', ...key],
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <OrganizationContext.Provider value={organization}>
        <OrganizationImage resourceType="renter" resourceId="renter-1" alt="Renter" canManage />
      </OrganizationContext.Provider>
    </QueryClientProvider>,
  )

  fireEvent.change(screen.getByLabelText('Upload image for Renter'), {
    target: { files: [new File(['text'], 'not-image.txt', { type: 'text/plain' })] },
  })

  expect(await screen.findByRole('alert')).toHaveTextContent('Choose a JPEG or PNG image.')
  expect(request.mock.calls.some(([method]) => method === 'put')).toBe(false)
  client.clear()
})

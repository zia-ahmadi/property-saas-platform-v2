import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@/features/organization/context', async () => { const { propertyOrganization } = await import('@/test/property-fixtures'); return { useOrganization: () => propertyOrganization } })
import { DashboardPage } from './DashboardPage'
import { PropertiesPage } from './PropertiesPage'

it('shows the dashboard and opens the property portfolio through View Properties', async () => {
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/properties" element={<PropertiesPage />} />
      </Routes>
    </MemoryRouter></QueryClientProvider>,
  )
  expect(
    screen.getByRole('heading', { name: 'Enterprise Portfolio Dashboard' }),
  ).toBeInTheDocument()
  expect(screen.getByText('Monthly Revenue')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /View Properties/ }))
  expect(screen.getByRole('heading', { name: 'Properties' })).toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: 'Grandview Commercial Tower' })).toBeInTheDocument()
  expect(
    screen.queryByRole('heading', { name: 'Enterprise Portfolio Dashboard' }),
  ).not.toBeInTheDocument()
})

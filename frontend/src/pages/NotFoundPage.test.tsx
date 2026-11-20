import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
import { NotFoundPage } from './NotFoundPage'
import { DashboardPage } from './DashboardPage'

vi.mock('@/features/organization/context', async () => {
  const { propertyOrganization } = await import('@/test/property-fixtures')
  return { useOrganization: () => propertyOrganization }
})

it('explains a missing page and lets the user return to the dashboard', async () => {
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/missing']}>
        <Routes>
          <Route path="*" element={<NotFoundPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument()
  expect(screen.getByText('The page you are looking for does not exist.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Return to Dashboard/ }))
  expect(
    screen.getByRole('heading', { name: 'Enterprise Portfolio Dashboard' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '404' })).not.toBeInTheDocument()
})

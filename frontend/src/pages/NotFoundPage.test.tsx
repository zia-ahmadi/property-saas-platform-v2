import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, it } from 'vitest'
import { NotFoundPage } from './NotFoundPage'
import { DashboardPage } from './DashboardPage'

it('explains a missing page and lets the user return to the dashboard', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/missing']}>
      <Routes>
        <Route path="*" element={<NotFoundPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument()
  expect(screen.getByText('The page you are looking for does not exist.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Return to Dashboard/ }))
  expect(
    screen.getByRole('heading', { name: 'Enterprise Portfolio Dashboard' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '404' })).not.toBeInTheDocument()
})

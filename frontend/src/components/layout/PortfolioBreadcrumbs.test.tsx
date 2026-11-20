import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { expect, it } from 'vitest'
import { PortfolioBreadcrumbs } from './PortfolioBreadcrumbs'

function NavigationHarness() {
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <>
      <PortfolioBreadcrumbs />
      <p>{location.pathname}</p>
      <button onClick={() => navigate(-1)}>Browser back</button>
      <button onClick={() => navigate(1)}>Browser forward</button>
    </>
  )
}
it('navigates the property/unit hierarchy and preserves browser history', async () => {
  render(
    <MemoryRouter initialEntries={['/properties/p/units/u/edit']}>
      <NavigationHarness />
    </MemoryRouter>,
  )
  const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' })
  expect(within(breadcrumb).getByText('Edit unit')).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: 'Unit details' })).toHaveAttribute(
    'href',
    '/properties/p/units/u',
  )
  expect(screen.getByRole('link', { name: 'Property units' })).toHaveAttribute(
    'href',
    '/properties/p/units',
  )
  await userEvent.click(screen.getByRole('link', { name: 'Property units' }))
  expect(screen.getByText('/properties/p/units')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Browser back' }))
  expect(screen.getByText('/properties/p/units/u/edit')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Browser forward' }))
  expect(screen.getByText('/properties/p/units')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('link', { name: 'Dashboard' }))
  expect(screen.getByText('/dashboard')).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument()
})
it('does not invent a property route for property creation', () => {
  render(
    <MemoryRouter initialEntries={['/properties/new']}>
      <PortfolioBreadcrumbs />
    </MemoryRouter>,
  )
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
})

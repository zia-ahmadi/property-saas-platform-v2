import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import { AppRouter } from '@/app/router/AppRouter'

function renderRoute(path: string) {
  window.history.replaceState(null, '', path)
  render(<AppRouter />)
}

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

it('renders the shell landmarks and dashboard content without placeholder account controls', () => {
  renderRoute('/dashboard')
  expect(screen.getByRole('complementary')).toHaveTextContent('Property SaaS')
  expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
  expect(
    within(screen.getByRole('banner')).getByRole('heading', { name: 'Dashboard', level: 1 }),
  ).toBeInTheDocument()
  expect(
    within(screen.getByRole('main', { name: 'Main content' })).getByRole('heading', {
      name: 'Enterprise Portfolio Dashboard',
    }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Sign Out/ })).not.toBeInTheDocument()
  expect(screen.queryByText('Tenant Isolated (JWT)')).not.toBeInTheDocument()
})

it.each([
  { destination: 'Dashboard', heading: 'Enterprise Portfolio Dashboard' },
  { destination: 'Properties', heading: 'Properties' },
  { destination: 'Settings', heading: 'Settings' },
])(
  'navigates to $destination and marks only that destination active',
  async ({ destination, heading }) => {
    const user = userEvent.setup()
    renderRoute(destination === 'Properties' ? '/settings' : '/properties')
    const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
    await user.click(within(navigation).getByRole('link', { name: destination }))
    expect(
      within(screen.getByRole('main')).getByRole('heading', { name: heading }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('banner')).getByRole('heading', { name: destination }),
    ).toBeInTheDocument()
    for (const link of within(navigation).getAllByRole('link')) {
      if (link.textContent === destination) {
        expect(link).toHaveAttribute('aria-current', 'page')
      } else {
        expect(link).not.toHaveAttribute('aria-current')
      }
    }
  },
)

it.each([
  { path: '/properties/prop-101', title: 'Property Details', heading: 'Property Details' },
  { path: '/properties/prop-101/units', title: 'Units', heading: 'Units Management' },
])('keeps $path inside the shell with Properties active', ({ path, title, heading }) => {
  renderRoute(path)
  expect(screen.getByRole('complementary')).toBeInTheDocument()
  expect(
    within(screen.getByRole('main')).getByRole('heading', { name: heading }),
  ).toBeInTheDocument()
  expect(
    within(screen.getByRole('banner')).getByRole('heading', { name: title }),
  ).toBeInTheDocument()
  const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
  expect(within(navigation).getByRole('link', { name: 'Properties' })).toHaveAttribute(
    'aria-current',
    'page',
  )
})

it('opens property units and returns to details within the shared shell', async () => {
  const user = userEvent.setup()
  renderRoute('/properties/prop-101')
  await user.click(screen.getByRole('button', { name: /Manage Units/ }))
  expect(
    within(screen.getByRole('main')).getByRole('heading', { name: 'Units Management' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Back to Property Details/ }))
  expect(
    within(screen.getByRole('main')).getByRole('heading', { name: 'Property Details' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
})

it('keeps login outside the shell', () => {
  renderRoute('/login')
  expect(screen.getByRole('heading', { name: 'Property SaaS Portal' })).toBeInTheDocument()
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  expect(screen.queryByRole('banner')).not.toBeInTheDocument()
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Skip to content' })).not.toBeInTheDocument()
})

it('lets keyboard users skip navigation and focus the main content', async () => {
  const user = userEvent.setup()
  renderRoute('/dashboard')
  await user.tab()
  expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveFocus()
  expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
    'href',
    '#main-content',
  )
  await user.keyboard('{Enter}')
  expect(screen.getByRole('main', { name: 'Main content' })).toHaveFocus()
})

it('preserves the root redirect to the dashboard shell', () => {
  renderRoute('/')
  expect(
    within(screen.getByRole('banner')).getByRole('heading', { name: 'Dashboard' }),
  ).toBeInTheDocument()
  expect(
    within(screen.getByRole('main')).getByRole('heading', {
      name: 'Enterprise Portfolio Dashboard',
    }),
  ).toBeInTheDocument()
})

it('keeps the not-found page outside the shell', () => {
  renderRoute('/missing')
  expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument()
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  expect(screen.queryByRole('banner')).not.toBeInTheDocument()
})

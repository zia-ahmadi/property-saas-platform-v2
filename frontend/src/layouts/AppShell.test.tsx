import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { AppRouter } from '@/app/router/AppRouter'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://api.example.test' }))

vi.mock('@/features/organization/context', async () => { const { propertyOrganization } = await import('@/test/property-fixtures'); return { useOptionalOrganization: () => propertyOrganization, useOrganization: () => propertyOrganization } })

vi.mock('@/features/auth/context', () => ({
  useAuth: () => ({ state: window.location.pathname === '/login' ? { status: 'anonymous' } : { status: 'authenticated', session: { user: { id: '1' }, organizations: [] } }, service: {} }),
  useOptionalAuth: () => null,
}))

function renderRoute(path: string) {
  window.history.replaceState(null, '', path)
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AppRouter /></QueryClientProvider>)
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
  { path: '/properties/prop-101/units', title: 'Units', heading: 'Units' },
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
  await user.click(await screen.findByRole('link', { name: /Manage Units/ }))
  expect(
    within(screen.getByRole('main')).getByRole('heading', { name: 'Units' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: /Back to property/ }))
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

it('opens a labelled mobile menu while retaining the desktop navigation', async () => {
  const user = userEvent.setup()
  renderRoute('/dashboard')
  const trigger = screen.getByRole('button', { name: 'Open navigation menu' })
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
  await user.click(trigger)
  const dialog = await screen.findByRole('dialog', { name: 'Property SaaS navigation' })
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  expect(within(dialog).getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument()
  expect(within(dialog).getAllByRole('link')).toHaveLength(3)
})

it('closes the mobile menu with its close button and restores trigger focus', async () => {
  const user = userEvent.setup()
  renderRoute('/dashboard')
  const trigger = screen.getByRole('button', { name: 'Open navigation menu' })
  await user.click(trigger)
  await user.click(await screen.findByRole('button', { name: 'Close navigation menu' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await waitFor(() => expect(trigger).toHaveFocus())
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
})

it('dismisses the mobile menu with Escape and restores trigger focus', async () => {
  const user = userEvent.setup()
  renderRoute('/dashboard')
  const trigger = screen.getByRole('button', { name: 'Open navigation menu' })
  await user.click(trigger)
  await screen.findByRole('dialog')
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await waitFor(() => expect(trigger).toHaveFocus())
})

it('selects a destination, dismisses the menu, and updates active navigation', async () => {
  const user = userEvent.setup()
  renderRoute('/dashboard')
  await user.click(screen.getByRole('button', { name: 'Open navigation menu' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('link', { name: 'Settings' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(
    within(screen.getByRole('main')).getByRole('heading', { name: 'Settings' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Open navigation menu' }))
  expect(
    within(await screen.findByRole('dialog')).getByRole('link', { name: 'Settings' }),
  ).toHaveAttribute('aria-current', 'page')
})

it('dismisses when selecting the current destination', async () => {
  const user = userEvent.setup()
  renderRoute('/dashboard')
  await user.click(screen.getByRole('button', { name: 'Open navigation menu' }))
  await user.click(
    within(await screen.findByRole('dialog')).getByRole('link', { name: 'Dashboard' }),
  )
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

it('dismisses on an external route change', async () => {
  const user = userEvent.setup()
  renderRoute('/dashboard')
  await user.click(screen.getByRole('button', { name: 'Open navigation menu' }))
  await screen.findByRole('dialog')
  act(() => {
    window.history.pushState(null, '', '/properties')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(
    within(screen.getByRole('banner')).getByRole('heading', { name: 'Properties' }),
  ).toBeInTheDocument()
})

it('keeps Properties active for nested routes in the mobile menu', async () => {
  const user = userEvent.setup()
  renderRoute('/properties/prop-101/units')
  await user.click(screen.getByRole('button', { name: 'Open navigation menu' }))
  const navigation = within(await screen.findByRole('dialog')).getByRole('navigation', {
    name: 'Mobile navigation',
  })
  expect(within(navigation).getByRole('link', { name: 'Properties' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(within(navigation).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
    'aria-current',
  )
})

it('traps keyboard focus inside the open menu', async () => {
  // jsdom has no layout; provide rectangles for the primitive's tabbability checks.
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([
    new DOMRect(0, 0, 100, 44),
  ] as unknown as DOMRectList)
  const user = userEvent.setup()
  renderRoute('/dashboard')
  await user.click(screen.getByRole('button', { name: 'Open navigation menu' }))
  const dialog = await screen.findByRole('dialog')
  const close = within(dialog).getByRole('button', { name: 'Close navigation menu' })
  await waitFor(() => expect(close).toHaveFocus())
  await user.tab({ shift: true })
  await waitFor(() => expect(within(dialog).getByRole('link', { name: 'Settings' })).toHaveFocus())
  await user.tab()
  await waitFor(() => expect(close).toHaveFocus())
})

it('supports outside-click dismissal', async () => {
  // Model preventScroll support, which Base UI probes before restoring focus
  // after pointer dismissal. jsdom's native focus does not read this option.
  const nativeFocus = HTMLElement.prototype.focus
  vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
    this: HTMLElement,
    options?: FocusOptions,
  ) {
    void options?.preventScroll
    nativeFocus.call(this, options)
  })
  const user = userEvent.setup()
  renderRoute('/dashboard')
  const trigger = screen.getByRole('button', { name: 'Open navigation menu' })
  await user.click(trigger)
  await screen.findByRole('dialog')
  await user.click(screen.getByTestId('navigation-backdrop'))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await waitFor(() => expect(trigger).toHaveFocus())
})

it('dismisses on a resize to desktop and focuses main content instead of the hidden trigger', async () => {
  const desktopQuery = Object.assign(new EventTarget(), {
    matches: false,
    media: '(min-width: 48rem)',
  })
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => desktopQuery),
  )
  const user = userEvent.setup()
  renderRoute('/dashboard')
  const main = screen.getByRole('main')
  await user.click(screen.getByRole('button', { name: 'Open navigation menu' }))
  await screen.findByRole('dialog')
  // Modal content is exposed to assistive technology; the background is not.
  expect(screen.queryByRole('main')).not.toBeInTheDocument()
  act(() => {
    desktopQuery.matches = true
    desktopQuery.dispatchEvent(Object.assign(new Event('change'), { matches: true }))
  })
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await waitFor(() => expect(main).toContainElement(document.activeElement as HTMLElement))
  expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
})

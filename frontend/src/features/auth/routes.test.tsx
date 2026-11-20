import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { StrictMode, useSyncExternalStore } from 'react'
import { AuthContext } from './context'
import { AuthLifecycleService, type AuthState } from './lifecycle'
import { ProtectedRoute } from '@/app/router/ProtectedRoute'
import { LoginPage } from '@/pages/LoginPage'

vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://api.example.test' }))
function setup(state: AuthState, path = '/private') {
  const coordinator = { login: vi.fn(), refresh: vi.fn(), logout: vi.fn(), acknowledgeRefreshRecovery: vi.fn(), publish: vi.fn(), subscribe: vi.fn(() => () => {}), close: vi.fn() }
  const service = new AuthLifecycleService({ coordinator, clearCache: async () => {} })
  render(<AuthContext.Provider value={{ state, service }}><MemoryRouter initialEntries={[path]}><Routes><Route path="/login" element={<LoginPage />} /><Route element={<ProtectedRoute />}><Route path="/private" element={<h1>Private content</h1>} /></Route></Routes></MemoryRouter></AuthContext.Provider>)
  return { service, coordinator }
}
describe('authentication routes', () => {
  it('redirects anonymous visitors without rendering protected content', () => {
    const { service } = setup({ status: 'anonymous' }); expect(screen.getByRole('heading', { name: 'Property SaaS Portal' })).toBeInTheDocument(); expect(screen.queryByText('Private content')).not.toBeInTheDocument(); service.dispose()
  })
  it('blocks protected content while refreshing', () => {
    const { service } = setup({ status: 'refreshing' }); expect(screen.getByRole('status')).toHaveTextContent('Verifying'); expect(screen.queryByText('Private content')).not.toBeInTheDocument(); service.dispose()
  })
  it('shows accessible recovery messaging', () => {
    const { service } = setup({ status: 'recovery-required', message: 'Please sign in again.' }); expect(screen.getByRole('alert')).toHaveTextContent('Please sign in again.'); expect(screen.queryByText('Private content')).not.toBeInTheDocument(); service.dispose()
  })
  it('toggles login password visibility without submitting', async () => {
    const { service, coordinator } = setup({ status: 'anonymous' }, '/login'); const user = userEvent.setup()
    const password = screen.getByLabelText('Password'); expect(password).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' })); expect(password).toHaveAttribute('type', 'text')
    screen.getByRole('button', { name: 'Hide password' }).focus(); await user.keyboard(' ')
    expect(password).toHaveAttribute('type', 'password'); expect(coordinator.login).not.toHaveBeenCalled(); service.dispose()
  })
  it('submits credentials and displays the login form with accessible labels', async () => {
    const { service, coordinator } = setup({ status: 'anonymous' }, '/login'); coordinator.login.mockRejectedValueOnce(new Error('failed'))
    const user = userEvent.setup(); await user.type(screen.getByLabelText('Email address'), 'person@example.test'); await user.type(screen.getByLabelText('Password'), 'password'); await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(coordinator.login).toHaveBeenCalledWith({ email: 'person@example.test', password: 'password' }, {})); service.dispose()
  })
})

it('keeps one lifecycle service through StrictMode subscription remounts', () => {
  const coordinator = { login: vi.fn(), refresh: vi.fn(), logout: vi.fn(), acknowledgeRefreshRecovery: vi.fn(), publish: vi.fn(), subscribe: vi.fn(() => () => {}), close: vi.fn() }
  const service = new AuthLifecycleService({ coordinator, clearCache: async () => {} })
  function Consumer() { const state = useSyncExternalStore(service.subscribe, service.getSnapshot); return <div>{state.status}</div> }
  const view = render(<StrictMode><Consumer /></StrictMode>)
  expect(screen.getByText('anonymous')).toBeInTheDocument(); expect(coordinator.refresh).not.toHaveBeenCalled()
  view.unmount(); expect(coordinator.close).not.toHaveBeenCalled(); service.dispose()
})

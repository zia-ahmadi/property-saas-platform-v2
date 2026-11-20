import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RegisterPage } from './RegisterPage'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/features/auth/registration', () => ({ register: vi.fn() }))
import { register } from '@/features/auth/registration'
const mockedRegister = vi.mocked(register)
async function fill() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('First name'), 'First')
  await user.type(screen.getByLabelText('Last name'), 'Last')
  await user.type(screen.getByLabelText('Email address'), 'person@example.test')
  await user.type(screen.getByLabelText('Password'), 'long-password-123')
  await user.type(screen.getByLabelText('Organization name'), 'Example')
  await user.type(screen.getByLabelText('Organization slug'), 'example-org')
  return user
}
function show() { render(<MemoryRouter initialEntries={['/register']}><Routes><Route path="/register" element={<RegisterPage />} /><Route path="/login" element={<h1>Sign in page</h1>} /></Routes></MemoryRouter>) }
beforeEach(() => vi.clearAllMocks())
describe('organization registration', () => {
  it('submits registration and directs the user to sign in', async () => {
    mockedRegister.mockResolvedValueOnce({ userId: '1', organizationId: '2', email: '', firstName: '', lastName: '', organizationName: '', organizationSlug: '', role: 'OWNER' })
    show(); const user = await fill(); await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(mockedRegister).toHaveBeenCalledOnce(); expect(await screen.findByRole('heading', { name: 'Sign in page' })).toBeInTheDocument()
  })
  it.each(['duplicate email', 'duplicate slug'])('shows a safe conflict message for %s', async () => {
    mockedRegister.mockRejectedValueOnce(new ApiError({ status: 409, message: 'internal detail' }))
    show(); const user = await fill(); await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('email or an organization with this slug already exists'); expect(screen.queryByText('internal detail')).not.toBeInTheDocument()
  })
  it('toggles password visibility with mouse and keyboard without submitting', async () => {
    show(); const user = userEvent.setup(); const password = screen.getByLabelText('Password')
    expect(password).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
    screen.getByRole('button', { name: 'Hide password' }).focus()
    await user.keyboard('{Enter}')
    expect(password).toHaveAttribute('type', 'password')
    expect(mockedRegister).not.toHaveBeenCalled()
  })
  it('links back to login', async () => { show(); await userEvent.click(screen.getByRole('link', { name: 'Sign in' })); expect(screen.getByRole('heading', { name: 'Sign in page' })).toBeInTheDocument() })
  it('rejects a malformed slug before making a request', async () => {
    show(); const user = await fill(); const slug = screen.getByLabelText('Organization slug'); await user.clear(slug); await user.type(slug, 'Invalid_slug'); await user.click(screen.getByRole('button', { name: 'Create account' })); expect(screen.getByRole('alert')).toHaveTextContent('lowercase'); expect(mockedRegister).not.toHaveBeenCalled()
  })
})

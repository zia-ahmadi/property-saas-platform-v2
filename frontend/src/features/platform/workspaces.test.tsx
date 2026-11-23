import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, it, vi } from 'vitest'
import { AuthContext } from '@/features/auth/context'
import { OrganizationContext } from '@/features/organization/context'
import { AppShell } from '@/layouts/AppShell'
import { PlatformRoute } from '@/app/router/PlatformRoute'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError } from '@/lib/api/errors'
import type { AuthLifecycleService } from '@/features/auth/lifecycle'
import type { OrganizationContextValue } from '@/features/organization/context'
vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://api.example.test' }))
function setup(allowed: boolean, hasOrganization = true, initial = '/dashboard') {
  const request = vi.fn().mockImplementation(() => allowed ? Promise.resolve({platformOwner: true}) : Promise.reject(new ApiError({message:'Forbidden', status:403})))
  const service = {request, signOut: vi.fn()} as unknown as AuthLifecycleService
  const org = {current: hasOrganization ? {organizationId:'org', organizationName:'My organization', organizationSlug:'mine', role:'OWNER'} : undefined, organizations: hasOrganization ? [{organizationId:'org', organizationName:'My organization', organizationSlug:'mine', role:'OWNER'}] : [], can: () => true, forbidden: false, select: vi.fn(), queryKey: () => ['details'], request: vi.fn().mockResolvedValue({status:'active'})} as unknown as OrganizationContextValue
  render(<QueryClientProvider client={new QueryClient()}><AuthContext.Provider value={{state:{status:'authenticated', session:{user:{id:'user',email:'user@example.test',firstName:'Test',lastName:'User'}, organizations:[]}},service}}><OrganizationContext.Provider value={org}><MemoryRouter initialEntries={[initial]}><Routes><Route element={<AppShell />}><Route path="/dashboard" element={<p>Organization home</p>} /><Route element={<PlatformRoute />}><Route path="/platform" element={<p>Platform home</p>} /></Route></Route></Routes></MemoryRouter></OrganizationContext.Provider></AuthContext.Provider></QueryClientProvider>)
}
it('switches between separate platform and organization navigation', async () => {
  setup(true)
  const user = userEvent.setup()
  await user.click(await screen.findByRole('link', {name:'Switch to platform workspace'}))
  expect(await screen.findByText('Platform home')).toBeVisible()
  expect(screen.queryByLabelText('Organization')).not.toBeInTheDocument()
  expect(within(screen.getByRole('navigation', {name:'Main navigation'})).getByText('Organizations')).toBeVisible()
  expect(within(screen.getByRole('navigation', {name:'Main navigation'})).queryByText('Renters')).not.toBeInTheDocument()
  await user.click(screen.getByRole('link', {name:'Switch to organization workspace'}))
  expect(screen.getByText('Organization home')).toBeVisible()
  expect(screen.getByLabelText('Organization')).toBeInTheDocument()
})
it('does not offer platform access to an ordinary organization user', async () => {
  setup(false, true, '/platform')
  expect(await screen.findByText('Platform owner access is required.')).toBeVisible()
  expect(screen.queryByText('Platform home')).not.toBeInTheDocument()
  expect(screen.queryByRole('link', {name:'Switch to platform workspace'})).not.toBeInTheDocument()
})
it('lets a platform owner without an active organization reach the platform workspace', async () => {
  setup(true, false)
  await waitFor(() => expect(screen.getByRole('link', {name:'Switch to platform workspace'})).toBeVisible())
  await userEvent.click(screen.getByRole('link', {name:'Switch to platform workspace'}))
  expect(await screen.findByText('Platform home')).toBeVisible()
  expect(screen.queryByText('No active organization')).not.toBeInTheDocument()
})

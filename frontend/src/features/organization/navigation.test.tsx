import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppNavigation } from '@/components/layout/AppNavigation'
import { OrganizationRoute } from '@/app/router/OrganizationRoute'
import { hasPermission } from './permissions'

vi.mock('@/features/organization/context', () => ({ useOptionalOrganization: () => ({ current: { organizationId: 'one', role: 'STAFF' }, forbidden: false, can: (permission: Parameters<typeof hasPermission>[1]) => hasPermission('STAFF', permission) }) }))

describe('role-aware routes and navigation', () => {
  it('shows property navigation and personal settings for staff', () => {
    render(<MemoryRouter><AppNavigation /></MemoryRouter>); expect(screen.getByRole('link', { name: 'Properties' })).toBeInTheDocument(); expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
  })
  it('routes staff away from organization management', () => {
    render(<MemoryRouter initialEntries={['/workspace-management']}><Routes><Route element={<OrganizationRoute permission="ORGANIZATION_MANAGE" />}><Route path="/workspace-management" element={<p>Settings content</p>} /></Route><Route path="/forbidden" element={<h1>Access denied</h1>} /></Routes></MemoryRouter>); expect(screen.getByRole('heading', { name: 'Access denied' })).toBeInTheDocument(); expect(screen.queryByText('Settings content')).not.toBeInTheDocument()
  })
})

import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { AppShell } from '@/layouts/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { PropertiesPage } from '@/pages/PropertiesPage'
import { PropertyDetailsPage } from '@/pages/PropertyDetailsPage'
import { PropertyFormPage } from '@/pages/PropertyFormPage'
import { UnitsPage } from '@/pages/UnitsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProtectedRoute } from './ProtectedRoute'
import { OrganizationRoute } from './OrganizationRoute'
import { RegisterPage } from '@/pages/RegisterPage'
import { ForbiddenPage } from '@/pages/ForbiddenPage'
import { UnauthorizedPage } from '@/pages/UnauthorizedPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login route outside the application shell */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* Shared dashboard layout */}
        <Route element={<ProtectedRoute />}><Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route element={<OrganizationRoute permission="ORGANIZATION_VIEW" />}><Route path="/dashboard" element={<DashboardPage />} /></Route>
          <Route element={<OrganizationRoute permission="PROPERTY_VIEW" />}><Route path="/properties" element={<PropertiesPage />} />
          <Route path="/properties/:propertyId" element={<PropertyDetailsPage />} />
          <Route path="/properties/:propertyId/units" element={<UnitsPage />} />
          </Route>
          <Route element={<OrganizationRoute permission="PROPERTY_MANAGE" />}><Route path="/properties/new" element={<PropertyFormPage />} /><Route path="/properties/:propertyId/edit" element={<PropertyFormPage edit />} /></Route>
          <Route element={<OrganizationRoute permission="ORGANIZATION_MANAGE" />}><Route path="/settings" element={<SettingsPage />} /></Route>
        </Route>

        <Route path="/forbidden" element={<ForbiddenPage />} />
        </Route>

        {/* Not Found */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

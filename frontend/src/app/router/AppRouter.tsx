import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { AppShell } from '@/layouts/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { PropertiesPage } from '@/pages/PropertiesPage'
import { PropertyDetailsPage } from '@/pages/PropertyDetailsPage'
import { PropertyFormPage } from '@/pages/PropertyFormPage'
import { RentersPage } from '@/pages/RentersPage'
import { RenterProfilePage } from '@/pages/RenterProfilePage'
import { UnitsPage } from '@/pages/UnitsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProtectedRoute } from './ProtectedRoute'
import { OrganizationRoute } from './OrganizationRoute'
import { RegisterPage } from '@/pages/RegisterPage'
import { ForbiddenPage } from '@/pages/ForbiddenPage'
import { UnauthorizedPage } from '@/pages/UnauthorizedPage'
import { TeamPage } from '@/pages/TeamPage'
import { InboxPage } from '@/pages/InboxPage'
import { PlatformPage } from '@/pages/PlatformPage'
import { InvitationPage } from '@/pages/InvitationPage'
import { RestrictedOrganizations } from '@/features/organization/RestrictedOrganizations'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login route outside the application shell */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/invite" element={<InvitationPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* Shared dashboard layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/platform" element={<PlatformPage />} />
            <Route path="/organization-messages/:organizationId" element={<InboxPage />} />
            <Route path="/access" element={<section><h2 className="text-2xl font-bold">Organization access</h2><p>Restricted organizations and their status appear below.</p><RestrictedOrganizations /></section>} />
            <Route element={<OrganizationRoute permission="MEMBERSHIP_MANAGE" />}><Route path="/team" element={<TeamPage />} /><Route path="/inbox" element={<InboxPage />} /></Route>
            <Route element={<OrganizationRoute permission="ORGANIZATION_VIEW" />}>
              <Route path="/dashboard" element={<DashboardPage />} />
            </Route>
            <Route element={<OrganizationRoute permission="PROPERTY_VIEW" />}>
              <Route path="/renters" element={<RentersPage />} />
              <Route path="/renters/:renterId" element={<RenterProfilePage />} />
              <Route path="/properties" element={<PropertiesPage />} />
              <Route path="/properties/:propertyId" element={<PropertyDetailsPage />} />
              <Route path="/properties/:propertyId/units" element={<UnitsPage />} />
              <Route
                path="/properties/:propertyId/units/:unitId"
                element={<UnitsPage mode="details" />}
              />
            </Route>
            <Route element={<OrganizationRoute permission="PROPERTY_MANAGE" />}>
              <Route path="/renters/new" element={<RenterProfilePage mode="create" />} />
              <Route path="/renters/:renterId/edit" element={<RenterProfilePage mode="edit" />} />
              <Route
                path="/properties/:propertyId/units/new"
                element={<UnitsPage mode="create" />}
              />
              <Route
                path="/properties/:propertyId/units/:unitId/edit"
                element={<UnitsPage mode="edit" />}
              />
              <Route path="/properties/new" element={<PropertyFormPage />} />
              <Route path="/properties/:propertyId/edit" element={<PropertyFormPage edit />} />
            </Route>
            <Route element={<OrganizationRoute permission="ORGANIZATION_MANAGE" />}>
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="/forbidden" element={<ForbiddenPage />} />
        </Route>

        {/* Not Found */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

import { BrowserRouter, Routes, Route } from 'react-router'
import { AppShell } from '@/layouts/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { BillingPage } from '@/pages/BillingPage'
import { IssueInvoicePage } from '@/pages/IssueInvoicePage'
import { InvoiceDetailsPage } from '@/pages/InvoiceDetailsPage'
import { LeasesPage } from '@/pages/LeasesPage'
import { LeaseDetailsPage } from '@/pages/LeaseDetailsPage'
import { LeasePrintPage } from '@/pages/LeasePrintPage'
import { MaintenancePage } from '@/pages/MaintenancePage'
import { MaintenanceRequestPage } from '@/pages/MaintenanceRequestPage'
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
import { PlatformRoute } from './PlatformRoute'
import { RegisterPage } from '@/pages/RegisterPage'
import { ForbiddenPage } from '@/pages/ForbiddenPage'
import { UnauthorizedPage } from '@/pages/UnauthorizedPage'
import { TeamPage } from '@/pages/TeamPage'
import { InboxPage } from '@/pages/InboxPage'
import { PlatformPage } from '@/pages/PlatformPage'
import { InvitationPage } from '@/pages/InvitationPage'
import { OrganizationAccessPage } from '@/features/organization/RestrictedOrganizations'
import { OrganizationNotificationsPage } from '@/pages/OrganizationNotificationsPage'
import { HomePage } from '@/pages/HomePage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/invite" element={<InvitationPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* Shared dashboard layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<OrganizationRoute permission="LEASE_MANAGE" />}>
            <Route path="/leases/:leaseId/print" element={<LeasePrintPage />} />
          </Route>
          <Route element={<AppShell />}>
            <Route element={<PlatformRoute />}><Route path="/platform" element={<PlatformPage />} /></Route>
            <Route path="/organization-messages/:organizationId" element={<InboxPage />} />
            <Route path="/notifications" element={<OrganizationNotificationsPage />} />
            <Route path="/access" element={<OrganizationAccessPage />} />
            <Route element={<OrganizationRoute permission="MEMBERSHIP_MANAGE" />}><Route path="/team" element={<TeamPage />} /><Route path="/inbox" element={<InboxPage />} /></Route>
            <Route element={<OrganizationRoute permission="ORGANIZATION_VIEW" />}>
              <Route path="/dashboard" element={<DashboardPage />} />
            </Route>
            <Route element={<OrganizationRoute permission="LEASE_MANAGE" />}>
              <Route path="/leases" element={<LeasesPage />} />
              <Route path="/leases/new" element={<LeaseDetailsPage mode="new" />} />
              <Route path="/leases/:leaseId" element={<LeaseDetailsPage />} />
              <Route path="/leases/:leaseId/edit" element={<LeaseDetailsPage mode="edit" />} />
            </Route>
            <Route element={<OrganizationRoute permission="BILLING_MANAGE" />}>
              <Route path="/billing" element={<BillingPage />} />
              <Route path="/billing/new" element={<IssueInvoicePage />} />
              <Route path="/billing/:invoiceId" element={<InvoiceDetailsPage />} />
            </Route>
            <Route element={<OrganizationRoute permission="MAINTENANCE_MANAGE" />}>
              <Route path="/maintenance" element={<MaintenancePage />} />
              <Route path="/maintenance/new" element={<MaintenanceRequestPage />} />
              <Route path="/maintenance/:requestId" element={<MaintenanceRequestPage />} />
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

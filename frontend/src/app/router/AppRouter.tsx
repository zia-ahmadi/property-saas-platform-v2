import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { AppShell } from '@/layouts/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { PropertiesPage } from '@/pages/PropertiesPage'
import { PropertyDetailsPage } from '@/pages/PropertyDetailsPage'
import { UnitsPage } from '@/pages/UnitsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login route outside the application shell */}
        <Route path="/login" element={<LoginPage />} />

        {/* Shared dashboard layout */}
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/properties" element={<PropertiesPage />} />
          <Route path="/properties/:propertyId" element={<PropertyDetailsPage />} />
          <Route path="/properties/:propertyId/units" element={<UnitsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Not Found */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

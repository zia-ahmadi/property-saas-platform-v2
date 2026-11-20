import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { QueryProvider } from '@/app/providers/QueryProvider'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { OrganizationProvider } from '@/features/organization/OrganizationProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <AuthProvider><OrganizationProvider><App /></OrganizationProvider></AuthProvider>
    </QueryProvider>
  </StrictMode>,
)

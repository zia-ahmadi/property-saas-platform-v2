import { apiClient } from '@/lib/api/client'

export interface LoginRequest {
  email: string
  password: string
}

export interface CsrfResponse {
  csrfToken: string
}

export interface AccessTokenResponse {
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: number
}

export type OrganizationRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF'

export interface SessionUser {
  id: string
  email: string
  firstName: string
  lastName: string
}

export interface SessionOrganization {
  organizationId: string
  organizationName: string
  organizationSlug: string
  role: OrganizationRole
}

export interface SessionResponse {
  user: SessionUser
  organizations: SessionOrganization[]
}

export interface AuthRequestOptions {
  signal?: AbortSignal
  timeoutMs?: number
}

const basePath = 'api/v1/browser-auth'

export function getCsrfToken(options?: AuthRequestOptions): Promise<CsrfResponse> {
  return apiClient.get(`${basePath}/csrf`, { ...options, credentials: 'include' })
}

export function login(
  request: LoginRequest,
  csrfToken: string,
  options?: AuthRequestOptions,
): Promise<AccessTokenResponse> {
  return apiClient.post(
    `${basePath}/login`,
    { email: request.email, password: request.password },
    { ...options, credentials: 'include', headers: { 'X-CSRF-TOKEN': csrfToken } },
  )
}

export function refresh(csrfToken: string, options?: AuthRequestOptions): Promise<AccessTokenResponse> {
  return apiClient.post(`${basePath}/refresh`, undefined, {
    ...options,
    credentials: 'include',
    headers: { 'X-CSRF-TOKEN': csrfToken },
  })
}

export function getSession(accessToken: string, options?: AuthRequestOptions): Promise<SessionResponse> {
  return apiClient.get(`${basePath}/session`, {
    ...options,
    credentials: 'omit',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export function logout(csrfToken: string, options?: AuthRequestOptions): Promise<void> {
  return apiClient.post(`${basePath}/logout`, undefined, {
    ...options,
    credentials: 'include',
    headers: { 'X-CSRF-TOKEN': csrfToken },
  })
}

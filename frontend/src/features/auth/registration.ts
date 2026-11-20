import { apiClient } from '@/lib/api/client'

export interface RegistrationRequest {
  email: string
  password: string
  firstName: string
  lastName: string
  organizationName: string
  organizationSlug: string
}
export interface RegistrationResponse {
  userId: string
  organizationId: string
  email: string
  firstName: string
  lastName: string
  organizationName: string
  organizationSlug: string
  role: string
}
export function register(request: RegistrationRequest): Promise<RegistrationResponse> {
  return apiClient.post('api/v1/users/register', request)
}

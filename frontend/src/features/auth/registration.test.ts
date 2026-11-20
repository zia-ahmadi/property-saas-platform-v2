import { expect, it, vi } from 'vitest'
import { register } from './registration'
import { apiClient } from '@/lib/api/client'
vi.mock('@/lib/api/client', () => ({ apiClient: { post: vi.fn() } }))
it('uses the existing public registration endpoint and exact request body', async () => {
  const request = { email: 'user@example.test', password: 'long-password-123', firstName: 'A', lastName: 'B', organizationName: 'Example', organizationSlug: 'example' }
  await register(request)
  expect(apiClient.post).toHaveBeenCalledWith('api/v1/users/register', request)
})

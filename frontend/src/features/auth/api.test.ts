import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import { getCsrfToken, getSession, login, logout, refresh } from './api'
import type { AccessTokenResponse, LoginRequest, SessionResponse } from './api'

vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://api.example.test' }))

const fetchMock = vi.fn<typeof fetch>()
const base = 'https://api.example.test/api/v1/browser-auth'
const access: AccessTokenResponse = { accessToken: 'access-test', tokenType: 'Bearer', expiresIn: 900 }

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function assertRequest(path: string, method: string, credentials: RequestCredentials) {
  expect(fetchMock).toHaveBeenCalledOnce()
  expect(fetchMock.mock.calls[0][0]).toBe(`${base}/${path}`)
  const options = fetchMock.mock.calls[0][1]
  expect(options).toMatchObject({ method, credentials })
  const headers = new Headers(options?.headers)
  expect(headers.has('Origin')).toBe(false)
  return { options, headers }
}

function pendingFetch() {
  fetchMock.mockImplementation(
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), {
          once: true,
        })
      }),
  )
}

describe('browser auth transport', () => {
  it('bootstraps CSRF with credentials and no authorization', async () => {
    fetchMock.mockResolvedValue(Response.json({ csrfToken: 'csrf-test' }))
    await expect(getCsrfToken()).resolves.toEqual({ csrfToken: 'csrf-test' })
    const { options, headers } = assertRequest('csrf', 'GET', 'include')
    expect(headers.has('Authorization')).toBe(false)
    expect(headers.has('X-CSRF-TOKEN')).toBe(false)
    expect(options?.body).toBeUndefined()
  })

  it('posts only login fields with one CSRF header and returns the access response', async () => {
    fetchMock.mockResolvedValue(Response.json(access))
    await expect(login({ email: 'user@example.test', password: 'password' }, 'csrf-test')).resolves.toEqual(access)
    const { options, headers } = assertRequest('login', 'POST', 'include')
    expect(JSON.parse(String(options?.body))).toEqual({ email: 'user@example.test', password: 'password' })
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('X-CSRF-TOKEN')).toBe('csrf-test')
    expect([...headers.keys()].filter((key) => key === 'x-csrf-token')).toHaveLength(1)
    expect(headers.has('Authorization')).toBe(false)
  })

  it('refreshes without a JSON token or bearer header', async () => {
    fetchMock.mockResolvedValue(Response.json(access))
    await expect(refresh('csrf-test')).resolves.toEqual(access)
    const { options, headers } = assertRequest('refresh', 'POST', 'include')
    expect(options?.body).toBeUndefined()
    expect(headers.get('X-CSRF-TOKEN')).toBe('csrf-test')
    expect([...headers.keys()].filter((key) => key === 'x-csrf-token')).toHaveLength(1)
    expect(headers.has('Authorization')).toBe(false)
  })

  it('loads session identity with only bearer authorization', async () => {
    const session: SessionResponse = {
      user: { id: 'user-id', email: 'user@example.test', firstName: 'First', lastName: 'Last' },
      organizations: [{ organizationId: 'org-id', organizationName: 'Example', organizationSlug: 'example', role: 'OWNER' }],
    }
    fetchMock.mockResolvedValue(Response.json(session))
    await expect(getSession('access-test')).resolves.toEqual(session)
    const { options, headers } = assertRequest('session', 'GET', 'omit')
    expect(headers.get('Authorization')).toBe('Bearer access-test')
    expect(headers.has('X-CSRF-TOKEN')).toBe(false)
    expect(options?.body).toBeUndefined()
  })

  it('handles a 204 logout without a body or bearer header', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(logout('csrf-test')).resolves.toBeUndefined()
    const { options, headers } = assertRequest('logout', 'POST', 'include')
    expect(options?.body).toBeUndefined()
    expect(headers.get('X-CSRF-TOKEN')).toBe('csrf-test')
    expect([...headers.keys()].filter((key) => key === 'x-csrf-token')).toHaveLength(1)
    expect(headers.has('Authorization')).toBe(false)
  })

  it.each([400, 401, 403, 500])('preserves HTTP %s errors without exposing the response', async (status) => {
    fetchMock.mockResolvedValue(new Response('private server details', { status }))
    const error = await refresh('csrf-test').catch((value: unknown) => value)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status, isNetworkError: false, isTimeoutError: false, isAbortError: false })
    expect((error as ApiError).message).not.toContain('private server details')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it.each([
    ['login', () => login({ email: 'user@example.test', password: 'password' }, 'csrf-test')],
    ['refresh', () => refresh('csrf-test')],
    ['logout', () => logout('csrf-test')],
  ])('does not retry a failed %s mutation', async (_name, call) => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))
    await expect(call()).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('preserves network errors', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'))
    await expect(getCsrfToken()).rejects.toMatchObject({ status: 0, isNetworkError: true })
  })

  it('preserves timeout errors', async () => {
    vi.useFakeTimers()
    pendingFetch()
    const result = expect(refresh('csrf-test', { timeoutMs: 100 })).rejects.toMatchObject({
      status: 408,
      isTimeoutError: true,
    })
    await vi.advanceTimersByTimeAsync(100)
    await result
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('preserves caller cancellation', async () => {
    pendingFetch()
    const controller = new AbortController()
    const result = expect(logout('csrf-test', { signal: controller.signal })).rejects.toMatchObject({
      status: 0,
      isAbortError: true,
    })
    controller.abort()
    await result
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('does not expose refresh tokens in the TypeScript contracts', () => {
    expectTypeOf<'refreshToken'>().not.toExtend<keyof AccessTokenResponse>()
    expectTypeOf<'refreshToken'>().not.toExtend<keyof LoginRequest>()
    expectTypeOf<'refreshToken'>().not.toExtend<keyof SessionResponse>()
  })
})

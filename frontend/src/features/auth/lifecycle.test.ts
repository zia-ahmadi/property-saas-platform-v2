import { describe, expect, it, vi } from 'vitest'
import { AuthLifecycleService } from './lifecycle'
import { ApiError } from '@/lib/api/errors'
import type { SessionResponse } from './api'
import type { SessionEvent } from './coordination'

vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://api.example.test' }))
const session: SessionResponse = { user: { id: 'one', email: 'a@example.test', firstName: 'A', lastName: 'B' }, organizations: [] }
const access = { accessToken: 'secret', tokenType: 'Bearer' as const, expiresIn: 900 }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
function setup() {
  let listener: ((event: SessionEvent) => void) | undefined
  const coordinator = {
    login: vi.fn().mockResolvedValue(access), refresh: vi.fn().mockResolvedValue(access), logout: vi.fn().mockResolvedValue(undefined),
    acknowledgeRefreshRecovery: vi.fn(), publish: vi.fn(), close: vi.fn(),
    subscribe: vi.fn((fn: (event: SessionEvent) => void) => { listener = fn; return () => { listener = undefined } }),
  }
  const getSession = vi.fn().mockResolvedValue(session)
  const clearCache = vi.fn().mockResolvedValue(undefined)
  const service = new AuthLifecycleService({ coordinator, session: getSession, clearCache })
  return { service, coordinator, getSession, clearCache, receive: (event: SessionEvent) => listener?.(event) }
}
const credentials = { email: 'a@example.test', password: 'password' }
describe('authentication lifecycle', () => {
  it('starts anonymous without refresh and waits for session before publishing identity', async () => {
    const { service, coordinator, getSession } = setup(); const gate = deferred<SessionResponse>(); getSession.mockReturnValueOnce(gate.promise)
    expect(service.getSnapshot().status).toBe('anonymous'); expect(coordinator.refresh).not.toHaveBeenCalled()
    const login = service.signIn(credentials); await vi.waitFor(() => expect(getSession).toHaveBeenCalled())
    expect(service.getSnapshot().status).toBe('authenticating'); gate.resolve(session); expect(await login).toBe(true)
    expect(service.getSnapshot()).toEqual({ status: 'authenticated', session }); service.dispose()
  })
  it('reports invalid credentials without exposing details', async () => {
    const { service, coordinator } = setup(); coordinator.login.mockRejectedValueOnce(new ApiError({ message: 'secret', status: 401 }))
    expect(await service.signIn(credentials)).toBe(false); expect(service.getSnapshot()).toEqual({ status: 'anonymous', message: 'Invalid email or password.' }); service.dispose()
  })
  it('shares refresh and rejects a changed identity', async () => {
    const { service, coordinator, getSession, clearCache } = setup(); await service.signIn(credentials)
    const gate = deferred<typeof access>(); coordinator.refresh.mockReturnValueOnce(gate.promise)
    getSession.mockResolvedValueOnce({ ...session, user: { ...session.user, id: 'other' } })
    const first = service.refresh(), second = service.refresh(); expect(coordinator.refresh).toHaveBeenCalledTimes(1)
    gate.resolve(access); expect(await first).toBe(false); expect(await second).toBe(false)
    expect(service.getSnapshot().status).toBe('recovery-required'); expect(clearCache).toHaveBeenCalledTimes(2); service.dispose()
  })
  it('never retries an uncertain refresh', async () => {
    const { service, coordinator } = setup(); await service.signIn(credentials); coordinator.refresh.mockRejectedValueOnce(new Error('timeout'))
    expect(await service.refresh()).toBe(false); expect(service.getSnapshot().status).toBe('recovery-required')
    expect(await service.refresh()).toBe(false); expect(coordinator.refresh).toHaveBeenCalledTimes(1); service.dispose()
  })
  it('retries session verification without repeating login', async () => {
    const { service, getSession, coordinator } = setup(); getSession.mockRejectedValueOnce(new ApiError({ message: 'offline', status: 0, isNetworkError: true }))
    expect(await service.signIn(credentials)).toBe(false); expect(service.getSnapshot().status).toBe('network-error')
    expect(await service.retrySessionVerification()).toBe(true); expect(coordinator.login).toHaveBeenCalledTimes(1); service.dispose()
  })
  it('invalidates late session results on logout and clears cache', async () => {
    const { service, getSession, clearCache } = setup(); const gate = deferred<SessionResponse>(); getSession.mockReturnValueOnce(gate.promise)
    const login = service.signIn(credentials); await vi.waitFor(() => expect(getSession).toHaveBeenCalled())
    expect(await service.signOut()).toBe(true); gate.resolve(session); expect(await login).toBe(false)
    expect(service.getSnapshot().status).toBe('anonymous'); expect(clearCache).toHaveBeenCalled(); service.dispose()
  })
  it('handles cross-tab hints as invalidation without rebroadcasting', async () => {
    const { service, coordinator, receive } = setup(); await service.signIn(credentials); coordinator.publish.mockClear(); receive('session-changed')
    expect(service.getSnapshot().status).toBe('anonymous'); expect(coordinator.publish).not.toHaveBeenCalled(); service.dispose()
  })
  it('reports an unconfirmed logout while signing out locally', async () => {
    const { service, coordinator } = setup(); await service.signIn(credentials); coordinator.logout.mockRejectedValueOnce(new Error('offline'))
    expect(await service.signOut()).toBe(false); expect(service.getSnapshot()).toMatchObject({ status: 'anonymous', message: expect.stringContaining('could not be confirmed') }); service.dispose()
  })
})

describe('refresh cancellation', () => {
  it('lets one caller cancel while a shared refresh succeeds for another', async () => {
    const { service, coordinator } = setup(); await service.signIn(credentials)
    const gate = deferred<typeof access>(); coordinator.refresh.mockReturnValueOnce(gate.promise)
    const controller = new AbortController(); const first = service.refresh({ signal: controller.signal }); const second = service.refresh()
    controller.abort(); expect(await first).toBe(false); gate.resolve(access); expect(await second).toBe(true)
    expect(coordinator.refresh).toHaveBeenCalledTimes(1); service.dispose()
  })
})

describe('protected requests', () => {
  it('uses the in-memory bearer and discards results after sign-out', async () => {
    const { service } = setup(); await service.signIn(credentials)
    const gate = deferred<Response>(); const fetchMock = vi.fn().mockReturnValue(gate.promise); vi.stubGlobal('fetch', fetchMock)
    const request = service.request('get', 'api/v1/properties')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const options = fetchMock.mock.calls[0][1]
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer secret')
    await service.signOut(); gate.resolve(new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
    await expect(request).rejects.toThrow('Authentication changed'); service.dispose(); vi.unstubAllGlobals()
  })
})

describe('sign-in cancellation', () => {
  it('does not publish a session if sign-in is cancelled during verification', async () => {
    const { service, getSession } = setup()
    const gate = deferred<SessionResponse>()
    getSession.mockReturnValueOnce(gate.promise)
    const controller = new AbortController()
    const login = service.signIn(credentials, { signal: controller.signal })
    await vi.waitFor(() => expect(getSession).toHaveBeenCalled())
    controller.abort()
    gate.resolve(session)
    expect(await login).toBe(false)
    expect(service.getSnapshot().status).toBe('anonymous')
    service.dispose()
  })
})

describe('protected HTTP failures', () => {
  it('does not refresh on a forbidden response', async () => {
    const { service, coordinator } = setup(); await service.signIn(credentials)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })))
    await expect(service.request('get', 'api/v1/organizations/example')).rejects.toMatchObject({ status: 403 })
    expect(coordinator.refresh).not.toHaveBeenCalled(); service.dispose(); vi.unstubAllGlobals()
  })
  it('performs one coordinated refresh on an unauthorized protected request', async () => {
    const { service, coordinator } = setup(); await service.signIn(credentials)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })))
    await expect(service.request('get', 'api/v1/organizations/example')).rejects.toMatchObject({ status: 401 })
    await vi.waitFor(() => expect(service.getSnapshot().status).toBe('authenticated'))
    expect(coordinator.refresh).toHaveBeenCalledTimes(1); service.dispose(); vi.unstubAllGlobals()
  })
})

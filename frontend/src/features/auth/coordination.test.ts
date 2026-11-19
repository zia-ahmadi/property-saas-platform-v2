import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthCoordinationUnavailableError, AuthRefreshOutcomeUnknownError, AuthRefreshRecoveryRequiredError, createAuthCoordinator } from './coordination'
import type { CoordinatorDependencies } from './coordination'
import type { AccessTokenResponse } from './api'

vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://api.example.test' }))

const access: AccessTokenResponse = { accessToken: 'access-test', tokenType: 'Bearer', expiresIn: 900 }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function lockHarness() {
  let tail = Promise.resolve()
  let held = false
  const names: string[] = []
  const request = vi.fn(<T>(name: string, options: { signal: AbortSignal }, callback: () => Promise<T>): Promise<T> => {
    names.push(name)
    const result = deferred<T>()
    const abort = () => result.reject(options.signal.reason)
    if (options.signal.aborted) abort()
    else options.signal.addEventListener('abort', abort, { once: true })
    tail = tail.then(async () => {
      options.signal.removeEventListener('abort', abort)
      if (options.signal.aborted) return
      held = true
      try { result.resolve(await callback()) } catch (error) { result.reject(error) } finally { held = false }
    })
    return result.promise
  })
  return { locks: { request } as unknown as NonNullable<CoordinatorDependencies['locks']>, held: () => held, names, request }
}

function transport() {
  return {
    getCsrfToken: vi.fn().mockResolvedValue({ csrfToken: 'csrf-test' }),
    login: vi.fn().mockResolvedValue(access),
    refresh: vi.fn().mockResolvedValue(access),
    logout: vi.fn().mockResolvedValue(undefined),
  }
}

class ChannelMock {
  listeners = new Set<EventListener>()
  postMessage = vi.fn()
  close = vi.fn()
  addEventListener(_type: string, listener: EventListener) { this.listeners.add(listener) }
  removeEventListener(_type: string, listener: EventListener) { this.listeners.delete(listener) }
  receive(data: unknown) { for (const listener of this.listeners) listener(new MessageEvent('message', { data })) }
}

afterEach(() => { vi.useRealTimers() })

describe('auth coordination', () => {
  it('serializes complete bootstrap and mutation sequences across coordinator instances', async () => {
    const lock = lockHarness(), api = transport(), gate = deferred<void>(), entered = deferred<void>()
    const order: string[] = []
    api.getCsrfToken.mockImplementation(async () => { expect(lock.held()).toBe(true); order.push('csrf'); return { csrfToken: 'csrf-test' } })
    api.login.mockImplementation(async () => { expect(lock.held()).toBe(true); order.push('login-start'); entered.resolve(); await gate.promise; order.push('login-end'); return access })
    api.logout.mockImplementation(async () => { expect(lock.held()).toBe(true); order.push('logout') })
    const first = createAuthCoordinator({ locks: lock.locks, transport: api, createChannel: null })
    const second = createAuthCoordinator({ locks: lock.locks, transport: api, createChannel: null })
    const login = first.login({ email: 'a@example.test', password: 'password' })
    await entered.promise
    const logout = second.logout()
    await Promise.resolve()
    expect(order).toEqual(['csrf', 'login-start'])
    gate.resolve()
    await Promise.all([login, logout])
    expect(order).toEqual(['csrf', 'login-start', 'login-end', 'csrf', 'logout'])
    expect(lock.names).toEqual(['property-saas:browser-auth', 'property-saas:browser-auth'])
    expect(api.login).toHaveBeenCalledOnce()
    expect(api.logout).toHaveBeenCalledOnce()
    first.close(); second.close()
  })

  it('releases after rejection and allows another operation', async () => {
    const lock = lockHarness(), api = transport()
    api.login.mockRejectedValueOnce(new Error('failed'))
    const coordinator = createAuthCoordinator({ locks: lock.locks, transport: api, createChannel: null })
    await expect(coordinator.login({ email: 'a', password: 'b' })).rejects.toThrow('failed')
    await expect(coordinator.logout()).resolves.toBeUndefined()
    expect(api.getCsrfToken).toHaveBeenCalledTimes(2)
    coordinator.close()
  })

  it('cancels a waiter without executing bootstrap or its mutation', async () => {
    const lock = lockHarness(), api = transport(), gate = deferred<void>(), entered = deferred<void>()
    api.login.mockImplementation(async () => { entered.resolve(); await gate.promise; return access })
    const coordinator = createAuthCoordinator({ locks: lock.locks, transport: api, createChannel: null })
    const first = coordinator.login({ email: 'a', password: 'b' })
    await entered.promise
    const controller = new AbortController()
    const rejected = expect(coordinator.logout({ signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    await Promise.resolve()
    controller.abort()
    await rejected
    gate.resolve(); await first
    await coordinator.logout()
    expect(api.getCsrfToken).toHaveBeenCalledTimes(2)
    expect(api.logout).toHaveBeenCalledOnce()
    coordinator.close()
  })

  it('releases the lock when a running bootstrap is cancelled and never starts its mutation', async () => {
    const lock = lockHarness(), api = transport(), entered = deferred<void>()
    api.getCsrfToken.mockImplementationOnce((options) => new Promise((_resolve, reject) => {
      entered.resolve()
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
    }))
    const coordinator = createAuthCoordinator({ locks: lock.locks, transport: api, createChannel: null })
    const controller = new AbortController()
    const result = expect(coordinator.refresh({ signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    await entered.promise
    controller.abort()
    await result
    await expect(coordinator.logout()).resolves.toBeUndefined()
    expect(api.refresh).not.toHaveBeenCalled()
    expect(api.logout).toHaveBeenCalledOnce()
    coordinator.close()
  })

  it('never starts an already aborted operation or recursively acquires the lock', async () => {
    const lock = lockHarness(), api = transport(), controller = new AbortController()
    const coordinator = createAuthCoordinator({ locks: lock.locks, transport: api, createChannel: null })
    controller.abort()
    await expect(coordinator.login({ email: 'a', password: 'b' }, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    await coordinator.login({ email: 'a', password: 'b' })
    await coordinator.refresh()
    await coordinator.logout()
    expect(api.getCsrfToken).toHaveBeenCalledTimes(3)
    expect(lock.request).toHaveBeenCalledTimes(4)
    coordinator.close()
  })

  it('shares refresh within one instance and clears the flight after success and failure', async () => {
    const lock = lockHarness(), api = transport(), gate = deferred<AccessTokenResponse>()
    api.refresh.mockReturnValueOnce(gate.promise).mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce(access)
    const coordinator = createAuthCoordinator({ locks: lock.locks, transport: api, createChannel: null })
    const first = coordinator.refresh(), second = coordinator.refresh()
    gate.resolve(access)
    await expect(first).resolves.toEqual(access)
    await expect(second).resolves.toEqual(access)
    await expect(coordinator.refresh()).rejects.toThrow('failed')
    await expect(coordinator.refresh()).rejects.toBeInstanceOf(AuthRefreshRecoveryRequiredError)
    coordinator.acknowledgeRefreshRecovery()
    await expect(coordinator.refresh()).resolves.toEqual(access)
    expect(api.refresh).toHaveBeenCalledTimes(3)
    expect(lock.request).toHaveBeenCalledTimes(3)
    coordinator.close()
  })

  it('does not retry an unknown refresh outcome after timeout', async () => {
    vi.useFakeTimers()
    const lock = lockHarness(), api = transport(), entered = deferred<void>(), gate = deferred<AccessTokenResponse>()
    let signal: AbortSignal | undefined
    api.refresh.mockImplementation((_csrf, options) => { signal = options.signal; entered.resolve(); return gate.promise })
    const coordinator = createAuthCoordinator({ locks: lock.locks, transport: api, createChannel: null })
    const result = expect(coordinator.refresh({ timeoutMs: 50 })).rejects.toBeInstanceOf(AuthRefreshOutcomeUnknownError)
    await entered.promise
    await vi.advanceTimersByTimeAsync(50)
    await result
    expect(api.refresh).toHaveBeenCalledOnce()
    expect(signal?.aborted).toBe(false)
    expect(lock.held()).toBe(true)
    await expect(coordinator.refresh()).rejects.toBeInstanceOf(AuthRefreshRecoveryRequiredError)
    expect(() => coordinator.acknowledgeRefreshRecovery()).toThrow(AuthRefreshRecoveryRequiredError)
    gate.resolve(access)
    await vi.advanceTimersByTimeAsync(0)
    expect(lock.held()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    coordinator.acknowledgeRefreshRecovery()
    coordinator.close()
  })

  it('fails closed without Web Locks and never starts a request', async () => {
    const api = transport()
    const coordinator = createAuthCoordinator({ locks: null, transport: api, createChannel: null })
    await expect(coordinator.refresh()).rejects.toBeInstanceOf(AuthCoordinationUnavailableError)
    expect(api.getCsrfToken).not.toHaveBeenCalled()
    coordinator.close()
  })

  it('closing cancels queued work before it acquires the lock', async () => {
    const lock = lockHarness(), api = transport(), gate = deferred<void>(), entered = deferred<void>()
    api.login.mockImplementation(async () => { entered.resolve(); await gate.promise; return access })
    const holder = createAuthCoordinator({ locks: lock.locks, transport: api, createChannel: null })
    const closing = createAuthCoordinator({ locks: lock.locks, transport: api, createChannel: null })
    const active = holder.login({ email: 'a', password: 'b' })
    await entered.promise
    const queued = expect(closing.logout()).rejects.toMatchObject({ name: 'AuthCoordinatorClosedError' })
    await Promise.resolve()
    closing.close()
    await queued
    gate.resolve(); await active
    await expect(closing.refresh()).rejects.toMatchObject({ name: 'AuthCoordinatorClosedError' })
    expect(api.getCsrfToken).toHaveBeenCalledOnce()
    expect(api.logout).not.toHaveBeenCalled()
    holder.close()
  })

  it('closing during bootstrap aborts it and prevents the mutation', async () => {
    const lock = lockHarness(), api = transport(), entered = deferred<void>(), gate = deferred<{ csrfToken: string }>()
    api.getCsrfToken.mockImplementationOnce(() => { entered.resolve(); return gate.promise })
    const closing = createAuthCoordinator({ locks: lock.locks, transport: api, createChannel: null })
    const next = createAuthCoordinator({ locks: lock.locks, transport: api, createChannel: null })
    const active = expect(closing.login({ email: 'a', password: 'b' })).rejects.toMatchObject({ name: 'AuthCoordinatorClosedError' })
    await entered.promise
    closing.close()
    expect(lock.held()).toBe(true)
    const following = next.logout()
    gate.resolve({ csrfToken: 'csrf-test' })
    await active
    await following
    expect(api.login).not.toHaveBeenCalled()
    expect(api.logout).toHaveBeenCalledOnce()
    next.close()
  })

  it.each(['login', 'refresh'] as const)('closing during dispatched %s holds the lock until the request settles', async (kind) => {
    const lock = lockHarness(), api = transport(), entered = deferred<void>(), gate = deferred<AccessTokenResponse>()
    api[kind].mockImplementation(() => { entered.resolve(); return gate.promise })
    const closing = createAuthCoordinator({ locks: lock.locks, transport: api, createChannel: null })
    const next = createAuthCoordinator({ locks: lock.locks, transport: api, createChannel: null })
    const running = kind === 'login' ? closing.login({ email: 'a', password: 'b' }) : closing.refresh()
    const rejected = expect(running).rejects.toMatchObject({ name: kind === 'refresh' ? 'AuthRefreshOutcomeUnknownError' : 'AuthCoordinatorClosedError' })
    await entered.promise
    closing.close()
    const following = next.logout()
    await Promise.resolve()
    expect(lock.held()).toBe(true)
    expect(api.logout).not.toHaveBeenCalled()
    gate.resolve(access)
    await rejected
    await following
    expect(api.logout).toHaveBeenCalledOnce()
    next.close()
  })

  it('allows one refresh waiter to cancel without cancelling another', async () => {
    const lock = lockHarness(), api = transport(), gate = deferred<AccessTokenResponse>(), entered = deferred<void>()
    let sharedSignal: AbortSignal | undefined
    api.refresh.mockImplementation((_csrf, options) => { sharedSignal = options.signal; entered.resolve(); return gate.promise })
    const coordinator = createAuthCoordinator({ locks: lock.locks, transport: api, createChannel: null })
    const firstController = new AbortController(), secondController = new AbortController()
    const first = coordinator.refresh({ signal: firstController.signal })
    const second = coordinator.refresh({ signal: secondController.signal })
    await entered.promise
    const rejected = expect(first).rejects.toBeInstanceOf(AuthRefreshOutcomeUnknownError)
    firstController.abort()
    await rejected
    expect(sharedSignal?.aborted).toBe(false)
    gate.resolve(access)
    await expect(second).resolves.toEqual(access)
    expect(api.refresh).toHaveBeenCalledOnce()
    coordinator.close()
  })

  it('delivers a refresh failure to the remaining waiter after another cancels and clears the flight', async () => {
    const lock = lockHarness(), api = transport(), gate = deferred<AccessTokenResponse>(), entered = deferred<void>()
    api.refresh.mockImplementationOnce(() => { entered.resolve(); return gate.promise }).mockResolvedValueOnce(access)
    const coordinator = createAuthCoordinator({ locks: lock.locks, transport: api, createChannel: null })
    const controller = new AbortController()
    const cancelled = expect(coordinator.refresh({ signal: controller.signal })).rejects.toBeInstanceOf(AuthRefreshOutcomeUnknownError)
    const remaining = expect(coordinator.refresh()).rejects.toThrow('refresh failed')
    await entered.promise
    controller.abort()
    await cancelled
    expect(api.refresh).toHaveBeenCalledOnce()
    gate.reject(new Error('refresh failed'))
    await remaining
    await expect(coordinator.refresh()).rejects.toBeInstanceOf(AuthRefreshRecoveryRequiredError)
    coordinator.acknowledgeRefreshRecovery()
    await expect(coordinator.refresh()).resolves.toEqual(access)
    expect(api.refresh).toHaveBeenCalledTimes(2)
    coordinator.close()
  })

  it('cleans up timers and the caller abort listener after a shared refresh succeeds', async () => {
    vi.useFakeTimers()
    const lock = lockHarness(), api = transport(), controller = new AbortController()
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener')
    const coordinator = createAuthCoordinator({ locks: lock.locks, transport: api, createChannel: null })
    await expect(coordinator.refresh({ signal: controller.signal, timeoutMs: 500 })).resolves.toEqual(access)
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(vi.getTimerCount()).toBe(0)
    expect(api.refresh).toHaveBeenCalledOnce()
    coordinator.close()
  })

  it('aborts a shared refresh when every waiter cancels while it is queued', async () => {
    const lock = lockHarness(), api = transport(), gate = deferred<void>(), entered = deferred<void>()
    api.login.mockImplementation(async () => { entered.resolve(); await gate.promise; return access })
    const holder = createAuthCoordinator({ locks: lock.locks, transport: api, createChannel: null })
    const coordinator = createAuthCoordinator({ locks: lock.locks, transport: api, createChannel: null })
    const running = holder.login({ email: 'a', password: 'b' })
    await entered.promise
    const a = new AbortController(), b = new AbortController()
    const first = expect(coordinator.refresh({ signal: a.signal })).rejects.toMatchObject({ name: 'AbortError' })
    const second = expect(coordinator.refresh({ signal: b.signal })).rejects.toMatchObject({ name: 'AbortError' })
    await Promise.resolve()
    a.abort(); b.abort()
    await Promise.all([first, second])
    gate.resolve(); await running
    await expect(coordinator.logout()).resolves.toBeUndefined()
    expect(api.refresh).not.toHaveBeenCalled()
    expect(api.getCsrfToken).toHaveBeenCalledTimes(2)
    holder.close(); coordinator.close()
  })

  it('aborts bootstrap when all shared refresh waiters cancel before dispatch', async () => {
    const lock = lockHarness(), api = transport(), entered = deferred<void>(), gate = deferred<{ csrfToken: string }>()
    let bootstrapSignal: AbortSignal | undefined
    api.getCsrfToken.mockImplementationOnce((options) => { bootstrapSignal = options.signal; entered.resolve(); return gate.promise })
    const coordinator = createAuthCoordinator({ locks: lock.locks, transport: api, createChannel: null })
    const a = new AbortController(), b = new AbortController()
    const first = expect(coordinator.refresh({ signal: a.signal })).rejects.toMatchObject({ name: 'AbortError' })
    const second = expect(coordinator.refresh({ signal: b.signal })).rejects.toMatchObject({ name: 'AbortError' })
    await entered.promise
    a.abort(); b.abort()
    await Promise.all([first, second])
    expect(bootstrapSignal?.aborted).toBe(true)
    expect(lock.held()).toBe(true)
    gate.resolve({ csrfToken: 'csrf-test' })
    await vi.waitFor(() => expect(lock.held()).toBe(false))
    expect(api.refresh).not.toHaveBeenCalled()
    coordinator.close()
  })

  it('keeps a dispatched refresh running when all waiters cancel and requires recovery', async () => {
    const lock = lockHarness(), api = transport(), gate = deferred<AccessTokenResponse>(), entered = deferred<void>()
    let sharedSignal: AbortSignal | undefined
    api.refresh.mockImplementation((_csrf, options) => { sharedSignal = options.signal; entered.resolve(); return gate.promise })
    const coordinator = createAuthCoordinator({ locks: lock.locks, transport: api, createChannel: null })
    const a = new AbortController(), b = new AbortController()
    const first = expect(coordinator.refresh({ signal: a.signal })).rejects.toBeInstanceOf(AuthRefreshOutcomeUnknownError)
    const second = expect(coordinator.refresh({ signal: b.signal })).rejects.toBeInstanceOf(AuthRefreshOutcomeUnknownError)
    await entered.promise
    a.abort(); b.abort()
    await Promise.all([first, second])
    expect(sharedSignal?.aborted).toBe(false)
    expect(lock.held()).toBe(true)
    await expect(coordinator.refresh()).rejects.toBeInstanceOf(AuthRefreshRecoveryRequiredError)
    expect(() => coordinator.acknowledgeRefreshRecovery()).toThrow(AuthRefreshRecoveryRequiredError)
    gate.reject(new Error('late failure'))
    await vi.waitFor(() => expect(lock.held()).toBe(false))
    expect(api.refresh).toHaveBeenCalledOnce()
    await expect(coordinator.refresh()).rejects.toBeInstanceOf(AuthRefreshRecoveryRequiredError)
    coordinator.acknowledgeRefreshRecovery()
    coordinator.close()
  })

  it('requires recovery after the bounded shared refresh timeout', async () => {
    vi.useFakeTimers()
    const lock = lockHarness(), api = transport(), entered = deferred<void>()
    api.refresh.mockImplementation((_csrf, options) => new Promise((_resolve, reject) => {
      entered.resolve()
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
    }))
    const coordinator = createAuthCoordinator({ locks: lock.locks, transport: api, createChannel: null })
    const result = expect(coordinator.refresh()).rejects.toBeInstanceOf(AuthRefreshOutcomeUnknownError)
    await entered.promise
    await vi.advanceTimersByTimeAsync(30_000)
    await result
    expect(lock.held()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    await expect(coordinator.refresh()).rejects.toBeInstanceOf(AuthRefreshRecoveryRequiredError)
    expect(api.refresh).toHaveBeenCalledOnce()
    coordinator.acknowledgeRefreshRecovery()
    coordinator.close()
  })

  it('keeps the recovery gate after an abandoned refresh succeeds', async () => {
    const lock = lockHarness(), api = transport(), gate = deferred<AccessTokenResponse>(), entered = deferred<void>()
    api.refresh.mockImplementationOnce(() => { entered.resolve(); return gate.promise }).mockResolvedValueOnce(access)
    const coordinator = createAuthCoordinator({ locks: lock.locks, transport: api, createChannel: null })
    const controller = new AbortController()
    const cancelled = expect(coordinator.refresh({ signal: controller.signal })).rejects.toBeInstanceOf(AuthRefreshOutcomeUnknownError)
    await entered.promise
    controller.abort()
    await cancelled
    gate.resolve(access)
    await vi.waitFor(() => expect(lock.held()).toBe(false))
    await expect(coordinator.refresh()).rejects.toBeInstanceOf(AuthRefreshRecoveryRequiredError)
    expect(api.refresh).toHaveBeenCalledOnce()
    coordinator.acknowledgeRefreshRecovery()
    await expect(coordinator.refresh()).resolves.toEqual(access)
    expect(api.refresh).toHaveBeenCalledTimes(2)
    coordinator.close()
  })

  it('broadcasts only allowed event shapes and cleans up listeners and channel', () => {
    const channel = new ChannelMock(), listener = vi.fn()
    const coordinator = createAuthCoordinator({ locks: null, createChannel: () => channel as unknown as BroadcastChannel })
    const unsubscribe = coordinator.subscribe(listener)
    channel.receive({ type: 'logout' })
    channel.receive({ type: 'session-changed' })
    for (const invalid of [null, 'logout', { type: 'unknown' }, { type: 'logout', token: 'secret' }, ['logout']]) channel.receive(invalid)
    expect(listener.mock.calls).toEqual([['logout'], ['session-changed']])
    expect(channel.postMessage).not.toHaveBeenCalled()
    coordinator.publish('logout')
    expect(channel.postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'logout' })
    unsubscribe(); channel.receive({ type: 'logout' })
    expect(listener).toHaveBeenCalledTimes(2)
    coordinator.close(); coordinator.close()
    expect(channel.listeners.size).toBe(0)
    expect(channel.close).toHaveBeenCalledOnce()
  })
})

import { ApiError } from '@/lib/api/errors'
import * as browserAuth from './api'
import type { AccessTokenResponse, AuthRequestOptions, LoginRequest } from './api'

const LOCK_NAME = 'property-saas:browser-auth'
const CHANNEL_NAME = 'property-saas:session-events'
const RECOVERY_KEY = 'property-saas:auth-recovery'
const DEFAULT_TIMEOUT_MS = 30_000

export type SessionEvent = 'logout' | 'session-changed'

export class AuthCoordinationUnavailableError extends Error {
  constructor() {
    super('Cross-tab authentication coordination is unavailable')
    this.name = 'AuthCoordinationUnavailableError'
  }
}

export class AuthCoordinatorClosedError extends Error {
  constructor() {
    super('Authentication coordinator is closed')
    this.name = 'AuthCoordinatorClosedError'
  }
}

export class AuthRefreshOutcomeUnknownError extends Error {
  constructor() {
    super('Refresh was dispatched; its outcome may be unknown. Do not retry automatically.')
    this.name = 'AuthRefreshOutcomeUnknownError'
  }
}

export class AuthRefreshRecoveryRequiredError extends Error {
  constructor() {
    super('Refresh recovery is required before another refresh attempt.')
    this.name = 'AuthRefreshRecoveryRequiredError'
  }
}

export class AuthRefreshRejectedError extends Error {
  constructor() {
    super('The refresh session was rejected')
    this.name = 'AuthRefreshRejectedError'
  }
}

export class AuthRefreshUnavailableError extends Error {
  constructor() {
    super('Could not connect before sending the refresh request')
    this.name = 'AuthRefreshUnavailableError'
  }
}

type AuthTransport = Pick<typeof browserAuth, 'getCsrfToken' | 'login' | 'refresh' | 'logout'>
type LockRequester = Pick<LockManager, 'request'>
type EventChannel = Pick<BroadcastChannel, 'postMessage' | 'addEventListener' | 'removeEventListener' | 'close'>

export interface CoordinatorDependencies {
  recoveryStorage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  transport?: AuthTransport
  locks?: LockRequester | null
  createChannel?: (() => EventChannel) | null
}

/**
 * One instance per tab. Refresh callers share one operation, but cancel their own waits.
 * Cancellation after dispatch can leave the refresh outcome unknown.
 * Broadcasts are untrusted hints; without BroadcastChannel locking still applies.
 */
export function createAuthCoordinator(dependencies: CoordinatorDependencies = {}) {
  const transport = dependencies.transport ?? browserAuth
  const locks = dependencies.locks === undefined ? globalThis.navigator?.locks : dependencies.locks
  const createChannel = dependencies.createChannel === undefined
    ? typeof BroadcastChannel === 'undefined' ? null : () => new BroadcastChannel(CHANNEL_NAME)
    : dependencies.createChannel
  const channel = createChannel?.() ?? null
  const listeners = new Set<(event: SessionEvent) => void>()
  let closed = false
  const outstanding = new Set<AbortController>()
  type RefreshFlight = {
    controller: AbortController
    promise: Promise<AccessTokenResponse>
    waiters: number
    settled: boolean
    phase: 'waiting' | 'bootstrap' | 'dispatched' | 'settled'
  }
  let refreshInFlight: RefreshFlight | undefined
  // Explicit sign-in clears recovery. Storage carries only an operation marker across reloads.
  let refreshRecoveryRequired = false
  const storage = dependencies.recoveryStorage
  const clearRefreshMarker = () => {
    if (storage?.getItem(RECOVERY_KEY) === 'refresh') storage.removeItem(RECOVERY_KEY)
  }

  const receive = (event: MessageEvent<unknown>) => {
    const data = event.data
    if (data === null || typeof data !== 'object' || Array.isArray(data)) return
    const record = data as Record<string, unknown>
    if (Object.keys(record).length !== 1 || !Object.hasOwn(record, 'type') ||
        (record.type !== 'logout' && record.type !== 'session-changed')) return
    for (const listener of listeners) listener(record.type)
  }
  channel?.addEventListener('message', receive as EventListener)

  function run<T>(operation: (csrfToken: string, options: AuthRequestOptions) => Promise<T>, options: AuthRequestOptions = {}, onBootstrap?: () => void): Promise<T> {
    if (closed) return Promise.reject(new AuthCoordinatorClosedError())
    if (!locks || typeof locks.request !== 'function') return Promise.reject(new AuthCoordinationUnavailableError())
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) return Promise.reject(new RangeError('timeoutMs must be a positive integer'))

    const controller = new AbortController()
    outstanding.add(controller)
    const abortFromCaller = () => controller.abort(options.signal?.reason)
    if (options.signal?.aborted) abortFromCaller()
    else options.signal?.addEventListener('abort', abortFromCaller, { once: true })
    const timeout = setTimeout(() => controller.abort(new DOMException('Authentication coordination timed out', 'TimeoutError')), timeoutMs)
    const requestOptions = { signal: controller.signal, timeoutMs }

    // The callback owns both network calls; callers cannot acquire this lock recursively.
    return Promise.resolve().then(() => locks.request(LOCK_NAME, { mode: 'exclusive', signal: controller.signal }, async () => {
      controller.signal.throwIfAborted()
      onBootstrap?.()
      const { csrfToken } = await transport.getCsrfToken(requestOptions).catch(error => {
        controller.signal.throwIfAborted()
        throw error
      })
      controller.signal.throwIfAborted()
      const result = await operation(csrfToken, requestOptions)
      controller.signal.throwIfAborted()
      return result
    })).finally(() => {
      clearTimeout(timeout)
      options.signal?.removeEventListener('abort', abortFromCaller)
      outstanding.delete(controller)
    })
  }

  function waitForRefresh(flight: RefreshFlight, options: AuthRequestOptions): Promise<AccessTokenResponse> {
    if (options.signal?.aborted) return Promise.reject(options.signal.reason)
    if (flight.controller.signal.aborted) return Promise.reject(
      flight.phase === 'dispatched' ? new AuthRefreshOutcomeUnknownError() : flight.controller.signal.reason,
    )
    const timeoutMs = options.timeoutMs
    if (timeoutMs !== undefined && (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)) {
      return Promise.reject(new RangeError('timeoutMs must be a positive integer'))
    }
    flight.waiters++
    return new Promise((resolve, reject) => {
      let done = false
      let timeout: ReturnType<typeof setTimeout> | undefined
      const finish = () => {
        if (done) return false
        done = true
        if (timeout !== undefined) clearTimeout(timeout)
        options.signal?.removeEventListener('abort', abort)
        flight.waiters--
        return true
      }
      const cancel = (reason: unknown) => {
        if (!finish()) return
        const error = flight.phase === 'dispatched' ? new AuthRefreshOutcomeUnknownError() : reason
        if (flight.waiters === 0 && !flight.settled) {
          if (flight.phase === 'dispatched') refreshRecoveryRequired = true
          else flight.controller.abort(reason)
        }
        reject(error)
      }
      const abort = () => cancel(options.signal?.reason)
      options.signal?.addEventListener('abort', abort, { once: true })
      if (timeoutMs !== undefined) timeout = setTimeout(() => cancel(new DOMException('Authentication wait timed out', 'TimeoutError')), timeoutMs)
      void flight.promise.then(
        (value) => { if (finish()) resolve(value) },
        (error: unknown) => { if (finish()) reject(error) },
      )
    })
  }

  return {
    login(request: LoginRequest, options?: AuthRequestOptions) {
      return run((csrf, requestOptions) => transport.login(request, csrf, requestOptions), options)
    },
    refresh(options?: AuthRequestOptions) {
      if (closed) return Promise.reject(new AuthCoordinatorClosedError())
      if (options?.signal?.aborted) return Promise.reject(options.signal.reason)
      if (options?.timeoutMs !== undefined && (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0)) return Promise.reject(new RangeError('timeoutMs must be a positive integer'))
      if (refreshRecoveryRequired) return Promise.reject(new AuthRefreshRecoveryRequiredError())
      if (!refreshInFlight && storage?.getItem(RECOVERY_KEY)) return Promise.reject(new AuthRefreshRecoveryRequiredError())
      if (!refreshInFlight) {
        const controller = new AbortController()
        const flight: RefreshFlight = { controller, promise: undefined as unknown as Promise<AccessTokenResponse>, waiters: 0, settled: false, phase: 'waiting' }
        flight.promise = run(async (csrf, requestOptions) => {
          if (storage?.getItem(RECOVERY_KEY) !== 'logout') storage?.setItem(RECOVERY_KEY, 'refresh')
          flight.phase = 'dispatched'
          try {
            const value = await transport.refresh(csrf, requestOptions)
            if (requestOptions.signal?.aborted) throw new AuthRefreshOutcomeUnknownError()
            if (!refreshRecoveryRequired) clearRefreshMarker()
            return value
          } catch (error) {
            if (!requestOptions.signal?.aborted && error instanceof ApiError && error.status === 401) {
              clearRefreshMarker()
              throw new AuthRefreshRejectedError()
            }
            refreshRecoveryRequired = true
            if (requestOptions.signal?.aborted) throw new AuthRefreshOutcomeUnknownError()
            throw error
          }
        }, { signal: controller.signal }, () => { flight.phase = 'bootstrap' }).catch(error => {
          if (flight.phase !== 'dispatched' && (
            (error instanceof ApiError && (error.isNetworkError || error.isTimeoutError)) ||
            (error instanceof DOMException && error.name === 'TimeoutError')
          )) throw new AuthRefreshUnavailableError()
          throw error
        })
        refreshInFlight = flight
        const clear = () => {
          flight.settled = true
          flight.phase = 'settled'
          if (refreshInFlight === flight) refreshInFlight = undefined
        }
        void flight.promise.then(clear, clear)
      }
      return waitForRefresh(refreshInFlight, options ?? {})
    },
    /** Call only after explicit recovery, such as a successful new sign-in. */
    acknowledgeRefreshRecovery() {
      if (closed) throw new AuthCoordinatorClosedError()
      if (refreshInFlight) throw new AuthRefreshRecoveryRequiredError()
      refreshRecoveryRequired = false
      storage?.removeItem(RECOVERY_KEY)
    },
    async logout(options?: AuthRequestOptions) {
      try {
        storage?.setItem(RECOVERY_KEY, 'logout')
      } catch {
        // Still attempt server revocation if the browser cannot write the marker.
      }
      await run((csrf, requestOptions) => transport.logout(csrf, requestOptions), options)
      storage?.removeItem(RECOVERY_KEY)
    },
    publish(type: SessionEvent) {
      if (closed) throw new AuthCoordinatorClosedError()
      if (type !== 'logout' && type !== 'session-changed') throw new TypeError('Invalid session event')
      channel?.postMessage({ type })
    },
    subscribe(listener: (event: SessionEvent) => void) {
      if (closed) throw new AuthCoordinatorClosedError()
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    close() {
      if (closed) return
      closed = true
      for (const controller of outstanding) controller.abort(new AuthCoordinatorClosedError())
      listeners.clear()
      channel?.removeEventListener('message', receive as EventListener)
      channel?.close()
    },
  }
}

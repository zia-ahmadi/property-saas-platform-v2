import { getSession, type LoginRequest, type SessionResponse } from './api'
import { createAuthCoordinator, AuthCoordinationUnavailableError, AuthRefreshRejectedError, AuthRefreshUnavailableError } from './coordination'
import { ApiError } from '@/lib/api/errors'
import { apiClient, type RequestOptions } from '@/lib/api/client'

export type AuthState =
  | { status: 'restoring' }
  | { status: 'anonymous'; message?: string }
  | { status: 'authenticating' }
  | { status: 'authenticated'; session: { readonly user: Readonly<SessionResponse['user']>; readonly organizations: readonly Readonly<SessionResponse['organizations'][number]>[] } }
  | { status: 'refreshing' }
  | { status: 'network-error'; message: string }
  | { status: 'recovery-required'; message: string }

type Coordinator = ReturnType<typeof createAuthCoordinator>
type Dependencies = {
  coordinator: Coordinator
  clearCache: () => Promise<void>
  session?: typeof getSession
  restoreOnStartup?: boolean
}
type Candidate = { token: string; expectedUser?: string; expiresAt: number }
type OperationOptions = { signal?: AbortSignal }

function waitFor<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T | false> {
  if (!signal) return promise
  if (signal.aborted) return Promise.resolve(false)
  return new Promise(resolve => {
    const abort = () => resolve(false)
    signal.addEventListener('abort', abort, { once: true })
    void promise.then(value => { signal.removeEventListener('abort', abort); resolve(value) }, () => { signal.removeEventListener('abort', abort); resolve(false) })
  })
}

export class AuthLifecycleService {
  private state: AuthState
  private startupAttempted = false
  private startupRetry = false
  private listeners = new Set<() => void>()
  private generation = 0
  private token: string | undefined
  private candidate: Candidate | undefined
  private refreshFlight: Promise<boolean> | undefined
  private timer: ReturnType<typeof setTimeout> | undefined
  private disposed = false
  private unsubscribe: () => void
  private cacheCleanup: Promise<void> = Promise.resolve()
  private session: typeof getSession

  private deps: Dependencies
  constructor(deps: Dependencies) {
    this.deps = deps
    this.state = { status: deps.restoreOnStartup === false ? 'anonymous' : 'restoring' }
    this.session = deps.session ?? getSession
    this.unsubscribe = deps.coordinator.subscribe(() => { this.invalidate('Your session changed in another tab. Please sign in again.') })
  }
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private set(state: AuthState) { this.state = Object.freeze(state); this.listeners.forEach(listener => listener()) }
  private clear() {
    this.token = undefined
    this.candidate = undefined
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    this.cacheCleanup = this.cacheCleanup.then(() => this.deps.clearCache())
    return this.cacheCleanup
  }
  private invalidate(message?: string) {
    ++this.generation
    void this.clear()
    this.set({ status: 'anonymous', message })
  }
  private valid(generation: number) { return !this.disposed && generation === this.generation }
  private async verify(candidate: Candidate, generation: number): Promise<boolean> {
    this.candidate = candidate
    try {
      const session = await this.session(candidate.token)
      if (!this.valid(generation)) return false
      if (candidate.expectedUser && candidate.expectedUser !== session.user.id) {
        await this.clear()
        if (this.valid(generation)) this.set({ status: 'recovery-required', message: 'Your account changed in another tab. Please sign in again.' })
        return false
      }
      await this.cacheCleanup
      if (!this.valid(generation)) return false
      this.candidate = undefined
      this.token = candidate.token
      const verified = Object.freeze({ user: Object.freeze({ ...session.user }), organizations: Object.freeze(session.organizations.map(org => Object.freeze({ ...org }))) })
      this.set({ status: 'authenticated', session: verified })
      const remaining = candidate.expiresAt - Date.now()
      if (remaining > 30_000) this.timer = setTimeout(() => { void this.refresh() }, remaining - 30_000)
      return true
    } catch (error) {
      if (!this.valid(generation)) return false
      if (error instanceof ApiError && (error.isNetworkError || error.isTimeoutError)) {
        this.set({ status: 'network-error', message: 'Unable to verify your session. Check your connection and try again.' })
      } else {
        await this.clear()
        if (this.valid(generation)) this.set({ status: 'recovery-required', message: 'Your session could not be verified. Please sign in again.' })
      }
      return false
    }
  }
  restoreSession(): Promise<boolean> {
    if (this.startupAttempted || this.state.status !== 'restoring' || this.disposed) {
      return Promise.resolve(false)
    }
    this.startupAttempted = true
    return this.restoreFromCookie()
  }

  private async restoreFromCookie(): Promise<boolean> {
    const generation = ++this.generation
    this.startupRetry = false
    try {
      const result = await this.deps.coordinator.refresh()
      if (!this.valid(generation)) return false
      return await this.verify({ token: result.accessToken, expiresAt: Date.now() + result.expiresIn * 1000 }, generation)
    } catch (error) {
      if (!this.valid(generation)) return false
      if (error instanceof AuthRefreshRejectedError) {
        this.set({ status: 'anonymous' })
      } else if (error instanceof AuthRefreshUnavailableError) {
        this.startupRetry = true
        this.set({ status: 'network-error', message: 'Unable to restore your session. Check your connection and try again.' })
      } else {
        this.set({ status: 'recovery-required', message: 'Your session could not be refreshed safely. Please sign in again.' })
      }
      return false
    }
  }

  async signIn(credentials: LoginRequest, options: OperationOptions = {}): Promise<boolean> {
    if (this.disposed || options.signal?.aborted) return false
    const generation = ++this.generation
    this.startupRetry = false
    this.set({ status: 'authenticating' })
    const cancel = () => { if (this.valid(generation)) this.invalidate() }
    options.signal?.addEventListener('abort', cancel, { once: true })
    if (options.signal?.aborted) cancel()
    try {
      await this.clear()
      if (!this.valid(generation)) return false
      const result = await this.deps.coordinator.login(credentials, options)
      if (!this.valid(generation)) return false
      this.deps.coordinator.acknowledgeRefreshRecovery()
      this.deps.coordinator.publish('session-changed')
      return await this.verify({ token: result.accessToken, expiresAt: Date.now() + result.expiresIn * 1000 }, generation)
    } catch (error) {
      if (!this.valid(generation)) return false
      const message = error instanceof ApiError && error.status === 401 ? 'Invalid email or password.' : error instanceof AuthCoordinationUnavailableError ? 'Secure browser coordination is unavailable.' : 'Sign-in could not be completed. Please try again.'
      this.set({ status: 'anonymous', message })
      return false
    } finally {
      options.signal?.removeEventListener('abort', cancel)
    }
  }
  refresh(options: OperationOptions = {}): Promise<boolean> {
    if (options.signal?.aborted) return Promise.resolve(false)
    if (this.refreshFlight) return waitFor(this.refreshFlight, options.signal)
    if (this.state.status !== 'authenticated' || this.disposed) return Promise.resolve(false)
    const user = this.state.session.user.id
    const generation = ++this.generation
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    // Keep an established session and its in-memory bearer usable while the
    // new token is negotiated so mounted queries, forms and dialogs are not torn
    // down; verify() atomically replaces the session once the token is confirmed.
    const flight = (async () => {
      try {
        const result = await this.deps.coordinator.refresh()
        if (!this.valid(generation)) return false
        return await this.verify({ token: result.accessToken, expectedUser: user, expiresAt: Date.now() + result.expiresIn * 1000 }, generation)
      } catch {
        if (this.valid(generation)) {
          await this.clear()
          if (this.valid(generation)) this.set({ status: 'recovery-required', message: 'Your session could not be refreshed safely. Please sign in again.' })
        }
        return false
      }
    })()
    this.refreshFlight = flight
    void flight.finally(() => { if (this.refreshFlight === flight) this.refreshFlight = undefined })
    return waitFor(flight, options.signal)
  }
  retrySessionVerification(): Promise<boolean> {
    if (this.state.status !== 'network-error') return Promise.resolve(false)
    if (this.startupRetry) {
      this.set({ status: 'restoring' })
      return this.restoreFromCookie()
    }
    if (!this.candidate || this.candidate.expiresAt <= Date.now()) {
      this.invalidate('Please sign in again.')
      return Promise.resolve(false)
    }
    const candidate = this.candidate
    this.set({ status: 'authenticating' })
    return this.verify(candidate, this.generation)
  }
  async signOut(): Promise<boolean> {
    if (this.disposed) return false
    this.invalidate()
    this.deps.coordinator.publish('logout')
    const generation = this.generation
    try { await this.deps.coordinator.logout(); return true } catch { if (this.valid(generation)) this.set({ status: 'anonymous', message: 'Signed out locally, but server logout could not be confirmed.' }); return false }
  }
  async request<T>(method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    if (this.state.status !== 'authenticated' || !this.token) throw new Error('Authentication required')
    const generation = this.generation
    const headers = new Headers(options.headers)
    headers.set('Authorization', `Bearer ${this.token}`)
    const requestOptions = { ...options, headers }
    try {
      const result = method === 'get' || method === 'delete' ? await apiClient[method]<T>(path, requestOptions) : await apiClient[method]<T>(path, body, requestOptions)
      if (!this.valid(generation)) throw new Error('Authentication changed')
      return result
    } catch (error) {
      if (!this.valid(generation)) throw new Error('Authentication changed', { cause: error })
      if (error instanceof ApiError && error.status === 401) void this.refresh()
      throw error
    }
  }
  dispose() { if (this.disposed) return; this.invalidate(); this.disposed = true; this.unsubscribe(); this.deps.coordinator.close(); this.listeners.clear() }
}

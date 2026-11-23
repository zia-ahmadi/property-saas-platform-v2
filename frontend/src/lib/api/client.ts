import { API_BASE_URL } from '@/config/env'
import { ApiError } from './errors'

export interface RequestOptions extends Omit<RequestInit, 'body' | 'signal'> {
  params?: Record<string, string | number | boolean | undefined>
  body?: unknown
  responseType?: 'blob'
  timeoutMs?: number
  signal?: AbortSignal
}

const resolveEndpoint = (endpoint: string): URL => {
  const invalidPath = () => new Error('Invalid relative API path')

  if (
    typeof endpoint !== 'string' ||
    endpoint === '' ||
    endpoint !== endpoint.trim() ||
    /[\s\\#\p{Cc}]/u.test(endpoint)
  ) {
    throw invalidPath()
  }

  // A single leading slash still denotes a path relative to the API base.
  const relativePath = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
  const [pathname] = relativePath.split('?', 1)

  if (pathname.startsWith('/') || pathname.includes('//')) {
    throw invalidPath()
  }

  try {
    decodeURIComponent(relativePath)

    for (const [index, segment] of pathname.split('/').entries()) {
      let decoded = segment
      while (true) {
        if (
          decoded === '.' ||
          decoded === '..' ||
          /[/\\#?\p{Cc}]/u.test(decoded) ||
          (index === 0 && /^[a-z][a-z0-9+.-]*:/i.test(decoded.trimStart()))
        ) {
          throw invalidPath()
        }

        if (!/%[0-9a-f]{2}/i.test(decoded)) {
          break
        }
        decoded = decodeURIComponent(decoded)
      }
    }
  } catch {
    throw invalidPath()
  }

  const base = new URL(`${API_BASE_URL}/`)
  const url = new URL(relativePath, base)

  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
    throw invalidPath()
  }

  return url
}

const request = async <T>(endpoint: string, options: RequestOptions = {}): Promise<T> => {
  const {
    params,
    body,
    responseType,
    timeoutMs = 30_000,
    headers: customHeaders,
    signal: callerSignal,
    ...fetchOptions
  } = options

  if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('timeoutMs must be a positive finite number')
  }

  const fullUrl = resolveEndpoint(endpoint)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        fullUrl.searchParams.append(key, String(value))
      }
    })
  }

  const headers = new Headers(customHeaders)
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  let serializedBody: BodyInit | undefined = undefined
  if (body !== undefined && body !== null) {
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      serializedBody = body
    } else {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
      }
      serializedBody = JSON.stringify(body)
    }
  }

  const controller = new AbortController()
  const timeoutReason = Symbol('request timeout')
  const abortFromCaller = () => controller.abort(callerSignal?.reason)

  if (callerSignal?.aborted) {
    abortFromCaller()
  } else {
    callerSignal?.addEventListener('abort', abortFromCaller, { once: true })
  }

  const timeoutId = setTimeout(() => controller.abort(timeoutReason), timeoutMs)

  try {
    controller.signal.throwIfAborted()

    const response = await fetch(fullUrl.href, {
      ...fetchOptions,
      method: fetchOptions.method || 'GET',
      headers,
      body: serializedBody,
      signal: controller.signal,
    })
    controller.signal.throwIfAborted()

    if (!response.ok) {
      // Discard the error payload without delaying delivery of the HTTP status.
      void response.body?.cancel().catch(() => {})
      throw new ApiError({
        message:
          response.status >= 500
            ? 'An internal server error occurred. Please try again later.'
            : `HTTP request failed with status ${response.status}`,
        status: response.status,
      })
    }

    if (response.status === 204 || response.status === 205) {
      return undefined as T
    }

    if (responseType === 'blob') {
      return (await response.blob()) as T
    }

    const text = await response.text()
    controller.signal.throwIfAborted()

    if (text.trim() === '') {
      return undefined as T
    }

    const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
    if (contentType === 'application/json' || contentType?.endsWith('+json')) {
      try {
        return JSON.parse(text) as T
      } catch {
        throw new ApiError({
          message: 'Failed to parse JSON response',
          status: response.status,
        })
      }
    }

    return text as T
  } catch (error: unknown) {
    if (controller.signal.reason === timeoutReason) {
      throw new ApiError({
        message: `Request timed out after ${timeoutMs}ms`,
        status: 408,
        isTimeoutError: true,
      })
    }

    if (controller.signal.aborted) {
      throw new ApiError({
        message: 'Request was aborted by the caller',
        status: 0,
        isAbortError: true,
      })
    }

    if (error instanceof ApiError) {
      throw error
    }

    throw new ApiError({
      message: 'Network error occurred',
      status: 0,
      isNetworkError: true,
    })
  } finally {
    clearTimeout(timeoutId)
    callerSignal?.removeEventListener('abort', abortFromCaller)
  }
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PUT', body }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
}

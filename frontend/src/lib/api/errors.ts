/**
 * Centralized API Error class for HTTP, network, timeout, and cancellation errors.
 */
export class ApiError extends Error {
  public readonly status: number
  public readonly code?: string
  public readonly details?: unknown
  public readonly isNetworkError: boolean
  public readonly isTimeoutError: boolean
  public readonly isAbortError: boolean

  constructor({
    message,
    status = 500,
    code,
    details,
    isNetworkError = false,
    isTimeoutError = false,
    isAbortError = false,
  }: {
    message: string
    status?: number
    code?: string
    details?: unknown
    isNetworkError?: boolean
    isTimeoutError?: boolean
    isAbortError?: boolean
  }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.isNetworkError = isNetworkError
    this.isTimeoutError = isTimeoutError
    this.isAbortError = isAbortError
  }
}

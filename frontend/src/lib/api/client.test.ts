import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './client'
import { ApiError } from './errors'

vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://api.example.test/platform/api/v1' }))

const fetchMock = vi.fn<typeof fetch>()
const baseUrl = 'https://api.example.test/platform/api/v1'

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

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

describe('apiClient', () => {
  it('returns parsed JSON from a GET with default headers', async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 'prop-101' }))
    await expect(apiClient.get('properties')).resolves.toEqual({ id: 'prop-101' })
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      `${baseUrl}/properties`,
      expect.objectContaining({ method: 'GET' }),
    )
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Accept')).toBe('application/json')
  })

  it('serializes query values, omits undefined, and preserves existing query parameters', async () => {
    fetchMock.mockResolvedValue(Response.json([]))
    await apiClient.get('properties?sort=name', {
      params: { search: 'A & B', page: 2, active: false, missing: undefined },
    })
    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(Object.fromEntries(url.searchParams)).toEqual({
      sort: 'name',
      search: 'A & B',
      page: '2',
      active: 'false',
    })
  })

  it('serializes POST JSON and preserves custom headers', async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 1 }))
    await apiClient.post('properties', { name: 'Tower' }, { headers: { 'X-Request-ID': 'test' } })
    const options = fetchMock.mock.calls[0][1]
    expect(options).toMatchObject({ method: 'POST', body: '{"name":"Tower"}' })
    const headers = new Headers(options?.headers)
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('X-Request-ID')).toBe('test')
  })

  it('sends multipart form data without overriding its generated content type', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    const form = new FormData()
    form.set('file', new Blob(['image bytes'], { type: 'image/png' }), 'image.png')
    await apiClient.put('images/property/one', form)
    const options = fetchMock.mock.calls[0][1]
    expect(options?.body).toBe(form)
    expect(new Headers(options?.headers).has('Content-Type')).toBe(false)
  })

  it('returns an image response as a blob when requested', async () => {
    const blob = new Blob(['image bytes'], { type: 'image/png' })
    fetchMock.mockResolvedValue(new Response(blob, { headers: { 'Content-Type': 'image/png' } }))
    await expect(apiClient.get('images/property/one', { responseType: 'blob' })).resolves.toEqual(blob)
  })

  it.each([204, 205])('returns undefined for HTTP %s', async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status }))
    await expect(apiClient.get('properties')).resolves.toBeUndefined()
  })

  it.each(['', '   '])('returns undefined for an empty successful response (%j)', async (body) => {
    fetchMock.mockResolvedValue(
      new Response(body, { headers: { 'Content-Type': 'application/json' } }),
    )
    await expect(apiClient.get('properties')).resolves.toBeUndefined()
  })

  it.each([
    {
      status: 400,
      body: '{"message":"private validation details"}',
      message: 'HTTP request failed with status 400',
    },
    {
      status: 500,
      body: 'sensitive database error',
      message: 'An internal server error occurred. Please try again later.',
    },
    { status: 403, body: null, message: 'HTTP request failed with status 403' },
  ])(
    'handles HTTP $status without exposing response details',
    async ({ status, body, message }) => {
      fetchMock.mockResolvedValue(new Response(body, { status }))
      const error = await apiClient.get('properties').catch((error: unknown) => error)
      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({
        status,
        message,
        details: undefined,
        isNetworkError: false,
        isTimeoutError: false,
        isAbortError: false,
      })
    },
  )

  it('normalizes network failures', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(apiClient.get('properties')).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
      message: 'Network error occurred',
      isNetworkError: true,
      isAbortError: false,
      isTimeoutError: false,
    })
  })

  it('aborts a timed out request and clears its timer', async () => {
    vi.useFakeTimers()
    pendingFetch()
    const result = expect(apiClient.get('properties', { timeoutMs: 100 })).rejects.toMatchObject({
      status: 408,
      message: 'Request timed out after 100ms',
      isTimeoutError: true,
      isAbortError: false,
      isNetworkError: false,
    })
    await vi.advanceTimersByTimeAsync(100)
    await result
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('distinguishes caller cancellation from timeout and removes the listener', async () => {
    vi.useFakeTimers()
    pendingFetch()
    const controller = new AbortController()
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener')
    const result = expect(
      apiClient.get('properties', { signal: controller.signal }),
    ).rejects.toMatchObject({
      status: 0,
      isAbortError: true,
      isTimeoutError: false,
      isNetworkError: false,
    })
    controller.abort()
    await result
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not fetch when the caller signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(apiClient.get('properties', { signal: controller.signal })).rejects.toMatchObject({
      isAbortError: true,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    'https://evil.test/data',
    '//evil.test/data',
    '../secrets',
    'properties/../../secrets',
    '%2e%2e/secrets',
    '%252e%252e/secrets',
    'properties%2f..%2fsecrets',
    'properties\\..\\secrets',
    '/%2fexample.test',
    'https%3A/evil.test',
    'properties#fragment',
  ])('rejects unsafe endpoint %s before fetching', async (endpoint) => {
    await expect(apiClient.get(endpoint)).rejects.toThrow('Invalid relative API path')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(['properties', '/properties'])(
    'preserves the configured API base path for %s',
    async (endpoint) => {
      fetchMock.mockResolvedValue(Response.json([]))
      await apiClient.get(endpoint)
      expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/properties`, expect.any(Object))
    },
  )

  it('reports malformed successful JSON as a parse error', async () => {
    fetchMock.mockResolvedValue(
      new Response('{broken', { headers: { 'Content-Type': 'application/json; charset=utf-8' } }),
    )
    await expect(apiClient.get('properties')).rejects.toMatchObject({
      name: 'ApiError',
      status: 200,
      message: 'Failed to parse JSON response',
      isNetworkError: false,
    })
  })

  it('clears the timeout after success', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(Response.json([]))
    await apiClient.get('properties')
    expect(vi.getTimerCount()).toBe(0)
  })
})

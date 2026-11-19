/**
 * Environment configuration module
 * Validates and normalizes environment variables for application-wide use.
 */

const getApiBaseUrl = (): string => {
  const url = import.meta.env.VITE_API_BASE_URL

  if (!url || url.trim() === '') {
    throw new Error('VITE_API_BASE_URL is not defined or is empty')
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error('VITE_API_BASE_URL is not a valid URL')
  }

  // Accept only http: and https: protocols
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(
      `VITE_API_BASE_URL protocol "${parsedUrl.protocol}" is not supported. Use http: or https:`,
    )
  }

  // Reject URLs containing embedded credentials
  if (parsedUrl.username || parsedUrl.password) {
    throw new Error('VITE_API_BASE_URL must not contain embedded credentials')
  }

  // Reject URLs with query strings or fragments
  if (parsedUrl.href.includes('?') || parsedUrl.href.includes('#')) {
    throw new Error('VITE_API_BASE_URL must not contain query strings or fragments')
  }

  // Normalize: remove trailing slashes to ensure consistent path joining
  return parsedUrl.href.replace(/\/+$/, '')
}

export const API_BASE_URL = getApiBaseUrl()

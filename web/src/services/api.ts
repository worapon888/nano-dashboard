import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from './auth-storage'

/**
 * Shared API client.
 * VITE_API_BASE_URL should point to the backend origin (e.g. http://localhost:3000).
 * The /api global prefix (set in NestJS main.ts) is appended here so individual
 * service paths don't need to repeat it.
 */
const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
const normalizedBaseUrl = configuredBaseUrl
  .replace(/\/+$/, '')
  .replace(/\/api$/, '')
export const apiBaseUrl = `${normalizedBaseUrl}/api`

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
  skipAuthRefresh?: boolean
}

console.log('[apiClient] VITE_API_BASE_URL =', import.meta.env.VITE_API_BASE_URL)
console.log('[apiClient] baseURL =', apiBaseUrl)

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
})

let refreshPromise: Promise<string> | null = null

async function requestTokenRefresh(): Promise<string> {
  const refreshToken = getRefreshToken()

  if (!refreshToken) {
    throw new Error('No refresh token available.')
  }

  const response = await axios.post<{
    success: true
    data: {
      accessToken: string
      refreshToken: string
    }
  }>(
    `${apiBaseUrl}/auth/refresh`,
    { refreshToken },
  )

  const nextTokens = {
    accessToken: response.data.data.accessToken,
    refreshToken: response.data.data.refreshToken,
  }

  setAuthTokens(nextTokens)
  return nextTokens.accessToken
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined
    const status = error.response?.status

    if (
      status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      originalRequest.skipAuthRefresh
    ) {
      return Promise.reject(error)
    }

    const accessToken = getAccessToken()
    const refreshToken = getRefreshToken()

    if (!accessToken || !refreshToken) {
      clearAuthTokens()
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      refreshPromise ??= requestTokenRefresh().finally(() => {
        refreshPromise = null
      })

      const nextAccessToken = await refreshPromise
      originalRequest.headers = originalRequest.headers ?? {}
      originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`

      return apiClient(originalRequest)
    } catch (refreshError) {
      clearAuthTokens()
      return Promise.reject(refreshError)
    }
  },
)

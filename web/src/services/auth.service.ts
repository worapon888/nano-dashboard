import axios from 'axios'
import { apiBaseUrl, apiClient } from './api'
import type { AuthTokens } from './auth-storage'
import { getRefreshToken } from './auth-storage'

interface AuthPayload {
  success: true
  data: {
    accessToken: string
    refreshToken: string
    tokenType: string
    expiresIn: string
    refreshExpiresIn: string
  }
}

export interface AuthenticatedUser {
  id: string
  email: string
  displayName: string
  role: string
  isActive: boolean
  createdAt: string
}

interface AuthenticatedUserResponse {
  success: true
  data: AuthenticatedUser
}

function normalizeAuthError(error: unknown): Error {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error
      ? error
      : new Error('Authentication failed. Please try again.')
  }

  if (error.code === 'ERR_NETWORK' || !error.response) {
    return new Error(
      'Network error. Check that the API server is running, reachable, and allows CORS.',
    )
  }

  const status = error.response.status

  if (status === 404) {
    return new Error('Auth endpoint not found. Check API base URL.')
  }

  if (status === 401) {
    return new Error('Invalid email or password.')
  }

  if (status === 409) {
    return new Error('Email already exists.')
  }

  if (status >= 500) {
    return new Error('Server error. Please try again in a moment.')
  }

  return new Error('Authentication failed. Please try again.')
}

export async function login(email: string, password: string): Promise<AuthTokens> {
  try {
    const response = await apiClient.post<AuthPayload>('/auth/login', { email, password })
    return {
      accessToken: response.data.data.accessToken,
      refreshToken: response.data.data.refreshToken,
    }
  } catch (error) {
    throw normalizeAuthError(error)
  }
}

/**
 * Registers a new user then immediately logs them in.
 */
export async function register(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthTokens> {
  try {
    await apiClient.post('/auth/register', { email, password, displayName })
    return login(email, password)
  } catch (error) {
    throw normalizeAuthError(error)
  }
}

export async function loginDemoUser(): Promise<AuthTokens> {
  return login('admin@example.com', '12345678')
}

export async function refreshTokens(refreshToken = getRefreshToken()): Promise<AuthTokens> {
  if (!refreshToken) {
    throw new Error('No refresh token available.')
  }

  try {
    const response = await axios.post<AuthPayload>(`${apiBaseUrl}/auth/refresh`, {
      refreshToken,
    })

    return {
      accessToken: response.data.data.accessToken,
      refreshToken: response.data.data.refreshToken,
    }
  } catch (error) {
    throw normalizeAuthError(error)
  }
}

export async function getAuthenticatedUser(token: string): Promise<AuthenticatedUser> {
  try {
    const response = await apiClient.get<AuthenticatedUserResponse>('/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    return response.data.data
  } catch (error) {
    throw normalizeAuthError(error)
  }
}

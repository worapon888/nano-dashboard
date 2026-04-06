export const ACCESS_TOKEN_STORAGE_KEY = 'accessToken'
export const REFRESH_TOKEN_STORAGE_KEY = 'refreshToken'

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export function getAccessToken(): string | null {
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
}

export function getRefreshToken(): string | null {
  return window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
}

export function setAuthTokens(tokens: AuthTokens): void {
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, tokens.accessToken)
  window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, tokens.refreshToken)
}

export function clearAuthTokens(): void {
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
  window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
}

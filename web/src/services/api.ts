import axios from 'axios'

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
const apiBaseUrl = `${normalizedBaseUrl}/api`

console.log('[apiClient] VITE_API_BASE_URL =', import.meta.env.VITE_API_BASE_URL)
console.log('[apiClient] baseURL =', apiBaseUrl)

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
})

import axios from 'axios'
import { appEnv } from '@/lib/env'

const authApiClient = axios.create({
  baseURL: appEnv.apiUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

export type RefreshResponse = {
  token: string
  refreshToken: string
  user?: unknown
}

/**
 * Refresh tokens without importing the main API client (and its interceptors).
 * This avoids circular deps between the API client and the auth store.
 */
export async function refreshAuth(refreshToken: string): Promise<RefreshResponse> {
  const response = await authApiClient.post('/auth/refresh', { refreshToken })
  return response.data
}


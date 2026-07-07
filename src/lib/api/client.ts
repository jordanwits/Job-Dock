import axios from 'axios'
import { appEnv } from '@/lib/env'
import { refreshAuth } from '@/lib/api/authApi'
import { notifySessionCleared, notifyTokenRefreshed } from '@/lib/auth/sessionBridge'

const API_URL = appEnv.apiUrl
const DEFAULT_TENANT_ID = appEnv.defaultTenantId

// Log API configuration for debugging
console.log('🔧 API Client Configuration:', {
  API_URL,
  DEFAULT_TENANT_ID,
  isMock: appEnv.isMock,
  dataMode: appEnv.dataMode,
})

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// Request interceptor for adding auth tokens
apiClient.interceptors.request.use(
  config => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // For authenticated requests, prefer tenant_id from localStorage
    // For unauthenticated requests (public booking), fall back to DEFAULT_TENANT_ID
    const tenantId = localStorage.getItem('tenant_id')
    if (tenantId) {
      config.headers['X-Tenant-ID'] = tenantId
    } else if (!token) {
      // Only use DEFAULT_TENANT_ID for unauthenticated requests
      config.headers['X-Tenant-ID'] = DEFAULT_TENANT_ID
    }

    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// Track if we're already handling a session timeout to prevent multiple redirects
let isHandlingSessionTimeout = false
let isRefreshingToken = false
let refreshSubscribers: Array<(token: string | null) => void> = []

// Function to add request to queue while token is refreshing
function subscribeTokenRefresh(callback: (token: string | null) => void) {
  refreshSubscribers.push(callback)
}

// Notify all queued requests when the refresh settles. `token` is null when
// the refresh FAILED — subscribers must reject then, otherwise their promises
// stay pending forever (spinners that never resolve).
function onRefreshed(token: string | null) {
  const subscribers = refreshSubscribers
  refreshSubscribers = []
  subscribers.forEach(callback => callback(token))
}

// Response interceptor for error handling and auto-refresh
apiClient.interceptors.response.use(
  response => {
    return response
  },
  async error => {
    const originalRequest = error.config

    // In mock data mode the real backend is unreachable, so non-mocked
    // endpoints (e.g. settings) will error. Never tear down the mock session
    // or redirect to login because of those — just let the caller handle it.
    if (appEnv.isMock) {
      return Promise.reject(error)
    }

    // Check for authentication errors - safely extract error message
    let errorMessage = ''
    try {
      if (error.response?.data?.error?.message && typeof error.response.data.error.message === 'string') {
        errorMessage = error.response.data.error.message.toLowerCase()
      } else if (error.response?.data?.message && typeof error.response.data.message === 'string') {
        errorMessage = error.response.data.message.toLowerCase()
      } else if (error.message && typeof error.message === 'string') {
        errorMessage = error.message.toLowerCase()
      }
    } catch (e) {
      // If any error occurs during message extraction, use empty string
      errorMessage = ''
    }

    const isTokenError =
      errorMessage.includes('token') ||
      errorMessage.includes('jwt') ||
      errorMessage.includes('expired') ||
      errorMessage.includes('invalid token') ||
      errorMessage.includes('malformed')

    const isAuthError =
      error.response?.status === 401 || (error.response?.status === 500 && isTokenError)

    // Try to refresh token on auth errors (except for auth endpoints themselves)
    if (isAuthError && !originalRequest._retry && !originalRequest.url?.includes('/auth/')) {
      originalRequest._retry = true

      // If already refreshing, queue this request
      if (isRefreshingToken) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((token: string | null) => {
            if (!token) {
              // The refresh failed — fail this queued request too.
              reject(error)
              return
            }
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(apiClient(originalRequest))
          })
        })
      }

      isRefreshingToken = true
      const refreshToken = localStorage.getItem('refresh_token')

      if (refreshToken) {
        try {
          // Attempt to refresh the token without importing the auth store
          // (avoids circular deps that can break some Rollup builds).
          const response = await refreshAuth(refreshToken)

          const newToken = response.token
          if (newToken) {
            localStorage.setItem('auth_token', newToken)
            localStorage.setItem('refresh_token', response.refreshToken)

            const maybeUser = response.user as { tenantId?: string } | undefined
            if (maybeUser?.tenantId) {
              localStorage.setItem('tenant_id', maybeUser.tenantId)
            }

            notifyTokenRefreshed({
              token: newToken,
              refreshToken: response.refreshToken,
              user: response.user,
            })

            isRefreshingToken = false
            onRefreshed(newToken)

            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${newToken}`
            return apiClient(originalRequest)
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError)
        }
      }

      isRefreshingToken = false
      // Release any requests queued during the failed refresh so they reject
      // instead of hanging forever.
      onRefreshed(null)

      // If refresh failed, handle session timeout
      if (!isHandlingSessionTimeout) {
        isHandlingSessionTimeout = true

        const message = isTokenError
          ? 'Your session has expired. Please log in again.'
          : 'Authentication failed. Please log in again.'

        console.warn('Session timeout:', message)

        // Clear auth state
        localStorage.removeItem('auth_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('tenant_id')

        try {
          localStorage.removeItem('auth-storage')
        } catch (e) {
          console.error('Failed to clear auth storage:', e)
        }

        // Also clear any in-memory auth state (e.g. Zustand store)
        notifySessionCleared()

        setTimeout(() => {
          window.location.href = `/auth/login?session=expired&message=${encodeURIComponent(message)}`
        }, 100)
      }
    }

    return Promise.reject(error)
  }
)

// Public API client for unauthenticated requests (e.g., public booking)
// This client does NOT send auth tokens or tenant IDs
export const publicApiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// Add request interceptor to log requests
publicApiClient.interceptors.request.use(
  config => {
    console.log('🌐 Making request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`,
    })
    return config
  },
  error => {
    console.error('❌ Request interceptor error:', error)
    return Promise.reject(error)
  }
)

// Add response interceptor to publicApiClient for better error handling
publicApiClient.interceptors.response.use(
  response => {
    console.log('✅ Response received:', {
      status: response.status,
      url: response.config.url,
    })
    return response
  },
  error => {
    // Log network errors for debugging
    if (!error.response) {
      console.error('🌐 Network error (no response):', {
        message: error.message,
        code: error.code,
        config: {
          url: error.config?.url,
          baseURL: error.config?.baseURL,
          fullURL: error.config ? `${error.config.baseURL}${error.config.url}` : 'unknown',
          method: error.config?.method,
        },
      })
    } else {
      console.error('❌ Response error:', {
        status: error.response.status,
        data: error.response.data,
        url: error.config?.url,
      })
    }
    return Promise.reject(error)
  }
)

// No auth interceptor for public client - it's completely unauthenticated
// The backend will determine the tenant from the service ID

export default apiClient

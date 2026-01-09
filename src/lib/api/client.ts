import axios from 'axios'
import { appEnv } from '@/lib/env'

const API_URL = appEnv.apiUrl
const DEFAULT_TENANT_ID = appEnv.defaultTenantId

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// Request interceptor for adding auth tokens
apiClient.interceptors.request.use(
  (config) => {
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
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login
      localStorage.removeItem('auth_token')
      window.location.href = '/login'
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

// No auth interceptor for public client - it's completely unauthenticated
// The backend will determine the tenant from the service ID

export default apiClient


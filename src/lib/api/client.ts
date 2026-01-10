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
    
    // #region agent log
    if (config.url?.includes('/contacts/import')) {
      const logData: any = {
        location: 'client.ts:34',
        message: 'Import API request',
        data: {
          url: config.url,
          method: config.method,
          headers: config.headers,
          dataType: typeof config.data,
          dataKeys: config.data ? Object.keys(config.data) : [],
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        hypothesisId: 'H_API'
      }
      if (config.data?.csvContent) {
        logData.data.csvContentLength = config.data.csvContent.length
        logData.data.csvFirstChars = config.data.csvContent.substring(0, 150)
      }
      fetch('http://127.0.0.1:7242/ingest/e588064f-96c5-4008-ad96-d8278684cf49',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
    }
    // #endregion
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    // #region agent log
    if (response.config.url?.includes('/contacts/import')) {
      fetch('http://127.0.0.1:7242/ingest/e588064f-96c5-4008-ad96-d8278684cf49',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client.ts:56',message:'Import API response success',data:{url:response.config.url,status:response.status,dataKeys:response.data ? Object.keys(response.data) : [],responseData:response.data},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H_API'})}).catch(()=>{});
    }
    // #endregion
    return response
  },
  (error) => {
    // #region agent log
    if (error.config?.url?.includes('/contacts/import')) {
      fetch('http://127.0.0.1:7242/ingest/e588064f-96c5-4008-ad96-d8278684cf49',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client.ts:64',message:'Import API response error',data:{url:error.config.url,status:error.response?.status,statusText:error.response?.statusText,errorMessage:error.message,responseData:error.response?.data,errorCode:error.code},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H_API'})}).catch(()=>{});
    }
    // #endregion
    
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


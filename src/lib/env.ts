type DataMode = 'live' | 'mock'

const DATA_MODE_STORAGE_KEY = 'jobdock:data-mode'

const envDefaults = {
  apiUrl: sanitizeUrl(import.meta.env.VITE_API_URL) || 'http://localhost:8000',
  awsRegion: import.meta.env.VITE_AWS_REGION || 'us-east-1',
  cognitoUserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
  cognitoClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
  s3Bucket: import.meta.env.VITE_S3_BUCKET || '',
  useMockDataFlag: parseBoolean(import.meta.env.VITE_USE_MOCK_DATA, import.meta.env.DEV),
  stripePublishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
  // Marketing analytics. Unset everywhere except the Vercel production environment, which is
  // what keeps local dev out of the data — see src/lib/analytics.ts.
  posthogKey: import.meta.env.VITE_POSTHOG_KEY || '',
}

const storedMode = readStoredDataMode()
const resolvedDataMode: DataMode = storedMode ?? (envDefaults.useMockDataFlag ? 'mock' : 'live')

export const dataModeController = {
  storageKey: DATA_MODE_STORAGE_KEY,
  /**
   * Persist the desired data mode in localStorage and reload the app
   * so module-level imports (like Zustand stores) pick up the change.
   */
  set(mode: DataMode) {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(DATA_MODE_STORAGE_KEY, mode)
    window.location.reload()
  },
  clear() {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(DATA_MODE_STORAGE_KEY)
    window.location.reload()
  },
}

export const awsConfig = {
  region: envDefaults.awsRegion,
  userPoolId: envDefaults.cognitoUserPoolId,
  userPoolClientId: envDefaults.cognitoClientId,
  filesBucket: envDefaults.s3Bucket,
}

export const appEnv = {
  apiUrl: envDefaults.apiUrl,
  awsRegion: envDefaults.awsRegion,
  cognitoUserPoolId: envDefaults.cognitoUserPoolId,
  cognitoClientId: envDefaults.cognitoClientId,
  filesBucket: envDefaults.s3Bucket,
  dataMode: resolvedDataMode,
  isLive: resolvedDataMode === 'live',
  isMock: resolvedDataMode === 'mock',
  stripePublishableKey: envDefaults.stripePublishableKey,
  posthogKey: envDefaults.posthogKey,
}

function readStoredDataMode(): DataMode | null {
  if (typeof window === 'undefined') {
    return null
  }
  const value = window.localStorage.getItem(DATA_MODE_STORAGE_KEY)
  if (value === 'live' || value === 'mock') {
    return value
  }
  return null
}

function parseBoolean(value: string | boolean | undefined, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true'
  }
  return fallback
}

function sanitizeUrl(url?: string) {
  if (!url) return ''
  return url.endsWith('/') ? url.slice(0, -1) : url
}

export type { DataMode }


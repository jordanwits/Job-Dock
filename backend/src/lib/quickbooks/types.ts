// Shared TypeScript types for the QuickBooks Online integration.

export interface QuickBooksStatus {
  connected: boolean
  realmId?: string
  companyName?: string
  paymentsConnected: boolean
  status: 'connected' | 'error' | 'disconnected' | 'not_connected'
  lastSyncAt?: string | null
  lastErrorMessage?: string | null
}

// Raw token response from the Intuit OAuth token endpoint.
export interface OAuthTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number // access token lifetime in seconds (~3600)
  x_refresh_token_expires_in: number // refresh token lifetime in seconds (~8726400 / 101 days)
  token_type: string
  scope?: string
}

// Decrypted, in-memory view of a stored connection with a guaranteed-fresh access token.
export interface ActiveConnection {
  tenantId: string
  realmId: string
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: Date
  refreshTokenExpiresAt: Date
  paymentsConnected: boolean
}

export interface SyncInvoiceResult {
  quickbooksInvoiceId: string
  quickbooksInvoiceUrl: string | null
}

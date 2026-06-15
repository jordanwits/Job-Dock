import { apiClient } from './client'

export interface QuickBooksStatus {
  connected: boolean
  realmId?: string
  companyName?: string
  paymentsConnected: boolean
  status: 'connected' | 'error' | 'disconnected' | 'not_connected'
  lastSyncAt?: string | null
  lastErrorMessage?: string | null
}

export interface SyncInvoiceResult {
  quickbooksInvoiceId: string
  quickbooksInvoiceUrl: string | null
}

export const quickbooksApi = {
  /** Current QuickBooks connection status for the tenant. */
  getStatus: async (): Promise<QuickBooksStatus> => {
    const response = await apiClient.get('/quickbooks/status')
    return response.data
  },

  /** Intuit authorize URL (backend builds it + signs the CSRF state). Owner only. */
  getConnectUrl: async (): Promise<{ url: string }> => {
    const response = await apiClient.get('/quickbooks/connect-url')
    return response.data
  },

  /** Exchange the Intuit authorization code for tokens. Called from the OAuth callback page. */
  connect: async (params: {
    code: string
    realmId: string
    state: string
  }): Promise<QuickBooksStatus> => {
    const response = await apiClient.post('/quickbooks/connect', params)
    return response.data
  },

  /** Disconnect QuickBooks for the tenant. Owner only. */
  disconnect: async (): Promise<{ success: boolean }> => {
    const response = await apiClient.post('/quickbooks/disconnect', {})
    return response.data
  },

  /** Push a JobDock invoice to QuickBooks (create/update + enable online payment). */
  syncInvoice: async (invoiceId: string): Promise<SyncInvoiceResult> => {
    const response = await apiClient.post('/quickbooks/sync-invoice', { invoiceId })
    return response.data
  },
}

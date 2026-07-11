import { apiClient } from './client'
import { appEnv } from '@/lib/env'

export type GoogleCalendarSyncMode = 'all' | 'mine'
export type GoogleCalendarConnectionStatus = 'connected' | 'error' | 'disconnected'

export interface GoogleCalendarStatus {
  /** Whether the server has Google Calendar OAuth credentials configured. */
  configured: boolean
  /** Whether the current user has an active connection. */
  connected: boolean
  status?: GoogleCalendarConnectionStatus
  googleEmail?: string
  syncMode?: GoogleCalendarSyncMode
  lastSyncAt?: string | null
  lastErrorMessage?: string | null
  /** Server-authoritative: may this user choose "all company appointments" (owner/admin)? */
  canChooseAll: boolean
}

/** Friendly message surfaced when a connect-type action is attempted in demo/mock mode. */
const MOCK_UNAVAILABLE_MESSAGE = 'Google Calendar sync is not available in demo mode'

/**
 * Inert status returned in mock/demo mode so the settings section renders the
 * "not configured" state without ever touching the network.
 */
const MOCK_STATUS: GoogleCalendarStatus = {
  configured: false,
  connected: false,
  canChooseAll: true,
}

/**
 * Thin wrappers over the authenticated apiClient for the per-user Google Calendar
 * sync integration (one-way: CleanDock → Google). Imported directly (not routed through
 * services.ts), mirroring src/lib/api/quickbooks.ts.
 *
 * In mock data mode every method is inert: getStatus returns canned "not configured"
 * data and the connect-type methods throw a friendly error, so the demo/mock preview
 * never issues a real request.
 */
export const googleCalendarApi = {
  /** Current Google Calendar connection status for the signed-in user. */
  getStatus: async (): Promise<GoogleCalendarStatus> => {
    if (appEnv.isMock) return { ...MOCK_STATUS }
    const response = await apiClient.get('/google-calendar/status')
    return response.data
  },

  /** Google authorize URL (backend builds it + signs the CSRF state incl. syncMode). */
  getConnectUrl: async (syncMode: GoogleCalendarSyncMode): Promise<{ url: string }> => {
    if (appEnv.isMock) throw new Error(MOCK_UNAVAILABLE_MESSAGE)
    const response = await apiClient.get('/google-calendar/connect-url', { params: { syncMode } })
    return response.data
  },

  /** Exchange the Google authorization code for tokens. Called from the OAuth callback page. */
  connect: async (params: { code: string; state: string }): Promise<GoogleCalendarStatus> => {
    if (appEnv.isMock) throw new Error(MOCK_UNAVAILABLE_MESSAGE)
    const response = await apiClient.post('/google-calendar/connect', params)
    return response.data
  },

  /** Disconnect Google Calendar for the current user (optionally deletes the CleanDock calendar). */
  disconnect: async (removeCalendar: boolean): Promise<{ disconnected: boolean }> => {
    if (appEnv.isMock) throw new Error(MOCK_UNAVAILABLE_MESSAGE)
    const response = await apiClient.post('/google-calendar/disconnect', { removeCalendar })
    return response.data
  },

  /** Change which appointments sync ('all' | 'mine'). Server clamps employees to 'mine'. */
  updateSyncMode: async (syncMode: GoogleCalendarSyncMode): Promise<GoogleCalendarStatus> => {
    if (appEnv.isMock) throw new Error(MOCK_UNAVAILABLE_MESSAGE)
    const response = await apiClient.post('/google-calendar/settings', { syncMode })
    return response.data
  },

  /** Queue an immediate reconcile sync for the tenant. */
  sync: async (): Promise<{ queued: boolean }> => {
    if (appEnv.isMock) throw new Error(MOCK_UNAVAILABLE_MESSAGE)
    const response = await apiClient.post('/google-calendar/sync', {})
    return response.data
  },
}

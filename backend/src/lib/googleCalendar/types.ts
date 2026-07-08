// Shared TypeScript types for the Google Calendar integration.

export type SyncMode = 'all' | 'mine'
export type ConnectionStatus = 'connected' | 'error' | 'disconnected'

// Status payload returned by GET /google-calendar/status.
export interface GoogleCalendarStatus {
  configured: boolean
  connected: boolean
  status?: ConnectionStatus
  googleEmail?: string
  syncMode?: SyncMode
  lastSyncAt?: string | null
  lastErrorMessage?: string | null
  canChooseAll: boolean
}

// Raw token response from Google's OAuth token endpoint. Google only returns refresh_token on the
// first consent (or when access_type=offline&prompt=consent forces it); it is absent on refresh.
export interface GoogleOAuthTokenResponse {
  access_token: string
  expires_in: number // access token lifetime in seconds (~3600)
  refresh_token?: string
  scope?: string
  token_type: string
  id_token?: string // JWT; its payload carries the account email
}

// Decrypted, in-memory view of a stored connection with a guaranteed-fresh access token.
export interface ActiveConnection {
  id: string
  tenantId: string
  userId: string
  googleEmail: string
  accessToken: string
  calendarId: string | null
  syncMode: SyncMode
  syncToken: string | null
}

// Minimal shape of a Google Calendar event we read/write.
export interface GoogleEventDateTime {
  date?: string // all-day events (YYYY-MM-DD) — we skip these
  dateTime?: string // RFC3339 timestamp for timed events
  timeZone?: string
}

export interface GoogleEvent {
  id?: string
  status?: string // 'confirmed' | 'tentative' | 'cancelled'
  summary?: string
  location?: string
  description?: string
  start?: GoogleEventDateTime
  end?: GoogleEventDateTime
  extendedProperties?: {
    private?: Record<string, string>
    shared?: Record<string, string>
  }
}

export interface ListEventsResult {
  items: GoogleEvent[]
  nextPageToken?: string
  nextSyncToken?: string
}

// Thrown by listEvents when Google rejects a stale syncToken (HTTP 410); the caller must clear the
// token and do a full windowed re-list.
export class SyncTokenGoneError extends Error {
  constructor(message = 'Google Calendar syncToken is no longer valid (410)') {
    super(message)
    this.name = 'SyncTokenGoneError'
  }
}

// Thrown when Google reports invalid_grant (revoked/expired refresh token). The connection is
// marked status:'error' and requires the user to reconnect.
export class InvalidGrantError extends Error {
  constructor(message = 'Google refused the refresh token (invalid_grant)') {
    super(message)
    this.name = 'InvalidGrantError'
  }
}

// Thrown for a non-OK Google Calendar API response (after rate-limit retries). Carries the HTTP
// status so callers can special-case 404 (calendar/event gone) etc.
export class GcalHttpError extends Error {
  status: number
  constructor(status: number, message?: string) {
    super(message || `Google Calendar API error (${status})`)
    this.name = 'GcalHttpError'
    this.status = status
  }
}

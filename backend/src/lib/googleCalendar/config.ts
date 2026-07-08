// Central configuration and endpoint constants for the Google Calendar integration.
// All secrets are read from the Lambda environment (injected by infrastructure/lib/jobdock-stack.ts).
// Mirrors the QuickBooks config module.

export interface GoogleCalendarConfig {
  clientId: string
  clientSecret: string
  tokenEncKey: string
  redirectUri: string
  scopes: string[]
}

// OAuth + API endpoints.
export const GOOGLE_OAUTH_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GOOGLE_OAUTH_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
export const GOOGLE_CALENDAR_API_BASE_URL = 'https://www.googleapis.com/calendar/v3'

// Full read/write access to calendars/events, plus openid + email so we can read the account
// email out of the id_token returned by the token endpoint.
export const GOOGLE_SCOPE_CALENDAR = 'https://www.googleapis.com/auth/calendar'
export const GOOGLE_SCOPE_OPENID = 'openid'
export const GOOGLE_SCOPE_EMAIL = 'email'

// The dedicated calendar JobDock creates in each connected Google account. Defined once here and
// imported by both service.ts (create/recreate on connect) and sync.ts (recreate on 404).
export const CALENDAR_SUMMARY = 'JobDock'
export const CALENDAR_DESCRIPTION = 'Appointments synced from JobDock'

export function loadGoogleCalendarConfig(): GoogleCalendarConfig {
  const publicAppUrl = (process.env.PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    tokenEncKey: process.env.GOOGLE_TOKEN_ENC_KEY || '',
    // The redirect URI must EXACTLY match one registered on the Google Cloud OAuth client.
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${publicAppUrl}/google-calendar/callback`,
    scopes: [GOOGLE_SCOPE_CALENDAR, GOOGLE_SCOPE_OPENID, GOOGLE_SCOPE_EMAIL],
  }
}

export function isConfigured(): boolean {
  const cfg = loadGoogleCalendarConfig()
  return Boolean(cfg.clientId && cfg.clientSecret)
}

export function assertConfigured(cfg: GoogleCalendarConfig): void {
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error(
      'Google Calendar is not configured (missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)'
    )
  }
}

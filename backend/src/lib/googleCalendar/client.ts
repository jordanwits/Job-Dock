// Per-connection Google Calendar access + authenticated Calendar API (v3) request helper.
// Access tokens (~1h) are refreshed lazily here when near expiry. Uses plain fetch (no googleapis
// SDK). Mirrors the QuickBooks client module.
//
// Never logs tokens or event bodies — counts/status only.

import { GOOGLE_CALENDAR_API_BASE_URL } from './config'
import { encryptToken, decryptToken } from './crypto'
import { refreshAccessToken } from './oauth'
import {
  GcalHttpError,
  InvalidGrantError,
  type ActiveConnection,
  type GoogleEvent,
  type SyncMode,
} from './types'

const ACCESS_TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000 // refresh if it expires within 5 minutes
const MAX_ATTEMPTS = 3

// Shape of the stored row we care about (kept loose so we don't depend on Prisma's generated type
// signature at call sites that pass either an id or a full record).
export interface StoredConnection {
  id: string
  tenantId: string
  userId: string
  googleEmail: string
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: Date
  scope: string | null
  calendarId: string | null
  syncMode: string
  status: string
}

async function getPrisma() {
  const { default: prisma } = await import('../db')
  return prisma
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Exponential backoff with jitter: ~0.5s, ~1s (attempt 0, 1).
function backoffMs(attempt: number): number {
  return 500 * 2 ** attempt + Math.floor(Math.random() * 250)
}

// Returns a connection whose access token is guaranteed fresh, refreshing on the fly if needed.
// On invalid_grant the connection is marked status:'error' and the error is re-thrown.
export async function getActiveConnection(
  connectionOrId: string | StoredConnection
): Promise<ActiveConnection> {
  const prisma = await getPrisma()
  const record: StoredConnection | null =
    typeof connectionOrId === 'string'
      ? ((await prisma.googleCalendarConnection.findUnique({
          where: { id: connectionOrId },
        })) as StoredConnection | null)
      : connectionOrId
  if (!record || record.status === 'disconnected') {
    throw new Error('Google Calendar is not connected')
  }

  let accessToken = decryptToken(record.accessToken)
  const expiresAt = new Date(record.accessTokenExpiresAt)

  if (expiresAt.getTime() - Date.now() < ACCESS_TOKEN_REFRESH_SKEW_MS) {
    const refreshToken = decryptToken(record.refreshToken)
    try {
      const refreshed = await refreshAccessToken(refreshToken)
      accessToken = refreshed.access_token
      await prisma.googleCalendarConnection.update({
        where: { id: record.id },
        data: {
          accessToken: encryptToken(refreshed.access_token),
          accessTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
          // Google does not return a new refresh_token on refresh — keep the stored one.
          scope: refreshed.scope ?? record.scope,
          status: 'connected',
          lastErrorMessage: null,
        },
      })
    } catch (err) {
      if (err instanceof InvalidGrantError) {
        await prisma.googleCalendarConnection.update({
          where: { id: record.id },
          data: {
            status: 'error',
            lastErrorMessage: 'Google refused the saved authorization; please reconnect.',
          },
        })
      }
      throw err
    }
  }

  return {
    id: record.id,
    tenantId: record.tenantId,
    userId: record.userId,
    googleEmail: record.googleEmail,
    accessToken,
    calendarId: record.calendarId,
    syncMode: (record.syncMode === 'mine' ? 'mine' : 'all') as SyncMode,
  }
}

// Low-level authenticated Calendar API request with 429/403-rate-limit retry (exp backoff + jitter).
// Returns parsed JSON (or undefined for 204). Throws GcalHttpError on a non-retryable failure.
export async function gcalRequest<T = unknown>(
  connection: Pick<ActiveConnection, 'accessToken'>,
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string | number | boolean | undefined>
): Promise<T | undefined> {
  const url = new URL(`${GOOGLE_CALENDAR_API_BASE_URL}${path}`)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    }
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

    if (res.ok) {
      if (res.status === 204) return undefined
      const text = await res.text()
      return text ? (JSON.parse(text) as T) : undefined
    }

    const text = await res.text()
    const isRateLimited =
      res.status === 429 ||
      (res.status === 403 && /rateLimitExceeded|userRateLimitExceeded/i.test(text))
    if (isRateLimited && attempt < MAX_ATTEMPTS - 1) {
      await sleep(backoffMs(attempt))
      continue
    }

    // Parse a short reason to log — never log the full body (may contain event data).
    let reason = ''
    try {
      const parsed = JSON.parse(text) as { error?: { errors?: Array<{ reason?: string }> } }
      reason = parsed?.error?.errors?.[0]?.reason || ''
    } catch {
      /* non-JSON */
    }
    console.warn(`Google Calendar ${method} ${path.split('?')[0]} failed: ${res.status} ${reason}`)
    throw new GcalHttpError(res.status, `Google Calendar ${method} failed (${res.status})`)
  }
  // Unreachable (loop either returns or throws), but satisfies the type checker.
  throw new GcalHttpError(429, 'Google Calendar request exhausted retries')
}

// ─── typed wrappers ──────────────────────────────────────────────────────────────────────────

export async function createCalendar(
  connection: Pick<ActiveConnection, 'accessToken'>,
  summary: string,
  description: string
): Promise<{ id: string }> {
  const created = await gcalRequest<{ id: string }>(connection, 'POST', '/calendars', {
    summary,
    description,
  })
  if (!created?.id) throw new Error('Google did not return a calendar id')
  return created
}

export async function deleteCalendar(
  connection: Pick<ActiveConnection, 'accessToken'>,
  calendarId: string
): Promise<void> {
  try {
    await gcalRequest(connection, 'DELETE', `/calendars/${encodeURIComponent(calendarId)}`)
  } catch (err) {
    if (err instanceof GcalHttpError && (err.status === 404 || err.status === 410)) return
    throw err
  }
}

export async function insertEvent(
  connection: ActiveConnection,
  calendarId: string,
  event: GoogleEvent
): Promise<GoogleEvent> {
  const created = await gcalRequest<GoogleEvent>(
    connection,
    'POST',
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    event
  )
  if (!created?.id) throw new Error('Google did not return an event id')
  return created
}

// Patch an event. Returns null when the event no longer exists (404/410) so the caller can decide
// to re-insert instead.
export async function patchEvent(
  connection: ActiveConnection,
  calendarId: string,
  eventId: string,
  event: GoogleEvent
): Promise<GoogleEvent | null> {
  try {
    const patched = await gcalRequest<GoogleEvent>(
      connection,
      'PATCH',
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      event
    )
    return patched ?? null
  } catch (err) {
    if (err instanceof GcalHttpError && (err.status === 404 || err.status === 410)) return null
    throw err
  }
}

// Delete an event. Treats 404/410 (already gone) as success.
export async function deleteEvent(
  connection: ActiveConnection,
  calendarId: string,
  eventId: string
): Promise<void> {
  try {
    await gcalRequest(
      connection,
      'DELETE',
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
    )
  } catch (err) {
    if (err instanceof GcalHttpError && (err.status === 404 || err.status === 410)) return
    throw err
  }
}

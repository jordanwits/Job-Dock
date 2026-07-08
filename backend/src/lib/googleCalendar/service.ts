// API-facing actions for the Google Calendar integration (invoked from the data Lambda's
// google-calendar branch). Every action is per-user: a caller only ever manages their OWN
// connection. Mirrors the QuickBooks service module.

import { ApiError } from '../errors'
import { CALENDAR_DESCRIPTION, CALENDAR_SUMMARY, isConfigured } from './config'
import { encryptToken, decryptToken } from './crypto'
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  parseIdTokenEmail,
  revokeToken,
  verifyState,
} from './oauth'
import { createCalendar, deleteCalendar } from './client'
import { invalidateTenantConnectionCache, invokeSyncTenant } from './trigger'
import type { GoogleCalendarStatus, SyncMode } from './types'

export interface RequestUser {
  id: string // User.id (not cognitoId)
  role: string
}

async function getPrisma() {
  const { default: prisma } = await import('../db')
  return prisma
}

function canChooseAll(role: string): boolean {
  return role === 'owner' || role === 'admin'
}

// Employees are always clamped to 'mine'; owners/admins default to 'all' unless they pick 'mine'.
function clampSyncMode(requested: string | undefined, role: string): SyncMode {
  if (!canChooseAll(role)) return 'mine'
  return requested === 'mine' ? 'mine' : 'all'
}

export async function getStatus(user: RequestUser): Promise<GoogleCalendarStatus> {
  const prisma = await getPrisma()
  const configured = isConfigured()
  const conn = await prisma.googleCalendarConnection.findUnique({ where: { userId: user.id } })
  if (!conn || conn.status === 'disconnected') {
    return { configured, connected: false, canChooseAll: canChooseAll(user.role) }
  }
  return {
    configured,
    connected: conn.status === 'connected',
    status: conn.status as GoogleCalendarStatus['status'],
    googleEmail: conn.googleEmail,
    syncMode: (conn.syncMode === 'mine' ? 'mine' : 'all') as SyncMode,
    lastSyncAt: conn.lastSyncAt ? conn.lastSyncAt.toISOString() : null,
    lastErrorMessage: conn.lastErrorMessage ?? null,
    canChooseAll: canChooseAll(user.role),
  }
}

export function getConnectUrl(
  tenantId: string,
  user: RequestUser,
  requestedSyncMode: string | undefined
): { url: string } {
  const syncMode = clampSyncMode(requestedSyncMode, user.role)
  return { url: buildAuthorizeUrl({ tenantId, userId: user.id, syncMode }) }
}

export async function connect(
  tenantId: string,
  user: RequestUser,
  params: { code: string; state: string }
): Promise<GoogleCalendarStatus> {
  if (!params.code || !params.state) throw new ApiError('Missing code or state', 400)
  const decoded = verifyState(params.state, { tenantId, userId: user.id })
  if (!decoded) throw new ApiError('Invalid OAuth state', 400)

  const tokens = await exchangeCodeForTokens(params.code)
  const googleEmail = parseIdTokenEmail(tokens.id_token) || 'unknown'

  const prisma = await getPrisma()
  const existing = await prisma.googleCalendarConnection.findUnique({ where: { userId: user.id } })

  // Google returns refresh_token on consent (we force prompt=consent). If it's somehow absent, fall
  // back to the previously stored one; error only if we have neither.
  let refreshToken = tokens.refresh_token
  if (!refreshToken) {
    if (existing) refreshToken = decryptToken(existing.refreshToken)
    else throw new ApiError('Google did not return a refresh token; please try connecting again.', 400)
  }

  // Use the fresh access token to (best-effort) remove the old JobDock calendar on re-connect, then
  // create a new one. Do NOT revoke the old grant here — it belongs to the same Google account and
  // revoking could invalidate the tokens we just obtained.
  const accessCtx = { accessToken: tokens.access_token }
  if (existing?.calendarId) {
    try {
      await deleteCalendar(accessCtx, existing.calendarId)
    } catch {
      /* best-effort */
    }
  }
  const calendar = await createCalendar(accessCtx, CALENDAR_SUMMARY, CALENDAR_DESCRIPTION)

  // syncMode carried in the signed state; re-clamp for safety against role changes.
  const syncMode = clampSyncMode(decoded.m, user.role)
  const data = {
    tenantId,
    googleEmail,
    accessToken: encryptToken(tokens.access_token),
    refreshToken: encryptToken(refreshToken),
    accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    scope: tokens.scope ?? null,
    calendarId: calendar.id,
    syncMode,
    status: 'connected',
    lastErrorMessage: null,
    syncInProgressAt: null,
  }
  await prisma.googleCalendarConnection.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  })

  // Reconnect replaces the JobDock calendar (old one deleted above, fresh one created) but keeps the
  // same connection row/id. Its old event-map rows point at events on the now-deleted calendar, so
  // they must be dropped BEFORE the initial sync — otherwise push would match each unchanged booking
  // on its stale fingerprint and skip it, leaving the new calendar empty (F3).
  if (existing) {
    await prisma.googleCalendarEventMap.deleteMany({ where: { connectionId: existing.id } })
  }

  // A newly-created/re-created connection changes "tenant has an active connection?" — bust the
  // per-container trigger cache so the next mutation's instant trigger sees it immediately (F9).
  invalidateTenantConnectionCache(tenantId)

  // Kick off the initial sync (full push of this user's eligible appointments to Google).
  await invokeSyncTenant(tenantId)
  return getStatus(user)
}

export async function disconnect(
  user: RequestUser,
  opts: { removeCalendar?: boolean } = {}
): Promise<{ disconnected: true }> {
  const prisma = await getPrisma()
  const conn = await prisma.googleCalendarConnection.findUnique({ where: { userId: user.id } })
  if (conn) {
    const removeCalendar = opts.removeCalendar !== false // default true
    if (removeCalendar && conn.calendarId) {
      try {
        // Refresh the token via getActiveConnection so the delete authenticates, then delete.
        const { getActiveConnection } = await import('./client')
        const active = await getActiveConnection(conn.id)
        if (active.calendarId) await deleteCalendar(active, active.calendarId)
      } catch {
        /* best-effort */
      }
    }
    try {
      await revokeToken(decryptToken(conn.refreshToken))
    } catch {
      /* best-effort */
    }
    // Delete the row; event maps cascade.
    await prisma.googleCalendarConnection.delete({ where: { id: conn.id } })
    // The tenant may no longer have an active connection — bust the per-container trigger cache
    // (other warm containers self-heal within the 60s TTL) (F9).
    invalidateTenantConnectionCache(conn.tenantId)
  }
  return { disconnected: true }
}

export async function updateSettings(
  tenantId: string,
  user: RequestUser,
  params: { syncMode?: string }
): Promise<GoogleCalendarStatus> {
  const prisma = await getPrisma()
  const conn = await prisma.googleCalendarConnection.findUnique({ where: { userId: user.id } })
  if (!conn) throw new ApiError('Google Calendar is not connected', 404)
  const syncMode = clampSyncMode(params.syncMode, user.role)
  await prisma.googleCalendarConnection.update({
    where: { id: conn.id },
    data: { syncMode },
  })
  // Keep the per-container trigger cache consistent after any connection change (F9).
  invalidateTenantConnectionCache(tenantId)
  await invokeSyncTenant(tenantId)
  return getStatus(user)
}

export async function syncNow(tenantId: string, user: RequestUser): Promise<{ queued: boolean }> {
  const prisma = await getPrisma()
  const conn = await prisma.googleCalendarConnection.findUnique({ where: { userId: user.id } })
  if (!conn) throw new ApiError('Google Calendar is not connected', 404)
  const queued = await invokeSyncTenant(tenantId)
  return { queued }
}

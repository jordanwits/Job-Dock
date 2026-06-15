// Per-tenant QuickBooks connection access + authenticated Accounting API (v3) request helper.
// Access tokens (~1h) are refreshed lazily here when near expiry.
//
// NOTE: the new Prisma models (quickBooksConnection) are referenced via `(prisma as any)` until
// `npx prisma generate` is run after the migration. Drop the cast once the client is regenerated.

import { loadQuickBooksConfig, getAccountingApiBaseUrl } from './config'
import { encryptToken, decryptToken } from './crypto'
import { refreshTokens } from './oauth'
import type { ActiveConnection, OAuthTokenResponse } from './types'

const ACCESS_TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000 // refresh if it expires within 5 minutes

async function getPrisma(): Promise<any> {
  const { default: prisma } = await import('../db')
  return prisma as any
}

export async function getConnectionRecord(tenantId: string): Promise<any | null> {
  const prisma = await getPrisma()
  return prisma.quickBooksConnection.findUnique({ where: { tenantId } })
}

export async function saveTokens(
  tenantId: string,
  realmId: string,
  tokens: OAuthTokenResponse,
  opts?: { connectedByUserId?: string; paymentsConnected?: boolean }
): Promise<void> {
  const prisma = await getPrisma()
  const now = Date.now()
  const data: Record<string, unknown> = {
    realmId,
    accessToken: encryptToken(tokens.access_token),
    refreshToken: encryptToken(tokens.refresh_token),
    accessTokenExpiresAt: new Date(now + tokens.expires_in * 1000),
    refreshTokenExpiresAt: new Date(now + tokens.x_refresh_token_expires_in * 1000),
    scope: tokens.scope ?? null,
    status: 'connected',
    lastRefreshedAt: new Date(now),
    lastErrorMessage: null,
  }
  if (opts?.paymentsConnected !== undefined) data.paymentsConnected = opts.paymentsConnected
  if (opts?.connectedByUserId) data.connectedByUserId = opts.connectedByUserId

  await prisma.quickBooksConnection.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
  })
}

// Returns a connection whose access token is guaranteed fresh, refreshing on the fly if needed.
export async function getActiveConnection(tenantId: string): Promise<ActiveConnection> {
  const prisma = await getPrisma()
  const record = await prisma.quickBooksConnection.findUnique({ where: { tenantId } })
  if (!record || record.status === 'disconnected') {
    throw new Error('QuickBooks is not connected for this tenant')
  }

  let accessToken = decryptToken(record.accessToken)
  const refreshToken = decryptToken(record.refreshToken)
  let accessTokenExpiresAt: Date = record.accessTokenExpiresAt
  let refreshTokenExpiresAt: Date = record.refreshTokenExpiresAt

  if (accessTokenExpiresAt.getTime() - Date.now() < ACCESS_TOKEN_REFRESH_SKEW_MS) {
    const refreshed = await refreshTokens(refreshToken)
    await saveTokens(tenantId, record.realmId, refreshed)
    accessToken = refreshed.access_token
    accessTokenExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000)
    refreshTokenExpiresAt = new Date(Date.now() + refreshed.x_refresh_token_expires_in * 1000)
  }

  return {
    tenantId,
    realmId: record.realmId,
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
    paymentsConnected: record.paymentsConnected,
  }
}

// Authenticated QuickBooks Accounting API request (v3), scoped to the tenant's realm.
export async function qboRequest<T = any>(
  tenantId: string,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const cfg = loadQuickBooksConfig()
  const conn = await getActiveConnection(tenantId)
  const url = `${getAccountingApiBaseUrl(cfg.env)}/v3/company/${conn.realmId}${path}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${conn.accessToken}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QuickBooks API ${method} ${path} failed (${res.status}): ${text}`)
  }
  return (await res.json()) as T
}

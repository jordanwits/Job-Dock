// Scheduled (daily) Lambda that keeps QuickBooks refresh tokens alive for inactive tenants.
//
// Intuit refresh tokens expire after ~100 days of non-use and ROTATE on every refresh, so a tenant
// who never sends an invoice would silently lose their connection. This job proactively refreshes
// connections that have not been refreshed recently. Active tenants are refreshed lazily on demand
// by lib/quickbooks/client.ts, so this is purely a safety net for idle accounts.

import { refreshTokens } from '../../lib/quickbooks/oauth'
import { saveTokens } from '../../lib/quickbooks/client'
import { decryptToken } from '../../lib/quickbooks/crypto'
import { loadSecrets } from '../../lib/secrets'

const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000 // refresh if not refreshed in the last 7 days

export const handler = async () => {
  await loadSecrets()
  const { default: prismaClient } = await import('../../lib/db')
  const prisma = prismaClient as any
  const cutoff = new Date(Date.now() - STALE_AFTER_MS)

  const connections = await prisma.quickBooksConnection.findMany({
    where: {
      status: 'connected',
      OR: [{ lastRefreshedAt: null }, { lastRefreshedAt: { lt: cutoff } }],
    },
  })

  let refreshed = 0
  let failed = 0
  for (const conn of connections) {
    try {
      const tokens = await refreshTokens(decryptToken(conn.refreshToken))
      await saveTokens(conn.tenantId, conn.realmId, tokens)
      refreshed++
    } catch (err: any) {
      failed++
      await prisma.quickBooksConnection.update({
        where: { tenantId: conn.tenantId },
        data: {
          status: 'error',
          lastErrorMessage: (err?.message || 'refresh failed').slice(0, 500),
        },
      })
    }
  }

  console.log(
    `[quickbooks-token-refresh] refreshed=${refreshed} failed=${failed} total=${connections.length}`
  )
  return { refreshed, failed, total: connections.length }
}

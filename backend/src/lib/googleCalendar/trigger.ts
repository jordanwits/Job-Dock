// Instant-sync trigger. The data Lambda calls triggerGoogleCalendarSync() after a successful
// mutating request; the API actions call invokeSyncTenant() directly. Both async-invoke the sync
// Lambda (InvocationType 'Event' = fire-and-forget). Everything is wrapped so a trigger failure can
// never break the request that caused it. No-ops when GOOGLE_SYNC_FUNCTION_NAME is unset.

import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda'

let lambdaClient: LambdaClient | null = null
function getLambdaClient(): LambdaClient {
  if (!lambdaClient) lambdaClient = new LambdaClient({})
  return lambdaClient
}

// Fire-and-forget async invoke of the sync Lambda. Returns false if not configured / failed.
export async function invokeSyncTenant(tenantId: string): Promise<boolean> {
  const fnName = process.env.GOOGLE_SYNC_FUNCTION_NAME
  if (!fnName || !tenantId) return false
  try {
    await getLambdaClient().send(
      new InvokeCommand({
        FunctionName: fnName,
        InvocationType: 'Event',
        Payload: Buffer.from(JSON.stringify({ type: 'sync-tenant', tenantId })),
      })
    )
    return true
  } catch (err) {
    console.warn(`[gcal-trigger] invoke failed: ${(err as Error)?.name || 'Error'}`)
    return false
  }
}

// Module-level TTL cache of "does this tenant have an active connection?" so the common case (no
// connection) costs at most one indexed COUNT per minute, not a Lambda invoke per mutation.
const CACHE_TTL_MS = 60 * 1000
const activeConnectionCache = new Map<string, { hasActive: boolean; expiresAt: number }>()

async function tenantHasActiveConnection(tenantId: string): Promise<boolean> {
  const now = Date.now()
  const cached = activeConnectionCache.get(tenantId)
  if (cached && cached.expiresAt > now) return cached.hasActive
  const { default: prisma } = await import('../db')
  // 'error' rows count as active so instant triggers keep retrying an errored connection (it
  // self-heals once the underlying issue clears); only 'disconnected' is excluded.
  const count = await prisma.googleCalendarConnection.count({
    where: { tenantId, status: { in: ['connected', 'error'] } },
  })
  const hasActive = count > 0
  activeConnectionCache.set(tenantId, { hasActive, expiresAt: now + CACHE_TTL_MS })
  return hasActive
}

// Best-effort per-container cache bust after a connection is created/removed/changed. Other warm
// containers self-heal within the CACHE_TTL_MS (60s) TTL.
export function invalidateTenantConnectionCache(tenantId: string): void {
  activeConnectionCache.delete(tenantId)
}

// Called from the data handler after a successful mutating dispatch. Swallows everything.
export async function triggerGoogleCalendarSync(tenantId: string): Promise<void> {
  try {
    if (!process.env.GOOGLE_SYNC_FUNCTION_NAME || !tenantId) return
    if (!(await tenantHasActiveConnection(tenantId))) return
    await invokeSyncTenant(tenantId)
  } catch (err) {
    console.warn(`[gcal-trigger] trigger failed: ${(err as Error)?.name || 'Error'}`)
  }
}

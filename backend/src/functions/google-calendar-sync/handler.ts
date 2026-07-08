/**
 * Google Calendar Sync Lambda
 *
 * Two entry paths:
 *  - EventBridge scheduled event (rate 5 min): sweep every tenant that has a connected connection.
 *  - Direct async invoke { type: 'sync-tenant', tenantId } from the data Lambda (instant push,
 *    post-connect initial sync, and manual "Sync now").
 *
 * The engine (lib/googleCalendar/sync.ts) is tenant-scoped, idempotent, and self-guards against
 * overlapping runs via an atomic per-connection claim.
 */

import prisma from '../../lib/db'
import { syncTenant } from '../../lib/googleCalendar'

interface SyncLambdaEvent {
  source?: string // 'aws.events' for the EventBridge schedule
  type?: string // 'sync-tenant' for direct invokes
  tenantId?: string
}

export const handler = async (event: SyncLambdaEvent): Promise<{ ok: boolean }> => {
  try {
    // Scheduled sweep across all tenants with an active connection. 'error' rows are included so a
    // transient failure self-heals on a later sweep (markConnectionSuccess flips them back to
    // 'connected'); only 'disconnected' is excluded.
    if (event?.source === 'aws.events') {
      const rows = await prisma.googleCalendarConnection.findMany({
        where: { status: { in: ['connected', 'error'] } },
        select: { tenantId: true },
        distinct: ['tenantId'],
      })
      console.log(`[gcal-sync] scheduled sweep: ${rows.length} tenant(s)`)
      for (const { tenantId } of rows) {
        try {
          await syncTenant(tenantId)
        } catch (err) {
          console.warn(
            `[gcal-sync] tenant ${tenantId} sweep failed: ${(err as Error)?.name || 'Error'}`
          )
        }
      }
      return { ok: true }
    }

    // Direct single-tenant invoke.
    if (event?.type === 'sync-tenant' && event.tenantId) {
      await syncTenant(event.tenantId)
      return { ok: true }
    }

    console.warn('[gcal-sync] ignored unrecognized event')
    return { ok: false }
  } catch (err) {
    console.error('[gcal-sync] handler error:', (err as Error)?.message || 'unknown')
    return { ok: false }
  }
}

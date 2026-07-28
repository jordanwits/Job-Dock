/**
 * Recurrence Top-Up Lambda
 *
 * Extends open-ended ("repeats forever") recurring series so their appointments keep rolling
 * forward. Bookings are materialized only out to a 12-month horizon; this runs daily and adds
 * whatever has fallen inside the window since the last run.
 *
 * It only ever ADDS bookings, strictly after a series' latest existing occurrence, and only for
 * series whose JobRecurrence is still 'active' AND whose parent job is still live. A series the
 * user archived or deleted is never resurrected.
 *
 * Scheduled to run: daily via EventBridge.
 */

import { Context } from 'aws-lambda'
import { loadSecrets } from '../../lib/secrets'
import { topUpRecurrences, type TopUpSummary } from '../../lib/recurrenceTopup'

interface TopUpResult extends TopUpSummary {
  success: boolean
  timestamp: string
  error?: string
}

export const handler = async (
  _event: unknown = {},
  context?: Context
): Promise<TopUpResult> => {
  console.log('[RECURRENCE-TOPUP] invoked', { requestId: context?.awsRequestId })
  const timestamp = new Date().toISOString()

  try {
    await loadSecrets()
    const summary = await topUpRecurrences()

    console.log('[RECURRENCE-TOPUP] done', JSON.stringify(summary))
    return { success: true, timestamp, ...summary }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[RECURRENCE-TOPUP] failed:', error)
    return {
      success: false,
      timestamp,
      error: message,
      scanned: 0,
      extended: 0,
      bookingsCreated: 0,
      skipped: {},
      truncated: false,
    }
  }
}

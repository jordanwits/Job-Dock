/**
 * Rolling top-up for open-ended ("repeats forever") recurring series.
 *
 * A series is stored as one Job + one JobRecurrence + N Booking rows. Bookings are only
 * materialized out to a rolling horizon (see RECURRENCE_HORIZON_MONTHS), so something has to
 * extend them as time passes — that is this module, driven daily by the recurrence-topup Lambda.
 *
 * The safety property that matters most: a series the user stopped must never come back.
 * Deletes/archives mark JobRecurrence.status non-active (see setRecurrenceStatus in
 * dataService), and this module independently re-checks that the parent job is still present
 * and unarchived. Both must hold before a single new booking is written.
 */
import prisma from './db'
import {
  generateRecurrenceInstances,
  isOpenEndedRecurrence,
  recurrenceHorizonEnd,
} from './dataService'

/** Most recurrences one run will touch. Bounds a runaway; logged when it bites. */
const MAX_RECURRENCES_PER_RUN = 500

export interface TopUpSummary {
  scanned: number
  extended: number
  bookingsCreated: number
  skipped: Record<string, number>
  truncated: boolean
}

type SeriesShape = {
  frequency: string
  interval: number
  daysOfWeek: number[]
  timezone: string | null
  startTime: Date
  endTime: Date
}

/**
 * Occurrences to append to a series, given the last one already on the calendar.
 *
 * Pure: no DB access, `now` injectable. The walk restarts from the series' ORIGINAL startTime
 * so monthly day-of-month anchoring and DST handling stay byte-identical to the initial
 * creation; `after` suppresses everything already materialized.
 */
export function occurrencesToAdd(
  series: SeriesShape,
  lastOccurrenceAt: Date | null,
  now: Date = new Date()
): Array<{ startTime: Date; endTime: Date }> {
  const horizonEnd = recurrenceHorizonEnd(now)
  if (lastOccurrenceAt && lastOccurrenceAt >= horizonEnd) return []

  return generateRecurrenceInstances({
    startTime: series.startTime,
    endTime: series.endTime,
    recurrence: {
      frequency: series.frequency as never,
      interval: series.interval,
      daysOfWeek: series.daysOfWeek?.length ? series.daysOfWeek : undefined,
      timezone: series.timezone ?? undefined,
      // Explicitly open-ended: the horizon does the bounding, not a count or end date.
      count: undefined,
      untilDate: undefined,
    },
    after: lastOccurrenceAt ?? undefined,
    horizonEnd,
  })
}

/**
 * Extend every active open-ended series up to the rolling horizon.
 * Safe to run repeatedly: new occurrences are only ever generated strictly after the series'
 * latest existing booking, so a second run in the same day is a no-op.
 */
export async function topUpRecurrences(now: Date = new Date()): Promise<TopUpSummary> {
  const summary: TopUpSummary = {
    scanned: 0,
    extended: 0,
    bookingsCreated: 0,
    skipped: {},
    truncated: false,
  }
  const skip = (reason: string) => {
    summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1
  }

  // Only 'active' survives here — archiving or deleting a series flips this (dataService).
  const recurrences = await prisma.jobRecurrence.findMany({
    where: { status: 'active', count: null, untilDate: null },
    take: MAX_RECURRENCES_PER_RUN + 1,
    orderBy: { createdAt: 'asc' },
  })

  if (recurrences.length > MAX_RECURRENCES_PER_RUN) {
    summary.truncated = true
    recurrences.length = MAX_RECURRENCES_PER_RUN
    console.warn(
      `[RECURRENCE-TOPUP] More than ${MAX_RECURRENCES_PER_RUN} open-ended series; ` +
        `processing the oldest ${MAX_RECURRENCES_PER_RUN} this run, remainder next run.`
    )
  }

  for (const recurrence of recurrences) {
    summary.scanned++

    if (!isOpenEndedRecurrence(recurrence)) {
      // Belt and braces — the query already filters these out.
      skip('not-open-ended')
      continue
    }

    // Cursor = the latest occurrence that EXISTS, archived or not. Using only live bookings
    // would re-create occurrences the user archived individually at the tail of the series.
    const latest = await prisma.booking.findFirst({
      where: { recurrenceId: recurrence.id, tenantId: recurrence.tenantId, deletedAt: null },
      orderBy: { startTime: 'desc' },
    })

    if (!latest) {
      // No bookings left at all: the series was permanently deleted and this row is an orphan.
      skip('no-bookings')
      continue
    }

    // Independent liveness check. status='active' should already guarantee this, but this area
    // has regressed before, so the worker does not rely on a single flag to decide it may write.
    const liveBooking = await prisma.booking.findFirst({
      where: {
        recurrenceId: recurrence.id,
        tenantId: recurrence.tenantId,
        deletedAt: null,
        archivedAt: null,
      },
      select: { id: true },
    })
    if (!liveBooking) {
      skip('series-archived')
      continue
    }

    // A staged-monthly series is a single to-be-scheduled anchor that the calendar renders as a
    // virtual chip each month — it has no fixed dates to extend. Those carry status 'staged' so
    // the query above already excludes them; this is the independent check, because
    // materializing real appointments for a deliberately-unscheduled series is precisely the
    // "stuck being scheduled forever" failure this worker must never cause.
    if (latest.toBeScheduled) {
      skip('staged-series')
      continue
    }

    if (!latest.jobId) {
      skip('no-job')
      continue
    }
    const job = await prisma.job.findFirst({
      where: { id: latest.jobId, tenantId: recurrence.tenantId },
      select: { id: true, archivedAt: true },
    })
    if (!job) {
      skip('job-deleted')
      continue
    }
    if (job.archivedAt) {
      skip('job-archived')
      continue
    }

    const additions = occurrencesToAdd(
      {
        frequency: recurrence.frequency,
        interval: recurrence.interval,
        daysOfWeek: recurrence.daysOfWeek,
        timezone: recurrence.timezone,
        startTime: recurrence.startTime,
        endTime: recurrence.endTime,
      },
      latest.startTime,
      now
    )

    if (additions.length === 0) {
      skip('already-current')
      continue
    }

    // New occurrences inherit the most recent occurrence's shape (service, price, assignees,
    // location, notes) rather than the original one — that is what "my recurring job, as it
    // is now" means to the user who edited it along the way.
    await prisma.booking.createMany({
      data: additions.map(instance => ({
        tenantId: recurrence.tenantId,
        jobId: latest.jobId,
        serviceId: latest.serviceId,
        quoteId: latest.quoteId,
        invoiceId: latest.invoiceId,
        recurrenceId: recurrence.id,
        startTime: instance.startTime,
        endTime: instance.endTime,
        toBeScheduled: false,
        status: latest.status,
        location: latest.location,
        price: latest.price,
        notes: latest.notes,
        assignedTo: latest.assignedTo ?? undefined,
        createdById: latest.createdById,
      })),
    })

    summary.extended++
    summary.bookingsCreated += additions.length
    console.log(
      `[RECURRENCE-TOPUP] recurrence=${recurrence.id} tenant=${recurrence.tenantId} ` +
        `added=${additions.length} through=${additions[additions.length - 1]?.startTime.toISOString()}`
    )
  }

  return summary
}

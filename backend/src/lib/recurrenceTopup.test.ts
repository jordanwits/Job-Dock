jest.mock('./db', () => ({
  __esModule: true,
  default: {
    jobRecurrence: { findMany: jest.fn() },
    booking: { findFirst: jest.fn(), createMany: jest.fn() },
    job: { findFirst: jest.fn() },
  },
}))

import prisma from './db'
import { topUpRecurrences } from './recurrenceTopup'

/**
 * The top-up worker's guard matrix.
 *
 * The requirement these protect: a user who deletes or archives a recurring job must not have
 * it silently rebuilt on the next nightly run. Nothing here should ever call booking.createMany
 * except the one genuinely-live case.
 */

const db = prisma as unknown as {
  jobRecurrence: { findMany: jest.Mock }
  booking: { findFirst: jest.Mock; createMany: jest.Mock }
  job: { findFirst: jest.Mock }
}

const NOW = new Date(2026, 5, 1, 12, 0) // 2026-06-01

const activeSeries = {
  id: 'rec-1',
  tenantId: 'tenant-1',
  status: 'active',
  frequency: 'weekly',
  interval: 1,
  daysOfWeek: [] as number[],
  timezone: null,
  count: null,
  untilDate: null,
  startTime: new Date(2026, 0, 5, 9, 0),
  endTime: new Date(2026, 0, 5, 11, 0),
  createdAt: new Date(2026, 0, 1),
}

/** A booking near the horizon edge, so a live series has something to extend. */
const latestBooking = {
  id: 'bk-latest',
  jobId: 'job-1',
  serviceId: 'svc-1',
  quoteId: null,
  invoiceId: null,
  status: 'active',
  location: '12 Elm St',
  price: null,
  notes: null,
  assignedTo: null,
  createdById: 'user-1',
  startTime: new Date(2026, 5, 29, 9, 0),
  archivedAt: null as Date | null,
  deletedAt: null as Date | null,
}

/**
 * @param opts.cursor   latest booking of ANY archived state (null = series has no bookings)
 * @param opts.live     a still-live booking, or null when the whole series is archived
 * @param opts.job      the parent job row, or null when it has been deleted
 */
function arrange(opts: {
  recurrences?: unknown[]
  cursor?: typeof latestBooking | null
  live?: { id: string } | null
  job?: { id: string; archivedAt: Date | null } | null
}) {
  const {
    recurrences = [activeSeries],
    cursor = latestBooking,
    live = { id: 'bk-live' },
    job = { id: 'job-1', archivedAt: null },
  } = opts

  db.jobRecurrence.findMany.mockResolvedValue(recurrences)
  db.booking.findFirst.mockImplementation((args: { where?: { archivedAt?: unknown } }) =>
    // The liveness probe is the one that filters archivedAt: null; the cursor query does not.
    Promise.resolve(args?.where?.archivedAt === null ? live : cursor)
  )
  db.job.findFirst.mockResolvedValue(job)
  db.booking.createMany.mockResolvedValue({ count: 0 })
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('topUpRecurrences — series that must NOT be extended', () => {
  it('only ever queries active, open-ended recurrences', async () => {
    arrange({})
    await topUpRecurrences(NOW)

    expect(db.jobRecurrence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'active', count: null, untilDate: null },
      })
    )
  })

  it('skips an orphaned recurrence with no bookings left (permanently deleted series)', async () => {
    arrange({ cursor: null })
    const result = await topUpRecurrences(NOW)

    expect(db.booking.createMany).not.toHaveBeenCalled()
    expect(result.skipped['no-bookings']).toBe(1)
    expect(result.bookingsCreated).toBe(0)
  })

  it('skips a series whose every booking is archived', async () => {
    arrange({ live: null })
    const result = await topUpRecurrences(NOW)

    expect(db.booking.createMany).not.toHaveBeenCalled()
    expect(result.skipped['series-archived']).toBe(1)
  })

  it('skips a series whose parent job was archived', async () => {
    arrange({ job: { id: 'job-1', archivedAt: new Date(2026, 4, 1) } })
    const result = await topUpRecurrences(NOW)

    expect(db.booking.createMany).not.toHaveBeenCalled()
    expect(result.skipped['job-archived']).toBe(1)
  })

  it('skips a series whose parent job was deleted', async () => {
    arrange({ job: null })
    const result = await topUpRecurrences(NOW)

    expect(db.booking.createMany).not.toHaveBeenCalled()
    expect(result.skipped['job-deleted']).toBe(1)
  })

  it('skips a series already materialized past the horizon', async () => {
    arrange({
      cursor: { ...latestBooking, startTime: new Date(2027, 11, 1, 9, 0) },
    })
    const result = await topUpRecurrences(NOW)

    expect(db.booking.createMany).not.toHaveBeenCalled()
    expect(result.skipped['already-current']).toBe(1)
  })
})

describe('topUpRecurrences — a live series', () => {
  it('appends occurrences after the cursor, inheriting the latest occurrence shape', async () => {
    arrange({})
    const result = await topUpRecurrences(NOW)

    expect(db.booking.createMany).toHaveBeenCalledTimes(1)
    const rows = db.booking.createMany.mock.calls[0][0].data as Array<{
      recurrenceId: string
      tenantId: string
      jobId: string | null
      serviceId: string | null
      location: string | null
      toBeScheduled: boolean
      startTime: Date
    }>

    expect(rows.length).toBeGreaterThan(0)
    expect(result.extended).toBe(1)
    expect(result.bookingsCreated).toBe(rows.length)

    for (const row of rows) {
      expect(row.recurrenceId).toBe('rec-1')
      expect(row.tenantId).toBe('tenant-1')
      expect(row.jobId).toBe('job-1')
      expect(row.serviceId).toBe('svc-1')
      expect(row.location).toBe('12 Elm St')
      expect(row.toBeScheduled).toBe(false)
      // Never re-create something at or before the cursor.
      expect(row.startTime.getTime()).toBeGreaterThan(latestBooking.startTime.getTime())
    }
  })

  it('takes its cursor from the latest booking regardless of archived state', async () => {
    // An individually-archived tail occurrence must still advance the cursor, otherwise the
    // worker recreates a date the user deliberately removed.
    arrange({ cursor: { ...latestBooking, archivedAt: new Date(2026, 5, 2) } })
    await topUpRecurrences(NOW)

    const cursorCall = db.booking.findFirst.mock.calls.find(
      (c: [{ orderBy?: { startTime?: string }; where: Record<string, unknown> }]) =>
        c[0]?.orderBy?.startTime === 'desc'
    )
    expect(cursorCall).toBeDefined()
    expect(cursorCall![0].where).not.toHaveProperty('archivedAt')
  })

  it('reports truncation instead of silently dropping series', async () => {
    const many = Array.from({ length: 501 }, (_, i) => ({ ...activeSeries, id: `rec-${i}` }))
    arrange({ recurrences: many, cursor: null })
    const result = await topUpRecurrences(NOW)

    expect(result.truncated).toBe(true)
    expect(result.scanned).toBe(500)
  })
})

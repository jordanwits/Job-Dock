// The push engine. CleanDock bookings are the source of truth; one Google event per
// (connection, eligible booking). Sync is ONE-WAY: syncTenant pushes CleanDock appointments to each
// connection's dedicated Google calendar (create/update/delete). Changes made in Google are never
// read back into CleanDock. Pure/idempotent: a steady-state run with no changes makes ZERO Google API
// calls. Never logs tokens or event bodies — counts only.

import { createCalendar, deleteEvent, getActiveConnection, insertEvent, patchEvent } from './client'
import { CALENDAR_DESCRIPTION, CALENDAR_SUMMARY } from './config'
import {
  bookingMatchesSyncMode,
  buildEventPayload,
  fingerprintOfEvent,
  isBookingEligible,
  prunedMapDisposition,
  windowStartDate,
  type PayloadBooking,
  type PayloadContact,
  type PayloadJob,
} from './eventPayload'
import { GcalHttpError, type ActiveConnection, type GoogleEvent } from './types'

const CLAIM_STALE_MS = 5 * 60 * 1000

async function getPrisma() {
  const { default: prisma } = await import('../db')
  return prisma
}

function publicAppUrl(): string {
  return (process.env.PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

// ─── entry point ───────────────────────────────────────────────────────────────────────────────

export async function syncTenant(tenantId: string): Promise<void> {
  const prisma = await getPrisma()
  // Include 'error' rows: a connection that hit a transient failure keeps being retried and
  // self-heals via markConnectionSuccess (which flips it back to 'connected'). Only 'disconnected'
  // is excluded. invalid_grant rows retry and fail fast each run, which is acceptable.
  const connections = await prisma.googleCalendarConnection.findMany({
    where: { tenantId, status: { in: ['connected', 'error'] } },
    select: { id: true },
  })
  if (connections.length === 0) return

  // PUSH every connection (CleanDock → Google). One-way: we never read Google state back.
  for (const { id } of connections) {
    try {
      const ran = await withClaim(id, () => pushConnection(id))
      if (ran) await markConnectionSuccess(id)
    } catch (err) {
      await recordConnectionError(id, err)
    }
  }
}

// ─── concurrency claim (atomic, no pg advisory locks) ────────────────────────────────────────────

// Claim the connection row for a phase. Claimed iff the atomic updateMany touched exactly one row.
// The 5-minute staleness makes a crashed run self-healing.
// A contested claim is RETRIED briefly instead of dropped: instant-sync invocations race (one
// Lambda per mutation), and the loser must still push after the winner releases — its re-read then
// picks up the mutation that invoked it. Without the retry, that mutation's push silently waits for
// the next trigger (e.g. a just-deleted appointment lingering on Google as a ghost event).
const CLAIM_RETRY_WINDOW_MS = 15 * 1000
const CLAIM_RETRY_DELAY_MS = 2500

async function withClaim(connectionId: string, fn: () => Promise<void>): Promise<boolean> {
  const prisma = await getPrisma()
  const deadline = Date.now() + CLAIM_RETRY_WINDOW_MS
  for (;;) {
    const now = new Date()
    const staleBefore = new Date(now.getTime() - CLAIM_STALE_MS)
    const claim = await prisma.googleCalendarConnection.updateMany({
      where: {
        id: connectionId,
        OR: [{ syncInProgressAt: null }, { syncInProgressAt: { lt: staleBefore } }],
      },
      data: { syncInProgressAt: now },
    })
    if (claim.count === 1) {
      try {
        await fn()
        return true
      } finally {
        // Only release the claim WE wrote: match syncInProgressAt to our exact timestamp so a run
        // that stole a stale claim from us (a future longer-running phase) is never clobbered. If
        // another run already re-claimed, this updateMany touches zero rows.
        await prisma.googleCalendarConnection
          .updateMany({
            where: { id: connectionId, syncInProgressAt: now },
            data: { syncInProgressAt: null },
          })
          .catch(() => {
            /* best-effort release; staleness will reclaim if this fails */
          })
      }
    }
    if (Date.now() >= deadline) return false
    await new Promise(resolve => setTimeout(resolve, CLAIM_RETRY_DELAY_MS))
  }
}

async function markConnectionSuccess(connectionId: string): Promise<void> {
  const prisma = await getPrisma()
  await prisma.googleCalendarConnection
    .update({
      where: { id: connectionId },
      data: { status: 'connected', lastSyncAt: new Date(), lastErrorMessage: null },
    })
    .catch(() => {})
}

async function recordConnectionError(connectionId: string, err: unknown): Promise<void> {
  const prisma = await getPrisma()
  const message = (err instanceof Error ? err.message : String(err)).slice(0, 500)
  const name = err instanceof Error ? err.name : 'Error'
  console.warn(`[gcal-sync] connection ${connectionId} failed: ${name}`)
  await prisma.googleCalendarConnection
    .update({ where: { id: connectionId }, data: { status: 'error', lastErrorMessage: message } })
    .catch(() => {})
}

// Recreate the dedicated CleanDock calendar (user deleted it), wipe this connection's map rows, and
// return the new calendar id. The subsequent push repopulates from scratch.
async function recreateCalendar(active: ActiveConnection): Promise<string> {
  const prisma = await getPrisma()
  const created = await createCalendar(active, CALENDAR_SUMMARY, CALENDAR_DESCRIPTION)
  await prisma.googleCalendarEventMap.deleteMany({ where: { connectionId: active.id } })
  await prisma.googleCalendarConnection.update({
    where: { id: active.id },
    data: { calendarId: created.id },
  })
  console.log(`[gcal-sync] recreated CleanDock calendar for connection ${active.id}`)
  return created.id
}

// ─── PUSH (CleanDock -> Google), diff-based ────────────────────────────────────────────────────────

async function pushConnection(connectionId: string): Promise<void> {
  const active = await getActiveConnection(connectionId)
  if (!active.calendarId) {
    // No calendar yet (e.g. connect created the row but calendar creation is pending) — make one.
    active.calendarId = await recreateCalendar(active)
  }
  try {
    await runPush(active)
  } catch (err) {
    if (err instanceof GcalHttpError && err.status === 404) {
      // The CleanDock calendar was deleted out from under us — recreate and push fresh.
      const newId = await recreateCalendar(active)
      active.calendarId = newId
      await runPush(active)
      return
    }
    throw err
  }
}

interface BookingWithRelations {
  id: string
  tenantId: string
  jobId: string | null
  title: string | null
  location: string | null
  notes: string | null
  startTime: Date | null
  endTime: Date | null
  status: string
  toBeScheduled: boolean
  archivedAt: Date | null
  deletedAt: Date | null
  assignedTo: unknown
  contact: { firstName: string; lastName: string; phone: string | null } | null
  job: {
    title: string | null
    location: string | null
    notes: string | null
    assignedTo: unknown
    contact: { firstName: string; lastName: string; phone: string | null } | null
  } | null
}

const BOOKING_INCLUDE = {
  contact: { select: { firstName: true, lastName: true, phone: true } },
  job: {
    select: {
      title: true,
      location: true,
      notes: true,
      assignedTo: true,
      contact: { select: { firstName: true, lastName: true, phone: true } },
    },
  },
} as const

function payloadContact(b: BookingWithRelations): PayloadContact | null {
  const c = b.contact ?? b.job?.contact ?? null
  return c ? { firstName: c.firstName, lastName: c.lastName, phone: c.phone } : null
}

function toPayloadBooking(b: BookingWithRelations): PayloadBooking {
  return {
    id: b.id,
    tenantId: b.tenantId,
    jobId: b.jobId,
    title: b.title,
    location: b.location,
    notes: b.notes,
    startTime: b.startTime as Date,
    endTime: b.endTime as Date,
    status: b.status,
  }
}

function toPayloadJob(b: BookingWithRelations): PayloadJob | null {
  return b.job ? { title: b.job.title, location: b.job.location, notes: b.job.notes } : null
}

function buildBookingEvent(b: BookingWithRelations): GoogleEvent {
  return buildEventPayload(toPayloadBooking(b), toPayloadJob(b), payloadContact(b), publicAppUrl())
}

// F8a: store the fingerprint of what Google ACTUALLY persisted (its create/patch response body),
// not merely what we sent — so a later incremental pull that echoes Google's own resource matches
// and stays a no-op. Fall back to the built-payload fingerprint if the response body is too thin to
// fingerprint (missing start/end dateTimes).
function storedFingerprint(builtFingerprint: string, response: GoogleEvent | null | undefined): string {
  if (response && (response.start?.dateTime || response.end?.dateTime)) {
    return fingerprintOfEvent(response)
  }
  return builtFingerprint
}

async function runPush(active: ActiveConnection): Promise<void> {
  const prisma = await getPrisma()
  const calendarId = active.calendarId!
  const now = new Date()
  const windowStart = windowStartDate(now)

  const maps = await prisma.googleCalendarEventMap.findMany({ where: { connectionId: active.id } })

  // Eligible bookings for this tenant. This WHERE clause is only a coarse DB prefilter — the
  // canonical push-eligibility predicate is eventPayload.isBookingEligible, re-applied below (with
  // the syncMode check) so the two never drift.
  const candidateBookings = (await prisma.booking.findMany({
    where: {
      tenantId: active.tenantId,
      toBeScheduled: false,
      archivedAt: null,
      deletedAt: null,
      status: { not: 'cancelled' },
      startTime: { gte: windowStart, not: null },
      endTime: { not: null },
    },
    include: BOOKING_INCLUDE,
  })) as unknown as BookingWithRelations[]

  const eligible = candidateBookings.filter(
    b =>
      isBookingEligible(b, now) &&
      bookingMatchesSyncMode(active.syncMode, active.userId, b.assignedTo, b.job?.assignedTo)
  )
  const eligibleIds = new Set(eligible.map(b => b.id))
  const mapByBookingId = new Map(maps.filter(m => m.bookingId).map(m => [m.bookingId as string, m]))

  let inserts = 0
  let patches = 0
  let deletes = 0

  // 1. Create / update events for eligible bookings.
  for (const booking of eligible) {
    const event = buildBookingEvent(booking)
    const fingerprint = fingerprintOfEvent(event)
    const existing = mapByBookingId.get(booking.id)

    if (!existing) {
      const created = await insertEvent(active, calendarId, event)
      await prisma.googleCalendarEventMap.create({
        data: {
          connectionId: active.id,
          bookingId: booking.id,
          googleEventId: created.id!,
          fingerprint: storedFingerprint(fingerprint, created),
        },
      })
      inserts++
      continue
    }

    if (existing.fingerprint === fingerprint) continue // steady state — no API call

    const patched = await patchEvent(active, calendarId, existing.googleEventId, event)
    if (patched === null) {
      // Event vanished from Google — re-insert and repoint the map row.
      const created = await insertEvent(active, calendarId, event)
      await prisma.googleCalendarEventMap.update({
        where: { id: existing.id },
        data: { googleEventId: created.id!, fingerprint: storedFingerprint(fingerprint, created) },
      })
      inserts++
    } else {
      await prisma.googleCalendarEventMap.update({
        where: { id: existing.id },
        data: { fingerprint: storedFingerprint(fingerprint, patched) },
      })
      patches++
    }
  }

  // 2. Prune map rows whose booking is NOT in the eligible set, applying the freeze rule (F4):
  //    'freeze' (out-of-window history) leaves the Google event AND the map row untouched, so a
  //    later reschedule into the window PATCHes the SAME event; 'remove' deletes both.
  const pruneMaps = maps.filter(m => !(m.bookingId && eligibleIds.has(m.bookingId)))

  // F12: batch the per-row booking lookup into ONE query + an in-memory Map (was an N+1). Only the
  // start time is needed to classify freeze vs remove (existence + window).
  const pruneBookingIds = [
    ...new Set(pruneMaps.map(m => m.bookingId).filter((id): id is string => !!id)),
  ]
  const prunedBookings = pruneBookingIds.length
    ? ((await prisma.booking.findMany({
        where: { id: { in: pruneBookingIds }, tenantId: active.tenantId },
        select: { id: true, startTime: true },
      })) as Array<{ id: string; startTime: Date | null }>)
    : []
  const prunedBookingById = new Map(prunedBookings.map(b => [b.id, b]))

  for (const map of pruneMaps) {
    const booking = map.bookingId ? prunedBookingById.get(map.bookingId) : null
    // 'freeze' → booking exists but is out-of-window history: leave the event and the map alone.
    if (prunedMapDisposition(booking, now) === 'freeze') continue
    // 'remove' → booking gone (hard-deleted / not found) or in-window but ineligible
    // (archived / cancelled / toBeScheduled / mode-mismatch): delete the event and the map row.
    await deleteEvent(active, calendarId, map.googleEventId)
    await prisma.googleCalendarEventMap.delete({ where: { id: map.id } })
    deletes++
  }

  if (inserts || patches || deletes) {
    console.log(
      `[gcal-sync] push connection ${active.id}: +${inserts} ~${patches} -${deletes}`
    )
  }
}

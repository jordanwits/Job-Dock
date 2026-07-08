// The reconcile engine. JobDock bookings are the source of truth; one Google event per
// (connection, eligible booking). syncTenant runs all PULLs first (a pulled change fans out to
// other connections in the same run), then all PUSHes. Pure/idempotent: a steady-state sweep with
// no changes makes ZERO Google API calls. Never logs tokens or event bodies — counts only.

import { createCalendar, deleteEvent, getActiveConnection, insertEvent, listEvents, patchEvent } from './client'
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
import { GcalHttpError, SyncTokenGoneError, type ActiveConnection, type GoogleEvent } from './types'

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

  const errored = new Set<string>()

  // PULL every connection first so a pulled change can fan out to the others' PUSH this same run.
  for (const { id } of connections) {
    try {
      await withClaim(id, () => pullConnection(id))
    } catch (err) {
      errored.add(id)
      await recordConnectionError(id, err)
    }
  }

  // PUSH every connection.
  for (const { id } of connections) {
    if (errored.has(id)) continue
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
async function withClaim(connectionId: string, fn: () => Promise<void>): Promise<boolean> {
  const prisma = await getPrisma()
  const now = new Date()
  const staleBefore = new Date(now.getTime() - CLAIM_STALE_MS)
  const claim = await prisma.googleCalendarConnection.updateMany({
    where: {
      id: connectionId,
      OR: [{ syncInProgressAt: null }, { syncInProgressAt: { lt: staleBefore } }],
    },
    data: { syncInProgressAt: now },
  })
  if (claim.count !== 1) return false
  try {
    await fn()
    return true
  } finally {
    // Only release the claim WE wrote: match syncInProgressAt to our exact timestamp so a run that
    // stole a stale claim from us (a future longer-running phase) is never clobbered. If another
    // run already re-claimed, this updateMany touches zero rows.
    await prisma.googleCalendarConnection
      .updateMany({ where: { id: connectionId, syncInProgressAt: now }, data: { syncInProgressAt: null } })
      .catch(() => {
        /* best-effort release; staleness will reclaim if this fails */
      })
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

// Recreate the dedicated JobDock calendar (user deleted it), wipe this connection's map rows +
// syncToken, and return the new calendar id. The subsequent push repopulates from scratch.
async function recreateCalendar(active: ActiveConnection): Promise<string> {
  const prisma = await getPrisma()
  const created = await createCalendar(active, CALENDAR_SUMMARY, CALENDAR_DESCRIPTION)
  await prisma.googleCalendarEventMap.deleteMany({ where: { connectionId: active.id } })
  await prisma.googleCalendarConnection.update({
    where: { id: active.id },
    data: { calendarId: created.id, syncToken: null },
  })
  console.log(`[gcal-sync] recreated JobDock calendar for connection ${active.id}`)
  return created.id
}

// ─── PUSH (JobDock -> Google), diff-based ────────────────────────────────────────────────────────

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
      // The JobDock calendar was deleted out from under us — recreate and push fresh.
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
      status: { in: ['active', 'pending-confirmation'] },
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

// ─── PULL (Google -> JobDock), syncToken incremental ────────────────────────────────────────────

async function pullConnection(connectionId: string): Promise<void> {
  const active = await getActiveConnection(connectionId)
  if (!active.calendarId) return // no calendar yet — nothing to pull; push will create it
  await runPull(active)
}

async function runPull(active: ActiveConnection): Promise<void> {
  const prisma = await getPrisma()
  const calendarId = active.calendarId!
  const now = new Date()
  const timeMin = windowStartDate(now).toISOString()

  let processed = 0
  const drain = async (opts: {
    syncToken?: string
    seenEventIds?: Set<string>
  }): Promise<string | undefined> => {
    let pageToken: string | undefined
    let nextSyncToken: string | undefined
    do {
      const page = await listEvents(active, calendarId, {
        syncToken: pageToken ? undefined : opts.syncToken,
        timeMin: pageToken || opts.syncToken ? undefined : timeMin,
        pageToken,
      })
      for (const event of page.items) {
        if (opts.seenEventIds && event.id) opts.seenEventIds.add(event.id)
        await processPulledEvent(active, calendarId, event, now)
        processed++
      }
      pageToken = page.nextPageToken
      if (page.nextSyncToken) nextSyncToken = page.nextSyncToken
    } while (pageToken)
    return nextSyncToken
  }

  // A full windowed re-list (no syncToken — initial sync, or the 410 fallback) omits events that
  // were cancelled in Google, and nothing else reconciles them. So on the full-re-list path only,
  // collect every returned event id and afterwards reconcile map rows against that set (F5).
  // Incremental pulls carry cancellations inline (processPulledEvent handles them) and never here.
  const fullReList = async (): Promise<string | undefined> => {
    const seenEventIds = new Set<string>()
    const token = await drain({ seenEventIds })
    await reconcileDeletedInGoogle(active, seenEventIds, now)
    return token
  }

  let nextSyncToken: string | undefined
  try {
    const currentToken = active.syncToken || undefined
    if (!currentToken) {
      nextSyncToken = await fullReList()
    } else {
      try {
        nextSyncToken = await drain({ syncToken: currentToken })
      } catch (err) {
        if (err instanceof SyncTokenGoneError) {
          // Stale token — clear it and fall back to a full windowed re-list + deletion reconcile.
          await prisma.googleCalendarConnection.update({
            where: { id: active.id },
            data: { syncToken: null },
          })
          nextSyncToken = await fullReList()
        } else {
          throw err
        }
      }
    }
  } catch (err) {
    if (err instanceof GcalHttpError && err.status === 404) {
      // Calendar deleted in Google (on either list attempt) — recreate (wipes maps + syncToken);
      // the push pass repopulates.
      await recreateCalendar(active)
      return
    }
    throw err
  }

  if (nextSyncToken) {
    await prisma.googleCalendarConnection.update({
      where: { id: active.id },
      data: { syncToken: nextSyncToken },
    })
  }
  if (processed) console.log(`[gcal-sync] pull connection ${active.id}: ${processed} events`)
}

// F5: after a FULL re-list only, reconcile map rows against the ids Google actually returned. A full
// re-list (showDeleted defaults false) omits cancelled events, so any map row whose googleEventId was
// NOT returned is an event deleted in Google while our syncToken was unusable. For each such row
// whose booking exists, has times, and is in-window, soft-delete the booking (archivedAt, direct
// update, NO emails/SMS — exactly like the incremental cancelled-event path) and drop the map row.
// Frozen/out-of-window and untimed bookings are EXEMPT (consistent with the F4 freeze rule); a row
// whose booking is already gone is left to the push pass to clean up as an orphan.
async function reconcileDeletedInGoogle(
  active: ActiveConnection,
  seenEventIds: Set<string>,
  now: Date
): Promise<void> {
  const prisma = await getPrisma()
  const windowStart = windowStartDate(now)
  const maps = await prisma.googleCalendarEventMap.findMany({ where: { connectionId: active.id } })
  const missing = maps.filter(m => m.bookingId && !seenEventIds.has(m.googleEventId))
  if (missing.length === 0) return

  const bookingIds = [...new Set(missing.map(m => m.bookingId as string))]
  const bookings = (await prisma.booking.findMany({
    where: { id: { in: bookingIds }, tenantId: active.tenantId },
    select: { id: true, startTime: true, endTime: true },
  })) as Array<{ id: string; startTime: Date | null; endTime: Date | null }>
  const byId = new Map(bookings.map(b => [b.id, b]))

  let softDeleted = 0
  for (const map of missing) {
    const booking = byId.get(map.bookingId as string)
    if (!booking || !booking.startTime || !booking.endTime) continue
    if (new Date(booking.startTime) < windowStart) continue // frozen / out-of-window — exempt
    await prisma.booking.updateMany({
      where: { id: booking.id, tenantId: active.tenantId, archivedAt: null },
      data: { archivedAt: now },
    })
    await prisma.googleCalendarEventMap.delete({ where: { id: map.id } })
    softDeleted++
  }
  if (softDeleted) {
    console.log(`[gcal-sync] pull reconcile connection ${active.id}: ${softDeleted} deleted-in-Google`)
  }
}

async function processPulledEvent(
  active: ActiveConnection,
  calendarId: string,
  event: GoogleEvent,
  now: Date
): Promise<void> {
  const prisma = await getPrisma()
  const eventId = event.id
  if (!eventId) return

  // Only timed events. If a pulled all-day event maps to one of OUR rows, someone converted our
  // timed event to all-day in Google — blank the stored fingerprint so this run's push detects a
  // mismatch and PATCHes it back to the booking's timed form (F6). Unmapped all-day events (created
  // by the user directly) stay ignored.
  if (event.start?.date || event.end?.date) {
    const allDayMap = await prisma.googleCalendarEventMap.findFirst({
      where: { connectionId: active.id, googleEventId: eventId },
    })
    if (allDayMap && allDayMap.fingerprint !== '') {
      await prisma.googleCalendarEventMap.update({
        where: { id: allDayMap.id },
        data: { fingerprint: '' },
      })
    }
    return
  }

  const map = await prisma.googleCalendarEventMap.findFirst({
    where: { connectionId: active.id, googleEventId: eventId },
  })

  // Deletion in Google.
  if (event.status === 'cancelled') {
    if (map) {
      if (map.bookingId) {
        // Soft-delete exactly like bookings.delete (archivedAt), directly — never the service
        // method, never any email/SMS.
        await prisma.booking.updateMany({
          where: { id: map.bookingId, tenantId: active.tenantId, archivedAt: null },
          data: { archivedAt: now },
        })
      }
      await prisma.googleCalendarEventMap.delete({ where: { id: map.id } })
    }
    return
  }

  if (!map) {
    // Not mapped — try to re-link via our extendedProperty, else treat as a user-created event.
    const jobdockBookingId = event.extendedProperties?.private?.jobdockBookingId
    if (jobdockBookingId) {
      const booking = await prisma.booking.findFirst({
        where: { id: jobdockBookingId, tenantId: active.tenantId },
      })
      if (booking) {
        await linkMap(active.id, booking.id, eventId, fingerprintOfEvent(event))
      } else {
        // Booking is gone — remove the stray event; no mapping.
        await deleteEvent(active, calendarId, eventId)
      }
      return
    }

    // Unknown event created by the user on the JobDock calendar → new independent booking.
    if (event.start?.dateTime && event.end?.dateTime) {
      const start = new Date(event.start.dateTime)
      if (!Number.isNaN(start.getTime()) && start >= windowStartDate(now)) {
        const created = await prisma.booking.create({
          data: {
            tenantId: active.tenantId,
            isIndependent: true,
            toBeScheduled: false,
            status: 'active',
            title: event.summary || 'Google Calendar event',
            location: event.location || null,
            notes: event.description || null,
            startTime: start,
            endTime: new Date(event.end.dateTime),
            createdById: active.userId,
            // Assign the appointment to the connecting user, in the exact object shape
            // dataService.normalizeAssignedTo accepts. Crucially this also makes the new booking
            // pass THIS connection's own syncMode:'mine' filter, so its very first push doesn't
            // prune and delete the event we just pulled (F1).
            assignedTo: [{ userId: active.userId, role: 'Assigned' }],
          },
        })
        await linkMap(active.id, created.id, eventId, fingerprintOfEvent(event))
      }
    }
    return
  }

  // Mapped event.
  const eventFingerprint = fingerprintOfEvent(event)
  if (eventFingerprint === map.fingerprint) return // our own echo — no-op

  if (!map.bookingId) {
    // Mapped to a hard-deleted booking; the push pass deletes the event. Nothing to apply.
    return
  }

  const booking = await prisma.booking.findFirst({
    where: { id: map.bookingId, tenantId: active.tenantId },
    select: { id: true, jobId: true, title: true },
  })
  if (!booking) {
    await deleteEvent(active, calendarId, eventId)
    await prisma.googleCalendarEventMap.delete({ where: { id: map.id } })
    return
  }

  if (event.start?.dateTime && event.end?.dateTime) {
    const data: Record<string, unknown> = {
      startTime: new Date(event.start.dateTime),
      endTime: new Date(event.end.dateTime),
    }
    // Only independent bookings pull summary/location; job-backed pull times only (JobDock wins
    // title/location — the push pass patches those back). Description is never pulled.
    if (booking.jobId == null) {
      data.title = event.summary || booking.title
      data.location = event.location || null
    }
    await prisma.booking.update({ where: { id: booking.id }, data })
  }

  // Record the event's fingerprint so we don't reprocess it; the push pass re-patches Google for any
  // fields where JobDock wins.
  await prisma.googleCalendarEventMap.update({
    where: { id: map.id },
    data: { fingerprint: eventFingerprint },
  })
}

// Create or repoint the (connection, booking) map row. Tolerant of the rare unique collision.
async function linkMap(
  connectionId: string,
  bookingId: string,
  googleEventId: string,
  fingerprint: string
): Promise<void> {
  const prisma = await getPrisma()
  const existing = await prisma.googleCalendarEventMap.findFirst({
    where: { connectionId, bookingId },
  })
  try {
    if (existing) {
      await prisma.googleCalendarEventMap.update({
        where: { id: existing.id },
        data: { googleEventId, fingerprint },
      })
    } else {
      await prisma.googleCalendarEventMap.create({
        data: { connectionId, bookingId, googleEventId, fingerprint },
      })
    }
  } catch (err) {
    console.warn(`[gcal-sync] linkMap skipped for booking ${bookingId}: ${(err as Error)?.name}`)
  }
}

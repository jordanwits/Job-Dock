// Pure, side-effect-free helpers shared by the push and pull halves of the sync engine:
// eligibility rules, the deterministic Google event payload, and the ONE fingerprint function that
// both directions use so echo-suppression works. This module intentionally imports nothing that
// touches the database or network, so it is cheap to unit-test.

import { createHash } from 'crypto'
import type { GoogleEvent, SyncMode } from './types'

// Push bookings whose start is within this many days in the past; no future cap. Aging past the
// window prunes the map row but leaves the Google event as history (see sync.ts).
export const EVENT_WINDOW_DAYS = 60

export function windowStartDate(now: Date): Date {
  return new Date(now.getTime() - EVENT_WINDOW_DAYS * 24 * 60 * 60 * 1000)
}

// Normalize a free-text field so the fingerprint of what we push matches what Google echoes back.
// CRLF/CR → LF (Windows-authored notes commonly carry CRLF), trailing whitespace stripped per line
// and at the end. Applied symmetrically by the payload builder (push side) and
// fingerprintFieldsFromEvent (pull side), so the two directions always hash identically.
export function normalizeText(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\s+$/, '')
}

// ─── assignment helpers (mirrors dataService normalizeAssignedTo/extractUserIds shape) ──────────

// Extract user ids from a booking/job assignedTo value. Handles the new format (array of
// { userId, ... } objects), the legacy array-of-strings format, and a single string.
// MUST stay in sync with dataService.ts extractUserIds/normalizeAssignedTo semantics: object branch
// keeps items whose userId is truthy AND a string (returned raw); the string-array branch keeps
// truthy strings raw (NO trim/empty test); only the single-string form is trimmed.
export function extractUserIds(assignedTo: unknown): string[] {
  if (!assignedTo) return []
  if (Array.isArray(assignedTo) && assignedTo.length > 0) {
    const first = assignedTo[0]
    if (typeof first === 'object' && first !== null && 'userId' in first) {
      return (assignedTo as Array<{ userId?: unknown }>)
        .filter(
          (item): item is { userId: string } =>
            !!item && typeof item === 'object' && !!item.userId && typeof item.userId === 'string'
        )
        .map(item => item.userId)
    }
    return (assignedTo as unknown[]).filter((id): id is string => !!id && typeof id === 'string')
  }
  if (typeof assignedTo === 'string' && assignedTo.trim() !== '') {
    return [assignedTo.trim()]
  }
  return []
}

// Effective assignment = the booking's own assignedTo when it has one, else its job's assignedTo.
export function effectiveAssignedUserIds(
  bookingAssignedTo: unknown,
  jobAssignedTo: unknown
): string[] {
  const own = extractUserIds(bookingAssignedTo)
  return own.length > 0 ? own : extractUserIds(jobAssignedTo)
}

export function bookingMatchesSyncMode(
  syncMode: SyncMode,
  connectionUserId: string,
  bookingAssignedTo: unknown,
  jobAssignedTo: unknown
): boolean {
  if (syncMode === 'all') return true
  return effectiveAssignedUserIds(bookingAssignedTo, jobAssignedTo).includes(connectionUserId)
}

// ─── eligibility ─────────────────────────────────────────────────────────────────────────────

export interface EligibilityBooking {
  startTime: Date | string | null
  endTime: Date | string | null
  toBeScheduled: boolean
  archivedAt: Date | string | null
  deletedAt: Date | string | null
  status: string
}

// A booking is pushable iff it is a real, live, timed, non-cancelled appointment whose start is not
// older than the window. Staged-monthly anchors (toBeScheduled with null times) fail the null check.
// This is the CANONICAL push-eligibility predicate; the sync.ts Prisma query is only a coarse
// prefilter, and the prune pass classifies non-eligible mapped rows with prunedMapDisposition.
export function isBookingEligible(booking: EligibilityBooking, now: Date): boolean {
  if (!booking.startTime || !booking.endTime) return false
  if (booking.toBeScheduled) return false
  if (booking.archivedAt != null || booking.deletedAt != null) return false
  // Every live status stays on the user's calendar — Scheduled / In progress / Completed are all
  // real appointments occupying time. Only an explicit cancellation removes the event.
  if (booking.status === 'cancelled') return false
  const start = new Date(booking.startTime)
  if (Number.isNaN(start.getTime())) return false
  if (start < windowStartDate(now)) return false
  return true
}

// Freeze rule (F4). For a map row whose booking is NOT in the eligible set, decide what the push
// prune pass should do with the Google event:
//   - booking gone (null / not found)                         → 'remove' (delete event + map)
//   - booking exists but its start is older than the window   → 'freeze' (leave event + map alone;
//       it is history — do NOT delete, do NOT re-push; if later rescheduled into the window the map
//       survives so the normal fingerprint-mismatch PATCH updates the SAME event, no duplicate)
//   - booking exists, in-window, but ineligible               → 'remove' (archived / cancelled /
//       toBeScheduled / mode-mismatch, or null/invalid start)
export function prunedMapDisposition(
  booking: { startTime: Date | string | null } | null | undefined,
  now: Date
): 'freeze' | 'remove' {
  if (!booking || !booking.startTime) return 'remove'
  const start = new Date(booking.startTime)
  if (Number.isNaN(start.getTime())) return 'remove'
  return start < windowStartDate(now) ? 'freeze' : 'remove'
}

// ─── deterministic event payload ───────────────────────────────────────────────────────────────

export interface PayloadBooking {
  id: string
  tenantId: string
  jobId: string | null
  title: string | null
  location: string | null
  notes: string | null
  startTime: Date | string
  endTime: Date | string
  status: string
}

export interface PayloadJob {
  title: string | null
  location: string | null
  notes: string | null
}

export interface PayloadContact {
  firstName: string | null
  lastName: string | null
  phone: string | null
}

function contactName(contact: PayloadContact | null): string {
  if (!contact) return ''
  return `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim()
}

// The Google `status` we push. pending-confirmation → tentative; everything eligible else → confirmed.
export function eventStatusForBooking(bookingStatus: string): 'confirmed' | 'tentative' {
  return bookingStatus === 'pending-confirmation' ? 'tentative' : 'confirmed'
}

// Build the deterministic Google event body for a booking. Same inputs always produce the same
// payload — this is what makes the fingerprint stable.
export function buildEventPayload(
  booking: PayloadBooking,
  job: PayloadJob | null,
  contact: PayloadContact | null,
  publicAppUrl: string
): GoogleEvent {
  const appUrl = (publicAppUrl || '').replace(/\/$/, '')
  const name = contactName(contact)

  const baseSummary = booking.title || job?.title || 'CleanDock appointment'
  // normalizeText keeps CRLF-authored titles/notes/locations hashing identically to Google's echo.
  const summary = normalizeText(name ? `${baseSummary} — ${name}` : baseSummary)

  // Always a string (never undefined): lets PATCH clear a removed location and keeps the push/pull
  // fingerprints symmetric so steady-state sweeps stay zero-API.
  const location = normalizeText(booking.location || job?.location || '')

  const notes = booking.notes || job?.notes || ''
  const descLines: string[] = []
  if (name) descLines.push(name)
  if (contact?.phone) descLines.push(contact.phone)
  if (notes) descLines.push(notes)
  descLines.push(`Managed by CleanDock: ${appUrl}/app/scheduling`)
  const description = normalizeText(descLines.join('\n'))

  const startISO = new Date(booking.startTime).toISOString()
  const endISO = new Date(booking.endTime).toISOString()

  const event: GoogleEvent = {
    summary,
    description,
    start: { dateTime: startISO, timeZone: 'UTC' },
    end: { dateTime: endISO, timeZone: 'UTC' },
    status: eventStatusForBooking(booking.status),
    location,
    extendedProperties: {
      private: {
        jobdockBookingId: booking.id,
        jobdockTenantId: booking.tenantId,
      },
    },
  }
  return event
}

// ─── fingerprint (shared by push and pull) ─────────────────────────────────────────────────────

// The six fields the fingerprint is computed over, in a fixed order. dateTimes are normalized to
// canonical UTC ISO (`...Z`) so an event Google echoes back in a local offset still matches.
export interface FingerprintFields {
  startISO: string
  endISO: string
  summary: string
  location: string
  description: string
  status: string
}

function normalizeDateTime(dt?: string): string {
  if (!dt) return ''
  const d = new Date(dt)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

// Extract the fingerprint fields from ANY event body (our freshly-built payload OR one returned by
// Google). Both push and pull go through here, guaranteeing identical inputs to computeFingerprint.
export function fingerprintFieldsFromEvent(event: GoogleEvent): FingerprintFields {
  return {
    startISO: normalizeDateTime(event.start?.dateTime),
    endISO: normalizeDateTime(event.end?.dateTime),
    // Text fields go through the SAME normalizer as the payload builder so a CRLF vs LF (or
    // trailing-whitespace) difference between what we sent and what Google echoes can't desync.
    summary: normalizeText(event.summary),
    location: normalizeText(event.location),
    description: normalizeText(event.description),
    status: event.status || '',
  }
}

export function computeFingerprint(fields: FingerprintFields): string {
  const stable = JSON.stringify([
    fields.startISO,
    fields.endISO,
    fields.summary,
    fields.location,
    fields.description,
    fields.status,
  ])
  return createHash('sha256').update(stable).digest('hex')
}

// Convenience: fingerprint of a whole event body (the common case for both directions).
export function fingerprintOfEvent(event: GoogleEvent): string {
  return computeFingerprint(fingerprintFieldsFromEvent(event))
}

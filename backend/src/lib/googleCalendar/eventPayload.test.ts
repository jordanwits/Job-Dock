import {
  bookingMatchesSyncMode,
  buildEventPayload,
  computeFingerprint,
  effectiveAssignedUserIds,
  extractUserIds,
  fingerprintOfEvent,
  isBookingEligible,
  normalizeText,
  prunedMapDisposition,
  type EligibilityBooking,
  type PayloadBooking,
} from './eventPayload'

const NOW = new Date('2026-07-07T12:00:00.000Z')

function baseBooking(overrides: Partial<EligibilityBooking> = {}): EligibilityBooking {
  return {
    startTime: '2026-07-08T17:00:00.000Z',
    endTime: '2026-07-08T18:00:00.000Z',
    toBeScheduled: false,
    archivedAt: null,
    deletedAt: null,
    status: 'active',
    ...overrides,
  }
}

describe('extractUserIds', () => {
  test('handles new object format', () => {
    expect(extractUserIds([{ userId: 'u1', role: 'Lead' }, { userId: 'u2' }])).toEqual(['u1', 'u2'])
  })
  test('handles legacy string array', () => {
    expect(extractUserIds(['u1', 'u2'])).toEqual(['u1', 'u2'])
  })
  test('handles single string and empties', () => {
    expect(extractUserIds('u1')).toEqual(['u1'])
    expect(extractUserIds(null)).toEqual([])
    expect(extractUserIds([])).toEqual([])
  })

  // F14: parity with dataService.ts extractUserIds/normalizeAssignedTo.
  test('object branch drops items whose userId is missing/empty/non-string, keeps the rest raw', () => {
    expect(
      extractUserIds([
        { userId: 'u1', role: 'Lead' },
        { userId: '' }, // empty string is falsy → dropped
        { userId: 42 }, // non-string → dropped
        { role: 'no-user' }, // missing userId → dropped
        { userId: 'u2' },
      ])
    ).toEqual(['u1', 'u2'])
  })
  test('object branch does NOT trim userId (kept raw, matching dataService)', () => {
    expect(extractUserIds([{ userId: '  u1  ' }])).toEqual(['  u1  '])
  })
  test('string-array branch keeps truthy strings raw and drops falsy/non-strings', () => {
    expect(extractUserIds(['u1', '', 'u2', 0 as unknown as string, null as unknown as string])).toEqual([
      'u1',
      'u2',
    ])
  })
})

describe('F1: pulled independent booking assignedTo shape', () => {
  // The shape sync.ts writes when a Google-created event becomes an independent booking. It must
  // pass the connecting user's OWN syncMode:'mine' filter, or that user's push pass would prune and
  // delete the event we just pulled.
  const pulledAssignedTo = [{ userId: 'connectingUser', role: 'Assigned' }]

  test("extractUserIds reads the connecting user out of the pulled shape", () => {
    expect(extractUserIds(pulledAssignedTo)).toEqual(['connectingUser'])
  })
  test("survives its own creator's 'mine' filter", () => {
    expect(bookingMatchesSyncMode('mine', 'connectingUser', pulledAssignedTo, null)).toBe(true)
  })
  test("does NOT leak into a different user's 'mine' calendar", () => {
    expect(bookingMatchesSyncMode('mine', 'someoneElse', pulledAssignedTo, null)).toBe(false)
  })
})

describe('F4: prunedMapDisposition (freeze rule)', () => {
  const now = new Date('2026-07-07T12:00:00.000Z')
  const inWindow = '2026-07-01T00:00:00.000Z' // ~6 days ago, within the 60-day window
  const outOfWindow = '2026-01-01T00:00:00.000Z' // > 60 days ago

  test("booking gone (null/undefined) → 'remove'", () => {
    expect(prunedMapDisposition(null, now)).toBe('remove')
    expect(prunedMapDisposition(undefined, now)).toBe('remove')
  })
  test("out-of-window booking → 'freeze' (leave event + map as history)", () => {
    expect(prunedMapDisposition({ startTime: outOfWindow }, now)).toBe('freeze')
  })
  test("in-window (but ineligible, hence pruned) booking → 'remove'", () => {
    expect(prunedMapDisposition({ startTime: inWindow }, now)).toBe('remove')
  })
  test("booking with null/invalid start → 'remove' (e.g. converted to toBeScheduled)", () => {
    expect(prunedMapDisposition({ startTime: null }, now)).toBe('remove')
    expect(prunedMapDisposition({ startTime: 'not-a-date' }, now)).toBe('remove')
  })
})

describe('effectiveAssignedUserIds', () => {
  test('prefers booking assignment when present', () => {
    expect(effectiveAssignedUserIds([{ userId: 'b1' }], [{ userId: 'j1' }])).toEqual(['b1'])
  })
  test('falls back to job assignment when booking is empty', () => {
    expect(effectiveAssignedUserIds(null, [{ userId: 'j1' }])).toEqual(['j1'])
    expect(effectiveAssignedUserIds([], [{ userId: 'j1' }])).toEqual(['j1'])
  })
})

describe('bookingMatchesSyncMode', () => {
  test("'all' always matches", () => {
    expect(bookingMatchesSyncMode('all', 'u1', null, null)).toBe(true)
    expect(bookingMatchesSyncMode('all', 'u1', [{ userId: 'other' }], null)).toBe(true)
  })
  test("'mine' matches only when the user is effectively assigned", () => {
    expect(bookingMatchesSyncMode('mine', 'u1', [{ userId: 'u1' }], null)).toBe(true)
    expect(bookingMatchesSyncMode('mine', 'u1', null, [{ userId: 'u1' }])).toBe(true)
    expect(bookingMatchesSyncMode('mine', 'u1', [{ userId: 'u2' }], null)).toBe(false)
    expect(bookingMatchesSyncMode('mine', 'u1', null, null)).toBe(false)
  })
})

describe('isBookingEligible', () => {
  test('a normal timed active booking is eligible', () => {
    expect(isBookingEligible(baseBooking(), NOW)).toBe(true)
  })
  test('pending-confirmation is eligible', () => {
    expect(isBookingEligible(baseBooking({ status: 'pending-confirmation' }), NOW)).toBe(true)
  })
  test('staged-monthly anchor (toBeScheduled + null times) is NOT eligible', () => {
    const anchor = baseBooking({ toBeScheduled: true, startTime: null, endTime: null })
    expect(isBookingEligible(anchor, NOW)).toBe(false)
  })
  test('archived / deleted / cancelled are NOT eligible', () => {
    expect(isBookingEligible(baseBooking({ archivedAt: new Date().toISOString() }), NOW)).toBe(false)
    expect(isBookingEligible(baseBooking({ deletedAt: new Date().toISOString() }), NOW)).toBe(false)
    expect(isBookingEligible(baseBooking({ status: 'cancelled' }), NOW)).toBe(false)
  })
  test('a booking older than the 60-day window is NOT eligible', () => {
    const old = baseBooking({
      startTime: '2026-01-01T17:00:00.000Z',
      endTime: '2026-01-01T18:00:00.000Z',
    })
    expect(isBookingEligible(old, NOW)).toBe(false)
  })
})

describe('fingerprint', () => {
  const payloadBooking: PayloadBooking = {
    id: 'bk1',
    tenantId: 'tn1',
    jobId: null,
    title: 'Deep clean',
    location: '123 Main St',
    notes: 'Bring supplies',
    startTime: '2026-07-08T17:00:00.000Z',
    endTime: '2026-07-08T18:00:00.000Z',
    status: 'active',
  }
  const contact = { firstName: 'Jane', lastName: 'Doe', phone: '555-1000' }

  test('same inputs produce an identical payload and fingerprint (deterministic)', () => {
    const a = buildEventPayload(payloadBooking, null, contact, 'https://thejobdock.com')
    const b = buildEventPayload(payloadBooking, null, contact, 'https://thejobdock.com')
    expect(a).toEqual(b)
    expect(fingerprintOfEvent(a)).toBe(fingerprintOfEvent(b))
  })

  test('a Google echo in a different UTC offset yields the SAME fingerprint (echo suppression)', () => {
    const pushed = buildEventPayload(payloadBooking, null, contact, 'https://thejobdock.com')
    // Google echoes the same instant but rendered in a -07:00 offset.
    const echo = {
      ...pushed,
      start: { dateTime: '2026-07-08T10:00:00-07:00', timeZone: 'America/Los_Angeles' },
      end: { dateTime: '2026-07-08T11:00:00-07:00', timeZone: 'America/Los_Angeles' },
    }
    expect(fingerprintOfEvent(echo)).toBe(fingerprintOfEvent(pushed))
  })

  test('a real content change yields a DIFFERENT fingerprint', () => {
    const pushed = buildEventPayload(payloadBooking, null, contact, 'https://thejobdock.com')
    const changed = buildEventPayload(
      { ...payloadBooking, location: '999 Elsewhere Ave' },
      null,
      contact,
      'https://thejobdock.com'
    )
    expect(fingerprintOfEvent(changed)).not.toBe(fingerprintOfEvent(pushed))
  })

  test('pending-confirmation maps to tentative status in the fingerprint', () => {
    const confirmed = buildEventPayload(payloadBooking, null, contact, 'https://thejobdock.com')
    const tentative = buildEventPayload(
      { ...payloadBooking, status: 'pending-confirmation' },
      null,
      contact,
      'https://thejobdock.com'
    )
    expect(confirmed.status).toBe('confirmed')
    expect(tentative.status).toBe('tentative')
    expect(fingerprintOfEvent(tentative)).not.toBe(fingerprintOfEvent(confirmed))
  })

  test('computeFingerprint is order-stable for the fixed field set', () => {
    const fp = computeFingerprint({
      startISO: 's',
      endISO: 'e',
      summary: 'sum',
      location: 'loc',
      description: 'desc',
      status: 'confirmed',
    })
    expect(fp).toMatch(/^[a-f0-9]{64}$/)
  })

  // F8b: CRLF-authored notes (common on this Windows-authored data) must fingerprint identically to
  // their LF form, so a sent-vs-echoed line-ending difference can't cause a false mismatch.
  test('CRLF vs LF notes produce the SAME fingerprint', () => {
    // Identical content, differing only in line-ending style — must hash equal.
    const crlf = buildEventPayload(
      { ...payloadBooking, notes: 'line one\r\nline two' },
      null,
      contact,
      'https://thejobdock.com'
    )
    const lf = buildEventPayload(
      { ...payloadBooking, notes: 'line one\nline two' },
      null,
      contact,
      'https://thejobdock.com'
    )
    expect(fingerprintOfEvent(crlf)).toBe(fingerprintOfEvent(lf))
  })

  test('a bare CR and trailing whitespace in a Google echo still match our payload', () => {
    const pushed = buildEventPayload(
      { ...payloadBooking, notes: 'note body' },
      null,
      contact,
      'https://thejobdock.com'
    )
    // Google echoes the same description with CR line endings + trailing spaces.
    const echo = { ...pushed, description: (pushed.description || '').replace(/\n/g, '\r') + '   ' }
    expect(fingerprintOfEvent(echo)).toBe(fingerprintOfEvent(pushed))
  })
})

describe('F8b: normalizeText', () => {
  test('CRLF and CR collapse to LF', () => {
    expect(normalizeText('a\r\nb')).toBe('a\nb')
    expect(normalizeText('a\rb')).toBe('a\nb')
    expect(normalizeText('a\nb')).toBe('a\nb')
  })
  test('trailing whitespace (per line and overall) is stripped', () => {
    expect(normalizeText('a   \nb\t\n')).toBe('a\nb')
    expect(normalizeText('a\n\n')).toBe('a')
  })
  test('null / undefined / empty → empty string', () => {
    expect(normalizeText(null)).toBe('')
    expect(normalizeText(undefined)).toBe('')
    expect(normalizeText('')).toBe('')
  })
  test('all CRLF/CR variants of the same content hash equal via computeFingerprint', () => {
    const mk = (desc: string) =>
      computeFingerprint({
        startISO: 's',
        endISO: 'e',
        summary: 'sum',
        location: 'loc',
        description: normalizeText(desc),
        status: 'confirmed',
      })
    expect(mk('x\r\ny')).toBe(mk('x\ny'))
    expect(mk('x\ry')).toBe(mk('x\ny'))
  })
})

describe('buildEventPayload content', () => {
  test('job-backed booking uses job title and appends the contact name', () => {
    const booking: PayloadBooking = {
      id: 'bk2',
      tenantId: 'tn1',
      jobId: 'job1',
      title: null,
      location: null,
      notes: null,
      startTime: '2026-07-08T17:00:00.000Z',
      endTime: '2026-07-08T18:00:00.000Z',
      status: 'active',
    }
    const event = buildEventPayload(
      booking,
      { title: 'Weekly clean', location: 'Job site', notes: null },
      { firstName: 'Jane', lastName: 'Doe', phone: null },
      'https://thejobdock.com'
    )
    expect(event.summary).toBe('Weekly clean — Jane Doe')
    expect(event.location).toBe('Job site')
    expect(event.description).toContain('Managed by JobDock: https://thejobdock.com/app/scheduling')
    expect(event.extendedProperties?.private?.jobdockBookingId).toBe('bk2')
    expect(event.extendedProperties?.private?.jobdockTenantId).toBe('tn1')
  })
})

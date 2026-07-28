import {
  generateRecurrenceInstances,
  isOpenEndedRecurrence,
  recurrenceHorizonEnd,
  type RecurrencePayload,
} from './dataService'
import { occurrencesToAdd } from './recurrenceTopup'

/**
 * Open-ended ("repeats forever") series and the rolling top-up that keeps them going.
 *
 * The property that carries the most risk: a top-up must produce exactly the occurrences the
 * original creation WOULD have produced next — same monthly day-of-month anchor, same wall
 * clock across DST — while never re-emitting one that already exists.
 */

const at = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m - 1, d, h, min)

const stamp = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`

const gen = (recurrence: RecurrencePayload, extra: Record<string, unknown> = {}) =>
  generateRecurrenceInstances({
    startTime: at(2026, 1, 5),
    endTime: at(2026, 1, 5, 11),
    recurrence,
    ...extra,
  })

describe('isOpenEndedRecurrence', () => {
  it('is open-ended only with neither a count nor an end date', () => {
    expect(isOpenEndedRecurrence({})).toBe(true)
    expect(isOpenEndedRecurrence({ count: null, untilDate: null })).toBe(true)
    expect(isOpenEndedRecurrence({ count: 10 })).toBe(false)
    expect(isOpenEndedRecurrence({ untilDate: '2027-01-01' })).toBe(false)
    expect(isOpenEndedRecurrence({ count: 10, untilDate: '2027-01-01' })).toBe(false)
  })
})

describe('open-ended generation', () => {
  it('fills the 12-month horizon instead of stopping at the old 50-occurrence cap', () => {
    const horizonEnd = recurrenceHorizonEnd(at(2026, 1, 5))
    const out = gen({ frequency: 'daily', interval: 1 }, { horizonEnd })

    // A counted series would have been clipped to 50; this one runs to the horizon.
    expect(out.length).toBeGreaterThan(300)
    expect(out[out.length - 1]!.startTime.getTime()).toBeLessThanOrEqual(horizonEnd.getTime())
  })

  it('does not change a counted series', () => {
    const out = gen({ frequency: 'weekly', interval: 1, count: 4 })
    expect(out.map(o => stamp(o.startTime))).toEqual([
      '2026-01-05 9:00',
      '2026-01-12 9:00',
      '2026-01-19 9:00',
      '2026-01-26 9:00',
    ])
  })

  it('still respects an explicit end date', () => {
    const out = gen({ frequency: 'weekly', interval: 1, untilDate: at(2026, 2, 2).toISOString() })
    expect(out.length).toBe(5)
    expect(stamp(out[out.length - 1]!.startTime)).toBe('2026-02-02 9:00')
  })

  it('caps a single batch so one call can never run away', () => {
    // 10-year horizon on a daily series would be ~3650 occurrences; the batch cap holds it.
    const out = gen({ frequency: 'daily', interval: 1 }, { horizonEnd: at(2036, 1, 5) })
    expect(out.length).toBeLessThanOrEqual(400)
  })
})

describe('after cursor (the top-up path)', () => {
  it('emits only occurrences past the cursor, with no gap and no repeat', () => {
    const horizonEnd = recurrenceHorizonEnd(at(2026, 1, 5))
    const full = gen({ frequency: 'weekly', interval: 1 }, { horizonEnd })
    const cursor = full[9]!.startTime

    const rest = gen({ frequency: 'weekly', interval: 1 }, { horizonEnd, after: cursor })

    expect(rest[0]!.startTime).toEqual(full[10]!.startTime)
    expect(rest.map(stampOf)).toEqual(full.slice(10).map(stampOf))
    expect(rest.some(o => o.startTime <= cursor)).toBe(false)
  })

  it('keeps the monthly day-of-month anchor when resuming mid-series', () => {
    // Jan 31 series: the anchor must come from the ORIGINAL start, not from the cursor,
    // or February's clamp to the 28th permanently collapses the series.
    const start = at(2026, 1, 31)
    const args = {
      startTime: start,
      endTime: at(2026, 1, 31, 11),
      recurrence: { frequency: 'monthly', interval: 1 } as RecurrencePayload,
      horizonEnd: recurrenceHorizonEnd(start),
    }
    const full = generateRecurrenceInstances(args)
    // Resume just after February (the clamped month) and confirm March returns to the 31st.
    const cursor = full[1]!.startTime
    const rest = generateRecurrenceInstances({ ...args, after: cursor })

    expect(stamp(full[1]!.startTime)).toBe('2026-02-28 9:00')
    expect(stamp(rest[0]!.startTime)).toBe('2026-03-31 9:00')
    expect(rest.map(stampOf)).toEqual(full.slice(2).map(stampOf))
  })

  it('preserves wall-clock time across a DST boundary when resuming', () => {
    const start = new Date('2026-02-01T17:00:00Z') // 9am America/Los_Angeles (PST)
    const args = {
      startTime: start,
      endTime: new Date('2026-02-01T19:00:00Z'),
      recurrence: {
        frequency: 'weekly',
        interval: 1,
        timezone: 'America/Los_Angeles',
      } as RecurrencePayload,
      horizonEnd: recurrenceHorizonEnd(start),
    }
    const full = generateRecurrenceInstances(args)
    const rest = generateRecurrenceInstances({ ...args, after: full[3]!.startTime })

    const local = (d: Date) =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        minute: '2-digit',
      }).format(d)

    // Every occurrence stays 9:00 AM local, before and after the March DST shift.
    expect(new Set(full.map(o => local(o.startTime)))).toEqual(new Set(['9:00 AM']))
    expect(new Set(rest.map(o => local(o.startTime)))).toEqual(new Set(['9:00 AM']))
    expect(rest[0]!.startTime).toEqual(full[4]!.startTime)
  })

  it('works for the daysOfWeek branch too', () => {
    const start = at(2026, 1, 5) // Monday
    const args = {
      startTime: start,
      endTime: at(2026, 1, 5, 11),
      recurrence: { frequency: 'custom', interval: 1, daysOfWeek: [2, 4] } as RecurrencePayload,
      horizonEnd: recurrenceHorizonEnd(start),
    }
    const full = generateRecurrenceInstances(args)
    const rest = generateRecurrenceInstances({ ...args, after: full[5]!.startTime })

    expect(full.length).toBeGreaterThan(50) // horizon-bounded, not count-bounded
    expect(rest.map(stampOf)).toEqual(full.slice(6).map(stampOf))
  })
})

describe('occurrencesToAdd', () => {
  const series = {
    frequency: 'weekly',
    interval: 1,
    daysOfWeek: [] as number[],
    timezone: null,
    startTime: at(2026, 1, 5),
    endTime: at(2026, 1, 5, 11),
  }

  it('adds nothing when the series is already materialized past the horizon', () => {
    const now = at(2026, 6, 1)
    const beyond = recurrenceHorizonEnd(now)
    expect(occurrencesToAdd(series, beyond, now)).toEqual([])
  })

  it('extends a series whose last occurrence is inside the window', () => {
    const now = at(2026, 6, 1)
    const last = at(2026, 6, 29)
    const added = occurrencesToAdd(series, last, now)

    expect(added.length).toBeGreaterThan(0)
    expect(added[0]!.startTime.getTime()).toBeGreaterThan(last.getTime())
    // Continues the cadence exactly: next weekly slot after the cursor.
    expect(stamp(added[0]!.startTime)).toBe('2026-07-06 9:00')
    expect(added[added.length - 1]!.startTime.getTime()).toBeLessThanOrEqual(
      recurrenceHorizonEnd(now).getTime()
    )
  })

  it('is idempotent — re-running after applying the additions yields nothing new', () => {
    const now = at(2026, 6, 1)
    const first = occurrencesToAdd(series, at(2026, 6, 29), now)
    const newCursor = first[first.length - 1]!.startTime
    expect(occurrencesToAdd(series, newCursor, now)).toEqual([])
  })

  it('preserves the appointment duration on generated occurrences', () => {
    const added = occurrencesToAdd(series, at(2026, 6, 29), at(2026, 6, 1))
    for (const a of added) {
      expect(a.endTime.getTime() - a.startTime.getTime()).toBe(2 * 60 * 60 * 1000)
    }
  })
})

function stampOf(o: { startTime: Date }) {
  return stamp(o.startTime)
}

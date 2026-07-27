import { generateRecurrenceInstances } from './dataService'

/**
 * Coverage for recurrence expansion — the function that decides when recurring customers
 * actually get visited. It had no tests, and a missing `interval` check in the daysOfWeek
 * branch was silently turning "every 2 weeks" into "every week".
 *
 * Dates are constructed with explicit local components so the assertions read in the same
 * wall-clock terms the scheduler uses.
 */

const at = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m - 1, d, h, min)

/** "YYYY-MM-DD h:mm" in local time, for readable assertions. */
const stamp = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`

const run = (recurrence: any, start = at(2026, 7, 27), end = at(2026, 7, 27, 11)) =>
  generateRecurrenceInstances({ startTime: start, endTime: end, recurrence })

describe('generateRecurrenceInstances', () => {
  describe('daysOfWeek branch (custom / weekly with explicit days)', () => {
    it('honours interval: every 2 weeks on Tue+Thu skips the odd weeks', () => {
      // Mon 2026-07-27 start. Tue=2, Thu=4.
      const out = run({ frequency: 'custom', interval: 2, daysOfWeek: [2, 4], count: 6 })

      expect(out.map(i => stamp(i.startTime))).toEqual([
        '2026-07-28 9:00',
        '2026-07-30 9:00',
        '2026-08-11 9:00',
        '2026-08-13 9:00',
        '2026-08-25 9:00',
        '2026-08-27 9:00',
      ])
    })

    it('interval 1 still produces every week (no regression)', () => {
      const out = run({ frequency: 'weekly', interval: 1, daysOfWeek: [2], count: 4 })

      expect(out.map(i => stamp(i.startTime))).toEqual([
        '2026-07-28 9:00',
        '2026-08-04 9:00',
        '2026-08-11 9:00',
        '2026-08-18 9:00',
      ])
    })

    it('every 4 weeks on a single day spaces occurrences 28 days apart', () => {
      const out = run({ frequency: 'custom', interval: 4, daysOfWeek: [1], count: 3 })
      const days = out.map(i => i.startTime.getTime())

      expect(out).toHaveLength(3)
      expect(days[1] - days[0]).toBe(28 * 24 * 60 * 60 * 1000)
      expect(days[2] - days[1]).toBe(28 * 24 * 60 * 60 * 1000)
    })

    it('preserves the appointment duration on every occurrence', () => {
      const out = run(
        { frequency: 'custom', interval: 2, daysOfWeek: [2], count: 3 },
        at(2026, 7, 27, 9),
        at(2026, 7, 27, 11, 30)
      )

      for (const i of out) {
        expect(i.endTime.getTime() - i.startTime.getTime()).toBe(150 * 60 * 1000)
      }
    })
  })

  describe('standard branch (no daysOfWeek)', () => {
    it('weekly with interval 2 lands a fortnight apart', () => {
      const out = run({ frequency: 'weekly', interval: 2, count: 3 })

      expect(out.map(i => stamp(i.startTime))).toEqual([
        '2026-07-27 9:00',
        '2026-08-10 9:00',
        '2026-08-24 9:00',
      ])
    })

    it('daily respects interval', () => {
      const out = run({ frequency: 'daily', interval: 3, count: 3 })

      expect(out.map(i => stamp(i.startTime))).toEqual([
        '2026-07-27 9:00',
        '2026-07-30 9:00',
        '2026-08-02 9:00',
      ])
    })

    it('monthly anchors to the original day-of-month instead of compounding the clamp', () => {
      // Jan 31 must not collapse to the 28th for the rest of the year.
      const out = run(
        { frequency: 'monthly', interval: 1, count: 4 },
        at(2026, 1, 31),
        at(2026, 1, 31, 11)
      )
      const days = out.map(i => i.startTime.getDate())

      expect(days[0]).toBe(31)
      expect(days[3]).toBe(30) // April has 30
      expect(days[3]).not.toBe(28) // the bug this anchoring prevents
    })
  })

  describe('bounds', () => {
    it('stops at untilDate', () => {
      const out = run({
        frequency: 'weekly',
        interval: 1,
        untilDate: at(2026, 8, 17, 23, 59).toISOString(),
      })

      expect(out.length).toBeGreaterThan(0)
      for (const i of out) {
        expect(i.startTime.getTime()).toBeLessThanOrEqual(at(2026, 8, 17, 23, 59).getTime())
      }
    })

    it('never exceeds the 50-occurrence safety cap', () => {
      const out = run({ frequency: 'daily', interval: 1, count: 500 })
      expect(out.length).toBeLessThanOrEqual(50)
    })

    it('always includes the original start as the first occurrence', () => {
      const out = run({ frequency: 'weekly', interval: 2, count: 2 })
      expect(stamp(out[0].startTime)).toBe('2026-07-27 9:00')
    })
  })
})

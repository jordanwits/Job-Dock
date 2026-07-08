import { computeNextDueMonthISO } from './recurrenceDueDate'

describe('computeNextDueMonthISO', () => {
  test('returns first day of the recurrence createdAt month when no scheduled sibling exists', () => {
    // createdAt mid-July -> due July
    const created = new Date('2026-07-07T15:30:00.000Z')
    expect(computeNextDueMonthISO(created, false)).toBe('2026-07-01T00:00:00.000Z')
  })

  test('returns first day of the month AFTER the latest scheduled occurrence', () => {
    // latest scheduled Aug 20 -> next due Sep 1
    const latestScheduled = new Date('2026-08-20T17:00:00.000Z')
    expect(computeNextDueMonthISO(latestScheduled, true)).toBe('2026-09-01T00:00:00.000Z')
  })

  test('rolls a December occurrence into January of the next year', () => {
    const latestScheduled = new Date('2026-12-15T12:00:00.000Z')
    expect(computeNextDueMonthISO(latestScheduled, true)).toBe('2027-01-01T00:00:00.000Z')
  })

  test('is stable regardless of the day-of-month of the source date', () => {
    const early = new Date('2026-03-01T00:00:00.000Z')
    const late = new Date('2026-03-31T23:59:59.000Z')
    expect(computeNextDueMonthISO(early, false)).toBe(computeNextDueMonthISO(late, false))
  })
})

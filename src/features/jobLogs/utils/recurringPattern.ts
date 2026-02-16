import { format, differenceInDays } from 'date-fns'
import type { JobLogBooking } from '../types/jobLog'

export interface RecurringGroup {
  bookings: JobLogBooking[]
  pattern: {
    type: 'weekly' | 'biweekly' | 'monthly' | 'custom'
    interval: number // days
    dayOfWeek?: number
    time: string // formatted time like "9:00 AM"
    duration: number // minutes
  }
  firstDate: Date
  lastDate: Date
}

export function detectRecurringPattern(bookings: JobLogBooking[]): RecurringGroup | null {
  if (bookings.length < 3) return null // Need at least 3 to detect a pattern
  
  const validBookings = bookings.filter(b => b.startTime && b.endTime && !b.toBeScheduled)
  if (validBookings.length < 3) return null

  const dates = validBookings.map(b => ({
    start: new Date(b.startTime!),
    end: new Date(b.endTime!),
    booking: b,
  })).sort((a, b) => a.start.getTime() - b.start.getTime())

  const firstStart = dates[0].start
  const firstEnd = dates[0].end
  const timeStr = format(firstStart, 'h:mm a')
  const duration = Math.round((firstEnd.getTime() - firstStart.getTime()) / (1000 * 60))

  // Check intervals between consecutive bookings
  const intervals: number[] = []
  for (let i = 1; i < dates.length; i++) {
    const daysDiff = differenceInDays(dates[i].start, dates[i - 1].start)
    intervals.push(daysDiff)
  }

  // Check if intervals are consistent (allow for slight variations)
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
  const isConsistent = intervals.every(interval => Math.abs(interval - avgInterval) < 2) // Allow 1-2 day variance

  if (!isConsistent) return null

  // Determine pattern type
  let patternType: 'weekly' | 'biweekly' | 'monthly' | 'custom' = 'custom'
  if (Math.abs(avgInterval - 7) < 1) {
    patternType = 'weekly'
  } else if (Math.abs(avgInterval - 14) < 1) {
    patternType = 'biweekly'
  } else if (Math.abs(avgInterval - 30) < 2 || Math.abs(avgInterval - 28) < 2) {
    patternType = 'monthly'
  }

  const dayOfWeek = firstStart.getDay()

  return {
    bookings: validBookings,
    pattern: {
      type: patternType,
      interval: Math.round(avgInterval),
      dayOfWeek,
      time: timeStr,
      duration,
    },
    firstDate: firstStart,
    lastDate: dates[dates.length - 1].start,
  }
}

export function getRecurringTag(bookings: JobLogBooking[]): string | null {
  const recurringGroup = detectRecurringPattern(bookings)
  
  if (recurringGroup) {
    return recurringGroup.pattern.type === 'weekly'
      ? 'Weekly'
      : recurringGroup.pattern.type === 'biweekly'
      ? 'Bi-weekly'
      : recurringGroup.pattern.type === 'monthly'
      ? 'Monthly'
      : null
  }
  
  // Fallback: if we have 3+ bookings with consistent weekly intervals, show Weekly
  const validBookings = bookings.filter(b => b.startTime && b.endTime && !b.toBeScheduled)
  if (validBookings.length >= 3) {
    const intervals: number[] = []
    const sortedDates = validBookings
      .map(b => new Date(b.startTime!))
      .sort((a, b) => a.getTime() - b.getTime())
    
    for (let i = 1; i < sortedDates.length; i++) {
      intervals.push(differenceInDays(sortedDates[i], sortedDates[i - 1]))
    }
    
    if (intervals.length >= 2) {
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
      const isWeekly = intervals.every(interval => Math.abs(interval - 7) < 2) && Math.abs(avgInterval - 7) < 1
      if (isWeekly) {
        return 'Weekly'
      }
    }
  }
  
  return null
}

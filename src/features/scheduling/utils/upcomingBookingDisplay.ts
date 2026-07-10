import { addDays, isAfter, isBefore, isSameDay, startOfDay, set } from 'date-fns'
import type { Job } from '../types/job'

// Last calendar day an appointment actually occupies. An end of exactly midnight (00:00) is a
// boundary, not occupancy (a 10pm–midnight appointment belongs to one day), so back up 1ms.
// Must match the calendar's `lastOccupiedDay` rule or the upcoming list dates a booking on a day
// the calendar never shows it.
const lastOccupiedDay = (endTime: string): Date => startOfDay(new Date(new Date(endTime).getTime() - 1))

/** Same rule as the calendar: different calendar days for start/end (local). */
export function isMultiDayScheduledJob(job: Job): boolean {
  if (!job.startTime || !job.endTime) return false
  const start = startOfDay(new Date(job.startTime))
  const end = lastOccupiedDay(job.endTime)
  return start.getTime() !== end.getTime()
}

/**
 * Single instant to use for upcoming-list filtering, sorting, and display.
 * Multi-day jobs appear once: the job's start clock time on the next in-range
 * calendar day after local today (or the job's first day if the job hasn't started yet).
 */
export function getUpcomingBookingListInstant(job: Job, now: Date): Date | null {
  if (job.toBeScheduled || !job.startTime || job.status === 'cancelled') return null
  if (job.archivedAt) return null

  const start = new Date(job.startTime)
  const nowDay = startOfDay(now)
  const startDay = startOfDay(start)

  if (!job.endTime) {
    if (isBefore(nowDay, startDay)) return start
    if (isSameDay(now, start)) return start
    return null
  }

  if (isMultiDayScheduledJob(job)) {
    const jobStartDay = startOfDay(start)
    const jobEndDay = lastOccupiedDay(job.endTime)
    const startToday = startOfDay(now)
    const dayAfterToday = addDays(startToday, 1)
    if (dayAfterToday > jobEndDay) return null
    const day = dayAfterToday < jobStartDay ? jobStartDay : dayAfterToday
    if (day > jobEndDay) return null
    return set(day, {
      hours: start.getHours(),
      minutes: start.getMinutes(),
      seconds: start.getSeconds(),
      milliseconds: start.getMilliseconds(),
    })
  }

  const endDay = lastOccupiedDay(job.endTime)
  if (isAfter(nowDay, endDay)) return null
  return start
}

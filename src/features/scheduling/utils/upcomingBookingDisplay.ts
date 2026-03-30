import { addDays, startOfDay, set } from 'date-fns'
import type { Job } from '../types/job'

/** Same rule as the calendar: different calendar days for start/end (local). */
export function isMultiDayScheduledJob(job: Job): boolean {
  if (!job.startTime || !job.endTime) return false
  const start = startOfDay(new Date(job.startTime))
  const end = startOfDay(new Date(job.endTime))
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

  if (!job.endTime) {
    if (start.getTime() < now.getTime()) return null
    return start
  }

  if (isMultiDayScheduledJob(job)) {
    const jobStartDay = startOfDay(start)
    const jobEndDay = startOfDay(new Date(job.endTime))
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

  if (start.getTime() < now.getTime()) return null
  return start
}

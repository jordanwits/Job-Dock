import { bookingsService, jobLogsService, jobsService } from '@/lib/api/services'
import type { Job } from '@/features/scheduling/types/job'
import type { JobLog } from '../types/jobLog'

export async function fetchWorkspaceJobSchedulingMeta(jobLog: JobLog): Promise<Job> {
  const raw: Record<string, unknown> = await jobsService.getById(jobLog.id)
  const bookings = (Array.isArray(raw.bookings) ? raw.bookings : []) as Record<string, unknown>[]
  const first = bookings[0]
  const recurrenceId =
    (first?.recurrenceId as string | undefined) ?? (raw.recurrenceId as string | undefined)
  const recurrenceBookings = recurrenceId
    ? bookings.filter((b) => b.recurrenceId === recurrenceId)
    : first
      ? [first]
      : []
  const occurrenceCount = recurrenceId ? recurrenceBookings.length : first ? 1 : 0

  const contact = raw.contact as
    | { firstName?: string; lastName?: string; email?: string }
    | undefined
  const bookingId = (first?.id as string | undefined) ?? undefined

  const toIso = (v: unknown): string | null => {
    if (v == null) return null
    if (typeof v === 'string') return v
    if (v instanceof Date) return v.toISOString()
    return null
  }

  return {
    id: raw.id as string,
    title: (raw.title as string) ?? jobLog.title,
    description: raw.description as string | undefined,
    contactId: raw.contactId as string | undefined,
    contactName: contact
      ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
      : '',
    startTime: toIso(first?.startTime ?? raw.startTime),
    endTime: toIso(first?.endTime ?? raw.endTime),
    toBeScheduled: first ? Boolean(first.toBeScheduled) : true,
    status: (first?.status ?? raw.status) as Job['status'],
    recurrenceId,
    occurrenceCount: Math.max(occurrenceCount, 1),
    bookingId,
    archivedAt: toIso(first?.archivedAt ?? raw.archivedAt),
    createdById: (raw.createdById as string | null) ?? null,
    createdAt:
      typeof raw.createdAt === 'string' ? raw.createdAt : new Date(raw.createdAt as Date).toISOString(),
    updatedAt:
      typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(raw.updatedAt as Date).toISOString(),
    isIndependent: false,
  }
}

/**
 * Archive a single job-log entry from the Jobs page.
 *
 * For a single occurrence of a recurring series, archives just that booking so the
 * other occurrences (and the parent job) stay active. Otherwise archives the whole
 * job, which cascades to all of its bookings on the backend.
 */
export async function archiveWorkspaceJobSingle(meta: Job): Promise<void> {
  const isRecurringOccurrence =
    !!meta.recurrenceId && (meta.occurrenceCount ?? 0) > 1 && !!meta.bookingId
  if (isRecurringOccurrence) {
    await bookingsService.delete(meta.bookingId!)
    return
  }
  await jobsService.delete(meta.id)
}

/** Archive all occurrences for a recurring series (cascades to the parent jobs). */
export async function archiveWorkspaceJobRecurringAll(meta: Job): Promise<void> {
  await jobsService.delete(meta.id, true)
}

/** Permanent delete: match SchedulingPage (booking only when booking exists). */
export async function permanentDeleteWorkspaceBookingOrJob(meta: Job): Promise<void> {
  if (meta.bookingId) {
    await bookingsService.permanentDelete(meta.bookingId)
    return
  }
  await jobLogsService.delete(meta.id)
}

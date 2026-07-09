export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'custom'

export interface RecurrencePayload {
  frequency: RecurrenceFrequency
  interval: number
  count?: number
  untilDate?: string
  daysOfWeek?: number[] // 0 = Sunday, 1 = Monday, etc. (for custom weekly patterns)
  timezone?: string // IANA e.g. 'America/New_York' - preserves local time across DST
}

export interface JobBreak {
  id?: string
  startTime: string
  endTime: string
  reason?: string
}

export interface JobAssignment {
  userId: string
  role: string
  price?: number | null
  payType?: 'job' | 'hourly'
  hourlyRate?: number | null
}

export interface Job {
  id: string
  title: string
  description?: string
  contactId?: string // Optional for independent appointments
  contactName?: string
  isIndependent?: boolean // True when this is a standalone booking (no job)
  contactEmail?: string
  contactPhone?: string
  serviceId?: string
  serviceName?: string
  quoteId?: string
  invoiceId?: string
  recurrenceId?: string
  startTime: string | null
  endTime: string | null
  toBeScheduled?: boolean
  status:
    | 'active'
    | 'scheduled'
    | 'in-progress'
    | 'completed'
    | 'cancelled'
    | 'pending-confirmation'
  location?: string
  price?: number
  notes?: string
  assignedTo?: JobAssignment[] | string // Support both old (string) and new (JobAssignment[]) formats
  assignedToName?: string
  breaks?: JobBreak[]
  deletedAt?: string | null
  archivedAt?: string | null
  createdById?: string | null
  createdByName?: string | null
  createdAt: string
  updatedAt: string
  occurrenceCount?: number
  bookingId?: string // ID of the specific booking (when job has multiple bookings)
  // --- Staged monthly ("virtual per-month") series fields (non-DB / synthetic) ---
  // Set on the anchor descriptor row emitted by jobs.getAll: this row represents a series,
  // not a real appointment to display. The frontend expands it into per-month virtual chips.
  isStagedSeries?: boolean
  seriesStartMonth?: string // 'YYYY-MM' — first month the series produces a chip
  anchorBookingId?: string // the persistent anchor placeholder booking id for the series
  // Set on a virtual per-month chip (whose `id` is synthetic, e.g. 'staged:<rec>:<YYYY-MM>'):
  stagedTargetMonth?: string // 'YYYY-MM' — the month this chip schedules into
  jobId?: string // the real Job id to target on update (chip `id` is synthetic)
}

export interface CreateJobData {
  title: string
  description?: string
  contactId: string
  serviceId?: string
  quoteId?: string
  invoiceId?: string
  startTime?: string
  endTime?: string
  toBeScheduled?: boolean
  notifyClient?: boolean // When true, send confirmation email/SMS to client for manual bookings
  status?:
    | 'active'
    | 'scheduled'
    | 'in-progress'
    | 'completed'
    | 'cancelled'
    | 'pending-confirmation'
  location?: string
  price?: number
  notes?: string
  assignedTo?: JobAssignment[]
  breaks?: JobBreak[]
  recurrence?: RecurrencePayload
}

export interface UpdateJobData extends Partial<CreateJobData> {
  id: string
  updateAll?: boolean // Update all future jobs in a recurring series
  bookingId?: string // When updating a specific booking (e.g. drag to-be-scheduled onto calendar)
  notifyClient?: boolean // When true and date/time changed, send reschedule notification to client
  payChangeEffectiveDate?: string // When editing pay and job has time entries, effective date (YYYY-MM-DD)
  removeRecurrence?: boolean // When true, stop a staged-monthly series (archive anchor + recurrence)
  scheduleStagedOccurrence?: boolean // When true, schedule ONE occurrence of a staged series (no rolling)
  recurrenceId?: string // The staged series' recurrence id (used with scheduleStagedOccurrence)
}

/** Data for creating an independent appointment (calendar-only booking, no job in Job Logs) */
export interface CreateIndependentBookingData {
  title: string
  contactId?: string
  serviceId?: string
  startTime?: string
  endTime?: string
  toBeScheduled?: boolean
  notifyClient?: boolean // When true and date/time changed, send reschedule notification to client
  status?:
    | 'active'
    | 'scheduled'
    | 'in-progress'
    | 'completed'
    | 'cancelled'
    | 'pending-confirmation'
  location?: string
  price?: number
  notes?: string
  assignedTo?: JobAssignment[]
  breaks?: JobBreak[]
}

export type JobStatus =
  | 'active'
  | 'scheduled'
  | 'in-progress'
  | 'completed'
  | 'cancelled'
  | 'pending-confirmation'

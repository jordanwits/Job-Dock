export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'custom'

export interface RecurrencePayload {
  frequency: RecurrenceFrequency
  interval: number
  count?: number
  untilDate?: string
  daysOfWeek?: number[] // 0 = Sunday, 1 = Monday, etc. (for custom weekly patterns)
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
  contactId: string
  contactName: string
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
}

export type JobStatus =
  | 'scheduled'
  | 'in-progress'
  | 'completed'
  | 'cancelled'
  | 'pending-confirmation'

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
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'pending-confirmation'
  location?: string
  price?: number
  notes?: string
  assignedTo?: string
  assignedToName?: string
  breaks?: JobBreak[]
  deletedAt?: string | null
  archivedAt?: string | null
  createdById?: string | null
  createdByName?: string | null
  createdAt: string
  updatedAt: string
  occurrenceCount?: number
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
  status?: 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'pending-confirmation'
  location?: string
  price?: number
  notes?: string
  assignedTo?: string
  breaks?: JobBreak[]
  recurrence?: RecurrencePayload
}

export interface UpdateJobData extends Partial<CreateJobData> {
  id: string
  updateAll?: boolean // Update all future jobs in a recurring series
}

export type JobStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'pending-confirmation'


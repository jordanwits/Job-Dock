export type RecurrenceFrequency = 'weekly' | 'monthly'

export interface RecurrencePayload {
  frequency: RecurrenceFrequency
  interval: number
  count?: number
  untilDate?: string
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
  startTime: string
  endTime: string
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'pending-confirmation'
  location?: string
  notes?: string
  assignedTo?: string
  breaks?: JobBreak[]
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
  startTime: string
  endTime: string
  status?: 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'pending-confirmation'
  location?: string
  notes?: string
  assignedTo?: string
  breaks?: JobBreak[]
  recurrence?: RecurrencePayload
}

export interface UpdateJobData extends Partial<CreateJobData> {
  id: string
}

export type JobStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'pending-confirmation'


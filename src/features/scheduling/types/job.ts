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
  startTime: string
  endTime: string
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'pending-confirmation'
  location?: string
  notes?: string
  assignedTo?: string
  createdAt: string
  updatedAt: string
}

export interface CreateJobData {
  title: string
  description?: string
  contactId: string
  serviceId?: string
  startTime: string
  endTime: string
  status?: 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'pending-confirmation'
  location?: string
  notes?: string
  assignedTo?: string
}

export interface UpdateJobData extends Partial<CreateJobData> {
  id: string
}

export type JobStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'pending-confirmation'


export interface JobAssignment {
  userId: string
  roleId?: string
  role: string
  price?: number | null
  payType?: 'job' | 'hourly'
  hourlyRate?: number | null
}

export interface TimeEntry {
  id: string
  jobLogId?: string
  userId?: string
  userName?: string
  startTime: string
  endTime: string
  breakMinutes?: number
  notes?: string
  createdAt?: string
  updatedAt?: string
}

export interface MarkupPoint {
  x: number
  y: number
}

export type MarkupTool = 'pen' | 'highlighter'

export interface MarkupStroke {
  tool: MarkupTool
  color: string
  opacity: number
  width: number
  points: MarkupPoint[]
}

export interface JobLogPhoto {
  id: string
  fileName: string
  fileKey: string
  url: string
  notes?: string | null
  markup?: { strokes?: MarkupStroke[] } | null
  createdAt: string
}

export interface JobLogNoteEntry {
  text: string
  date?: string
}

export interface JobLogBooking {
  id: string
  startTime?: string | null
  endTime?: string | null
  status: string
  toBeScheduled?: boolean
  service?: { name: string } | null
  price?: number | null
}

export interface JobLog {
  id: string
  tenantId: string
  title: string
  description?: string
  location?: string
  notes?: string
  jobId?: string
  contactId?: string
  // Flattened primary booking fields (so Jobs page can show what calendar sets)
  startTime?: string | null
  endTime?: string | null
  toBeScheduled?: boolean
  bookingStatus?: string | null
  serviceId?: string | null
  serviceName?: string | null
  price?: number | null
  assignedTo?: JobAssignment[] | string | string[] // Support old format for backward compatibility
  assignedToName?: string
  status: 'active' | 'completed' | 'inactive'
  createdAt: string
  updatedAt: string
  job?: {
    id: string
    title: string
    startTime?: string
    endTime?: string
    status: string
    createdByName?: string
    toBeScheduled?: boolean
    serviceName?: string | null
    price?: number | null
  } | null
  contact?: {
    id: string
    name: string
    email?: string
  } | null
  timeEntries?: TimeEntry[]
  photos?: JobLogPhoto[]
  bookings?: JobLogBooking[]
}

export interface CreateJobLogData {
  title: string
  description?: string
  location?: string
  notes?: string
  jobId?: string
  contactId?: string
  price?: number | null
  serviceId?: string
  assignedTo?: JobAssignment[]
  status?: 'active' | 'completed' | 'inactive'
}

export interface UpdateJobLogData extends Partial<CreateJobLogData> {
  id: string
}

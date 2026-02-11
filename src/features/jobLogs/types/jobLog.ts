export interface TimeEntry {
  id: string
  jobLogId?: string
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

export interface JobLog {
  id: string
  tenantId: string
  title: string
  description?: string
  location?: string
  notes?: string
  jobId?: string
  contactId?: string
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
  } | null
  contact?: {
    id: string
    name: string
    email?: string
  } | null
  timeEntries?: TimeEntry[]
  photos?: JobLogPhoto[]
}

export interface CreateJobLogData {
  title: string
  description?: string
  location?: string
  notes?: string
  jobId?: string
  contactId?: string
  status?: 'active' | 'completed' | 'inactive'
}

export interface UpdateJobLogData extends Partial<CreateJobLogData> {
  id: string
}

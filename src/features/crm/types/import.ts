import { Contact } from './contact'

export interface ImportConflict {
  id: string
  sessionId: string
  rowIndex: number
  existingContact: Contact
  incomingData: Partial<Contact>
  status: 'pending' | 'resolved'
  resolution?: 'update' | 'skip'
  createdAt: string
}

export interface ImportError {
  rowIndex: number
  /** 1-based line in the source file. Older responses may not include it. */
  line?: number
  field?: string
  message: string
  data: any
}

export interface CSVPreview {
  headers: string[]
  rows: any[]
  totalRows: number
  suggestedMapping: Record<string, string>
  /** Non-fatal problems with the file, e.g. rows whose column count doesn't match the header. */
  warnings?: string[]
}

export interface ImportProgress {
  total: number
  processed: number
  inserted: number
  updated: number
  skipped: number
  failed: number
}

export interface ImportSessionData {
  sessionId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: ImportProgress
  pendingConflicts: ImportConflict[]
  errors: ImportError[]
}

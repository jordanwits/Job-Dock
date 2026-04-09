import type { SavedLineItem } from './savedLineItem'

export interface SavedLineItemImportConflict {
  id: string
  sessionId: string
  rowIndex: number
  type: 'existing_saved_item' | 'csv_duplicate'
  existingRowIndex?: number
  existingItem: SavedLineItem
  incomingData: Partial<{
    name: string
    description: string
    defaultQuantity: number
    unitPrice: number
    isActive: boolean
  }>
  status: 'pending' | 'resolved'
  resolution?: 'update' | 'skip' | 'keep_existing' | 'keep_incoming' | 'keep_both'
  createdAt: string
}

export interface SavedLineItemImportError {
  rowIndex: number
  field?: string
  message: string
  data: unknown
}

export interface SavedLineItemCSVPreview {
  headers: string[]
  rows: Record<string, string>[]
  totalRows: number
  suggestedMapping: Record<string, string>
}

export interface SavedLineItemImportSessionData {
  sessionId: string
  status: string
  progress: {
    total: number
    processed: number
    inserted: number
    updated: number
    skipped: number
    failed: number
  }
  pendingConflicts: SavedLineItemImportConflict[]
  errors: SavedLineItemImportError[]
}

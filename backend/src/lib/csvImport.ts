/**
 * CSV Import Service
 * Handles CSV parsing, validation, and conflict resolution for contact imports
 */

import Papa from 'papaparse'
import prisma from './db'
import { Contact } from '@prisma/client'

export interface ImportSession {
  id: string
  tenantId: string
  fileName: string
  totalRows: number
  processedRows: number
  insertedCount: number
  updatedCount: number
  skippedCount: number
  failedCount: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  csvData: string // Base64 encoded CSV content
  fieldMapping: Record<string, string>
  conflicts: ImportConflict[]
  errors: ImportError[]
  createdAt: Date
}

export interface ImportConflict {
  id: string
  sessionId: string
  rowIndex: number
  existingContact: Contact
  incomingData: Partial<Contact>
  status: 'pending' | 'resolved'
  resolution?: 'update' | 'skip'
  createdAt: Date
}

export interface ImportError {
  rowIndex: number
  field?: string
  message: string
  data: any
}

export interface CSVPreview {
  headers: string[]
  rows: any[]
  totalRows: number
  suggestedMapping: Record<string, string>
}

export interface ImportSessionData {
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
  pendingConflicts: ImportConflict[]
  errors: ImportError[]
}

// In-memory storage for import sessions (in production, use Redis or DynamoDB)
const importSessions = new Map<string, ImportSession>()

/**
 * Parse CSV and generate preview
 */
export function parseCSVPreview(csvContent: string): CSVPreview {
  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  })

  if (parsed.errors.length > 0) {
    throw new Error(`CSV parsing error: ${parsed.errors[0].message}`)
  }

  const headers = parsed.meta.fields || []
  const rows = parsed.data.slice(0, 5) // Preview first 5 rows
  const totalRows = parsed.data.length

  // Suggest field mappings based on common column names
  const suggestedMapping = generateFieldMapping(headers)

  return {
    headers,
    rows,
    totalRows,
    suggestedMapping,
  }
}

/**
 * Generate suggested field mapping from CSV headers
 */
function generateFieldMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}

  const fieldMappings: Record<string, string[]> = {
    firstName: ['first name', 'firstname', 'first', 'given name', 'fname'],
    lastName: ['last name', 'lastname', 'last', 'surname', 'family name', 'lname'],
    email: ['email', 'email address', 'e-mail', 'mail'],
    phone: ['phone', 'phone number', 'telephone', 'mobile', 'cell'],
    company: ['company', 'company name', 'organization', 'business'],
    jobTitle: ['job title', 'title', 'position', 'role'],
    address: ['address', 'street', 'street address', 'address line 1'],
    city: ['city', 'town'],
    state: ['state', 'province', 'region'],
    zipCode: ['zip', 'zip code', 'zipcode', 'postal code', 'postcode'],
    country: ['country'],
    notes: ['notes', 'note', 'comments', 'description'],
  }

  headers.forEach((header) => {
    const normalized = header.toLowerCase().trim()

    for (const [field, aliases] of Object.entries(fieldMappings)) {
      if (aliases.includes(normalized) || normalized === field) {
        mapping[header] = field
        break
      }
    }
  })

  return mapping
}

/**
 * Create a new import session
 */
export function createImportSession(
  tenantId: string,
  fileName: string,
  csvContent: string,
  fieldMapping: Record<string, string>
): ImportSession {
  const preview = parseCSVPreview(csvContent)

  const session: ImportSession = {
    id: `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    tenantId,
    fileName,
    totalRows: preview.totalRows,
    processedRows: 0,
    insertedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    status: 'pending',
    csvData: Buffer.from(csvContent).toString('base64'),
    fieldMapping,
    conflicts: [],
    errors: [],
    createdAt: new Date(),
  }

  importSessions.set(session.id, session)
  return session
}

/**
 * Get import session by ID
 */
export function getImportSession(sessionId: string): ImportSession | null {
  return importSessions.get(sessionId) || null
}

/**
 * Process CSV import session
 */
export async function processImportSession(
  sessionId: string
): Promise<ImportSessionData> {
  const session = importSessions.get(sessionId)
  if (!session) {
    throw new Error('Import session not found')
  }

  if (session.status === 'processing') {
    throw new Error('Import session is already being processed')
  }

  session.status = 'processing'

  const csvContent = Buffer.from(session.csvData, 'base64').toString('utf-8')
  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  })

  const rows = parsed.data as any[]

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    try {
      // Map CSV fields to contact fields
      const contactData = mapRowToContact(row, session.fieldMapping)

      // Validate required fields
      if (!contactData.firstName || !contactData.lastName) {
        session.errors.push({
          rowIndex: i,
          message: 'Missing required fields: firstName and lastName are required',
          data: row,
        })
        session.failedCount++
        session.processedRows++
        continue
      }

      // Check for duplicate by email
      if (contactData.email) {
        const existing = await prisma.contact.findFirst({
          where: {
            tenantId: session.tenantId,
            email: contactData.email,
          },
        })

        if (existing) {
          // Create conflict for user decision
          const conflict: ImportConflict = {
            id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            sessionId: session.id,
            rowIndex: i,
            existingContact: existing,
            incomingData: contactData,
            status: 'pending',
            createdAt: new Date(),
          }
          session.conflicts.push(conflict)
          session.processedRows++
          continue // Skip for now, will be resolved by user
        }
      }

      // Insert new contact
      await prisma.contact.create({
        data: {
          tenantId: session.tenantId,
          firstName: contactData.firstName!,
          lastName: contactData.lastName!,
          email: contactData.email || null,
          phone: contactData.phone || null,
          company: contactData.company || null,
          jobTitle: contactData.jobTitle || null,
          address: contactData.address || null,
          city: contactData.city || null,
          state: contactData.state || null,
          zipCode: contactData.zipCode || null,
          country: contactData.country || 'USA',
          tags: (contactData.tags as string[]) || [],
          notes: contactData.notes || null,
          status: (contactData.status as string) || 'active',
        },
      })

      session.insertedCount++
      session.processedRows++
    } catch (error: any) {
      session.errors.push({
        rowIndex: i,
        message: error.message || 'Unknown error',
        data: row,
      })
      session.failedCount++
      session.processedRows++
    }
  }

  // Update session status
  if (session.conflicts.length === 0) {
    session.status = 'completed'
  } else {
    session.status = 'pending' // Waiting for conflict resolution
  }

  return getImportSessionData(sessionId)
}

/**
 * Map CSV row to contact data
 */
function mapRowToContact(
  row: any,
  fieldMapping: Record<string, string>
): Partial<Contact> {
  const contact: any = {}

  for (const [csvField, contactField] of Object.entries(fieldMapping)) {
    const value = row[csvField]
    if (value !== undefined && value !== null && value !== '') {
      contact[contactField] = String(value).trim()
    }
  }

  // Handle tags if present (comma-separated)
  if (contact.tags && typeof contact.tags === 'string') {
    contact.tags = contact.tags.split(',').map((t: string) => t.trim())
  }

  return contact
}

/**
 * Resolve a conflict (update or skip)
 */
export async function resolveConflict(
  sessionId: string,
  conflictId: string,
  resolution: 'update' | 'skip'
): Promise<void> {
  const session = importSessions.get(sessionId)
  if (!session) {
    throw new Error('Import session not found')
  }

  const conflict = session.conflicts.find((c) => c.id === conflictId)
  if (!conflict) {
    throw new Error('Conflict not found')
  }

  if (conflict.status === 'resolved') {
    throw new Error('Conflict already resolved')
  }

  conflict.status = 'resolved'
  conflict.resolution = resolution

  if (resolution === 'update') {
    // Update existing contact
    await prisma.contact.update({
      where: { id: conflict.existingContact.id },
      data: conflict.incomingData,
    })
    session.updatedCount++
  } else {
    // Skip this contact
    session.skippedCount++
  }

  // Check if all conflicts are resolved
  const allResolved = session.conflicts.every((c) => c.status === 'resolved')
  if (allResolved && session.processedRows === session.totalRows) {
    session.status = 'completed'
  }
}

/**
 * Get import session data/status
 */
export function getImportSessionData(sessionId: string): ImportSessionData {
  const session = importSessions.get(sessionId)
  if (!session) {
    throw new Error('Import session not found')
  }

  return {
    sessionId: session.id,
    status: session.status,
    progress: {
      total: session.totalRows,
      processed: session.processedRows,
      inserted: session.insertedCount,
      updated: session.updatedCount,
      skipped: session.skippedCount,
      failed: session.failedCount,
    },
    pendingConflicts: session.conflicts.filter((c) => c.status === 'pending'),
    errors: session.errors,
  }
}

/**
 * Cleanup old import sessions (call periodically)
 */
export function cleanupOldSessions(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
  const now = Date.now()
  for (const [id, session] of importSessions.entries()) {
    const age = now - session.createdAt.getTime()
    if (age > maxAgeMs && (session.status === 'completed' || session.status === 'failed')) {
      importSessions.delete(id)
    }
  }
}

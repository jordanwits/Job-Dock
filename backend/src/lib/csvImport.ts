/**
 * CSV Import Service
 * Handles CSV parsing, validation, and conflict resolution for contact imports
 */

import Papa from 'papaparse'
import prisma from './db'
import { Contact } from '@prisma/client'
import { ApiError } from './errors'

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
  /** 1-based line in the source file, so the message matches what the user sees in their spreadsheet. */
  line: number
  field?: string
  message: string
  data: any
}

export interface CSVPreview {
  headers: string[]
  rows: any[]
  totalRows: number
  suggestedMapping: Record<string, string>
  /** Non-fatal problems with the file (e.g. rows whose column count doesn't match the header). */
  warnings: string[]
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

interface ParsedCSV {
  headers: string[]
  rows: Array<Record<string, string>>
  /** 1-based source line for each row in `rows`, aligned by index. */
  lines: number[]
  warnings: string[]
}

/**
 * Parse a CSV into rows plus their source line numbers.
 *
 * Empty lines are kept by the parser (rather than using skipEmptyLines) and filtered here, so a
 * row's index in `parsed.data` still corresponds to its line in the file — that is what lets row
 * errors quote a line number the user can find in their spreadsheet. Both the preview and the
 * import run through this one function so they can never disagree about what the file contains.
 */
function parseCSV(csvContent: string): ParsedCSV {
  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: false,
    transformHeader: (header) => header.trim(),
    quoteChar: '"',
    escapeChar: '"',
  })

  // An unterminated quote swallows the rest of the file, so there is genuinely nothing to import.
  const unterminatedQuote = parsed.errors.find((e: { type?: string }) => e.type === 'Quotes')
  if (unterminatedQuote) {
    throw new ApiError(
      'This file has a quotation mark that is never closed, so the rest of it can\'t be read. ' +
        'Re-export it from your spreadsheet and try again.',
      400
    )
  }

  const headers = parsed.meta.fields || []

  // Rows whose column count differs from the header are still usable: short rows simply leave
  // fields empty and long rows put the surplus in __parsed_extra. One hand-edited line must not
  // reject the entire file, so these are reported as warnings and imported.
  const mismatchedRows = new Set(
    parsed.errors
      .filter((e: { type?: string }) => e.type === 'FieldMismatch')
      .map((e: { row?: number }) => e.row)
      .filter((row): row is number => typeof row === 'number')
  )

  const rows: Array<Record<string, string>> = []
  const lines: number[] = []
  const mismatchedLines: number[] = []

  ;(parsed.data as any[]).forEach((row, index) => {
    const hasContent = Object.entries(row).some(([key, value]) => {
      if (key === '__parsed_extra') return false
      if (value === null || value === undefined) return false
      const trimmed = String(value).trim()
      // Rows that are entirely FALSE come from spreadsheet boolean columns, not real contacts.
      return trimmed !== '' && trimmed.toLowerCase() !== 'false'
    })
    if (!hasContent) return

    delete row.__parsed_extra
    // +2 == one line for the header, and lines are 1-based.
    const line = index + 2
    rows.push(row)
    lines.push(line)
    if (mismatchedRows.has(index)) mismatchedLines.push(line)
  })

  const warnings: string[] = []
  if (mismatchedLines.length > 0) {
    const shown = mismatchedLines.slice(0, 10).join(', ')
    const suffix = mismatchedLines.length > 10 ? `, and ${mismatchedLines.length - 10} more` : ''
    warnings.push(
      `${mismatchedLines.length} row(s) don't have the same number of columns as the header ` +
        `(line${mismatchedLines.length > 1 ? 's' : ''} ${shown}${suffix}). ` +
        'They will still be imported, using the columns that lined up.'
    )
  }

  return { headers, rows, lines, warnings }
}

/**
 * Parse CSV and generate preview
 */
export function parseCSVPreview(csvContent: string): CSVPreview {
  const { headers, rows, warnings } = parseCSV(csvContent)

  return {
    headers,
    rows: rows.slice(0, 5), // Preview first 5 rows
    totalRows: rows.length,
    suggestedMapping: generateFieldMapping(headers),
    warnings,
  }
}

/**
 * Generate suggested field mapping from CSV headers
 */
function generateFieldMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}

  const fieldMappings: Record<string, string[]> = {
    // Note: 'client name', 'full name', 'name' map to `fullName` below and are split server-side
    firstName: ['first name', 'first_name', 'firstname', 'first', 'given name', 'fname', 'givenname'],
    lastName: ['last name', 'last_name', 'lastname', 'last', 'surname', 'family name', 'lname', 'familyname'],
    email: ['email', 'email address', 'email_address', 'e-mail', 'mail', 'emailaddress'],
    phone: ['phone', 'phone number', 'phone_number', 'telephone', 'mobile', 'cell', 'contact', 'phonenumber', 'phone#', 'tel'],
    company: ['company', 'company name', 'company_name', 'organization', 'business', 'companyname', 'org'],
    jobTitle: ['job title', 'job_title', 'title', 'position', 'role', 'jobtitle'],
    address: ['address', 'street', 'street address', 'street_address', 'address line 1', 'location', 'addr'],
    city: ['city', 'town'],
    state: ['state', 'province', 'region'],
    zipCode: ['zip', 'zip code', 'zip_code', 'zipcode', 'postal code', 'postal_code', 'postcode', 'postalcode'],
    country: ['country'],
    notes: ['notes', 'note', 'comments', 'comment', 'description', 'special notes', 'info', 'special_notes', 'additional info', 'details', 'memo'],
  }

  headers.forEach((header) => {
    // Normalize: lowercase, trim, and replace underscores/hyphens with spaces for matching
    const normalized = header.toLowerCase().trim()
    const normalizedWithSpaces = normalized.replace(/[_-]/g, ' ')

    // "Name"-style columns map to the synthetic `fullName` target, which mapRowToContact splits
    // into first + last. Mapping them explicitly (rather than leaving them unmapped and splitting
    // them behind the user's back) is what makes the import UI's field mapping truthful.
    if (isFullNameField(header)) {
      mapping[header] = 'fullName'
      return
    }

    // Check standard field mappings
    for (const [field, aliases] of Object.entries(fieldMappings)) {
      // Check both the original normalized and the version with special chars replaced
      if (aliases.includes(normalized) || 
          aliases.includes(normalizedWithSpaces) || 
          normalized === field.toLowerCase() ||
          normalizedWithSpaces === field.toLowerCase()) {
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
  const { rows, lines } = parseCSV(csvContent)

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const line = lines[i]

    try {
      // Map CSV fields to contact fields
      const contactData = mapRowToContact(row, session.fieldMapping)

      console.log('Processing row', i, 'with field mapping:', session.fieldMapping)
      console.log('Row data:', row)
      console.log('Mapped contact data:', contactData)

      // Validate required fields
      const firstName = contactData.firstName?.trim()
      const lastName = contactData.lastName?.trim()
      
      if (!firstName || !lastName) {
        const missing = [!firstName && 'first name', !lastName && 'last name'].filter(Boolean)
        const errorMsg = `Missing required ${missing.length > 1 ? 'fields' : 'field'}: ${missing.join(' and ')}`
        console.log('Validation error:', errorMsg, 'for row:', row)
        session.errors.push({
          rowIndex: i,
          line,
          message: errorMsg,
          data: row,
        })
        session.failedCount++
        session.processedRows++
        continue
      }
      
      // Update contactData with trimmed values
      contactData.firstName = firstName
      contactData.lastName = lastName

      // Check for duplicates using multiple criteria
      let existing = null
      
      // First, check by email if available. Case-insensitively: addresses are not case-sensitive
      // in practice, and matching exactly let ADA@x.com and ada@x.com both import as new contacts.
      if (contactData.email) {
        existing = await prisma.contact.findFirst({
          where: {
            tenantId: session.tenantId,
            email: { equals: contactData.email, mode: 'insensitive' },
          },
        })
      }
      
      // If no match by email, check by name + phone
      if (!existing && contactData.phone) {
        existing = await prisma.contact.findFirst({
          where: {
            tenantId: session.tenantId,
            firstName: firstName,
            lastName: lastName,
            phone: contactData.phone,
          },
        })
      }
      
      // If still no match, check by name + company (if both exist)
      if (!existing && contactData.company && firstName && lastName) {
        existing = await prisma.contact.findFirst({
          where: {
            tenantId: session.tenantId,
            firstName: firstName,
            lastName: lastName,
            company: contactData.company,
          },
        })
      }

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

      // Ensure we have valid firstName and lastName
      if (!firstName || !lastName) {
        console.error('ERROR: firstName or lastName is missing after validation!', {
          firstName,
          lastName,
          contactData,
          row
        })
        session.errors.push({
          rowIndex: i,
          line,
          message: 'Internal error: firstName or lastName missing after validation',
          data: row,
        })
        session.failedCount++
        session.processedRows++
        continue
      }

      // Insert new contact
      await prisma.contact.create({
        data: {
          tenantId: session.tenantId,
          firstName: firstName,
          lastName: lastName,
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
          status: (contactData.status as string) || 'customer',
        },
      })

      session.insertedCount++
      session.processedRows++
    } catch (error: any) {
      session.errors.push({
        rowIndex: i,
        line,
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
 * Split a full name into first and last names
 */
function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim()
  const parts = trimmed.split(/\s+/)
  
  if (parts.length === 0 || trimmed === '') {
    return { firstName: '', lastName: '' }
  }
  
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' }
  }
  
  // First word is firstName, rest is lastName
  const firstName = parts[0]
  const lastName = parts.slice(1).join(' ')
  
  return { firstName, lastName }
}

/**
 * Check if a CSV header looks like a "full name" column. Used to pick the default mapping for
 * such a column; it never overrides a mapping the user has chosen.
 */
function isFullNameField(header: string): boolean {
  const lowerHeader = header.toLowerCase().trim().replace(/[_-]/g, ' ')
  const fullNamePatterns = [
    'name',
    'full name',
    'fullname',
    'contact name',
    'contactname',
    'client name',
    'clientname',
    'customer name',
    'customername'
  ]
  return fullNamePatterns.includes(lowerHeader)
}

/**
 * Map CSV row to contact data
 */
function mapRowToContact(
  row: any,
  fieldMapping: Record<string, string>
): Partial<Contact> {
  const contact: any = {}

  const readCell = (csvField: string): string | null => {
    const value = row[csvField]
    if (value === undefined || value === null) return null
    const trimmed = String(value).trim()
    return trimmed || null
  }

  const applyFullName = (value: string) => {
    const { firstName, lastName } = splitFullName(value)
    if (!firstName) return
    contact.firstName = firstName
    // A single-word name has no surname to use; fall back to repeating it so the row still
    // satisfies the required-fields check rather than failing outright.
    contact.lastName = lastName || firstName
  }

  // The field mapping is authoritative: a column is only read if the user mapped it, and it is
  // only written to the field they chose. `fullName` is the one synthetic target — it fans out
  // into firstName/lastName. It runs first so an explicit firstName/lastName mapping can override
  // the split rather than the other way round.
  for (const [csvField, contactField] of Object.entries(fieldMapping)) {
    if (contactField !== 'fullName') continue
    const value = readCell(csvField)
    if (value) applyFullName(value)
  }

  for (const [csvField, contactField] of Object.entries(fieldMapping)) {
    if (!contactField || contactField === 'fullName') continue
    const value = readCell(csvField)
    if (value) contact[contactField] = value
  }

  // Backwards compatibility: a client from before `fullName` existed leaves name columns
  // unmapped. Only when the mapping names no name field at all is a name column detected
  // automatically — otherwise every row in such a file would fail validation. An explicit
  // choice (including "don't import") is never second-guessed.
  const mappedFields = Object.values(fieldMapping)
  const hasNameMapping =
    mappedFields.includes('firstName') ||
    mappedFields.includes('lastName') ||
    mappedFields.includes('fullName')
  if (!hasNameMapping) {
    for (const csvField of Object.keys(row)) {
      if (!isFullNameField(csvField)) continue
      // A column present in the mapping has an explicit decision attached to it — including the
      // empty string, which means "don't import". Only columns the client never mentioned at all
      // are eligible for the legacy auto-split.
      if (csvField in fieldMapping) continue
      const value = readCell(csvField)
      if (value) {
        applyFullName(value)
        break
      }
    }
  }

  // Handle tags if present (comma-separated)
  if (contact.tags && typeof contact.tags === 'string') {
    contact.tags = contact.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t)
  }

  console.log('Mapped contact:', contact)
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
    // Update existing contact - filter out undefined values
    const updateData: any = {}
    for (const [key, value] of Object.entries(conflict.incomingData)) {
      if (value !== undefined && value !== null) {
        updateData[key] = value
      }
    }
    
    console.log('Updating contact', conflict.existingContact.id, 'with data:', updateData)
    
    await prisma.contact.update({
      where: { id: conflict.existingContact.id },
      data: updateData,
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

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
  console.log('[parseCSVPreview] Starting, content length:', csvContent?.length)
  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: 'greedy', // Skip lines with all empty values
    transformHeader: (header) => header.trim(),
    quoteChar: '"',
    escapeChar: '"',
  })

  console.log('[parseCSVPreview] Parsed:', { errorCount: parsed.errors.length, dataLength: parsed.data?.length, fields: parsed.meta?.fields })

  if (parsed.errors.length > 0) {
    console.error('[parseCSVPreview] Parse errors:', parsed.errors)
    // Only throw if it's a critical error, not just warnings
    const criticalErrors = parsed.errors.filter((e: { type?: string }) => e.type === 'Quotes' || e.type === 'FieldMismatch')
    if (criticalErrors.length > 0) {
      throw new Error(`CSV parsing error: ${criticalErrors[0].message}`)
    }
  }

  const headers = parsed.meta.fields || []
  
  // Filter out rows that are truly empty (all values are empty or whitespace)
  const nonEmptyRows = (parsed.data as any[]).filter(row => {
    return Object.values(row).some(value => 
      value !== null && 
      value !== undefined && 
      String(value).trim() !== '' &&
      String(value).trim().toLowerCase() !== 'false' // Filter out rows with just FALSE values
    )
  })

  const rows = nonEmptyRows.slice(0, 5) // Preview first 5 rows
  const totalRows = nonEmptyRows.length

  console.log('[parseCSVPreview] Headers:', headers)
  console.log('[parseCSVPreview] First row sample:', rows[0])
  console.log('[parseCSVPreview] Total non-empty rows:', totalRows)

  // Suggest field mappings based on common column names
  const suggestedMapping = generateFieldMapping(headers)

  console.log('[parseCSVPreview] Generated mapping:', suggestedMapping)

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
    // Note: 'client name', 'full name', 'name' are handled specially via name splitting
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

  // Special handling for full name fields (will be split automatically)
  const fullNameAliases = ['client name', 'client_name', 'clientname', 'full name', 'full_name', 'fullname', 'name', 'contact name', 'contact_name']

  headers.forEach((header) => {
    // Normalize: lowercase, trim, and replace underscores/hyphens with spaces for matching
    const normalized = header.toLowerCase().trim()
    const normalizedWithSpaces = normalized.replace(/[_-]/g, ' ')

    // Check if this is a full name field first
    if (fullNameAliases.includes(normalized) || fullNameAliases.includes(normalizedWithSpaces)) {
      // Don't map full name fields - they'll be handled by the name splitting logic
      // Just leave them unmapped so user can see them, but they'll be auto-processed
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
  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
    quoteChar: '"',
    escapeChar: '"',
  })

  // Filter out truly empty rows
  const allRows = parsed.data as any[]
  const rows = allRows.filter(row => {
    return Object.values(row).some(value => 
      value !== null && 
      value !== undefined && 
      String(value).trim() !== '' &&
      String(value).trim().toLowerCase() !== 'false'
    )
  })

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

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
        const errorMsg = `Missing required fields: ${!firstName ? 'firstName' : ''} ${!lastName ? 'lastName' : ''}`.trim()
        console.log('Validation error:', errorMsg, 'for row:', row)
        session.errors.push({
          rowIndex: i,
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
      
      // First, check by email if available
      if (contactData.email) {
        existing = await prisma.contact.findFirst({
          where: {
            tenantId: session.tenantId,
            email: contactData.email,
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
 * Check if a CSV header is a "full name" type field
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

  // First, look for full name fields in ALL CSV columns (even unmapped ones) and split them
  for (const [csvField, value] of Object.entries(row)) {
    if (!value || typeof value !== 'string') continue
    
    const trimmedValue = value.trim()
    if (!trimmedValue) continue
    
    // Check if this is a "full name" type field (even if not mapped)
    if (isFullNameField(csvField)) {
      const { firstName, lastName } = splitFullName(trimmedValue)
      if (firstName) {
        contact.firstName = firstName
      }
      // Use firstName as lastName fallback if no lastName
      if (lastName) {
        contact.lastName = lastName
      } else if (firstName) {
        contact.lastName = firstName
      }
      console.log(`Split full name from unmapped field "${csvField}": "${trimmedValue}" -> firstName: "${firstName}", lastName: "${lastName || firstName}"`)
    }
  }

  // Then apply the field mapping for explicitly mapped fields (but don't overwrite firstName/lastName if already set from full name)
  for (const [csvField, contactField] of Object.entries(fieldMapping)) {
    // Skip if this is a full name field (already processed above)
    if (isFullNameField(csvField)) continue
    
    const value = row[csvField]
    if (value !== undefined && value !== null && value !== '') {
      const trimmedValue = String(value).trim()
      if (trimmedValue) {
        // Don't overwrite firstName/lastName if already set from full name split
        if ((contactField === 'firstName' || contactField === 'lastName') && contact[contactField]) {
          continue
        }
        contact[contactField] = trimmedValue
      }
    }
  }

  // Handle tags if present (comma-separated)
  if (contact.tags && typeof contact.tags === 'string') {
    contact.tags = contact.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t)
  }

  // Also handle the phone/contact field mapping
  if (!contact.phone && row['Contact']) {
    contact.phone = String(row['Contact']).trim()
  }
  
  // Handle address field
  if (!contact.address && row['Address']) {
    contact.address = String(row['Address']).trim()
  }
  
  // Handle notes from Info or Special Notes fields
  if (!contact.notes) {
    const infoValue = row['Info'] || row['Special Notes']
    if (infoValue && typeof infoValue === 'string') {
      contact.notes = String(infoValue).trim()
    }
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

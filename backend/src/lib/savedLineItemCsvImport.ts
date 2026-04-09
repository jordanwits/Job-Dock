/**
 * CSV import for tenant saved line items (quotes/invoices catalog)
 */

import Papa from 'papaparse'
import prisma from './db'
import type { SavedLineItem } from '@prisma/client'
import { Prisma } from '@prisma/client'
import {
  generateSavedLineItemFieldMapping,
  normalizeSavedLineItemName,
  parseMoneyForCsv,
  parseQuantityForCsv,
} from './savedLineItemCsvHelpers'

export interface SavedLineItemImportSession {
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
  csvData: string
  fieldMapping: Record<string, string>
  conflicts: SavedLineItemImportConflict[]
  errors: SavedLineItemImportError[]
  createdAt: Date
}

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
  createdAt: Date
}

export interface SavedLineItemImportError {
  rowIndex: number
  field?: string
  message: string
  data: any
}

export interface SavedLineItemCSVPreview {
  headers: string[]
  rows: any[]
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

const importSessions = new Map<string, SavedLineItemImportSession>()

export function parseSavedLineItemCSVPreview(csvContent: string): SavedLineItemCSVPreview {
  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: header => header.trim(),
    quoteChar: '"',
    escapeChar: '"',
  })

  if (parsed.errors.length > 0) {
    const criticalErrors = parsed.errors.filter(
      (e: { type?: string }) => e.type === 'Quotes' || e.type === 'FieldMismatch'
    )
    if (criticalErrors.length > 0) {
      throw new Error(`CSV parsing error: ${criticalErrors[0]!.message}`)
    }
  }

  const headers = parsed.meta.fields || []
  const nonEmptyRows = (parsed.data as any[]).filter(row =>
    Object.values(row).some(
      value =>
        value !== null &&
        value !== undefined &&
        String(value).trim() !== '' &&
        String(value).trim().toLowerCase() !== 'false'
    )
  )

  const rows = nonEmptyRows.slice(0, 5)
  const totalRows = nonEmptyRows.length
  const suggestedMapping = generateSavedLineItemFieldMapping(headers, rows)

  return {
    headers,
    rows,
    totalRows,
    suggestedMapping,
  }
}

function mapRowToSavedLineItem(row: Record<string, string>, fieldMapping: Record<string, string>) {
  const out: {
    name?: string
    description?: string
    defaultQuantity?: number
    unitPrice?: number
  } = {}

  for (const [csvField, targetField] of Object.entries(fieldMapping)) {
    const raw = row[csvField]
    if (raw === undefined || raw === null || String(raw).trim() === '') continue
    const v = String(raw).trim()

    if (targetField === 'name') {
      out.name = v
    } else if (targetField === 'description') {
      out.description = v
    } else if (targetField === 'defaultQuantity') {
      const q = parseQuantityForCsv(v)
      if (q != null) out.defaultQuantity = q
    } else if (targetField === 'unitPrice') {
      const p = parseMoneyForCsv(v)
      if (p != null) out.unitPrice = p
    }
  }

  const firstKey = Object.keys(row)[0]
  const firstValue =
    firstKey && row[firstKey] != null ? String(row[firstKey]).trim() : ''

  if (!out.description && out.name) {
    out.description = out.name
  }
  if (!out.description && firstValue) {
    out.description = firstValue
  }
  if (!out.name && out.description) {
    out.name = out.description.slice(0, 500)
  }
  if (!out.name && firstValue) {
    out.name = firstValue.slice(0, 500)
  }

  return out
}

function buildUniqueSavedLineItemName(baseName: string, suffix: number): string {
  const suffixText = ` (${suffix})`
  const maxBaseLength = Math.max(1, 500 - suffixText.length)
  return `${baseName.slice(0, maxBaseLength)}${suffixText}`
}

async function getAvailableSavedLineItemName(
  tenantId: string,
  baseName: string,
  excludeId?: string
): Promise<{ name: string; normalizedName: string }> {
  const trimmedBaseName = baseName.trim().slice(0, 500)
  if (!trimmedBaseName) {
    throw new Error('Incoming name is required')
  }

  for (let suffix = 2; suffix < 10000; suffix++) {
    const candidateName = buildUniqueSavedLineItemName(trimmedBaseName, suffix)
    const normalizedName = normalizeSavedLineItemName(candidateName)
    const taken = await prisma.savedLineItem.findFirst({
      where: {
        tenantId,
        normalizedName,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    })
    if (!taken) {
      return { name: candidateName, normalizedName }
    }
  }

  throw new Error('Could not generate a unique saved line item name')
}

export function createSavedLineItemImportSession(
  tenantId: string,
  fileName: string,
  csvContent: string,
  fieldMapping: Record<string, string>
): SavedLineItemImportSession {
  const preview = parseSavedLineItemCSVPreview(csvContent)
  const session: SavedLineItemImportSession = {
    id: `sli_import_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
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

export function getSavedLineItemImportSession(sessionId: string): SavedLineItemImportSession | null {
  return importSessions.get(sessionId) || null
}

export function getSavedLineItemImportSessionData(sessionId: string): SavedLineItemImportSessionData {
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
    pendingConflicts: session.conflicts.filter(c => c.status === 'pending'),
    errors: session.errors,
  }
}

export async function processSavedLineItemImportSession(sessionId: string): Promise<SavedLineItemImportSessionData> {
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
    transformHeader: header => header.trim(),
    quoteChar: '"',
    escapeChar: '"',
  })

  const allRows = parsed.data as any[]
  const rows = allRows.filter(row =>
    Object.values(row).some(
      value =>
        value !== null &&
        value !== undefined &&
        String(value).trim() !== '' &&
        String(value).trim().toLowerCase() !== 'false'
    )
  )
  const insertedByNormalizedName = new Map<string, { id: string; rowIndex: number }>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Record<string, string>
    try {
      const mapped = mapRowToSavedLineItem(row, session.fieldMapping)
      const description = mapped.description?.trim() || mapped.name?.trim() || ''
      const name = (mapped.name?.trim() || description).slice(0, 500)
      if (!name) {
        session.errors.push({
          rowIndex: i,
          message: 'Missing description',
          data: row,
        })
        session.failedCount++
        session.processedRows++
        continue
      }

      const unitPrice = mapped.unitPrice ?? 0
      if (unitPrice < 0 || !Number.isFinite(unitPrice)) {
        session.errors.push({
          rowIndex: i,
          message: 'Invalid unit price',
          data: row,
        })
        session.failedCount++
        session.processedRows++
        continue
      }

      const defaultQuantity = mapped.defaultQuantity ?? 1
      if (defaultQuantity < 0 || !Number.isFinite(defaultQuantity)) {
        session.errors.push({
          rowIndex: i,
          message: 'Invalid quantity',
          data: row,
        })
        session.failedCount++
        session.processedRows++
        continue
      }

      const normalizedName = normalizeSavedLineItemName(name)

      const existing = await prisma.savedLineItem.findUnique({
        where: {
          tenantId_normalizedName: {
            tenantId: session.tenantId,
            normalizedName,
          },
        },
      })

      if (existing) {
        const csvDuplicate = insertedByNormalizedName.get(normalizedName)
        const conflict: SavedLineItemImportConflict = {
          id: `sli_conflict_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          sessionId: session.id,
          rowIndex: i,
          type: csvDuplicate ? 'csv_duplicate' : 'existing_saved_item',
          existingRowIndex: csvDuplicate?.rowIndex,
          existingItem: existing,
          incomingData: {
            name,
            description,
            defaultQuantity,
            unitPrice,
            isActive: true,
          },
          status: 'pending',
          createdAt: new Date(),
        }
        session.conflicts.push(conflict)
        session.processedRows++
        continue
      }

      const created = await prisma.savedLineItem.create({
        data: {
          tenantId: session.tenantId,
          name,
          normalizedName,
          description,
          defaultQuantity: new Prisma.Decimal(defaultQuantity),
          unitPrice: new Prisma.Decimal(unitPrice),
          isActive: true,
        },
      })
      insertedByNormalizedName.set(normalizedName, { id: created.id, rowIndex: i })
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

  session.status = session.conflicts.length === 0 ? 'completed' : 'pending'
  return getSavedLineItemImportSessionData(sessionId)
}

export async function resolveSavedLineItemConflict(
  sessionId: string,
  conflictId: string,
  resolution: 'update' | 'skip' | 'keep_existing' | 'keep_incoming' | 'keep_both'
): Promise<void> {
  const session = importSessions.get(sessionId)
  if (!session) {
    throw new Error('Import session not found')
  }

  const conflict = session.conflicts.find(c => c.id === conflictId)
  if (!conflict) {
    throw new Error('Conflict not found')
  }
  if (conflict.status === 'resolved') {
    throw new Error('Conflict already resolved')
  }

  conflict.status = 'resolved'
  conflict.resolution = resolution

  const inc = conflict.incomingData
  const incomingName = inc.name?.trim()
  if (!incomingName) {
    throw new Error('Incoming name is required to resolve this conflict')
  }

  const buildUpdateData = (name: string, normalizedName: string) => {
    const data: {
      name: string
      normalizedName: string
      description?: string
      defaultQuantity?: Prisma.Decimal
      unitPrice?: Prisma.Decimal
      isActive?: boolean
    } = {
      name,
      normalizedName,
    }
    if (inc.description !== undefined) data.description = inc.description
    if (inc.defaultQuantity !== undefined) {
      data.defaultQuantity = new Prisma.Decimal(inc.defaultQuantity)
    }
    if (inc.unitPrice !== undefined) {
      data.unitPrice = new Prisma.Decimal(inc.unitPrice)
    }
    data.isActive = true
    return data
  }

  if (conflict.type === 'existing_saved_item') {
    if (resolution === 'skip' || resolution === 'keep_existing') {
      session.skippedCount++
    } else if (resolution === 'update' || resolution === 'keep_incoming') {
      const normalizedName = normalizeSavedLineItemName(incomingName)
      const data = buildUpdateData(incomingName, normalizedName)

      if (normalizedName !== conflict.existingItem.normalizedName) {
        const taken = await prisma.savedLineItem.findFirst({
          where: {
            tenantId: session.tenantId,
            normalizedName,
            NOT: { id: conflict.existingItem.id },
          },
        })
        if (taken) {
          throw new Error('Another saved item already uses this name')
        }
      }

      await prisma.savedLineItem.update({
        where: { id: conflict.existingItem.id },
        data,
      })
      session.updatedCount++
    } else {
      throw new Error('Import both is only available for duplicates inside the CSV')
    }
  } else if (resolution === 'skip' || resolution === 'keep_existing') {
    session.skippedCount++
  } else if (resolution === 'update' || resolution === 'keep_incoming') {
    const normalizedName = normalizeSavedLineItemName(incomingName)
    const data = buildUpdateData(incomingName, normalizedName)

    await prisma.savedLineItem.update({
      where: { id: conflict.existingItem.id },
      data,
    })
    session.updatedCount++
  } else if (resolution === 'keep_both') {
    const uniqueName = await getAvailableSavedLineItemName(
      session.tenantId,
      incomingName,
      conflict.existingItem.id
    )
    await prisma.savedLineItem.create({
      data: {
        tenantId: session.tenantId,
        name: uniqueName.name,
        normalizedName: uniqueName.normalizedName,
        description: inc.description ?? incomingName,
        defaultQuantity: new Prisma.Decimal(inc.defaultQuantity ?? 1),
        unitPrice: new Prisma.Decimal(inc.unitPrice ?? 0),
        isActive: true,
      },
    })
    session.insertedCount++
  } else {
    throw new Error('Unsupported conflict resolution')
  }

  const allResolved = session.conflicts.every(c => c.status === 'resolved')
  if (allResolved && session.processedRows === session.totalRows) {
    session.status = 'completed'
  }
}

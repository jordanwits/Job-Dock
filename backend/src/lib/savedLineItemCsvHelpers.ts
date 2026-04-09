/** Pure helpers for saved line item CSV import (no DB side effects) */

export function normalizeSavedLineItemName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function parseMoneyForCsv(value: string | undefined | null): number | null {
  if (value == null || value === '') return null
  const cleaned = String(value).replace(/[$€£,\s]/g, '').trim()
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export function parseQuantityForCsv(value: string | undefined | null): number | null {
  if (value == null || value === '') return null
  const cleaned = String(value).trim().replace(/,/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export type SavedLineItemCsvTargetField =
  | 'name'
  | 'description'
  | 'defaultQuantity'
  | 'unitPrice'

function isUnnamedCsvHeader(header: string): boolean {
  const normalized = header.trim().toLowerCase()
  return normalized === '' || /^unnamed(?::|\s|$)/.test(normalized)
}

export function generateSavedLineItemFieldMapping(
  headers: string[],
  rows: Array<Record<string, string | undefined | null>>
): Record<string, SavedLineItemCsvTargetField> {
  const mapping: Record<string, SavedLineItemCsvTargetField> = {}
  const fieldMappings: Record<Exclude<SavedLineItemCsvTargetField, 'name'>, string[]> = {
    // Description is the primary visible field in the app, so common "name"-style
    // CSV headers should land here and we derive the internal name from it later.
    description: [
      'description',
      'desc',
      'details',
      'memo',
      'line description',
      'name',
      'item',
      'item name',
      'itemname',
      'product',
      'product name',
      'service',
      'title',
      'sku',
      'code',
      'line item',
    ],
    defaultQuantity: ['quantity', 'qty', 'default quantity', 'default_qty', 'units', 'qnty'],
    unitPrice: ['unit price', 'unitprice', 'price', 'rate', 'each', 'cost', 'amount', 'unit cost'],
  }

  headers.forEach(header => {
    const normalized = header.toLowerCase().trim()
    const normalizedWithSpaces = normalized.replace(/[_-]/g, ' ')
    for (const [field, aliases] of Object.entries(fieldMappings)) {
      if (
        aliases.includes(normalized) ||
        aliases.includes(normalizedWithSpaces) ||
        normalized === field.toLowerCase() ||
        normalizedWithSpaces === field.toLowerCase()
      ) {
        mapping[header] = field as SavedLineItemCsvTargetField
        break
      }
    }
  })

  if (!Object.values(mapping).includes('description')) {
    const firstDescriptiveHeader = headers.find(header => {
      if (mapping[header]) return false
      if (!header.trim()) return false
      return !isUnnamedCsvHeader(header)
    })
    if (firstDescriptiveHeader) {
      mapping[firstDescriptiveHeader] = 'description'
    }
  }

  if (!Object.values(mapping).includes('unitPrice')) {
    const unnamedHeaders = headers.filter(header => !mapping[header] && isUnnamedCsvHeader(header))
    const candidate = unnamedHeaders
      .map((header, index) => {
        const nonEmptyValues = rows
          .map(row => row[header])
          .filter(value => value != null && String(value).trim() !== '')
          .map(value => String(value).trim())

        if (nonEmptyValues.length < 2) {
          return null
        }

        const parsedValues = nonEmptyValues
          .map(value => parseMoneyForCsv(value))
          .filter((value): value is number => value != null)

        if (parsedValues.length / nonEmptyValues.length < 0.8) {
          return null
        }

        const decimalLikeCount = nonEmptyValues.filter(value => /[$€£.]|,\d{2}\b/.test(value)).length
        const averageAbs = parsedValues.reduce((sum, value) => sum + Math.abs(value), 0) / parsedValues.length

        return {
          header,
          index,
          decimalLikeCount,
          averageAbs,
        }
      })
      .filter((value): value is { header: string; index: number; decimalLikeCount: number; averageAbs: number } => !!value)
      .sort((a, b) => {
        if (b.decimalLikeCount !== a.decimalLikeCount) return b.decimalLikeCount - a.decimalLikeCount
        if (b.averageAbs !== a.averageAbs) return b.averageAbs - a.averageAbs
        return b.index - a.index
      })[0]

    if (candidate) {
      mapping[candidate.header] = 'unitPrice'
    }
  }

  return mapping
}

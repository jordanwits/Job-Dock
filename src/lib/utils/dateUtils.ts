/**
 * Converts a date string (YYYY-MM-DD) to ISO string at noon UTC
 * This prevents timezone shifts when saving dates
 * 
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns ISO string at noon UTC, or undefined if input is empty
 * 
 * @example
 * dateStringToISO('2026-01-15') // Returns '2026-01-15T12:00:00.000Z'
 */
export function dateStringToISO(dateString: string | undefined): string | undefined {
  if (!dateString) return undefined
  
  const dateParts = dateString.split('-')
  if (dateParts.length !== 3) return undefined
  
  // Create date at noon UTC to avoid timezone shifts
  const date = new Date(Date.UTC(
    parseInt(dateParts[0]), 
    parseInt(dateParts[1]) - 1, 
    parseInt(dateParts[2]), 
    12, 0, 0
  ))
  
  return date.toISOString()
}

/**
 * Converts an ISO date string to YYYY-MM-DD format for date inputs
 *
 * @param isoString - ISO date string
 * @returns Date string in YYYY-MM-DD format
 *
 * @example
 * isoToDateString('2026-01-15T12:00:00.000Z') // Returns '2026-01-15'
 */
export function isoToDateString(isoString: string | undefined): string {
  if (!isoString) return ''
  return new Date(isoString).toISOString().split('T')[0]
}

/**
 * Parses a YYYY-MM-DD date-input value as a LOCAL calendar date.
 * `new Date('YYYY-MM-DD')` parses as UTC midnight, so formatting it locally
 * shows the PREVIOUS day in US timezones — use this for previews/labels of
 * date-input values instead.
 */
export function parseDateStringLocal(dateString: string | undefined): Date | null {
  if (!dateString) return null
  const [y, m, d] = dateString.split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  return isNaN(date.getTime()) ? null : date
}

/**
 * Format a date-only value (e.g. dueDate/validUntil — 'YYYY-MM-DD' or an ISO
 * timestamp at UTC midnight) as a local calendar date string. Plain
 * `new Date(value).toLocaleDateString()` shows the PREVIOUS day in US timezones.
 */
export function formatDateOnly(value: string | Date): string {
  const s = value instanceof Date ? value.toISOString() : String(value)
  const parsed = parseDateStringLocal(s.slice(0, 10))
  return (parsed ?? new Date(value)).toLocaleDateString()
}

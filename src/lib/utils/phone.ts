/**
 * Phone number formatting and normalization utilities
 */

/**
 * Normalizes a phone number by removing all non-digit characters
 * Used for search and comparison purposes
 */
export function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return ''
  return phone.replace(/\D/g, '')
}

/**
 * Formats a phone number as the user types
 * Formats as: XXX-XXX-XXXX (10 digits) or XXX-XXXX (7 digits)
 * For longer numbers, formats as: XXX-XXX-XXXX-XXXX (14 digits max)
 */
export function formatPhoneNumber(value: string): string {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '')
  
  // Limit to 14 digits max
  const limitedDigits = digits.slice(0, 14)
  
  // Format based on length
  if (limitedDigits.length <= 3) {
    return limitedDigits
  } else if (limitedDigits.length <= 6) {
    return `${limitedDigits.slice(0, 3)}-${limitedDigits.slice(3)}`
  } else if (limitedDigits.length <= 10) {
    return `${limitedDigits.slice(0, 3)}-${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6)}`
  } else {
    // For numbers longer than 10 digits (e.g., with extension)
    return `${limitedDigits.slice(0, 3)}-${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6, 10)}-${limitedDigits.slice(10)}`
  }
}

/**
 * Checks if a search query matches a phone number
 * Normalizes both the query and phone number before comparison
 */
export function phoneMatches(query: string, phone: string | null | undefined): boolean {
  if (!phone) return false
  const normalizedQuery = normalizePhoneNumber(query)
  const normalizedPhone = normalizePhoneNumber(phone)
  
  // If query is empty after normalization, don't match
  if (!normalizedQuery) return false
  
  // Check if normalized phone contains normalized query
  return normalizedPhone.includes(normalizedQuery)
}

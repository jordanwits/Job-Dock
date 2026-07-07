import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility function to merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number as currency with commas (e.g., 1234.56 -> "1,234.56")
 */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Format an integer with commas (e.g., 1234 -> "1,234")
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US')
}

/**
 * Convert a stored fractional tax rate (e.g. 0.07) to its percent value (7)
 * without float artifacts like 7.000000000000001.
 */
export function taxRateToPercent(rate: number): number {
  return Number((rate * 100).toFixed(4))
}

/**
 * Format fractional hours as "Xh Ym" with minutes carried into hours,
 * so 1.9993h renders "2h 0m" — never "1h 60m".
 */
export function formatHoursMinutes(totalHours: number): { hours: number; minutes: number } {
  const totalMinutes = Math.round(totalHours * 60)
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 }
}

/** Parts of a mailing address used for maps search. */
export interface ContactAddressParts {
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
}

/**
 * Join contact address fields into one line suitable for maps search / display.
 */
export function buildContactAddressQuery(parts: ContactAddressParts): string {
  const cityStateZip = [parts.city, parts.state, parts.zipCode].filter(Boolean).join(' ')
  const segments = [parts.address, cityStateZip || undefined, parts.country].filter(
    (s): s is string => Boolean(s && String(s).trim())
  )
  return segments.map((s) => String(s).trim()).join(', ')
}

/**
 * Maps URL for a freeform address or place query. Uses platform hints when available;
 * falls back to Google Maps web search.
 */
export function getMapsHref(query: string): string {
  const q = query.trim()
  if (!q) {
    return '#'
  }
  const encoded = encodeURIComponent(q)

  if (typeof navigator === 'undefined') {
    return `https://www.google.com/maps/search/?api=1&query=${encoded}`
  }

  const ua = navigator.userAgent || ''

  if (/iPhone|iPad|iPod/i.test(ua)) {
    return `https://maps.apple.com/?q=${encoded}`
  }

  if (/Android/i.test(ua)) {
    return `geo:0,0?q=${encoded}`
  }

  if (/Macintosh/i.test(ua) && /Safari/i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua)) {
    return `https://maps.apple.com/?q=${encoded}`
  }

  // Windows and other desktops: Google Maps web (opens in browser; may hand off to installed app)
  return `https://www.google.com/maps/search/?api=1&query=${encoded}`
}


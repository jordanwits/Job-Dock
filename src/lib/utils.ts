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


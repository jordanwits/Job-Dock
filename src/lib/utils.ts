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


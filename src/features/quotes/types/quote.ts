export interface QuoteLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
}

/**
 * `converted` is set by the system when a quote becomes an invoice — it is never chosen by hand.
 * It replaces the old behaviour of deleting the quote on conversion, which destroyed the record of
 * what the customer actually accepted.
 *
 * Single source of truth: reference this rather than re-spelling the union, or the two copies
 * drift and only one of them learns about new statuses.
 */
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted'

export interface Quote {
  id: string
  quoteNumber: string
  title?: string
  contactId: string
  contactName?: string
  contactEmail?: string
  contactCompany?: string
  contactPhone?: string
  contactNotificationPreference?: 'email' | 'sms' | 'both'
  sentVia?: string[] // ['email'] | ['sms'] | ['email','sms'] - set by send response
  lineItems: QuoteLineItem[]
  subtotal: number
  taxRate: number
  taxAmount: number
  discount: number
  discountReason?: string
  total: number
  status: QuoteStatus
  /** Set when the client declines via the public approval link (optional). */
  clientDeclineReason?: string
  notes?: string
  validUntil?: string
  createdAt: string
  updatedAt: string
}

export interface CreateQuoteData {
  contactId: string
  title?: string
  lineItems: Omit<QuoteLineItem, 'id' | 'total'>[]
  taxRate?: number
  discount?: number
  discountReason?: string
  notes?: string
  validUntil?: string
  status?: QuoteStatus
}

export interface UpdateQuoteData extends Partial<CreateQuoteData> {
  id: string
}

/** User-facing labels (stored/API status for declined quotes remains `rejected`). */
export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Declined',
  expired: 'Expired',
  converted: 'Invoiced',
}

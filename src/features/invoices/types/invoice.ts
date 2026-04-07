export interface InvoiceLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export interface Invoice {
  id: string
  invoiceNumber: string
  title?: string
  contactId: string
  contactName?: string
  contactEmail?: string
  contactCompany?: string
  contactPhone?: string
  contactNotificationPreference?: 'email' | 'sms' | 'both'
  sentVia?: string[] // ['email'] | ['sms'] | ['email','sms'] - set by send response
  lineItems: InvoiceLineItem[]
  subtotal: number
  taxRate: number
  taxAmount: number
  discount: number
  discountReason?: string
  total: number
  status: 'draft' | 'sent' | 'overdue' | 'cancelled'
  paymentStatus: 'pending' | 'partial' | 'paid'
  approvalStatus?: 'none' | 'accepted' | 'declined'
  approvalAt?: string
  /** Set when the client declines via the public approval link (optional). */
  clientDeclineReason?: string
  notes?: string
  dueDate?: string
  paymentTerms?: string
  paidAmount: number
  trackResponse?: boolean
  trackPayment?: boolean
  createdAt: string
  updatedAt: string
  convertedFromQuoteNumber?: string
  convertedFromQuoteTotal?: number
  convertedFromQuoteCreatedAt?: string
}

export interface CreateInvoiceData {
  contactId: string
  title?: string
  lineItems: Omit<InvoiceLineItem, 'id' | 'total'>[]
  taxRate?: number
  discount?: number
  discountReason?: string
  notes?: string
  dueDate?: string
  paymentTerms?: string
  status?: 'draft' | 'sent' | 'overdue' | 'cancelled'
  paymentStatus?: 'pending' | 'partial' | 'paid'
  trackResponse?: boolean
  trackPayment?: boolean
  convertedFromQuoteNumber?: string
  convertedFromQuoteTotal?: number
  convertedFromQuoteCreatedAt?: string
}

export interface UpdateInvoiceData extends Partial<CreateInvoiceData> {
  id: string
  approvalStatus?: ApprovalStatus
  /** Amount already paid (partial payments). Ignored unless paymentStatus is partial. */
  paidAmount?: number
}

export type InvoiceStatus = 'draft' | 'sent' | 'overdue' | 'cancelled'
export type PaymentStatus = 'pending' | 'partial' | 'paid'
export type ApprovalStatus = 'none' | 'accepted' | 'declined'

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
}

export const CLIENT_APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  none: 'No response',
  accepted: 'Accepted',
  declined: 'Declined',
}

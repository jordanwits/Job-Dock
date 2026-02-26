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
  notes?: string
  dueDate?: string
  paymentTerms?: string
  paidAmount: number
  trackResponse?: boolean
  trackPayment?: boolean
  createdAt: string
  updatedAt: string
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
}

export interface UpdateInvoiceData extends Partial<CreateInvoiceData> {
  id: string
  approvalStatus?: ApprovalStatus
}

export type InvoiceStatus = 'draft' | 'sent' | 'overdue' | 'cancelled'
export type PaymentStatus = 'pending' | 'partial' | 'paid'
export type ApprovalStatus = 'none' | 'accepted' | 'declined'


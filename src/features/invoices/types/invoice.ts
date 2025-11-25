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
  contactId: string
  contactName?: string
  contactEmail?: string
  contactCompany?: string
  lineItems: InvoiceLineItem[]
  subtotal: number
  taxRate: number
  taxAmount: number
  discount: number
  total: number
  status: 'draft' | 'sent' | 'overdue' | 'cancelled'
  paymentStatus: 'pending' | 'partial' | 'paid'
  notes?: string
  dueDate?: string
  paymentTerms?: string
  paidAmount: number
  createdAt: string
  updatedAt: string
}

export interface CreateInvoiceData {
  contactId: string
  lineItems: Omit<InvoiceLineItem, 'id' | 'total'>[]
  taxRate?: number
  discount?: number
  notes?: string
  dueDate?: string
  paymentTerms?: string
  status?: 'draft' | 'sent' | 'overdue' | 'cancelled'
  paymentStatus?: 'pending' | 'partial' | 'paid'
}

export interface UpdateInvoiceData extends Partial<CreateInvoiceData> {
  id: string
}

export type InvoiceStatus = 'draft' | 'sent' | 'overdue' | 'cancelled'
export type PaymentStatus = 'pending' | 'partial' | 'paid'


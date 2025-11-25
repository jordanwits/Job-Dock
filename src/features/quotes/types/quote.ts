export interface QuoteLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export interface Quote {
  id: string
  quoteNumber: string
  contactId: string
  contactName?: string
  contactEmail?: string
  contactCompany?: string
  lineItems: QuoteLineItem[]
  subtotal: number
  taxRate: number
  taxAmount: number
  discount: number
  total: number
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
  notes?: string
  validUntil?: string
  createdAt: string
  updatedAt: string
}

export interface CreateQuoteData {
  contactId: string
  lineItems: Omit<QuoteLineItem, 'id' | 'total'>[]
  taxRate?: number
  discount?: number
  notes?: string
  validUntil?: string
  status?: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
}

export interface UpdateQuoteData extends Partial<CreateQuoteData> {
  id: string
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'


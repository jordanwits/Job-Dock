import { create } from 'zustand'
import { invoicesService } from '@/lib/api/services'
import type { Invoice, CreateInvoiceData, UpdateInvoiceData } from '../types/invoice'
import type { Quote } from '@/features/quotes/types/quote'

interface InvoiceState {
  invoices: Invoice[]
  selectedInvoice: Invoice | null
  isLoading: boolean
  error: string | null
  searchQuery: string
  statusFilter: 'all' | 'draft' | 'sent' | 'overdue' | 'cancelled'
  paymentStatusFilter: 'all' | 'pending' | 'partial' | 'paid'
  
  // Actions
  fetchInvoices: () => Promise<void>
  getInvoiceById: (id: string) => Promise<void>
  createInvoice: (data: CreateInvoiceData) => Promise<Invoice>
  updateInvoice: (data: UpdateInvoiceData) => Promise<void>
  deleteInvoice: (id: string) => Promise<void>
  sendInvoice: (id: string) => Promise<void>
  convertQuoteToInvoice: (quote: Quote, options?: { paymentTerms?: string; dueDate?: string }) => Promise<Invoice>
  setSelectedInvoice: (invoice: Invoice | null) => void
  setSearchQuery: (query: string) => void
  setStatusFilter: (status: 'all' | 'draft' | 'sent' | 'overdue' | 'cancelled') => void
  setPaymentStatusFilter: (status: 'all' | 'pending' | 'partial' | 'paid') => void
  clearError: () => void
}

export const useInvoiceStore = create<InvoiceState>((set, get) => ({
  invoices: [],
  selectedInvoice: null,
  isLoading: false,
  error: null,
  searchQuery: '',
  statusFilter: 'all',
  paymentStatusFilter: 'all',

  fetchInvoices: async () => {
    set({ isLoading: true, error: null })
    try {
      const invoices = await invoicesService.getAll()
      set({ invoices, isLoading: false })
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch invoices',
        isLoading: false,
      })
    }
  },

  getInvoiceById: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const invoice = await invoicesService.getById(id)
      set({ selectedInvoice: invoice, isLoading: false })
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch invoice',
        isLoading: false,
      })
    }
  },

  createInvoice: async (data: CreateInvoiceData) => {
    set({ isLoading: true, error: null })
    try {
      const newInvoice = await invoicesService.create(data)
      set((state) => ({
        invoices: [newInvoice, ...state.invoices],
        isLoading: false,
      }))
      return newInvoice
    } catch (error: any) {
      set({
        error: error.message || 'Failed to create invoice',
        isLoading: false,
      })
      throw error
    }
  },

  updateInvoice: async (data: UpdateInvoiceData) => {
    set({ isLoading: true, error: null })
    try {
      const updatedInvoice = await invoicesService.update(data.id, data)
      set((state) => ({
        invoices: state.invoices.map((i) =>
          i.id === data.id ? updatedInvoice : i
        ),
        selectedInvoice:
          state.selectedInvoice?.id === data.id
            ? updatedInvoice
            : state.selectedInvoice,
        isLoading: false,
      }))
    } catch (error: any) {
      set({
        error: error.message || 'Failed to update invoice',
        isLoading: false,
      })
      throw error
    }
  },

  deleteInvoice: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await invoicesService.delete(id)
      set((state) => ({
        invoices: state.invoices.filter((i) => i.id !== id),
        selectedInvoice:
          state.selectedInvoice?.id === id ? null : state.selectedInvoice,
        isLoading: false,
      }))
    } catch (error: any) {
      set({
        error: error.message || 'Failed to delete invoice',
        isLoading: false,
      })
      throw error
    }
  },

  sendInvoice: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const updatedInvoice = await invoicesService.send(id)
      set((state) => ({
        invoices: state.invoices.map((i) =>
          i.id === id ? updatedInvoice : i
        ),
        selectedInvoice:
          state.selectedInvoice?.id === id
            ? updatedInvoice
            : state.selectedInvoice,
        isLoading: false,
      }))
    } catch (error: any) {
      set({
        error: error.message || 'Failed to send invoice',
        isLoading: false,
      })
      throw error
    }
  },

  convertQuoteToInvoice: async (quote: Quote, options?: { paymentTerms?: string; dueDate?: string }) => {
    set({ isLoading: true, error: null })
    try {
      // Calculate due date from payment terms if not provided
      let dueDate = options?.dueDate
      if (!dueDate && options?.paymentTerms) {
        // Parse payment terms like "Net 30" to calculate due date
        const netMatch = options.paymentTerms.match(/Net\s+(\d+)/i)
        if (netMatch) {
          const days = parseInt(netMatch[1], 10)
          const date = new Date()
          date.setDate(date.getDate() + days)
          dueDate = date.toISOString().split('T')[0]
        }
      }
      // Default to 30 days from now if no due date
      if (!dueDate) {
        const date = new Date()
        date.setDate(date.getDate() + 30)
        dueDate = date.toISOString().split('T')[0]
      }

      const invoiceData: CreateInvoiceData = {
        contactId: quote.contactId,
        lineItems: quote.lineItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        taxRate: quote.taxRate,
        discount: quote.discount,
        notes: quote.notes ? `Converted from ${quote.quoteNumber}\n\n${quote.notes}` : `Converted from ${quote.quoteNumber}`,
        dueDate,
        paymentTerms: options?.paymentTerms || 'Net 30',
        status: 'draft',
        paymentStatus: 'pending',
      }

      const newInvoice = await invoicesService.create(invoiceData)
      set((state) => ({
        invoices: [newInvoice, ...state.invoices],
        isLoading: false,
      }))
      return newInvoice
    } catch (error: any) {
      set({
        error: error.message || 'Failed to convert quote to invoice',
        isLoading: false,
      })
      throw error
    }
  },

  setSelectedInvoice: (invoice: Invoice | null) => {
    set({ selectedInvoice: invoice })
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query })
  },

  setStatusFilter: (status: 'all' | 'draft' | 'sent' | 'overdue' | 'cancelled') => {
    set({ statusFilter: status })
  },

  setPaymentStatusFilter: (status: 'all' | 'pending' | 'partial' | 'paid') => {
    set({ paymentStatusFilter: status })
  },

  clearError: () => {
    set({ error: null })
  },
}))


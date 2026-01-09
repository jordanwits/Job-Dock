import { create } from 'zustand'
import { quotesService } from '@/lib/api/services'
import type { Quote, CreateQuoteData, UpdateQuoteData } from '../types/quote'

interface QuoteState {
  quotes: Quote[]
  selectedQuote: Quote | null
  isLoading: boolean
  error: string | null
  searchQuery: string
  statusFilter: 'all' | 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
  
  // Actions
  fetchQuotes: () => Promise<void>
  getQuoteById: (id: string) => Promise<void>
  createQuote: (data: CreateQuoteData) => Promise<Quote>
  updateQuote: (data: UpdateQuoteData) => Promise<void>
  deleteQuote: (id: string) => Promise<void>
  sendQuote: (id: string) => Promise<void>
  setSelectedQuote: (quote: Quote | null) => void
  setSearchQuery: (query: string) => void
  setStatusFilter: (status: 'all' | 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired') => void
  clearError: () => void
}

export const useQuoteStore = create<QuoteState>((set, get) => ({
  quotes: [],
  selectedQuote: null,
  isLoading: false,
  error: null,
  searchQuery: '',
  statusFilter: 'all',

  fetchQuotes: async () => {
    set({ isLoading: true, error: null })
    try {
      const quotes = await quotesService.getAll()
      set({ quotes, isLoading: false })
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch quotes',
        isLoading: false,
      })
    }
  },

  getQuoteById: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const quote = await quotesService.getById(id)
      set({ selectedQuote: quote, isLoading: false })
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch quote',
        isLoading: false,
      })
    }
  },

  createQuote: async (data: CreateQuoteData) => {
    set({ isLoading: true, error: null })
    try {
      const newQuote = await quotesService.create(data)
      set((state) => ({
        quotes: [newQuote, ...state.quotes],
        isLoading: false,
      }))
      return newQuote
    } catch (error: any) {
      set({
        error: error.message || 'Failed to create quote',
        isLoading: false,
      })
      throw error
    }
  },

  updateQuote: async (data: UpdateQuoteData) => {
    set({ isLoading: true, error: null })
    try {
      const updatedQuote = await quotesService.update(data.id, data)
      set((state) => ({
        quotes: state.quotes.map((q) =>
          q.id === data.id ? updatedQuote : q
        ),
        selectedQuote:
          state.selectedQuote?.id === data.id
            ? updatedQuote
            : state.selectedQuote,
        isLoading: false,
      }))
    } catch (error: any) {
      set({
        error: error.message || 'Failed to update quote',
        isLoading: false,
      })
      throw error
    }
  },

  deleteQuote: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await quotesService.delete(id)
      set((state) => ({
        quotes: state.quotes.filter((q) => q.id !== id),
        selectedQuote:
          state.selectedQuote?.id === id ? null : state.selectedQuote,
        isLoading: false,
      }))
    } catch (error: any) {
      set({
        error: error.message || 'Failed to delete quote',
        isLoading: false,
      })
      throw error
    }
  },

  sendQuote: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const updatedQuote = await quotesService.send(id)
      set((state) => ({
        quotes: state.quotes.map((q) =>
          q.id === id ? updatedQuote : q
        ),
        selectedQuote:
          state.selectedQuote?.id === id
            ? updatedQuote
            : state.selectedQuote,
        isLoading: false,
      }))
    } catch (error: any) {
      set({
        error: error.message || 'Failed to send quote',
        isLoading: false,
      })
      throw error
    }
  },

  setSelectedQuote: (quote: Quote | null) => {
    set({ selectedQuote: quote })
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query })
  },

  setStatusFilter: (status: 'all' | 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired') => {
    set({ statusFilter: status })
  },

  clearError: () => {
    set({ error: null })
  },
}))


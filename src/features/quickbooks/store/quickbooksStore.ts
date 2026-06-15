import { create } from 'zustand'
import { quickbooksApi, type QuickBooksStatus } from '@/lib/api/quickbooks'

interface QuickBooksState {
  status: QuickBooksStatus | null
  loading: boolean
  error: string | null
  loadStatus: () => Promise<void>
  /** Redirects the browser to Intuit's consent screen. */
  startConnect: () => Promise<void>
  disconnect: () => Promise<void>
  syncInvoice: (invoiceId: string) => Promise<void>
}

export const useQuickBooksStore = create<QuickBooksState>((set, get) => ({
  status: null,
  loading: false,
  error: null,

  loadStatus: async () => {
    set({ loading: true, error: null })
    try {
      const status = await quickbooksApi.getStatus()
      set({ status, loading: false })
    } catch (err: any) {
      set({
        error: err?.response?.data?.message || 'Failed to load QuickBooks status',
        loading: false,
      })
    }
  },

  startConnect: async () => {
    const { url } = await quickbooksApi.getConnectUrl()
    window.location.href = url
  },

  disconnect: async () => {
    set({ loading: true, error: null })
    try {
      await quickbooksApi.disconnect()
      await get().loadStatus()
    } catch (err: any) {
      set({
        error: err?.response?.data?.message || 'Failed to disconnect QuickBooks',
        loading: false,
      })
    }
  },

  syncInvoice: async (invoiceId: string) => {
    await quickbooksApi.syncInvoice(invoiceId)
  },
}))

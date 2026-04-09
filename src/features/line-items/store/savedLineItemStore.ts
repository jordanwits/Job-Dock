import { create } from 'zustand'
import { savedLineItemsService } from '@/lib/api/services'
import type { SavedLineItem, CreateSavedLineItemData, UpdateSavedLineItemData } from '../types/savedLineItem'

interface SavedLineItemState {
  items: SavedLineItem[]
  isLoading: boolean
  error: string | null
  fetchItems: () => Promise<void>
  createItem: (data: CreateSavedLineItemData) => Promise<SavedLineItem | null>
  updateItem: (data: UpdateSavedLineItemData) => Promise<SavedLineItem | null>
  deleteItem: (id: string) => Promise<boolean>
  clearError: () => void
}

export const useSavedLineItemStore = create<SavedLineItemState>(set => ({
  items: [],
  isLoading: false,
  error: null,

  fetchItems: async () => {
    set({ isLoading: true, error: null })
    try {
      const items = (await savedLineItemsService.getAll()) as SavedLineItem[]
      set({ items, isLoading: false })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load saved line items'
      set({ error: message, isLoading: false })
    }
  },

  createItem: async data => {
    set({ isLoading: true, error: null })
    try {
      const created = (await savedLineItemsService.create(data)) as SavedLineItem
      set(state => ({
        items: [...state.items, created].sort((a, b) => a.name.localeCompare(b.name)),
        isLoading: false,
      }))
      return created
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create item'
      set({ error: message, isLoading: false })
      return null
    }
  },

  updateItem: async data => {
    set({ isLoading: true, error: null })
    try {
      const { id, ...rest } = data
      const updated = (await savedLineItemsService.update(id, rest)) as SavedLineItem
      set(state => ({
        items: state.items
          .map(item => (item.id === id ? updated : item))
          .sort((a, b) => a.name.localeCompare(b.name)),
        isLoading: false,
      }))
      return updated
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update item'
      set({ error: message, isLoading: false })
      return null
    }
  },

  deleteItem: async id => {
    set({ isLoading: true, error: null })
    try {
      await savedLineItemsService.delete(id)
      set(state => ({
        items: state.items.filter(item => item.id !== id),
        isLoading: false,
      }))
      return true
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete item'
      set({ error: message, isLoading: false })
      return false
    }
  },

  clearError: () => set({ error: null }),
}))

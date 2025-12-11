import { create } from 'zustand'
import { contactsService } from '@/lib/api/services'
import type { Contact, CreateContactData, UpdateContactData } from '../types/contact'

type ApiErrorShape = {
  response?: {
    data?: {
      error?: {
        message?: string
      }
    }
  }
  message?: string
}

const resolveErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object') {
    const parsed = error as ApiErrorShape
    const serverMessage = parsed.response?.data?.error?.message
    if (serverMessage) {
      return serverMessage
    }
    if (parsed.message) {
      return parsed.message
    }
  }
  return fallback
}

interface ContactState {
  contacts: Contact[]
  selectedContact: Contact | null
  isLoading: boolean
  error: string | null
  searchQuery: string
  statusFilter: 'all' | 'active' | 'inactive' | 'lead'
  
  // Actions
  fetchContacts: () => Promise<void>
  getContactById: (id: string) => Promise<void>
  createContact: (data: CreateContactData) => Promise<void>
  updateContact: (data: UpdateContactData) => Promise<void>
  deleteContact: (id: string) => Promise<void>
  setSelectedContact: (contact: Contact | null) => void
  setSearchQuery: (query: string) => void
  setStatusFilter: (status: 'all' | 'active' | 'inactive' | 'lead') => void
  clearError: () => void
}

export const useContactStore = create<ContactState>((set, _get) => ({
  contacts: [],
  selectedContact: null,
  isLoading: false,
  error: null,
  searchQuery: '',
  statusFilter: 'all',

  fetchContacts: async () => {
    set({ isLoading: true, error: null })
    try {
      const contacts = await contactsService.getAll()
      set({ contacts, isLoading: false })
    } catch (error: unknown) {
      const message = resolveErrorMessage(error, 'Failed to fetch contacts')
      set({
        error: message,
        isLoading: false,
      })
    }
  },

  getContactById: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const contact = await contactsService.getById(id)
      set({ selectedContact: contact, isLoading: false })
    } catch (error: unknown) {
      const message = resolveErrorMessage(error, 'Failed to fetch contact')
      set({
        error: message,
        isLoading: false,
      })
    }
  },

  createContact: async (data: CreateContactData) => {
    set({ isLoading: true, error: null })
    try {
      const newContact = await contactsService.create(data)
      set((state) => ({
        contacts: [newContact, ...state.contacts],
        isLoading: false,
      }))
      return Promise.resolve()
    } catch (error: unknown) {
      const message = resolveErrorMessage(error, 'Failed to create contact')
      set({
        error: message,
        isLoading: false,
      })
      throw error
    }
  },

  updateContact: async (data: UpdateContactData) => {
    set({ isLoading: true, error: null })
    try {
      const updatedContact = await contactsService.update(data.id, data)
      set((state) => ({
        contacts: state.contacts.map((c) =>
          c.id === data.id ? updatedContact : c
        ),
        selectedContact:
          state.selectedContact?.id === data.id
            ? updatedContact
            : state.selectedContact,
        isLoading: false,
      }))
    } catch (error: unknown) {
      const message = resolveErrorMessage(error, 'Failed to update contact')
      set({
        error: message,
        isLoading: false,
      })
      throw error
    }
  },

  deleteContact: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await contactsService.delete(id)
      set((state) => ({
        contacts: state.contacts.filter((c) => c.id !== id),
        selectedContact:
          state.selectedContact?.id === id ? null : state.selectedContact,
        isLoading: false,
      }))
    } catch (error: unknown) {
      const message = resolveErrorMessage(error, 'Failed to delete contact')
      set({
        error: message,
        isLoading: false,
      })
      throw error
    }
  },

  setSelectedContact: (contact: Contact | null) => {
    set({ selectedContact: contact })
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query })
  },

  setStatusFilter: (status: 'all' | 'active' | 'inactive' | 'lead') => {
    set({ statusFilter: status })
  },

  clearError: () => {
    set({ error: null })
  },
}))


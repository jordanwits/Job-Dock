import { create } from 'zustand'
import { servicesService } from '@/lib/api/services'
import type { Service, CreateServiceData, UpdateServiceData, ServiceBookingLink } from '../types/service'

interface ServiceState {
  services: Service[]
  selectedService: Service | null
  isLoading: boolean
  error: string | null
  
  // Actions
  fetchServices: () => Promise<void>
  getServiceById: (id: string) => Promise<void>
  createService: (data: CreateServiceData) => Promise<void>
  updateService: (data: UpdateServiceData) => Promise<void>
  deleteService: (id: string) => Promise<void>
  toggleServiceActive: (id: string) => Promise<void>
  getBookingLink: (id: string) => Promise<ServiceBookingLink>
  setSelectedService: (service: Service | null) => void
  clearError: () => void
}

export const useServiceStore = create<ServiceState>((set, get) => ({
  services: [],
  selectedService: null,
  isLoading: false,
  error: null,

  fetchServices: async () => {
    set({ isLoading: true, error: null })
    try {
      const services = await servicesService.getAll()
      set({ services, isLoading: false })
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch services',
        isLoading: false,
      })
    }
  },

  getServiceById: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const service = await servicesService.getById(id)
      set({ selectedService: service, isLoading: false })
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch service',
        isLoading: false,
      })
    }
  },

  createService: async (data: CreateServiceData) => {
    set({ isLoading: true, error: null })
    try {
      const newService = await servicesService.create(data)
      set((state) => ({
        services: [newService, ...state.services],
        isLoading: false,
      }))
      return Promise.resolve()
    } catch (error: any) {
      set({
        error: error.message || 'Failed to create service',
        isLoading: false,
      })
      throw error
    }
  },

  updateService: async (data: UpdateServiceData) => {
    set({ isLoading: true, error: null })
    try {
      const updatedService = await servicesService.update(data.id, data)
      set((state) => ({
        services: state.services.map((s) =>
          s.id === data.id ? updatedService : s
        ),
        selectedService:
          state.selectedService?.id === data.id
            ? updatedService
            : state.selectedService,
        isLoading: false,
      }))
    } catch (error: any) {
      set({
        error: error.message || 'Failed to update service',
        isLoading: false,
      })
      throw error
    }
  },

  deleteService: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await servicesService.delete(id)
      set((state) => ({
        services: state.services.filter((s) => s.id !== id),
        selectedService:
          state.selectedService?.id === id ? null : state.selectedService,
        isLoading: false,
      }))
    } catch (error: any) {
      set({
        error: error.message || 'Failed to delete service',
        isLoading: false,
      })
      throw error
    }
  },

  toggleServiceActive: async (id: string) => {
    const service = get().services.find((s) => s.id === id)
    if (!service) return

    set({ isLoading: true, error: null })
    try {
      const updatedService = await servicesService.update(id, {
        isActive: !service.isActive,
      })
      set((state) => ({
        services: state.services.map((s) =>
          s.id === id ? updatedService : s
        ),
        selectedService:
          state.selectedService?.id === id
            ? updatedService
            : state.selectedService,
        isLoading: false,
      }))
    } catch (error: any) {
      set({
        error: error.message || 'Failed to update service',
        isLoading: false,
      })
    }
  },

  getBookingLink: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const link = await servicesService.getBookingLink(id)
      set({ isLoading: false })
      return link
    } catch (error: any) {
      set({
        error: error.message || 'Failed to get booking link',
        isLoading: false,
      })
      throw error
    }
  },

  setSelectedService: (service: Service | null) => {
    set({ selectedService: service })
  },

  clearError: () => {
    set({ error: null })
  },
}))

